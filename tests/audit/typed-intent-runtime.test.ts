import {it,expect} from 'vitest';
import {hashTypedData} from 'viem';
import {prepareTypedIntent} from '../../packages/shared/src/trade-intent.js';
const hash=`0x${'11'.repeat(32)}` as const;
const guard='0x1111111111111111111111111111111111111111';
const valid={sessionId:1n,policyVersion:1,strategyPolicyHash:hash,intentNonce:0n,direction:0 as const,amountInRaw:1n,referenceAmountOutRaw:2n,amountOutMinimumRaw:1n,quoteObservedAt:1n,quoteBlockNumber:1n,quoteBlockHash:hash,deadline:2n,evidenceHash:hash};
it('rejects runtime JS number where raw bigint is required, before silently retaining rounding',()=>{
 const unsafe=JSON.parse('{"amountInRaw":9007199254740993}');
 expect(unsafe.amountInRaw).toBe(9007199254740992);
 expect(()=>Reflect.apply(prepareTypedIntent,null,[177,guard,{...valid,...unsafe}])).toThrow();
});
it('rejects number zero instead of bypassing bigint zero-amount guard',()=>{
 expect(()=>Reflect.apply(prepareTypedIntent,null,[177,guard,{...valid,amountInRaw:0}])).toThrow();
});
it('accepts exact bigint beyond safe JS integer and enforces uint width',()=>{
 const amount=9007199254740993n;
 expect(prepareTypedIntent(177,guard,{...valid,amountInRaw:amount}).message.amountInRaw).toBe(amount);
 expect(()=>prepareTypedIntent(177,guard,{...valid,sessionId:1n<<64n})).toThrow();
});
it('rejects invalid number policyVersion at runtime',()=>{
 for(const policyVersion of [1.5,Number.NaN,Number.POSITIVE_INFINITY,Number.MAX_SAFE_INTEGER+1]){
  expect(()=>Reflect.apply(prepareTypedIntent,null,[177,guard,{...valid,policyVersion}])).toThrow();
 }
});

it('unsafe numeric input cannot produce a digest for a rounded amount',()=>{
 const numeric=JSON.parse('9007199254740993');
 const call=()=>Reflect.apply(prepareTypedIntent,null,[177,guard,{...valid,amountInRaw:numeric}]);
 // Historical repro: both helper and viem accepted the already-rounded numeric amount.
 // Post-fix the boundary must reject before a typed-data digest is available.
 expect(()=>hashTypedData(call())).toThrow();
});
