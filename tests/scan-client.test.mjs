import test from 'node:test';
import assert from 'node:assert/strict';
import { readAnalysisResponse } from '../src/scan-client.js';
const encode=new TextEncoder();
function response(lines,width=7){const bytes=encode.encode(lines);return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=width)controller.enqueue(bytes.slice(i,i+width));controller.close();}}),{headers:{'content-type':'application/x-ndjson'}});}
test('streams split UTF-8 updates in order and returns the final record',async()=>{const events=[],data={appName:'Música',sorted:{takes:[]}};const body=JSON.stringify({type:'progress',stage:'search',status:'running',message:'Finding Música'})+'\n'+JSON.stringify({type:'progress',stage:'search',status:'complete'})+'\n'+JSON.stringify({type:'result',data});assert.deepEqual(await readAnalysisResponse(response(body),e=>events.push(e)),data);assert.equal(events[0].message,'Finding Música');assert.equal(events[1].status,'complete');});
test('surfaces streamed errors and rejects interrupted scans',async()=>{await assert.rejects(()=>readAnalysisResponse(response('{"type":"error","error":"Policy unavailable"}\n')),/Policy unavailable/);await assert.rejects(()=>readAnalysisResponse(response('{"type":"progress","stage":"search"}\n')),/complete analysis/);});
test('retains JSON response compatibility',async()=>{const data={sorted:{takes:[]}};assert.deepEqual(await readAnalysisResponse(Response.json(data)),data);await assert.rejects(()=>readAnalysisResponse(Response.json({error:'Invalid input'},{status:400})),/Invalid input/);});
