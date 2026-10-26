import canonicalize from 'canonicalize';
import {createHash} from 'node:crypto';
export function sealEvidence<T>(data:T){const canonical=canonicalize(data);if(typeof canonical!=='string')throw Error('INVALID_EVIDENCE');return {schemaVersion:'hsk-evidence-envelope/1',algorithm:'RFC8785-SHA256',claim:'Integrity commitment only; does not prove factual truth or reasoning correctness.',sha256:createHash('sha256').update(canonical).digest('hex'),data};}
export function verifyEvidence(value:unknown):boolean{if(!value||typeof value!=='object')return false;const x=value as any;try{return x.schemaVersion==='hsk-evidence-envelope/1'&&x.algorithm==='RFC8785-SHA256'&&typeof x.sha256==='string'&&sealEvidence(x.data).sha256===x.sha256;}catch{return false;}}
