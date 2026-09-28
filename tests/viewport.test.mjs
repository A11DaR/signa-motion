import test from 'node:test';
import assert from 'node:assert/strict';
import {videoRect,projectLandmark} from '../src/ui/viewport.js';
test('Portrait video and skeleton use the same centered contain rectangle',()=>{const r=videoRect(360,480,480,640);assert.deepEqual(r,{x:0,y:0,width:360,height:480});assert.deepEqual(projectLandmark({x:.25,y:.5},r,false),[90,240]);assert.deepEqual(projectLandmark({x:.25,y:.5},r,true),[270,240]);});
test('Capped camera height adds identical horizontal margins to video and skeleton',()=>{const r=videoRect(600,500,480,640);assert.deepEqual(r,{x:112.5,y:0,width:375,height:500});assert.deepEqual(projectLandmark({x:0,y:0},r,false),[112.5,0]);assert.deepEqual(projectLandmark({x:1,y:1},r,false),[487.5,500]);});
test('Wide video letterboxes vertically without stretching skeleton coordinates',()=>{const r=videoRect(640,480,1280,720);assert.deepEqual(r,{x:0,y:60,width:640,height:360});assert.deepEqual(projectLandmark({x:.5,y:.5},r),[320,240]);assert.deepEqual(videoRect(0,480,1280,720),{x:0,y:0,width:0,height:0});});
