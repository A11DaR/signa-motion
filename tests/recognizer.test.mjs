import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureRecognizer,extractFeatures} from '../dist/recognizer.js';
import {Course} from '../dist/course.js';
import {HandCommands} from '../dist/commands.js';

const finger=(extended)=>({extended,folded:!extended,bend:extended?170:85,tipBend:160,reach:extended?1.4:.7});
const feature=(type='ily',overrides={})=>{const pitch=overrides.pitch??0;return {fingers:(type==='ily'?[true,false,false,true]:type==='no'?[true,true,false,false]:[false,false,false,false]).map(finger),thumbOut:type==='ily',facingCamera:true,pitch,screenScale:.2,cropped:false,closeGap:1,screenCloseGap:overrides.closeGap??1,pairTogether:true,indexUpright:true,palmFrame:{direction:{x:0,y:-Math.cos(pitch),z:Math.sin(pitch)},across:{x:1,y:0,z:0},normal:{x:0,y:-Math.sin(pitch),z:-Math.cos(pitch)}},...overrides};};
const feed=(engine,f,start,end,target)=>{let r;for(let t=start;t<=end;t+=50)r=engine.updateFeatures(f,t,target);return r;};

test('ILY requires a 700 ms of valid observations, not a single matching frame',()=>{const r=new GestureRecognizer();assert.equal(r.updateFeatures(feature(),0,'ily').success,false);assert.equal(feed(r,feature(),50,650,'ily').success,false);assert.equal(r.updateFeatures(feature(),700,'ily').success,true);});
test('A cropped or missing hand cannot complete an in-progress hold',()=>{const r=new GestureRecognizer();feed(r,feature(),0,550,'ily');assert.equal(r.updateFeatures(null,1000,'ily').kind,'tracking');assert.equal(r.updateFeatures(feature(),1100,'ily').success,false);assert.equal(r.updateFeatures(feature('ily',{cropped:true}),1150,'ily').success,false);});
test('A long frame gap resets temporal progress even without a null frame',()=>{const r=new GestureRecognizer();feed(r,feature(),0,500,'ily');const out=r.updateFeatures(feature(),2200,'ily');assert.equal(out.success,false);assert.equal(out.progress,0);});
test('One noisy frame every 600 ms pauses ILY progress without preventing completion',()=>{const r=new GestureRecognizer();let completed=false;for(let t=0;t<=2400;t+=100){const f=feature();if(t%600===500)f.fingers[1]=finger(true);const out=r.updateFeatures(f,t,'ily');if(t%600===500)assert.equal(out.success,false);completed||=out.success;}assert.ok(completed);});
test('A slow 3 FPS camera can complete ILY',()=>{const r=new GestureRecognizer();let successes=0;for(let t=0;t<=1665;t+=333)successes+=Number(r.updateFeatures(feature(),t,'ily').success);assert.equal(successes,1);});
test('Sustained wrong fingers reset a partial hold instead of earning success',()=>{const r=new GestureRecognizer();feed(r,feature(),0,450,'ily');const f=feature();f.fingers[3]=finger(false);const out=feed(r,f,750,1300,'ily');assert.equal(out.progress,0);assert.equal(out.success,false);assert.equal(r.updateFeatures(feature(),1400,'ily').progress,0);});
test('Wrong ILY finger receives an actionable correction and affected joint group',()=>{const r=new GestureRecognizer();const f=feature();f.fingers[3]=finger(false);const out=r.updateFeatures(f,0,'ily');assert.match(out.title,/мизинец/);assert.deepEqual(out.badFingers,[4]);assert.equal(out.success,false);});
test('A still fist and tiny tracking jitter never count as YES',()=>{const r=new GestureRecognizer();for(let t=0;t<6000;t+=50){const out=r.updateFeatures(feature('yes',{pitch:Math.sin(t)*.06}),t,'yes');assert.equal(out.success,false);}});
test('YES needs a wrist pitch change AND a return',()=>{const r=new GestureRecognizer();feed(r,feature('yes'),0,250,'yes');assert.equal(feed(r,feature('yes',{pitch:.65}),300,650,'yes').success,false);assert.equal(feed(r,feature('yes'),700,1350,'yes').correct,true);});
test('NO cannot be recognized from a closed pinch alone',()=>{const r=new GestureRecognizer();assert.equal(feed(r,feature('no',{closeGap:.1}),0,2000,'no').success,false);});
test('NO recognizes ordered opening then closing, not an inverted sequence',()=>{const r=new GestureRecognizer();feed(r,feature('no',{closeGap:.1}),0,500,'no');assert.equal(feed(r,feature('no'),550,800,'no').success,false);assert.equal(feed(r,feature('no',{closeGap:.12}),1000,1500,'no').success,true);});
test('NO opening expires after 4.5 seconds; a late sustained closure cannot pass',()=>{const r=new GestureRecognizer();feed(r,feature('no'),0,300,'no');for(let t=350;t<=5000;t+=50)r.updateFeatures(feature('no',{closeGap:.5}),t,'no');for(let t=5050;t<=6500;t+=50)assert.equal(r.updateFeatures(feature('no',{closeGap:.12}),t,'no').success,false);});
test('Changing the lesson resets any partial gesture',()=>{const r=new GestureRecognizer();feed(r,feature(),0,550,'ily');r.updateFeatures(feature('yes'),1000,'yes');assert.equal(r.updateFeatures(feature(),1100,'ily').success,false);});
test('Completion is committed once, then advances on time independently of camera frames',()=>{
 const c=new Course();c.begin(0);assert.equal(c.accept('no',0),false);
 for(const [i,s] of ['ily','yes','no','yes','ily'].entries()){
  const t=1000+i*2000;assert.equal(c.accept(s,t),true);assert.equal(c.status,'completed');assert.equal(c.target,s);assert.equal(c.accept(s,t+100),false);assert.equal(c.advance(t+799),false);assert.equal(c.advance(t+800),true);
 }
 assert.equal(c.stage,'done');assert.equal(c.summary().checks,5);assert.equal(c.summary().score,100);assert.equal(c.accept('ily',20000),false);
});
test('Results record genuine rule confidence, hints and paused time, then reset',()=>{
 const c=new Course();c.begin(1000);c.recordCorrection();c.pause(2000);c.resume(5000);
 for(const [i,s] of ['ily','yes','no','yes','ily'].entries()){
  const t=6000+i*2000;c.observe({confidence:.8,kind:'working'},t);c.observe({confidence:.8,kind:'working'},t+200);c.accept(s,t+300);if(i===4){c.pause(t+400);c.advance(t+26000);}else c.advance(t+1100);
 }
 const result=c.summary();assert.equal(result.score,97);assert.equal(result.accuracy,80);assert.equal(result.hints,1);assert.equal(result.seconds,10);assert.ok(result.bestGesture);c.restart();assert.equal(c.summary().score,0);assert.equal(c.summary().accuracy,0);
});
test('One or two missing frames pause a hold; a longer disappearance resets it',()=>{
 const r=new GestureRecognizer();feed(r,feature(),0,400,'ily');assert.ok(r.updateFeatures(null,450,'ily').progress>0);r.updateFeatures(null,520,'ily');assert.ok(r.updateFeatures(feature(),580,'ily').progress>0);assert.equal(feed(r,feature(),630,980,'ily').correct,true);
 r.reset();feed(r,feature(),0,400,'ily');r.updateFeatures(null,450,'ily');r.updateFeatures(null,900,'ily');assert.equal(r.updateFeatures(feature(),1000,'ily').progress,0);
});
test('Correct, almost and incorrect are distinct and a pass is emitted only once',()=>{
 const r=new GestureRecognizer(),f=feature();f.fingers[3]=finger(false);let out=r.updateFeatures(f,0,'ily');assert.equal(out.state,'Almost');assert.ok(out.errors.includes('Выпрями мизинец'));assert.ok(Number.isFinite(out.confidence));
 out=r.updateFeatures(feature('yes'),100,'ily');assert.equal(out.state,'Incorrect');let count=0;for(let t=200;t<=1800;t+=50)count+=Number(r.updateFeatures(feature(),t,'ily').success);assert.equal(count,1);
});

