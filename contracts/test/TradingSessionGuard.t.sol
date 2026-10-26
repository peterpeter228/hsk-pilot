// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {TradingSessionGuard, ISwapRouter02} from "../src/TradingSessionGuard.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface Vm {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function warp(uint256) external;
    function roll(uint256) external;
    function chainId(uint256) external;
    function prank(address) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
    function deal(address, uint256) external;
    function etch(address, bytes calldata) external;
    function readFile(string calldata) external view returns (string memory);
    function parseJsonBytes32(string calldata, string calldata) external pure returns (bytes32);
}

contract MockToken is ERC20 {
    uint8 private immutable _dec;

    constructor(uint8 d) ERC20("Local synthetic token", "MOCK") {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 n) external {
        _mint(to, n);
    }

    function burn(address who, uint256 n) external {
        _burn(who, n);
    }
}

contract MockPool {
    address public token0;
    address public token1;
    uint24 public fee = 3000;

    constructor(address a, address b) {
        token0 = a;
        token1 = b;
    }

    function pay(address token, address to, uint256 n) external {
        require(IERC20(token).transfer(to, n), "mock transfer failed");
    }
}

contract MockFactory {
    address public pool;

    constructor(address p) {
        pool = p;
    }

    function getPool(address, address, uint24) external view returns (address) {
        return pool;
    }
}

contract MockRouter is ISwapRouter02 {
    address public immutable factory;
    address public immutable WETH9;
    MockPool public immutable pool;
    uint256 public output;
    uint256 public inputShortfall;
    bool public shouldRevert;
    bool public callbackEnabled;
    bool public callbackSucceeded;
    uint256 public observedAllowance;

    constructor(address f, address r, MockPool p) {
        factory = f;
        WETH9 = r;
        pool = p;
    }

    function configure(uint256 out, uint256 shortfall, bool fail) external {
        output = out;
        inputShortfall = shortfall;
        shouldRevert = fail;
    }

    function enableCallback() external {
        callbackEnabled = true;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256) {
        require(!shouldRevert, "synthetic router failure");
        require(p.recipient == msg.sender && p.fee == 3000 && p.sqrtPriceLimitX96 == 0, "route changed");
        require(
            (p.tokenIn == pool.token0() && p.tokenOut == pool.token1())
                || (p.tokenIn == pool.token1() && p.tokenOut == pool.token0()),
            "bad pair"
        );
        observedAllowance = IERC20(p.tokenIn).allowance(msg.sender, address(this));
        if (callbackEnabled) (callbackSucceeded,) = msg.sender.call(abi.encodeCall(TradingSessionGuard.pause, ()));
        require(
            IERC20(p.tokenIn).transferFrom(msg.sender, address(pool), p.amountIn - inputShortfall),
            "mock transferFrom failed"
        );
        pool.pay(p.tokenOut, p.recipient, output);
        return type(uint256).max; // Intentionally false: accounting must ignore router return.
    }
}

