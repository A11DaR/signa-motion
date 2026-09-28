import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
import {hand} from './fixtures.mjs';

test('Start button drives camera, frame scheduler, calibration, every lesson and camera recovery',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const source=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 const cameraImport=source.match(/from ['"](.\/camera\.js[^'"]*)['"]/)[1];
 const {CameraSession}=await import(new URL(cameraImport,new URL('../dist/app.js',import.meta.url)));
 const originalStart=CameraSession.prototype.start;
 const errors=[],virtualConsole=new VirtualConsole();
 for(const event of ['error','jsdomError'])virtualConsole.on(event,(...args)=>errors.push(args));
 const dom=new JSDOM(html,{url:'https://signa.test/',pretendToBeVisual:true,virtualConsole});
 const w=dom.window,doc=w.document,$=id=>doc.getElementById(id),frames=new Map(),registered=new Map(),streams=[],models=[];
 let nextFrame=0,time=10000,detection=hand('palm'),cameraError=null,modelError=null,inferences=0;
 const originals=new Map();
 function global(name,value){originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});}
 // Web IDL accepts a global/undefined receiver, but rejects calling a Window
 // function as a method of an unrelated object. Arrow-only mocks hid this bug.
 function requestFrame(callback){if(this!==undefined&&this!==globalThis)throw new TypeError('Illegal invocation');frames.set(++nextFrame,callback);return nextFrame;}
 function cancelFrame(id){if(this!==undefined&&this!==globalThis)throw new TypeError('Illegal invocation');frames.delete(id);}
 const mediaDevices={async getUserMedia(constraints){
  if(cameraError)throw Object.assign(new Error(cameraError),{name:cameraError});
  const track=new w.EventTarget();track.stops=0;track.stop=()=>track.stops++;track.getSettings=()=>({facingMode:constraints.video.facingMode.ideal});
  const stream={track,getTracks:()=>[track],getVideoTracks:()=>[track]};streams.push(stream);return stream;
 }};
 for(const [name,value] of Object.entries({window:w,document:doc,navigator:{mediaDevices},location:w.location,isSecureContext:true,localStorage:w.localStorage,sessionStorage:w.sessionStorage,innerWidth:1200,innerHeight:800,devicePixelRatio:1,requestAnimationFrame:requestFrame,cancelAnimationFrame:cancelFrame,matchMedia:()=>({matches:false})}))global(name,value);
 for(const event of ['error','unhandledrejection'])w.addEventListener(event,e=>errors.push(e.error??e.reason??e.message));
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({getImageData:()=>({data:new Uint8ClampedArray(24*18*4).fill(150)})},{get:(target,key)=>target[key]??(()=>{}),set:()=>true});
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.scrollTo=()=>{};w.scrollBy=()=>{};doc.elementFromPoint=()=>null;
 doc.modelContext={registerTool:tool=>registered.set(tool.name,tool)};
 const video=$('camera');video.play=async()=>{};
 for(const [key,value] of Object.entries({readyState:4,currentTime:0,videoWidth:640,videoHeight:480}))Object.defineProperty(video,key,{value,writable:true,configurable:true});
 Object.defineProperties($('overlay'),{clientWidth:{value:640},clientHeight:{value:480}});
 CameraSession.prototype.start=function(...args){
  // Only hardware and neural inference are substituted; session startup and
  // the app's production frame loop run unchanged from the Start click.
  this.modelFactory=async()=>{if(modelError)throw modelError;const model={closed:0,detectForVideo(){inferences++;return detection;},close(){this.closed++;}};models.push(model);return model;};
  return originalStart.apply(this,args);
 };
 const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
 const state=()=>registered.get('read_signa_lesson').execute({});
 const runFrames=async(type,count,options={})=>{
  detection=type?hand(type,options):{landmarks:[]};
  for(let i=0;i<count;i++){time+=100;video.currentTime+=.1;const pending=[...frames.entries()];for(const [id] of pending)frames.delete(id);await Promise.all(pending.map(([,callback])=>callback(time)));}
 };
 try{
  await import('../dist/app.js?startup-regression');
  $('start-camera').click();await settle();
  assert.equal(state().camera,true,'Start must keep the camera running: '+$('camera-title').textContent);
  assert.equal(state().calibrating,true);assert.equal($('camera-start').classList.contains('hidden'),true);
  await runFrames('palm',20);assert.equal(state().calibrating,false);assert.ok(inferences>=20);
  await runFrames('ily',20);assert.equal(state().target,'yes');
  const yes=async()=>{await runFrames('fist',5);await runFrames('fist',6,{pitch:.65});await runFrames('fist',18);};
  await yes();assert.equal(state().target,'no');
  await runFrames('no',4);await runFrames('no',16,{closed:true});assert.equal(state().stage,'phrase');
  await yes();assert.equal(state().target,'ily');
  await runFrames('ily',20);assert.equal(state().stage,'done');assert.equal(state().summary.checks,5);
  assert.equal($('results').classList.contains('hidden'),false);assert.equal(JSON.parse(w.localStorage.getItem('signa-best-v1')).sessions,1);
  $('stop-button').click();assert.equal(state().camera,false);assert.equal(streams[0].track.stops,1);assert.equal(models[0].closed,1);assert.equal(video.srcObject,null);
  const afterStop=inferences;await runFrames('palm',3);assert.equal(inferences,afterStop);
  $('restart-lesson').click();$('start-camera').click();await settle();assert.equal(state().camera,true);
  $('switch-camera').click();await settle();assert.equal(state().camera,true);assert.equal(video.dataset.mirrored,'false');assert.equal(streams[1].track.stops,1);assert.equal(models[1].closed,1);
  streams.at(-1).track.dispatchEvent(new w.Event('ended'));assert.equal(state().camera,false);assert.notEqual($('camera-task').textContent,'Настроим камеру');assert.equal($('sign-name').textContent,'Я тебя люблю');
  for(const [name,title] of [['NotAllowedError','Доступ к камере запрещён'],['NotFoundError','Камера не найдена'],['NotReadableError','Камера занята']]){
   cameraError=name;$('start-camera').click();await settle();assert.equal(state().camera,false);assert.equal($('camera-title').textContent,title);assert.equal($('start-camera').disabled,false);
  }
  cameraError=null;modelError=new Error('Model load failed');$('start-camera').click();await settle();assert.equal(state().camera,false);assert.equal($('camera-title').textContent,'Не удалось загрузить распознавание');assert.equal(streams.at(-1).track.stops,1);assert.equal($('start-camera').disabled,false);
  modelError=null;$('start-camera').click();await settle();assert.equal(state().camera,true);await runFrames('palm',20);assert.equal(state().calibrating,false);
  assert.deepEqual(errors,[]);
 }finally{
  w.dispatchEvent(new w.Event('pagehide'));CameraSession.prototype.start=originalStart;w.close();frames.clear();
  for(const [name,value] of originals){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}
 }
});
