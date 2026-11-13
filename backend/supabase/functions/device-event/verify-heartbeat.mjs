// Test the real entrypoint with stubbed Deno environment and RPC responses. Owner: Fahim.
import assert from 'node:assert/strict';
let handler;
globalThis.Deno = { env: { get: key => key === 'SUPABASE_URL' ? 'https://example.invalid' : 'test-service-key' }, serve: h => { handler = h; } };
await import('./index.ts');
const event = { event_id:'123e4567-e89b-42d3-a456-426614174000', kind:'help_requested' };
const alert = { ...event, device_id:'d99d5080-585a-4b57-94f4-a09d3af42cea', received_at:'2026-11-14T00:00:00Z', acknowledged_at:null };
/** Runs one intake request with deterministic RPC stubs and returns its response and RPC order. */
async function run(kind, heartbeatResult, validToken=true) {
  const calls=[];
  globalThis.fetch = async (url, options) => {
    const name=new URL(url).pathname.split('/').pop();
    calls.push(name);
    assert.match(JSON.parse(options.body).p_token_hash,/^[a-f0-9]{64}$/);
    if(name==='submit_device_event') return Response.json(validToken ? alert : null);
    if(heartbeatResult==='throw') throw new Error('network down');
    if(heartbeatResult==='500') return Response.json({error:'failed'}, {status:500});
    return Response.json(validToken);
  };
  const response=await handler(new Request('https://example.invalid/device-event', {
    method:'POST',headers:{authorization:'Bearer sample-token','content-type':'application/json'},
    body:JSON.stringify({...event,kind})
  }));
  return { response, calls };
}
for(const failure of ['500','throw']) {
  const {response,calls}=await run('help_requested',failure);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),alert);
  assert.deepEqual(calls,['submit_device_event','submit_heartbeat']);
}
let result=await run('heartbeat','ok');
assert.equal(result.response.status,200);
assert.deepEqual(await result.response.json(),{ok:true});
assert.deepEqual(result.calls,['submit_heartbeat']);
result=await run('heartbeat','500');
assert.equal(result.response.status,500);
assert.deepEqual(result.calls,['submit_heartbeat']);
result=await run('heartbeat','ok',false);
assert.equal(result.response.status,401);
result=await run('help_requested','ok',false);
assert.equal(result.response.status,401);
assert.deepEqual(result.calls,['submit_device_event']);
console.log('Passed 6 entrypoint cases: help survives HTTP/network heartbeat failure, heartbeat-only success/failure, and invalid tokens on both paths.');