// A simple synthetic 21-joint skeleton tests geometry, not the neural detector.
function openHand(){return [[.5,.8],[.4,.68],[.32,.61],[.25,.55],[.18,.49],[.42,.55],[.42,.39],[.42,.28],[.42,.19],[.5,.52],[.5,.34],[.5,.22],[.5,.12],[.58,.54],[.58,.39],[.58,.29],[.58,.2],[.65,.59],[.65,.47],[.65,.39],[.65,.3]].map(([x,y])=>({x,y,z:0}));}
test('Geometry recognizes extended fingers and is invariant under translation/scale',()=>{const s=openHand(),a=extractFeatures(s,null,1,'Left');assert.ok(a.fingers.every(f=>f.extended));assert.ok(a.openPalm);const p=s.map(v=>({x:.12+v.x*.8,y:.04+v.y*.8,z:0})),b=extractFeatures(p,null,1,'Left');assert.deepEqual(b.fingers.map(f=>f.extended),a.fingers.map(f=>f.extended));assert.equal(b.thumbOut,a.thumbOut);});
test('Mirroring with the opposite handedness preserves palm orientation',()=>{const p=openHand(),a=extractFeatures(p,null,1,'Left'),b=extractFeatures(p.map(v=>({...v,x:1-v.x})),null,1,'Right');assert.equal(a.facingCamera,b.facingCamera);assert.equal(a.openPalm,b.openPalm);});
test('Invalid or zero-length landmark sets never produce valid features',()=>{assert.equal(extractFeatures([]),null);assert.equal(extractFeatures(Array.from({length:21},()=>({x:0,y:0,z:0}))),null);const p=openHand();p[4].x=NaN;assert.equal(extractFeatures(p),null);});
test('Two-palm pause triggers once per hold and rearms only after release',()=>{const c=new HandCommands(),p=feature('ily',{openPalm:true});c.update([p,p],0);assert.equal(c.update([p,p],1100).action,null);assert.equal(c.update([p,p],1200).action,'pause');assert.equal(c.update([p,p],1400).action,null);c.update([],1600);c.update([],2100);c.update([p,p],2200);assert.equal(c.update([p,p],3500).action,'pause');});
test('Two fists open the reference while a single ASL fist does not trigger UI',()=>{const c=new HandCommands(),p=feature('yes');c.update([p],0);assert.equal(c.update([p],1500).action,null);c.update([p,p],2000);assert.equal(c.update([p,p],3250).action,'example');});
