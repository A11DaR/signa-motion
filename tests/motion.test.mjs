import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GestureRecognizer,extractFeatures,validateGesture} from '../src/gestures/recognizer.js';
import {hand} from './fixtures.mjs';
const refs=JSON.parse(readFileSync(new URL('./motion-landmarks.json',import.meta.url)));
const features=(d,w=640,h=480)=>extractFeatures(d.landmarks[0],d.worldLandmarks[0],w/h,d.handedness[0][0].categoryName);
const sample=(name,mirrored=false)=>{const c=refs.cases.find(c=>c.name===name&&c.mirrored===mirrored);return features(c.detection,c.width,c.height);};
const nod=[0,0,0,.12,.28,.45,.30,.12,.04,...Array(12).fill(0)];

test('A continuous YES nod with no pause at its peak passes in different camera planes',()=>{
 for(const mirrored of [false,true])for(const [viewYaw,viewRoll] of [[0,0],[Math.PI/2,0],[0,1.2],[.8,.6]]){
  const engine=new GestureRecognizer();let passes=0;
  for(const [i,pitch] of nod.entries()){const f=features(hand('fist',{pitch,viewYaw,viewRoll,mirrored}));passes+=Number(engine.updateFeatures(f,i*80,'yes').success);}
  assert.equal(passes,1,JSON.stringify({mirrored,viewYaw,viewRoll}));
 }
});
test('Still fists, translation, sideways waves and a one-frame depth spike cannot pass YES',()=>{
 for(const kind of ['still','translation','sideways','spike']){
  const engine=new GestureRecognizer();
  for(let i=0;i<50;i++){
   const f=features(hand('fist',{dx:kind==='translation'?Math.sin(i/3)*.04:0,dy:kind==='translation'?Math.cos(i/3)*.04:0,viewRoll:kind==='sideways'?Math.sin(i/4)*.5:0,pitch:kind==='spike'&&i===6?.8:0}));
   assert.equal(engine.updateFeatures(f,i*80,'yes').success,false,kind);
  }
 }
});
test('A foreshortened fist stays visible at the calibrated distance',()=>{
 const palm=features(hand('palm')),engine=new GestureRecognizer();engine.setProfile({palmSize:palm.viewScale});
 const fist=features(hand('fist',{viewYaw:Math.PI/2}));assert.ok(fist.screenScale<.065);assert.equal(engine.updateFeatures(fist,0,'yes').kind,'correction');
});
test('All actual ASL University YES reference poses pass the S-hand shape check',()=>{
 for(const c of refs.cases.filter(c=>c.name.startsWith('yes'))){const result=validateGesture('yes',features(c.detection,c.width,c.height));assert.equal(result.poseCorrect,true,c.name+' '+c.mirrored+': '+result.errors);}
});
test('Actual model YES reference frames pass the nod and return, for either hand',()=>{
 for(const mirrored of [false,true]){const engine=new GestureRecognizer();let time=0,passes=0;
  for(const [name,count] of [['yes1.jpg',4],['yes2.jpg',4],['yes3.jpg',12]])for(let i=0;i<count;i++){passes+=Number(engine.updateFeatures(sample(name,mirrored),time,'yes').success);time+=100;}
  assert.equal(passes,1,'mirror='+mirrored);
 }
});
test('Actual NO reference opening and closing pass in original and mirrored forms',()=>{
 for(const mirrored of [false,true]){const engine=new GestureRecognizer();let time=0,passes=0;
  for(const [name,count] of [['no-open.jpg',4],['no-close.jpg',12]])for(let i=0;i<count;i++){passes+=Number(engine.updateFeatures(sample(name,mirrored),time,'no').success);time+=100;}
  assert.equal(passes,1,'mirror='+mirrored);
 }
});
test('The four-frame NO instructional GIF completes with its recorded frame durations',()=>{
 for(const clip of refs.clips){const engine=new GestureRecognizer();let passes=0;
  for(let time=0;time<2900;time+=100){const frame=clip.frames.findLast(f=>f.time<=time);passes+=Number(engine.updateFeatures(features(frame.detection,clip.width,clip.height),time,'no').success);}
  assert.equal(passes,1,'mirror='+clip.mirrored);
 }
});
test('NO asks for opening first; a closed pinch, fist or incomplete closure cannot finish',()=>{
 const engine=new GestureRecognizer();for(let t=0;t<1400;t+=100)assert.equal(engine.updateFeatures(sample('no-close.jpg',true),t,'no').success,false);
 engine.reset();const first=engine.updateFeatures(sample('no-open.jpg'),0,'no');assert.match(first.title,/задержи/);assert.ok(first.errors.every(e=>!e.startsWith('Теперь')));
 for(let t=100;t<=300;t+=100)engine.updateFeatures(sample('no-open.jpg'),t,'no');
 assert.match(engine.updateFeatures(sample('no-open.jpg'),400,'no').title,/Теперь сомкни/);
 const fist=features(hand('fist'));for(let t=500;t<2000;t+=100)assert.equal(engine.updateFeatures({...fist,closeGap:.1,screenCloseGap:.1},t,'no').success,false);
 engine.reset();for(let t=0;t<=300;t+=100)engine.updateFeatures(sample('no-open.jpg'),t,'no');
 for(let t=400;t<2000;t+=100)assert.equal(engine.updateFeatures({...sample('no-close.jpg'),closeGap:.6,screenCloseGap:.5},t,'no').success,false);
});
test('Missing frames cannot finish the NO opening; a fresh opening recovers normally',()=>{
 const engine=new GestureRecognizer(),open=sample('no-open.jpg'),closed=sample('no-close.jpg');
 engine.updateFeatures(open,0,'no');engine.updateFeatures(open,50,'no');
 for(const time of [100,150,200])engine.updateFeatures(null,time,'no');
 assert.match(engine.updateFeatures(open,250,'no').title,/задержи/);
 for(let time=300;time<=1000;time+=100)assert.equal(engine.updateFeatures(closed,time,'no').success,false);
 for(let time=1100;time<=1500;time+=100)engine.updateFeatures(open,time,'no');
 let passes=0;for(let time=1600;time<2600;time+=100)passes+=Number(engine.updateFeatures(closed,time,'no').success);
 assert.equal(passes,1);
});
