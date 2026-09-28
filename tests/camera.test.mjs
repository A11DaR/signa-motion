import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraSession,CAMERA_ERRORS} from '../dist/camera.js';
import {FrameTracker} from '../dist/tracking.js';
function fakeStream(){const track=new EventTarget();track.stops=0;track.stop=()=>track.stops++;track.getSettings=()=>({facingMode:'environment'});return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};}
function video(){const v=new EventTarget();v.readyState=2;v.currentTime=0;v.srcObject=null;v.play=async()=>{};return v;}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('Permission refusal, missing and occupied camera produce recoverable states',async()=>{
 for(const name of ['NotAllowedError','NotFoundError','NotReadableError']){
  const stream=fakeStream();let failed=true,models=0;const session=new CameraSession(video(),{secure:()=>true,mediaDevices:{getUserMedia:async()=>{if(failed)throw Object.assign(new Error(name),{name});return stream;}},modelFactory:async()=>{models++;return {close(){}};}});
  await assert.rejects(session.start(),{name});assert.ok(CAMERA_ERRORS[name]);assert.equal(models,0);assert.equal(session.stream,null);
  failed=false;assert.equal(await session.start(),true);session.stop();assert.equal(stream.track.stops,1);
 }
});
test('Concurrent starts share one permission request; a late stream after cancellation is stopped',async()=>{
 const request=deferred(),stream=fakeStream();let requests=0,models=0;
 const session=new CameraSession(video(),{secure:()=>true,mediaDevices:{getUserMedia:()=>{requests++;return request.promise;}},modelFactory:async()=>{models++;return {close(){}};}});
 const a=session.start(),b=session.start();assert.equal(a,b);session.stop();request.resolve(stream);assert.equal(await a,false);assert.equal(requests,1);assert.equal(models,0);assert.equal(stream.track.stops,1);assert.equal(session.video.srcObject,null);
});
test('Cancelling a model load releases the stream and disposes its late model',async()=>{
 const request=deferred(),stream=fakeStream();let disposed=0;
 const session=new CameraSession(video(),{secure:()=>true,mediaDevices:{getUserMedia:async()=>stream},modelFactory:()=>request.promise});const start=session.start();await Promise.resolve();await Promise.resolve();session.stop();request.resolve({close(){disposed++;}});assert.equal(await start,false);assert.equal(disposed,1);assert.equal(stream.track.stops,1);
});
test('A cancelled metadata wait removes handlers and never starts inference',async()=>{
 const v=video();v.readyState=0;const stream=fakeStream();let models=0;
 const session=new CameraSession(v,{secure:()=>true,mediaDevices:{getUserMedia:async()=>stream},modelFactory:async()=>{models++;}});const start=session.start();await Promise.resolve();session.stop();await assert.rejects(start,{name:'AbortError'});v.dispatchEvent(new Event('loadedmetadata'));assert.equal(models,0);assert.equal(stream.track.stops,1);
});
test('Ended camera track is surfaced and stopping disposes model exactly once',async()=>{
 const stream=fakeStream();let ended=0,closed=0;const session=new CameraSession(video(),{secure:()=>true,mediaDevices:{getUserMedia:async()=>stream},modelFactory:async()=>({close(){closed++;}}),onEnded:()=>ended++});await session.start();assert.equal(session.facing,'environment');stream.track.dispatchEvent(new Event('ended'));assert.equal(ended,1);session.stop();session.stop();assert.equal(closed,1);assert.equal(stream.track.stops,1);
});
test('Frame tracker never overlaps inference or delivers a frame after stop',async()=>{
 let callback,calls=0,delivered=0;const pending=deferred(),v=video(),session={video:v,model:{detectForVideo(){calls++;return pending.promise;}}};
 const tracker=new FrameTracker({raf:fn=>{callback=fn;return 1;},caf:()=>{},visible:()=>true});tracker.start(session,()=>delivered++,()=>assert.fail());const first=callback(100);v.currentTime=1;await callback(200);assert.equal(calls,1);tracker.stop();pending.resolve({landmarks:[]});await first;assert.equal(delivered,0);
});
test('Repeated inference failure stops the loop instead of endlessly throwing',async()=>{
 let callback,errors=0;const v=video(),tracker=new FrameTracker({raf:fn=>{callback=fn;return 1;},caf:()=>{},visible:()=>true});tracker.start({video:v,model:{detectForVideo(){throw new Error('device lost');}}},()=>assert.fail(),()=>errors++);
 for(let i=0;i<7;i++){v.currentTime=i;await callback(100+i*100);}assert.equal(errors,1);assert.equal(tracker.session,null);
});
