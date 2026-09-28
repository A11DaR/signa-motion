import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {hand} from './fixtures.mjs';

test('Real landmark-to-DOM pipeline: complete lesson, hands-free controls and camera geometry',async t=>{
 const dom=new JSDOM(await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),{url:'https://signa.test/',pretendToBeVisual:true,runScripts:'outside-only'});
 const w=dom.window,doc=w.document,$=id=>doc.getElementById(id),tools=new Map(),timers=new Map();
 let target=null,timerID=0,time=10000,scrolls=[];
 const old=new Map();
 function global(name,value){old.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});}
 for(const [name,value] of Object.entries({window:w,document:doc,navigator:w.navigator,location:w.location,localStorage:w.localStorage,sessionStorage:w.sessionStorage,innerWidth:1200,innerHeight:800,devicePixelRatio:2,requestAnimationFrame:()=>0,matchMedia:()=>({matches:false}),setTimeout:fn=>{timers.set(++timerID,fn);return timerID;},clearTimeout:id=>timers.delete(id)}))global(name,value);
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});
 w.HTMLElement.prototype.getClientRects=function(){return this.closest('.hidden')?[]:[{width:100,height:40}];};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLElement.prototype.scrollBy=(x,y)=>scrolls.push(y);
 w.scrollTo=()=>{};w.scrollBy=(x,y)=>scrolls.push(y);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 doc.elementFromPoint=()=>target;
 doc.modelContext={registerTool:tool=>tools.set(tool.name,tool)};
 for(const [key,value] of Object.entries({videoWidth:640,videoHeight:480}))Object.defineProperty($('camera'),key,{value,writable:true,configurable:true});
 Object.defineProperties($('overlay'),{clientWidth:{value:640},clientHeight:{value:480}});
 const {processDetectionFrame:processFrame,syncCameraLayout}=await import('../dist/app.js?integration');
 const send=(type,options,delta=100)=>{time+=delta;return processFrame(type?hand(type,options):{landmarks:[]},time);};
 const repeat=(type,count,options,delta=100)=>{let result;for(let i=0;i<count;i++)result=send(type,options,delta);return result;};
 const state=()=>tools.get('read_signa_lesson').execute({});
 const restart=()=>{target=null;tools.get('restart_signa_lesson').execute({});time+=2000;};
 const navOn=()=>{repeat('palm',6);assert.equal($('nav-toggle').getAttribute('aria-pressed'),'true');};
 const dwell=id=>{target=$(id);repeat('palm',15);target=null;};
 try{
  await t.test('ILY advances synchronously despite repeated noisy frames; no animation callback is needed',()=>{
   for(let i=0;i<22&&state().target==='ily';i++)send(i%6===5?'palm':'ily');
   assert.equal(state().target,'yes');assert.equal($('sign-name').textContent,'Да');assert.match($('camera-task').textContent,/«Да»/);assert.equal($('camera-task-count').textContent,'2 / 5');assert.equal(state().summary.checks,1);
   repeat('ily',25);assert.equal(state().summary.checks,1);
  });
  await t.test('Every task and phrase token advances; completion is saved exactly once',()=>{
   function yes(){repeat('fist',4);repeat('fist',6,{pitch:.65});repeat('fist',7);}
   yes();assert.equal(state().target,'no');assert.equal($('sign-name').textContent,'Нет');
   time+=1300;repeat('no',4);repeat('no',3,{closed:true});assert.equal(state().stage,'phrase');assert.equal(state().target,'yes');assert.equal($('phrase-card').classList.contains('hidden'),false);
   time+=1300;yes();assert.equal(state().target,'ily');assert.equal($('token-0').classList.contains('passed'),true);assert.equal($('camera-task-count').textContent,'5 / 5');
   time+=1300;repeat('ily',15);assert.equal(state().stage,'done');assert.equal(state().summary.checks,5);assert.equal($('results').classList.contains('hidden'),false);assert.equal($('token-1').classList.contains('passed'),true);
   repeat('ily',30);assert.equal(JSON.parse(w.localStorage.getItem('signa-best-v1')).sessions,1);
  });
  await t.test('Results can restart with the hand cursor and no mouse event from the test',()=>{navOn();dwell('restart-button');assert.equal(state().target,'ily');assert.equal(state().summary.checks,0);assert.equal($('results').classList.contains('hidden'),true);assert.equal($('nav-toggle').getAttribute('aria-pressed'),'false');});
  await t.test('Slow 3 FPS observations advance the real interface',()=>{repeat('ily',6,{},333);assert.equal(state().target,'yes');assert.equal($('camera-task-count').textContent,'2 / 5');restart();});
  await t.test('Dwell opens and closes modal controls while cursor remains in its top layer',()=>{
   navOn();dwell('about-button');assert.ok($('info-dialog').open);assert.equal($('hand-cursor').parentElement,$('info-dialog'));assert.equal($('navigation-bar').parentElement,$('info-dialog'));
   repeat('palm',6);dwell('close-info');assert.equal($('info-dialog').open,false);assert.equal($('hand-cursor').parentElement,doc.body);
  });
  await t.test('Pinch activates an ordinary button once, then rearms after leaving',()=>{
   repeat('palm',7);target=$('sound-button');repeat('pinch',3);assert.equal($('sound-button').getAttribute('aria-pressed'),'true');repeat('pinch',20);assert.equal($('sound-button').getAttribute('aria-pressed'),'true');
   target=null;repeat('palm',8);target=$('sound-button');repeat('pinch',3);assert.equal($('sound-button').getAttribute('aria-pressed'),'false');target=null;
  });
  await t.test('Small palm movements reach both page scroll edges without cropping the hand',()=>{
   scrolls=[];repeat('palm',18,{dy:.095});assert.ok(scrolls.some(y=>y>0));scrolls=[];repeat('palm',25,{dy:-.095});assert.ok(scrolls.some(y=>y<0));
  });
  await t.test('Hand cursor opens a reference and returns to the actual lesson',()=>{
   repeat('palm',8);dwell('example-button');assert.ok($('video-dialog').open);assert.ok($('video-container').querySelector('img'));repeat('palm',8);dwell('return-practice');assert.equal($('video-dialog').open,false);assert.equal($('nav-toggle').getAttribute('aria-pressed'),'false');
   repeat('ily',15);assert.equal(state().target,'yes');restart();
  });
  await t.test('Fist exits navigation and allows gesture recognition again',()=>{navOn();repeat('fist',7);assert.equal($('nav-toggle').getAttribute('aria-pressed'),'false');repeat('ily',17);assert.equal(state().target,'yes');restart();});
  await t.test('Reference video has hand-operable play, pause and replay controls',async()=>{
   let events,playerState=0,plays=0,pauses=0,seeks=0,destroyed=false;
   const fakePlayer={mute(){},playVideo(){plays++;playerState=1;events.onStateChange({data:1});},pauseVideo(){pauses++;playerState=2;events.onStateChange({data:2});},seekTo(){seeks++;},getPlayerState(){return playerState;},destroy(){destroyed=true;}};
   w.YT={Player:function(iframe,options){events=options.events;return fakePlayer;}};
   repeat('ily',15);assert.equal(state().target,'yes');navOn();dwell('example-button');await Promise.resolve();events.onReady({target:fakePlayer});assert.equal($('example-play').disabled,false);assert.equal(plays,1);
   repeat('palm',8);dwell('example-play');assert.equal(pauses,1);repeat('palm',8);dwell('example-play');assert.equal(plays,2);
   repeat('palm',8);dwell('example-replay');assert.equal(seeks,1);repeat('palm',8);dwell('return-practice');assert.ok(destroyed);assert.equal($('video-dialog').open,false);restart();
  });
  await t.test('Portrait camera metadata changes the viewport ratio without distorting video',()=>{$('camera').videoWidth=480;$('camera').videoHeight=640;syncCameraLayout();assert.equal($('camera-stage').style.getPropertyValue('--camera-ratio'),'0.75');assert.equal($('camera').dataset.mirrored,'true');});
 }finally{timers.clear();dom.window.close();for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
