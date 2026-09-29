import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GestureRecognizer,extractFeatures} from '../src/gestures/recognizer.js';
const {cases}=JSON.parse(readFileSync(new URL('./photo-landmarks.json',import.meta.url)));
const features=(c,i)=>extractFeatures(c.detection.landmarks[i],c.detection.worldLandmarks[i],c.width/c.height,c.detection.handedness[i][0].categoryName);
test('Two real ILY photographs and mirrored/rotated variants pass with actual MediaPipe handedness',()=>{
 const samples=cases.filter(c=>c.name.startsWith('ily'));assert.equal(samples.length,12);
 for(const c of samples){assert.equal(c.detection.landmarks.length,1);const f=features(c,0),r=new GestureRecognizer();let result;
  assert.equal(f.facingCamera,true,c.name+' '+c.mirrored+' '+c.rotation);
  for(let time=0;time<=1200;time+=100)result=r.updateFeatures(f,time,'ily');
  assert.equal(result.correct,true,c.name+' '+c.mirrored+' '+c.rotation+': '+result.title);
 }
});
test('Camera-derived fists, thumbs up, pointing, V and back-of-hand samples never pass ILY',()=>{
 let samples=0;
 for(const c of cases.filter(c=>!c.name.startsWith('ily')))for(let i=0;i<c.detection.landmarks.length;i++){
  samples++;const f=features(c,i),r=new GestureRecognizer();for(let time=0;time<=2000;time+=100)assert.equal(r.updateFeatures(f,time,'ily').success,false,c.name);
  if(c.name.endsWith('_hands'))assert.equal(f.facingCamera,false,'back of '+c.name+' mirror='+c.mirrored);
 }
 assert.equal(samples,16);
});
