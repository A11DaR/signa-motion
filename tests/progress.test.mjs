import test from 'node:test';
import assert from 'node:assert/strict';
import {saveCompletedLesson,PROGRESS_KEY} from '../src/lesson/progress.js';
import {resultsMarkup} from '../src/ui/results.js';

const summary=(score=94,accuracy=80)=>({completed:true,score,accuracy,hints:score===100?0:2,seconds:55,bestGesture:'ily',errors:{ily:0,yes:1,no:1},perGesture:['ily','yes','no'].map(sign=>({sign,accuracy}))});
const memory=initial=>{let raw=initial;return {getItem:key=>{assert.equal(key,PROGRESS_KEY);return raw;},setItem:(key,value)=>{assert.equal(key,PROGRESS_KEY);raw=value;},read:()=>JSON.parse(raw)};};

test('Existing personal records migrate without invented history; gesture bests never decrease',()=>{
 const storage=memory(JSON.stringify({score:97,sessions:2}));
 let result=saveCompletedLesson(summary(),{storage,now:1000});
 assert.equal(result.progress.score,97);assert.equal(result.progress.sessions,3);assert.equal(result.previousScore,null);assert.equal(result.progress.history.length,1);
 result=saveCompletedLesson(summary(100,75),{storage,now:2000});
 assert.equal(result.previousScore,94);assert.equal(result.progress.score,100);assert.equal(result.progress.cleanLesson,true);assert.equal(result.progress.gestureBest.yes,80);
 assert.match(resultsMarkup(summary(100,75),result.progress,result.persisted,result.previousScore),/\+6 балл/);
 for(let i=3;i<=8;i++)result=saveCompletedLesson(summary(),{storage,now:i*1000});
 assert.equal(storage.read().sessions,10);assert.equal(storage.read().history.length,5);assert.equal(storage.read().history[0].at,4000);assert.equal(storage.read().cleanLesson,true);
});
test('Denied storage access or writes cannot prevent results from rendering',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('SecurityError');}});
  let result=saveCompletedLesson(summary());assert.equal(result.persisted,false);assert.equal(result.progress.sessions,1);
  assert.match(resultsMarkup(summary(),result.progress,result.persisted),/Повторить урок/);
  result=saveCompletedLesson(summary(),{storage:{getItem:()=>null,setItem(){throw new Error('QuotaExceededError');}}});
  assert.equal(result.persisted,false);assert.match(resultsMarkup(summary(),result.progress,false),/сохранение недоступно/);
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});
test('Corrupted progress is discarded instead of breaking results or injecting markup',()=>{
 for(const raw of ['broken JSON',JSON.stringify({score:200,sessions:-1}),JSON.stringify({score:90,sessions:1,history:[{at:Infinity,score:90},'<img src=x>'],gestureBest:{ily:'<script>bad()</script>'}})]){
  const result=saveCompletedLesson(summary(),{storage:memory(raw),now:1000});
  assert.equal(result.progress.history.length,1);assert.equal(result.progress.gestureBest.ily,80);assert.equal(result.persisted,true);
  assert.doesNotMatch(resultsMarkup(summary(),result.progress,true),/<script>|<img/);
 }
});
test('An unfinished lesson cannot create a record or achievement',()=>{
 const storage=memory(null);assert.throws(()=>saveCompletedLesson({...summary(),completed:false},{storage}),/completed lessons/);assert.equal(storage.read(),null);
});