abstract contract GuardBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    // Public synthetic local-test keys only; never load wallet secrets or broadcast.
    uint256 internal constant STRATEGY_KEY = 0x12345;
    uint256 internal constant RISK_KEY = 0x67890;
    MockToken internal risk;
    MockToken internal quote;
    MockPool internal pool;
    MockFactory internal factory;
    MockRouter internal router;
    TradingSessionGuard internal guard;
    TradingSessionGuard.SessionPolicy internal p;

    function setUp() public {
        vm.warp(1_800_000_000);
        vm.roll(100);
        vm.chainId(31337);
        risk = new MockToken(18);
        quote = new MockToken(6);
        pool = new MockPool(address(risk), address(quote));
        factory = new MockFactory(address(pool));
        router = new MockRouter(address(factory), address(risk), pool);
        guard = new TradingSessionGuard(
            address(this), address(risk), address(quote), address(router), address(factory), address(pool), 3000
        );
        quote.mint(address(guard), 100e6);
        risk.mint(address(guard), 10e18);
        quote.mint(address(pool), 1_000_000e6);
        risk.mint(address(pool), 1_000_000e18);
        p = TradingSessionGuard.SessionPolicy(
            TradingSessionGuard.Mode.BOUNDED_EXECUTION,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            vm.addr(STRATEGY_KEY),
            vm.addr(RISK_KEY),
            keccak256("policy-v1"),
            10e6,
            20e6,
            30e6,
            100e18,
            5e18,
            60,
            100,
            30,
            60,
            10e18,
            5,
            uint64(block.timestamp + 2 days)
        );
        guard.startSession(p, 100e6, 10e18);
    }

    function _intent(uint8 dir, uint256 amount, uint256 out)
        internal
        view
        returns (TradingSessionGuard.TradeIntent memory)
    {
        return TradingSessionGuard.TradeIntent(
            guard.sessionId(),
            guard.policyVersion(),
            p.strategyPolicyHash,
            guard.intentNonce(),
            dir,
            amount,
            out,
            out,
            uint64(block.timestamp),
            block.number,
            keccak256("synthetic-block"),
            uint64(block.timestamp + 30),
            keccak256("synthetic-evidence")
        );
    }

    function _sig(bytes32 digest, uint256 key) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signed(TradingSessionGuard.TradeIntent memory i) internal returns (bytes memory a, bytes memory b) {
        bytes32 h = guard.hashIntent(i);
        return (_sig(h, STRATEGY_KEY), _sig(h, RISK_KEY));
    }

    function _exec(TradingSessionGuard.TradeIntent memory i) internal returns (uint256) {
        (bytes memory a, bytes memory b) = _signed(i);
        return guard.execute(i, a, b);
    }

    function _reject(TradingSessionGuard.TradeIntent memory i, bytes4 err) internal {
        (bytes memory a, bytes memory b) = _signed(i);
        vm.expectRevert(err);
        guard.execute(i, a, b);
    }

    function _buy() internal {
        router.configure(1e18, 0, false);
        _exec(_intent(0, 10e6, 1e18));
    }

    function _eq(uint256 a, uint256 b) internal pure {
        require(a == b, "assert equal");
    }
}

