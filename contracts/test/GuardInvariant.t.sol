// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {GuardBase, TradingSessionGuard} from "./TradingSessionGuard.t.sol";

/// @dev Deterministic synthetic DEX with generated action sequences, not a market simulation.
contract GuardHandler is GuardBase {
    uint256 public ghostSessionBuy;
    mapping(uint256 => uint256) public ghostDayBuy;
    uint256 public successfulTrades;
    bool public accountingBroken;
    bool public reduceIncreasedRisk;

    constructor() {
        setUp();
    }

    function trade(uint96 seed, bool buy, bool fail) external {
        vm.warp(block.timestamp + 61);
        uint256 amount = buy ? uint256(seed) % 10e6 + 1 : uint256(seed) % 10e18 + 1;
        uint256 out = buy ? amount * 1e12 : amount / 1e12 + 1;
        router.configure(fail ? 0 : out, 0, false);
        TradingSessionGuard.TradeIntent memory i = _intent(buy ? 0 : 1, amount, out);
        (bytes memory a, bytes memory b) = _signed(i);
        uint256 priorRisk = guard.allocatedRiskRaw();
        bool reducing = guard.status() == TradingSessionGuard.Status.REDUCE_ONLY
            || guard.status() == TradingSessionGuard.Status.EXPIRED;
        try guard.execute(i, a, b) returns (uint256 actualOut) {
            successfulTrades++;
            if (buy) {
                ghostSessionBuy += amount;
                ghostDayBuy[block.timestamp / 1 days] += amount;
            }
            if (actualOut != out) accountingBroken = true;
            if (reducing && guard.allocatedRiskRaw() > priorRisk) reduceIncreasedRisk = true;
        } catch {}
    }

    function donate(uint96 n, bool toRisk) external {
        if (toRisk) risk.mint(address(guard), n);
        else quote.mint(address(guard), n);
    }

    function tighten(uint96 n) external {
        uint256 limit = uint256(n) % 30e6 + 1;
        p.maxSessionGrossBuyQuoteRaw = limit;
        p.maxBuyPerTradeQuoteRaw = limit < 10e6 ? limit : 10e6;
        try guard.updatePolicy(p) {} catch {}
    }

    function reduce() external {
        try guard.enterReduceOnly(bytes32(0), bytes32(0)) {} catch {}
    }

    function closeAndRestart(bool withdrawFirst) external {
        guard.pause();
        if (withdrawFirst) guard.withdrawAllocated();
        p.validAfter = uint64(block.timestamp);
        p.validUntil = uint64(block.timestamp + 1 days);
        p.exitValidUntil = uint64(block.timestamp + 2 days);
        p.maxSessionGrossBuyQuoteRaw = 20e6;
        p.maxBuyPerTradeQuoteRaw = 10e6;
        uint256 q = quote.balanceOf(address(guard));
        uint256 r = risk.balanceOf(address(guard));
        q = q > 100e6 ? 100e6 : q;
        r = r > 10e18 ? 10e18 : r;
        guard.startSession(p, q, r);
        ghostSessionBuy = 0;
    }

    function check() external view {
        require(quote.balanceOf(address(guard)) >= guard.allocatedQuoteRaw(), "quote allocation uncovered");
        require(risk.balanceOf(address(guard)) >= guard.allocatedRiskRaw(), "risk allocation uncovered");
        require(guard.sessionGrossBuyQuoteRaw() == ghostSessionBuy, "gross accounting reset");
        require(
            guard.utcDayGrossBuyQuoteRaw(block.timestamp / 1 days) == ghostDayBuy[block.timestamp / 1 days],
            "day accounting reset"
        );
        require(!accountingBroken && !reduceIncreasedRisk, "delta/reduce accounting");
        require(
            quote.allowance(address(guard), address(router)) == 0
                && risk.allowance(address(guard), address(router)) == 0,
            "residual allowance"
        );
        require(guard.owner() == address(this), "owner changed");
    }
}

contract GuardInvariantTest {
    struct FuzzSelector {
        address addr;
        bytes4[] selectors;
    }
    GuardHandler public handler;

    function setUp() public {
        handler = new GuardHandler();
    }

    function testGhostDailyExcludesSuccessfulSale() public {
        handler.donate(433103188103536521967214, true);
        handler.trade(718, false, false);
        require(handler.successfulTrades() == 1, "regression must execute sale");
        require(handler.ghostDayBuy(uint256(1800000061) / 1 days) == 0, "sell not buy spend");
        handler.check();
    }

    function targetContracts() external view returns (address[] memory a) {
        a = new address[](1);
        a[0] = address(handler);
    }

    function targetSelectors() external view returns (FuzzSelector[] memory a) {
        bytes4[] memory s = new bytes4[](5);
        s[0] = GuardHandler.trade.selector;
        s[1] = GuardHandler.donate.selector;
        s[2] = GuardHandler.tighten.selector;
        s[3] = GuardHandler.reduce.selector;
        s[4] = GuardHandler.closeAndRestart.selector;
        a = new FuzzSelector[](1);
        a[0] = FuzzSelector(address(handler), s);
    }

    function invariantAllocatedCoverageGrossBudgetAllowanceAndReduceOnly() public view {
        handler.check();
    }
}
