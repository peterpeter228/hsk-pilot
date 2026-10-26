// Public synthetic test data only. No wallet access, RPC or signing.
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {hashTypedData, keccak256, stringToHex} from 'viem';
const config = JSON.parse(readFileSync(new URL('../../config/trade-intent-types.json', import.meta.url), 'utf8'));
const hash = s => keccak256(stringToHex(s));
const fixture = {
  dataMode: 'SIMULATION',
  source: 'viem.hashTypedData; frozen config/trade-intent-types.json',
  domain: { name: config.domainName, version: config.domainVersion, chainId: 177, verifyingContract: '0x1111111111111111111111111111111111111111' },
  types: config.types,
  primaryType: config.primaryType,
  message: {sessionId:'7', policyVersion:3, strategyPolicyHash:hash('golden-policy'), intentNonce:'9', direction:0, amountInRaw:'1000000',referenceAmountOutRaw:'11000000000000000000',amountOutMinimumRaw:'10890000000000000000',quoteObservedAt:'1800000000',quoteBlockNumber:'29322293',quoteBlockHash:hash('golden-block'),deadline:'1800000030',evidenceHash:hash('golden-evidence')}
};
fixture.digest = hashTypedData(fixture);
const path = new URL('../test/fixtures/trade-intent-golden.json',import.meta.url);
if(process.argv.includes('--check')) {
 const committed = JSON.parse(readFileSync(path,'utf8'));
 if(JSON.stringify(committed)!==JSON.stringify(fixture)) throw new Error('Golden vector drift');
 console.log(`PASS frozen EIP712 golden vector ${fixture.digest}`);
} else {writeFileSync(path,JSON.stringify(fixture,null,2)+'\n');console.log(fileURLToPath(path));}
