// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {TradingSessionGuard} from "../src/TradingSessionGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vm} from "../test/TradingSessionGuard.t.sol";
interface IWrappedHSK { function deposit() external payable; }
interface IQuoterV2 {
    struct Params {address tokenIn;address tokenOut;uint256 amountIn;uint24 fee;uint160 sqrtPriceLimitX96;}
    function quoteExactInputSingle(Params calldata) external returns(uint256,uint160,uint32,uint256);
}
/// @notice FORK only. Public state at fixed block; all funding, deployment and swaps are local.
contract HSKFixedBlockTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant RISK=0xB210D2120d57b758EE163cFfb43e73728c471Cf1;
    address constant QUOTE=0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029;
    address constant ROUTER=0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3;
    address constant FACTORY=0x972cA9D1662F5e029cD18327D29026532E84c742;
    address constant POOL=0x4ff515761864e7838B0AdB8b5b2B8B7A068905dC;
    address constant QUOTER=0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD;
    uint256 constant STRATEGY=0x12345;
    uint256 constant RISK_SIGNER=0x67890;
    TradingSessionGuard guard;
    TradingSessionGuard.SessionPolicy policy;
    function setUp() public {
        require(block.number==29326419,"explicit fixed block required");
        vm.chainId(31337); // Local-only chain identity even though public state came from HSK177.
        guard=new TradingSessionGuard(address(this),RISK,QUOTE,ROUTER,FACTORY,POOL,3000);
        vm.deal(address(this),20 ether);IWrappedHSK(RISK).deposit{value:10 ether}();
        require(IERC20(RISK).transfer(address(guard),10 ether));
        policy=TradingSessionGuard.SessionPolicy(TradingSessionGuard.Mode.BOUNDED_EXECUTION,uint64(block.timestamp),uint64(block.timestamp+1 days),vm.addr(STRATEGY),vm.addr(RISK_SIGNER),keccak256("local-fork-policy"),1e6,2e6,3e6,20e18,2e18,0,100,60,120,10e18,0,uint64(block.timestamp+2 days));
        guard.startSession(policy,0,10e18);
    }
    function sig(bytes32 digest,uint256 key) internal returns(bytes memory) { (uint8 v,bytes32 r,bytes32 s)=vm.sign(key,digest);return abi.encodePacked(r,s,v); }
    function intent(uint8 direction,uint256 input,uint256 ref,uint256 min) internal view returns(TradingSessionGuard.TradeIntent memory) {
        return TradingSessionGuard.TradeIntent(guard.sessionId(),guard.policyVersion(),policy.strategyPolicyHash,guard.intentNonce(),direction,input,ref,min,uint64(block.timestamp),block.number-1,blockhash(block.number-1),uint64(block.timestamp+60),keccak256("local-fork-evidence"));
    }
    function execute(TradingSessionGuard.TradeIntent memory i) internal returns(uint256) {bytes32 h=guard.hashIntent(i);return guard.execute(i,sig(h,STRATEGY),sig(h,RISK_SIGNER));}
    function quoted(uint8 direction,uint256 input) internal returns(uint256 out) {
        (out,,,)=IQuoterV2(QUOTER).quoteExactInputSingle(IQuoterV2.Params(direction==0?QUOTE:RISK,direction==0?RISK:QUOTE,input,3000,0));
    }
    function testRealRouterSellBuyMinOutReduceAndWithdrawalOnLocalFork() public {
        require(block.chainid==31337,"not local chain");
        uint256 sellQuote=quoted(1,1e18);require(sellQuote>0,"empty sell quote");
        uint256 qBefore=IERC20(QUOTE).balanceOf(address(guard));uint256 poolRiskBefore=IERC20(RISK).balanceOf(POOL);
        uint256 soldOut=execute(intent(1,1e18,sellQuote,sellQuote*99/100));
        require(IERC20(QUOTE).balanceOf(address(guard))-qBefore==soldOut,"sell delta");
        require(IERC20(RISK).balanceOf(POOL)-poolRiskBefore==1e18,"input must enter actual fixed pool");
        require(IERC20(RISK).allowance(address(guard),ROUTER)==0,"sell approval");
        uint256 buyQuote=quoted(0,soldOut);uint256 rBefore=IERC20(RISK).balanceOf(address(guard));
        uint256 boughtOut=execute(intent(0,soldOut,buyQuote,buyQuote*99/100));
        require(IERC20(RISK).balanceOf(address(guard))-rBefore==boughtOut,"buy delta");
        require(IERC20(QUOTE).allowance(address(guard),ROUTER)==0,"buy approval");
        require(guard.sessionGrossBuyQuoteRaw()==soldOut,"gross buy");
        TradingSessionGuard.TradeIntent memory old=intent(1,1e18,sellQuote,sellQuote*99/100);
        bytes32 h=guard.hashIntent(old);bytes memory a=sig(h,STRATEGY);bytes memory b=sig(h,RISK_SIGNER);
        guard.updatePolicy(policy);vm.expectRevert(TradingSessionGuard.InvalidIntent.selector);guard.execute(old,a,b);
        guard.enterReduceOnly(keccak256("fork-risk"),keccak256("fork-evidence"));
        TradingSessionGuard.TradeIntent memory impossible=intent(1,1e18,type(uint128).max,type(uint128).max);
        h=guard.hashIntent(impossible);a=sig(h,STRATEGY);b=sig(h,RISK_SIGNER);
        vm.expectRevert();guard.execute(impossible,a,b);
        require(uint256(guard.status())==2,"reduce state lost");
        uint256 exitQuote=quoted(1,1e18);execute(intent(1,1e18,exitQuote,exitQuote*99/100));
        guard.pause();guard.withdrawAll();
        require(IERC20(RISK).balanceOf(address(guard))==0 && IERC20(QUOTE).balanceOf(address(guard))==0,"owner withdrawal");
    }
    receive() external payable {}
}