contract GuardTest is GuardBase {
    function testBuySellActualDeltaFixedPoolAndAllowance() public {
        uint256 beforePool = quote.balanceOf(address(pool));
        _buy();
        _eq(guard.allocatedQuoteRaw(), 90e6);
        _eq(guard.allocatedRiskRaw(), 11e18);
        _eq(guard.intentNonce(), 1);
        _eq(quote.balanceOf(address(pool)) - beforePool, 10e6);
        _eq(quote.balanceOf(address(router)), 0);
        _eq(router.observedAllowance(), 10e6);
        _eq(quote.allowance(address(guard), address(router)), 0);
        vm.warp(block.timestamp + 60);
        router.configure(12e6, 0, false);
        _eq(_exec(_intent(1, 1e18, 12e6)), 12e6);
        _eq(guard.allocatedQuoteRaw(), 102e6);
        _eq(guard.allocatedRiskRaw(), 10e18);
        _eq(guard.sessionGrossBuyQuoteRaw(), 10e6);
        _eq(risk.allowance(address(guard), address(router)), 0);
    }

    function testMissingWrongAndSwappedRoleSignatures() public {
        TradingSessionGuard.TradeIntent memory i = _intent(0, 1e6, 1e18);
        (bytes memory a, bytes memory b) = _signed(i);
        vm.expectRevert();
        guard.execute(i, a, hex"");
        vm.expectRevert();
        guard.execute(i, hex"", b);
        vm.expectRevert(TradingSessionGuard.InvalidSignatures.selector);
        guard.execute(i, b, a);
        vm.expectRevert(TradingSessionGuard.InvalidSignatures.selector);
        guard.execute(i, a, a);
        _eq(guard.intentNonce(), 0);
        _eq(guard.sessionGrossBuyQuoteRaw(), 0);
    }

    function testDistinctNonzeroRolesRequired() public {
        guard.pause();
        p.riskSigner = p.strategySigner;
        vm.expectRevert(TradingSessionGuard.InvalidConfiguration.selector);
        guard.startSession(p, 1, 0);
        p.riskSigner = address(0);
        vm.expectRevert(TradingSessionGuard.InvalidConfiguration.selector);
        guard.startSession(p, 1, 0);
    }

    function testReplayNonceSessionVersionChainAndContract() public {
        TradingSessionGuard.TradeIntent memory i = _intent(0, 10e6, 1e18);
        (bytes memory a, bytes memory b) = _signed(i);
        router.configure(1e18, 0, false);
        guard.execute(i, a, b);
        vm.expectRevert(TradingSessionGuard.InvalidIntent.selector);
        guard.execute(i, a, b);
        guard.pause();
        guard.startSession(p, 90e6, 11e18);
        vm.expectRevert(TradingSessionGuard.InvalidIntent.selector);
        guard.execute(i, a, b);
        i = _intent(0, 1e6, 1e18);
        (a, b) = _signed(i);
        vm.chainId(177);
        vm.expectRevert(TradingSessionGuard.InvalidSignatures.selector);
        guard.execute(i, a, b);
        vm.chainId(31337);
        TradingSessionGuard other = new TradingSessionGuard(
            address(this), address(risk), address(quote), address(router), address(factory), address(pool), 3000
        );
        require(guard.hashIntent(i) != other.hashIntent(i), "cross-contract digest");
        i.policyVersion--;
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
    }

    function testEveryIntentFieldBoundByBothSignatures() public {
        TradingSessionGuard.TradeIntent memory i = _intent(0, 1e6, 1e18);
        (bytes memory a, bytes memory b) = _signed(i);
        i.evidenceHash = keccak256("altered");
        vm.expectRevert(TradingSessionGuard.InvalidSignatures.selector);
        guard.execute(i, a, b);
    }

    function testMalformedMalleableSignatureRejected() public {
        TradingSessionGuard.TradeIntent memory i = _intent(0, 1e6, 1e18);
        (bytes memory a, bytes memory b) = _signed(i);
        // Invalid high-s; mature ECDSA implementation must reject before executing.
        assembly { mstore(add(a, 64), not(0)) }
        vm.expectRevert();
        guard.execute(i, a, b);
        _eq(guard.intentNonce(), 0);
    }

    function testTimeBlockDirectionAmountAndSlippageBounds() public {
        TradingSessionGuard.TradeIntent memory i = _intent(0, 1e6, 1e18);
        i.deadline = uint64(block.timestamp - 1);
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
        i = _intent(0, 1e6, 1e18);
        i.quoteObservedAt++;
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
        i = _intent(0, 1e6, 1e18);
        i.deadline = uint64(block.timestamp + 61);
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
        i = _intent(0, 1e6, 1e18);
        i.quoteObservedAt = uint64(block.timestamp - 31);
        i.deadline = uint64(block.timestamp + 1);
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
        i = _intent(0, 1e6, 1e18);
        i.quoteBlockNumber++;
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
        i = _intent(2, 1e6, 1e18);
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
        i = _intent(0, 0, 1e18);
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
        i = _intent(0, 1e6, 1e18);
        i.amountOutMinimumRaw = 99e16 - 1;
        _reject(i, TradingSessionGuard.InvalidIntent.selector);
        i = _intent(0, type(uint256).max, 1e18);
        _reject(i, TradingSessionGuard.BudgetExceeded.selector);
    }

    function testGrossBudgetNeverReplenishedByProfitableSaleOrMidnight() public {
        _buy();
        vm.warp(block.timestamp + 60);
        router.configure(100e6, 0, false);
        _exec(_intent(1, 1e18, 100e6));
        vm.warp(block.timestamp + 60);
        _buy();
        vm.warp((block.timestamp / 1 days + 1) * 1 days);
        _reject(_intent(0, 1, 1), TradingSessionGuard.BudgetExceeded.selector);
        _eq(guard.sessionGrossBuyQuoteRaw(), 20e6);
    }

    function testDailyBudgetPersistsAcrossSessionsAndTightening() public {
        _buy();
        guard.pause();
        guard.startSession(p, 90e6, 11e18);
        _buy();
        guard.pause();
        p.maxUtcDayGrossBuyQuoteRaw = 15e6;
        guard.startSession(p, 80e6, 12e18);
        _reject(_intent(0, 1, 1), TradingSessionGuard.BudgetExceeded.selector);
        router.configure(1e6, 0, false);
        _exec(_intent(1, 1e18, 1e6));
        _eq(guard.utcDayGrossBuyQuoteRaw(block.timestamp / 1 days), 20e6);
    }

    function testRouterFailureRollsBackBudgetNonceAllowanceAndBalances() public {
        router.configure(1e18 - 1, 0, false);
        _reject(_intent(0, 10e6, 1e18), TradingSessionGuard.InvalidBalanceDelta.selector);
        _eq(guard.intentNonce(), 0);
        _eq(guard.sessionGrossBuyQuoteRaw(), 0);
        _eq(quote.balanceOf(address(guard)), 100e6);
        _eq(quote.allowance(address(guard), address(router)), 0);
        router.configure(1e18, 1, false);
        _reject(_intent(0, 10e6, 1e18), TradingSessionGuard.InvalidBalanceDelta.selector);
        router.configure(1e18, 0, true);
        TradingSessionGuard.TradeIntent memory i = _intent(0, 10e6, 1e18);
        (bytes memory a, bytes memory b) = _signed(i);
        vm.expectRevert();
        guard.execute(i, a, b);
        _eq(guard.intentNonce(), 0);
        _eq(quote.allowance(address(guard), address(router)), 0);
    }

    function testSurplusNotAllocatedAndDeficitFailsClosed() public {
        quote.mint(address(guard), 1000e6);
        risk.mint(address(guard), 1000e18);
        _buy();
        _eq(guard.allocatedQuoteRaw(), 90e6);
        _eq(guard.allocatedRiskRaw(), 11e18);
        _eq(risk.balanceOf(address(guard)) - guard.allocatedRiskRaw(), 1000e18);
        risk.burn(address(guard), 1000e18 + 1);
        vm.warp(block.timestamp + 60);
        _reject(_intent(1, 1, 1), TradingSessionGuard.AllocationNotCovered.selector);
    }

    function testInventoryLimitRevertsEntireBuy() public {
        guard.pause();
        p.maxRiskInventoryRaw = 10e18;
        guard.startSession(p, 100e6, 10e18);
        router.configure(1e18, 0, false);
        _reject(_intent(0, 1e6, 1e18), TradingSessionGuard.BudgetExceeded.selector);
        _eq(guard.intentNonce(), 0);
    }

    function testReduceOnlyPersistsAfterFailureAndIndependentExitCooldown() public {
        _buy();
        vm.prank(p.riskSigner);
        guard.enterReduceOnly(keccak256("risk"), keccak256("evidence"));
        _reject(_intent(0, 1, 1), TradingSessionGuard.InvalidState.selector);
        router.configure(0, 0, false);
        _reject(_intent(1, 1e18, 1e6), TradingSessionGuard.InvalidBalanceDelta.selector);
        _eq(uint256(guard.status()), uint256(TradingSessionGuard.Status.REDUCE_ONLY));
        router.configure(1e6, 0, false); // Ordinary 60-second cooldown still active.
        _exec(_intent(1, 1e18, 1e6));
        _reject(_intent(1, 1e18, 1e6), TradingSessionGuard.BudgetExceeded.selector);
        vm.warp(block.timestamp + 5);
        _exec(_intent(1, 1e18, 1e6));
        _eq(guard.allocatedRiskRaw(), 9e18);
        _eq(guard.sessionGrossBuyQuoteRaw(), 10e6);
    }

    function testExitAfterOrdinaryBudgetExhaustedAndExpiryWindow() public {
        _buy();
        vm.warp(block.timestamp + 60);
        _buy();
        vm.warp(uint256(p.validUntil) + 1);
        _eq(uint256(guard.status()), 3);
        _reject(_intent(0, 1, 1), TradingSessionGuard.InvalidState.selector);
        router.configure(1e6, 0, false); // Above ordinary sell cap; within exit cap.
        _exec(_intent(1, 6e18, 1e6));
        vm.warp(uint256(p.exitValidUntil) + 1);
        _reject(_intent(1, 1, 1), TradingSessionGuard.InvalidState.selector);
        guard.withdrawAll();
        _eq(quote.balanceOf(address(guard)), 0);
        _eq(risk.balanceOf(address(guard)), 0);
    }

    function testOwnerPauseWithdrawalAndUnauthorizedPaths() public {
        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert();
        guard.pause();
        vm.prank(attacker);
        vm.expectRevert();
        guard.withdrawAll();
        vm.prank(p.strategySigner);
        vm.expectRevert();
        guard.enterReduceOnly(bytes32(0), bytes32(0));
        guard.pause();
        _reject(_intent(0, 1, 1), TradingSessionGuard.InvalidState.selector);
        // These external systems do not occur in the emergency call graph.
        router.configure(0, 0, true);
        guard.withdrawAllocated();
        _eq(quote.balanceOf(address(this)), 100e6);
        _eq(risk.balanceOf(address(this)), 10e18);
    }

    function testOwnershipTransferClosesAtBothStepsAndRenounceDisabled() public {
        uint32 v = guard.policyVersion();
        address next = address(0xABCD);
        guard.transferOwnership(next);
        _eq(uint256(guard.status()), 0);
        require(guard.policyVersion() > v, "version not advanced");
        vm.expectRevert(TradingSessionGuard.InvalidState.selector);
        guard.startSession(p, 100e6, 10e18);
        vm.expectRevert(TradingSessionGuard.OwnershipRenunciationDisabled.selector);
        guard.renounceOwnership();
        vm.prank(next);
        guard.acceptOwnership();
        require(guard.owner() == next, "owner");
        vm.expectRevert();
        guard.withdrawAll();
        vm.prank(next);
        guard.withdrawAll();
        _eq(quote.balanceOf(next), 100e6);
    }

    function testUnsupportedOracleModeNeverDowngrades() public {
        guard.pause();
        p.mode = TradingSessionGuard.Mode.ORACLE_GUARDED;
        vm.expectRevert(TradingSessionGuard.UnsupportedOracleMode.selector);
        guard.startSession(p, 100e6, 10e18);
        _eq(uint256(guard.status()), 0);
    }

    function testNativeAndUnknownTokenRecoveryOnlyToOwner() public {
        vm.deal(address(guard), 1 ether);
        guard.withdrawNative();
        _eq(address(guard).balance, 0);
        MockToken unknown = new MockToken(8);
        unknown.mint(address(guard), 5);
        guard.recoverToken(address(unknown));
        _eq(unknown.balanceOf(address(this)), 5);
    }

    function testRouterCannotReenterOwnerStateChangeEvenWhenOwner() public {
        // Make malicious router the owner and then attempt its callback during a signed swap.
        guard.transferOwnership(address(router));
        vm.prank(address(router));
        guard.acceptOwnership();
        vm.prank(address(router));
        guard.startSession(p, 100e6, 10e18);
        router.enableCallback();
        _buy();
        require(!router.callbackSucceeded(), "reentered pause");
        _eq(uint256(guard.status()), 1);
    }

    function testFuzzBuyAccountingAndSurplus(uint96 raw, uint96 donation) public {
        uint256 amount = uint256(raw) % 10e6 + 1;
        uint256 extra = uint256(donation);
        quote.mint(address(guard), extra);
        router.configure(amount * 1e12, 0, false);
        _exec(_intent(0, amount, amount * 1e12));
        _eq(guard.allocatedQuoteRaw(), 100e6 - amount);
        _eq(quote.balanceOf(address(guard)) - guard.allocatedQuoteRaw(), extra);
        _eq(guard.allocatedRiskRaw(), 10e18 + amount * 1e12);
        _eq(guard.sessionGrossBuyQuoteRaw(), amount);
        _eq(quote.allowance(address(guard), address(router)), 0);
    }

    function testFuzzSlippageFloor(uint96 referenceRaw, uint16 bpsSeed) public {
        uint256 referenceOut = uint256(referenceRaw) % 1e18 + 10001;
        uint16 bps = bpsSeed % 1001;
        guard.pause();
        p.maxQuoteSlippageBps = bps;
        guard.startSession(p, 100e6, 10e18);
        TradingSessionGuard.TradeIntent memory i = _intent(0, 1e6, referenceOut);
        i.amountOutMinimumRaw = referenceOut * (10000 - bps) / 10000;
        router.configure(i.amountOutMinimumRaw, 0, false);
        _exec(i);
        _eq(guard.allocatedRiskRaw(), 10e18 + i.amountOutMinimumRaw);
    }

    function testPolicyTighteningAndRoleRotationPreserveSpendAndInvalidateOldSignatures() public {
        _buy();
        TradingSessionGuard.TradeIntent memory oldIntent = _intent(1, 1e18, 1e6);
        (bytes memory a, bytes memory b) = _signed(oldIntent);
        uint64 id = guard.sessionId();
        uint32 version = guard.policyVersion();
        p.maxSessionGrossBuyQuoteRaw = 5e6;
        p.maxBuyPerTradeQuoteRaw = 5e6;
        p.strategySigner = vm.addr(0x99999);
        p.strategyPolicyHash = keccak256("tightened");
        guard.updatePolicy(p);
        _eq(guard.sessionId(), id);
        _eq(guard.policyVersion(), version + 1);
        _eq(guard.intentNonce(), 1);
        _eq(guard.sessionGrossBuyQuoteRaw(), 10e6);
        _eq(guard.allocatedQuoteRaw(), 90e6);
        _eq(guard.allocatedRiskRaw(), 11e18);
        vm.expectRevert(TradingSessionGuard.InvalidIntent.selector);
        guard.execute(oldIntent, a, b);
        vm.warp(block.timestamp + 60);
        TradingSessionGuard.TradeIntent memory i = _intent(0, 1, 1);
        a = _sig(guard.hashIntent(i), 0x99999);
        b = _sig(guard.hashIntent(i), RISK_KEY);
        vm.expectRevert(TradingSessionGuard.BudgetExceeded.selector);
        guard.execute(i, a, b);
        guard.enterReduceOnly(bytes32(0), bytes32(0));
        guard.updatePolicy(p);
        _eq(uint256(guard.status()), 2);
        i = _intent(1, 1e18, 1e6);
        a = _sig(guard.hashIntent(i), 0x99999);
        b = _sig(guard.hashIntent(i), RISK_KEY);
        router.configure(1e6, 0, false);
        guard.execute(i, a, b);
        _eq(guard.sessionGrossBuyQuoteRaw(), 10e6);
        _eq(guard.allocatedRiskRaw(), 10e18);
    }

    function testGoldenViemDigest() public {
        // Exact vector generated by script/typed-data-fixture.mjs using frozen shared JSON.
        address fixedGuard = address(0x1111111111111111111111111111111111111111);
        vm.etch(fixedGuard, address(guard).code);
        vm.chainId(177);
        TradingSessionGuard.TradeIntent memory i = TradingSessionGuard.TradeIntent(
            7,
            3,
            keccak256("golden-policy"),
            9,
            0,
            1000000,
            11000000000000000000,
            10890000000000000000,
            1800000000,
            29322293,
            keccak256("golden-block"),
            1800000030,
            keccak256("golden-evidence")
        );
        string memory fixture = vm.readFile("test/fixtures/trade-intent-golden.json");
        require(
            TradingSessionGuard(payable(fixedGuard)).hashIntent(i) == vm.parseJsonBytes32(fixture, ".digest"),
            "TS/Solidity EIP712 mismatch"
        );
    }

    receive() external payable {}
}
