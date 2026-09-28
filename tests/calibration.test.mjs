import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Calibration} from '../dist/calibration.js';
import {extractFeatures} from '../dist/landmarks.js';
import {trackingIssue} from '../dist/gesture-rules.js';
import {hand} from './fixtures.mjs';
const features=()=>{const d=hand('palm');return extractFeatures(d.landmarks[0],d.worldLandmarks[0],4/3,'Left');};
test('Calibration measures the actual palm scale with short tracking gaps',()=>{
 const c=new Calibration(),f=features();let out;for(let t=0;t<2300;t+=100)out=c.update(t===500||t===600?[]:[f],t,{mirrored:true});assert.ok(out.complete);assert.equal(out.profile.palmSize,f.screenScale);assert.equal(out.profile.mirrored,true);
 assert.equal(trackingIssue({...f,screenScale:f.screenScale*.2},out.profile).code,'far');assert.equal(trackingIssue({...f,screenScale:.8},out.profile).code,'near');
});
test('Calibration gives distinct instructions for darkness, edges, multiple hands and wrong orientation',()=>{
 const c=new Calibration(),f=features();assert.match(c.update([],0,{brightness:10}).title,/свет/);assert.match(c.update([f,f],100).title,/одну/);assert.match(c.update([{...f,cropped:true}],200).title,/края|кадра/);assert.match(c.update([{...f,facingCamera:false}],300).title,/ладонь/);assert.equal(c.profile,null);
});
test('Fast movement does not complete calibration',()=>{
 const c=new Calibration(),f=features();let out;for(let t=0;t<2500;t+=100)out=c.update([{...f,center:{x:t%200===0?.2:.8,y:.5}}],t);assert.equal(out.complete,false);assert.match(out.title,/месте/);
});
test('An actual model observation of an open palm completes calibration',()=>{
 const sample=JSON.parse(readFileSync(new URL('./calibration-palm.json',import.meta.url))),d=sample.detection;
 const f=extractFeatures(d.landmarks[0],d.worldLandmarks[0],sample.width/sample.height,d.handedness[0][0].categoryName);
 const calibration=new Calibration();let result;
 for(let time=0;time<1400;time+=100){result=calibration.update([f],time);assert.equal(result.complete,false);}
 result=calibration.update([f],1400);assert.equal(result.complete,true);assert.equal(result.profile.palmSize,f.screenScale);
});
