import {it,expect} from 'vitest';
import {sealEvidence,verifyEvidence} from '../../scripts/evidence.js';
it('commits canonical values, detects tampering, does not prove truth',()=>{const data={mode:'SIMULATION',amountRaw:'1000000',receipt:null};const e=sealEvidence(data);expect(verifyEvidence(e)).toBe(true);expect(sealEvidence({receipt:null,amountRaw:'1000000',mode:'SIMULATION'}).sha256).toBe(e.sha256);expect(verifyEvidence({...e,data:{...data,amountRaw:'1000001'}})).toBe(false);expect(e.claim).toContain('does not prove');});
