import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../../apps/web/src/App';
import { units, decimalToRaw } from '../../apps/web/src/format';
import { request, ApiError } from '../../apps/web/src/api';
import { SimulationSession } from '../../apps/worker/src/simulation';

afterEach(()=>vi.unstubAllGlobals());
describe('raw amount display boundary',()=>{
 it('keeps large integers exact and separates unavailable from zero',()=>{
 expect(units('9007199254740993000001',6,6)).toBe('9,007,199,254,740,993.000001');
 expect(units(null)).toBe('Unavailable');expect(units('0')).toBe('0');expect(units('-1234500')).toBe('−1.2345');expect(units('1e18')).toBe('Unavailable');
 });
 it('rejects exponent, negative and overprecision policy inputs',()=>{expect(decimalToRaw('0.000001')).toBe('1');for(const input of ['1e6','-1','0.0000001','Infinity'])expect(()=>decimalToRaw(input)).toThrow();});
});
describe('read-only judge rendering',()=>{
 it('renders synthetic source, model limitations, unknown net and disabled policy controls',()=>{const html=renderToStaticMarkup(React.createElement<NonNullable<Parameters<typeof App>[0]>>(App,{initialState:new SimulationSession('judge').getState()}));expect(html).toContain('SIMULATION');expect(html).toContain('read-only example');expect(html).toContain('No real funds');expect(html).toContain('Cost coverage incomplete');expect(html).toContain('RULE-BASED · NOT AI');expect(html).not.toContain('$');expect(html).toMatch(/disabled=""[^>]*>Preview policy changes/);expect(html).toContain('Open synthetic sandbox');expect(html).not.toContain('Connect wallet');});
 it('uses server decision result and never inserts a fake transaction hash',async()=>{const session=new SimulationSession('test');await session.tick();const html=renderToStaticMarkup(React.createElement<NonNullable<Parameters<typeof App>[0]>>(App,{initialState:session.getState()}));expect(html).toContain('REBALANCE');expect(html).toContain('No blockchain transaction occurred');expect(html).toContain('2 WHSK');expect(html).not.toMatch(/0x[0-9a-f]{64}/);});
});
describe('network authority boundary',()=>{
 it('sends scoped token and expected-version request exactly once',async()=>{const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true})});vi.stubGlobal('fetch',fetcher);await request('/api/simulations/test/proposals',{token:'scoped-test-token',body:{message:'target 20%',expectedVersion:'2'}});expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer scoped-test-token');expect(JSON.parse(fetcher.mock.calls[0][1].body).expectedVersion).toBe('2');});
 it('does not retry an ambiguous mutation result or substitute local success',async()=>{const fetcher=vi.fn().mockRejectedValue(new Error('network lost'));vi.stubGlobal('fetch',fetcher);await expect(request('/api/simulations/test/control',{body:{action:'RUN'}})).rejects.toMatchObject({code:'CONNECTION_UNCONFIRMED'});expect(fetcher).toHaveBeenCalledTimes(1);});
 it('preserves stale-policy rejection and does not auto-confirm',async()=>{const fetcher=vi.fn().mockResolvedValue({ok:false,json:async()=>({code:'POLICY_VERSION_CHANGED',message:'Refresh policy before confirming',retryable:false})});vi.stubGlobal('fetch',fetcher);await expect(request('/confirm',{body:{expectedVersion:'1'}})).rejects.toBeInstanceOf(ApiError);expect(fetcher).toHaveBeenCalledTimes(1);});
});
