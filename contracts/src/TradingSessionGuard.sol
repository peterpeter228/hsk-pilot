// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface IV3Factory {
    function getPool(address, address, uint24) external view returns (address);
}

interface IV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function factory() external view returns (address);
    function WETH9() external view returns (address);
    function exactInputSingle(ExactInputSingleParams calldata) external payable returns (uint256);
}

/// @notice Single-owner bounded execution. No independent oracle/fair-price guarantee.
/// @dev Deployment identity checks do not certify dependency bytecode or upgrade safety:
///      fresh read-only preflight and fixed-block integration tests remain mandatory.
contract TradingSessionGuard is Ownable2Step, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    enum Mode {
        BOUNDED_EXECUTION,
        ORACLE_GUARDED
    }
    enum Status {
        PAUSED,
        ACTIVE,
        REDUCE_ONLY,
        EXPIRED
    }

    struct SessionPolicy {
        Mode mode;
        uint64 validAfter;
        uint64 validUntil;
        address strategySigner;
        address riskSigner;
        bytes32 strategyPolicyHash;
        uint256 maxBuyPerTradeQuoteRaw;
        uint256 maxSessionGrossBuyQuoteRaw;
        uint256 maxUtcDayGrossBuyQuoteRaw;
        uint256 maxRiskInventoryRaw;
        uint256 maxSellPerTradeRiskRaw;
        uint32 minTradeIntervalSec;
        uint16 maxQuoteSlippageBps;
        uint32 maxQuoteAgeSec;
        uint32 maxIntentTtlSec;
        uint256 exitMaxPerTradeRiskRaw;
        uint32 exitMinIntervalSec;
        uint64 exitValidUntil;
    }

    // Keep field types/order identical to config/trade-intent-types.json.
    struct TradeIntent {
        uint64 sessionId;
        uint32 policyVersion;
        bytes32 strategyPolicyHash;
        uint256 intentNonce;
        uint8 direction;
        uint256 amountInRaw;
        uint256 referenceAmountOutRaw;
        uint256 amountOutMinimumRaw;
        uint64 quoteObservedAt;
        uint256 quoteBlockNumber;
        bytes32 quoteBlockHash;
        uint64 deadline;
        bytes32 evidenceHash;
    }
    bytes32 public constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(uint64 sessionId,uint32 policyVersion,bytes32 strategyPolicyHash,uint256 intentNonce,uint8 direction,uint256 amountInRaw,uint256 referenceAmountOutRaw,uint256 amountOutMinimumRaw,uint64 quoteObservedAt,uint256 quoteBlockNumber,bytes32 quoteBlockHash,uint64 deadline,bytes32 evidenceHash)"
    );
    uint16 public constant HARD_MAX_QUOTE_SLIPPAGE_BPS = 1000;
    IERC20 public immutable riskToken;
    IERC20 public immutable quoteToken;
    ISwapRouter02 public immutable router;
    address public immutable factory;
    address public immutable pool;
    uint24 public immutable poolFee;
    uint8 public immutable riskDecimals;
    uint8 public immutable quoteDecimals;
    SessionPolicy public policy;
    Status private _status;
    uint64 public sessionId;
    uint32 public policyVersion;
    uint256 public intentNonce;
    uint256 public allocatedQuoteRaw;
    uint256 public allocatedRiskRaw;
    uint256 public sessionGrossBuyQuoteRaw;
    mapping(uint256 utcDay => uint256 grossBuyQuoteRaw) public utcDayGrossBuyQuoteRaw;
    uint256 public lastTradeAt;
    uint256 public lastExitAt;

    error InvalidConfiguration();
    error UnsupportedOracleMode();
    error InvalidState();
    error InvalidIntent();
    error InvalidSignatures();
    error BudgetExceeded();
    error InvalidBalanceDelta();
    error AllocationNotCovered();
    error OwnershipRenunciationDisabled();
    error NativeTransferFailed();

    event SessionStarted(
        uint64 indexed sessionId,
        uint32 policyVersion,
        bytes32 indexed strategyPolicyHash,
        uint256 allocatedQuoteRaw,
        uint256 allocatedRiskRaw
    );
    event SessionClosed(
        uint64 indexed sessionId, uint32 policyVersion, uint256 closingQuoteRaw, uint256 closingRiskRaw
    );
    event ReducedOnly(uint64 indexed sessionId, bytes32 reasonCode, bytes32 evidenceHash);
    event Withdrawn(address indexed token, address indexed recipient, uint256 amountRaw);
    event TradeExecuted(
        bytes32 indexed intentHash,
        uint64 indexed sessionId,
        uint32 policyVersion,
        uint8 direction,
        uint256 amountInRaw,
        uint256 actualOutRaw,
        bytes32 evidenceHash,
        address strategySigner,
        address riskSigner
    );

    constructor(
        address initialOwner,
        address risk,
        address quote,
        address fixedRouter,
        address fixedFactory,
        address fixedPool,
        uint24 fee_
    ) Ownable(initialOwner) EIP712("HSKPilotGuard", "1") {
        if (
            risk == quote || risk.code.length == 0 || quote.code.length == 0 || fixedRouter.code.length == 0
                || fixedFactory.code.length == 0 || fixedPool.code.length == 0
        ) revert InvalidConfiguration();
        if (
            ISwapRouter02(fixedRouter).factory() != fixedFactory || ISwapRouter02(fixedRouter).WETH9() != risk
                || IV3Factory(fixedFactory).getPool(risk, quote, fee_) != fixedPool
        ) revert InvalidConfiguration();
        address a = IV3Pool(fixedPool).token0();
        address b = IV3Pool(fixedPool).token1();
        if (!((a == risk && b == quote) || (a == quote && b == risk)) || IV3Pool(fixedPool).fee() != fee_) {
            revert InvalidConfiguration();
        }
        uint8 rd = IERC20Metadata(risk).decimals();
        uint8 qd = IERC20Metadata(quote).decimals();
        if (rd != 18 || qd != 6) revert InvalidConfiguration();
        riskToken = IERC20(risk);
        quoteToken = IERC20(quote);
        router = ISwapRouter02(fixedRouter);
        factory = fixedFactory;
        pool = fixedPool;
        poolFee = fee_;
        riskDecimals = rd;
        quoteDecimals = qd;
    }

    function status() public view returns (Status) {
        if (_status == Status.ACTIVE && block.timestamp > policy.validUntil) return Status.EXPIRED;
        return _status;
    }

    /// @notice Policy/role/mode/allocation changes require closing and explicitly opening a new session.
    ///         UTC daily spend is account-wide and is deliberately not reset here.
    function startSession(SessionPolicy calldata p, uint256 quoteAllocation, uint256 riskAllocation)
        external
        onlyOwner
        nonReentrant
    {
        if (_status != Status.PAUSED || pendingOwner() != address(0)) revert InvalidState();
        _validatePolicy(p);
        if (riskAllocation > p.maxRiskInventoryRaw) revert InvalidConfiguration();
        if (
            quoteAllocation > quoteToken.balanceOf(address(this)) || riskAllocation > riskToken.balanceOf(address(this))
        ) revert AllocationNotCovered();
        // Close accounting of any previously retained allocation without treating it as new P&L.
        if (allocatedQuoteRaw != 0 || allocatedRiskRaw != 0) {
            emit SessionClosed(sessionId, policyVersion, allocatedQuoteRaw, allocatedRiskRaw);
        }
        policy = p;
        sessionId++;
        policyVersion++;
        intentNonce = 0;
        allocatedQuoteRaw = quoteAllocation;
        allocatedRiskRaw = riskAllocation;
        sessionGrossBuyQuoteRaw = 0;
        lastTradeAt = 0;
        lastExitAt = 0;
        _status = Status.ACTIVE;
        emit SessionStarted(sessionId, policyVersion, p.strategyPolicyHash, quoteAllocation, riskAllocation);
    }

    event PolicyUpdated(uint64 indexed sessionId, uint32 policyVersion, bytes32 indexed strategyPolicyHash);

    /// @notice Same-session owner policy/role change. Spend, allocation and cooldown counters never reset.
    ///         Does not restore ACTIVE from REDUCE_ONLY or PAUSED; mode changes require a new session.
    function updatePolicy(SessionPolicy calldata p) external onlyOwner nonReentrant {
        if (_status == Status.PAUSED || pendingOwner() != address(0) || block.timestamp > policy.validUntil) {
            revert InvalidState();
        }
        _validatePolicy(p);
        if (p.mode != policy.mode) revert InvalidConfiguration();
        policy = p;
        policyVersion++;
        emit PolicyUpdated(sessionId, policyVersion, p.strategyPolicyHash);
    }

    function _validatePolicy(SessionPolicy calldata p) private view {
        if (p.mode != Mode.BOUNDED_EXECUTION) revert UnsupportedOracleMode();
        if (
            p.strategySigner == address(0) || p.riskSigner == address(0) || p.strategySigner == p.riskSigner
                || p.strategyPolicyHash == bytes32(0) || p.validUntil <= block.timestamp || p.validUntil <= p.validAfter
                || p.exitValidUntil < p.validUntil || p.maxBuyPerTradeQuoteRaw == 0
                || p.maxBuyPerTradeQuoteRaw > p.maxSessionGrossBuyQuoteRaw || p.maxUtcDayGrossBuyQuoteRaw == 0
                || p.maxRiskInventoryRaw == 0 || p.maxSellPerTradeRiskRaw == 0 || p.exitMaxPerTradeRiskRaw == 0
                || p.maxQuoteAgeSec == 0 || p.maxIntentTtlSec == 0
                || p.maxQuoteSlippageBps > HARD_MAX_QUOTE_SLIPPAGE_BPS
        ) revert InvalidConfiguration();
    }

    function hashIntent(TradeIntent calldata i) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(TRADE_INTENT_TYPEHASH, i)));
    }

    function execute(TradeIntent calldata i, bytes calldata strategySignature, bytes calldata riskSignature)
        external
        nonReentrant
        returns (uint256 actualOutRaw)
    {
        SessionPolicy memory p = policy;
        Status s = status();
        bool exiting = s == Status.REDUCE_ONLY || s == Status.EXPIRED;
        if (
            s == Status.PAUSED || block.timestamp < p.validAfter
                || (exiting && (i.direction != 1 || block.timestamp > p.exitValidUntil))
        ) revert InvalidState();
        if (p.mode != Mode.BOUNDED_EXECUTION) revert UnsupportedOracleMode();
        if (
            i.sessionId != sessionId || i.policyVersion != policyVersion || i.strategyPolicyHash != p.strategyPolicyHash
                || i.intentNonce != intentNonce || i.direction > 1 || i.amountInRaw == 0 || i.referenceAmountOutRaw == 0
                || i.amountOutMinimumRaw == 0 || i.deadline < block.timestamp || i.quoteObservedAt > block.timestamp
                || i.deadline < i.quoteObservedAt || uint256(i.deadline) - i.quoteObservedAt > p.maxIntentTtlSec
                || block.timestamp - i.quoteObservedAt > p.maxQuoteAgeSec || i.quoteBlockNumber > block.number
                || i.quoteBlockHash == bytes32(0)
                || i.amountOutMinimumRaw < Math.mulDiv(i.referenceAmountOutRaw, 10000 - p.maxQuoteSlippageBps, 10000)
        ) revert InvalidIntent();
        bytes32 digest = hashIntent(i);
        if (
            ECDSA.recover(digest, strategySignature) != p.strategySigner
                || ECDSA.recover(digest, riskSignature) != p.riskSigner
        ) revert InvalidSignatures();
        _checkCoverage();
        if (exiting) {
            if (
                i.amountInRaw > p.exitMaxPerTradeRiskRaw
                    || (lastExitAt != 0 && block.timestamp < lastExitAt + p.exitMinIntervalSec)
            ) revert BudgetExceeded();
            lastExitAt = block.timestamp;
        } else {
            if (lastTradeAt != 0 && block.timestamp < lastTradeAt + p.minTradeIntervalSec) revert BudgetExceeded();
            lastTradeAt = block.timestamp;
            if (i.direction == 1 && i.amountInRaw > p.maxSellPerTradeRiskRaw) revert BudgetExceeded();
        }
        if (i.direction == 0) {
            if (
                i.amountInRaw > allocatedQuoteRaw || i.amountInRaw > p.maxBuyPerTradeQuoteRaw
                    || sessionGrossBuyQuoteRaw > p.maxSessionGrossBuyQuoteRaw
                    || i.amountInRaw > p.maxSessionGrossBuyQuoteRaw - sessionGrossBuyQuoteRaw
                    || utcDayGrossBuyQuoteRaw[block.timestamp / 1 days] > p.maxUtcDayGrossBuyQuoteRaw
                    || i.amountInRaw > p.maxUtcDayGrossBuyQuoteRaw - utcDayGrossBuyQuoteRaw[block.timestamp / 1 days]
            ) revert BudgetExceeded();
            sessionGrossBuyQuoteRaw += i.amountInRaw;
            utcDayGrossBuyQuoteRaw[block.timestamp / 1 days] += i.amountInRaw;
        } else if (i.amountInRaw > allocatedRiskRaw) {
            revert BudgetExceeded();
        }
        intentNonce++;
        IERC20 input = i.direction == 0 ? quoteToken : riskToken;
        IERC20 output = i.direction == 0 ? riskToken : quoteToken;
        uint256 beforeIn = input.balanceOf(address(this));
        uint256 beforeOut = output.balanceOf(address(this));
        input.forceApprove(address(router), i.amountInRaw);
        router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams(
                address(input), address(output), poolFee, address(this), i.amountInRaw, i.amountOutMinimumRaw, 0
            )
        );
        input.forceApprove(address(router), 0);
        uint256 afterIn = input.balanceOf(address(this));
        uint256 afterOut = output.balanceOf(address(this));
        if (
            afterIn > beforeIn || beforeIn - afterIn != i.amountInRaw || afterOut < beforeOut
                || afterOut - beforeOut < i.amountOutMinimumRaw || input.allowance(address(this), address(router)) != 0
        ) revert InvalidBalanceDelta();
        actualOutRaw = afterOut - beforeOut;
        if (i.direction == 0) {
            allocatedQuoteRaw -= i.amountInRaw;
            allocatedRiskRaw += actualOutRaw;
            if (allocatedRiskRaw > p.maxRiskInventoryRaw) revert BudgetExceeded();
        } else {
            allocatedRiskRaw -= i.amountInRaw;
            allocatedQuoteRaw += actualOutRaw;
        }
        _checkCoverage();
        emit TradeExecuted(
            digest,
            sessionId,
            policyVersion,
            i.direction,
            i.amountInRaw,
            actualOutRaw,
            i.evidenceHash,
            p.strategySigner,
            p.riskSigner
        );
    }

    /// @notice Separate persistent action; a later failing swap cannot roll this state back.
    function enterReduceOnly(bytes32 reasonCode, bytes32 evidenceHash) external nonReentrant {
        if (msg.sender != owner() && msg.sender != policy.riskSigner) revert InvalidSignatures();
        if (_status == Status.PAUSED) revert InvalidState();
        if (_status == Status.REDUCE_ONLY) return;
        _status = Status.REDUCE_ONLY;
        emit ReducedOnly(sessionId, reasonCode, evidenceHash);
    }

    function pause() external onlyOwner nonReentrant {
        _close();
    }

    function _close() private {
        _status = Status.PAUSED;
        policyVersion++;
        emit SessionClosed(sessionId, policyVersion, allocatedQuoteRaw, allocatedRiskRaw);
    }

    function _checkCoverage() private view {
        if (
            quoteToken.balanceOf(address(this)) < allocatedQuoteRaw
                || riskToken.balanceOf(address(this)) < allocatedRiskRaw
        ) revert AllocationNotCovered();
    }

    function withdrawAllocated() external onlyOwner nonReentrant {
        _close();
        uint256 q = allocatedQuoteRaw;
        uint256 r = allocatedRiskRaw;
        allocatedQuoteRaw = 0;
        allocatedRiskRaw = 0;
        _withdraw(quoteToken, q);
        _withdraw(riskToken, r);
    }

    function withdrawAll() external onlyOwner nonReentrant {
        _close();
        allocatedQuoteRaw = 0;
        allocatedRiskRaw = 0;
        _withdraw(quoteToken, quoteToken.balanceOf(address(this)));
        _withdraw(riskToken, riskToken.balanceOf(address(this)));
    }

    /// @notice Independent per-token recovery; unknown token failure cannot block other withdrawals.
    function recoverToken(address token) external onlyOwner nonReentrant {
        _close();
        // Closing releases both allocations before an owner capital withdrawal.
        allocatedQuoteRaw = 0;
        allocatedRiskRaw = 0;
        _withdraw(IERC20(token), IERC20(token).balanceOf(address(this)));
    }

    function _withdraw(IERC20 token, uint256 amount) private {
        if (amount != 0) token.safeTransfer(owner(), amount);
        emit Withdrawn(address(token), owner(), amount);
    }

    function withdrawNative() external onlyOwner nonReentrant {
        _close();
        uint256 amount = address(this).balance;
        (bool ok,) = payable(owner()).call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
        emit Withdrawn(address(0), owner(), amount);
    }

    function transferOwnership(address newOwner) public override onlyOwner nonReentrant {
        if (newOwner == address(0)) revert InvalidConfiguration();
        _close();
        super.transferOwnership(newOwner);
    }

    function acceptOwnership() public override nonReentrant {
        _close();
        super.acceptOwnership();
    }

    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }
    receive() external payable {}
}
