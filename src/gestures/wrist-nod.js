import {StableHold} from './stability.js?v=20260928-6';
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const clamp=x=>Math.max(-1,Math.min(1,x));
const blend=(a,b,alpha)=>{const v={x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha},n=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/n,y:v.y/n,z:v.z/n};};

export class WristNod {
 constructor(){this.reset();}
 reset(){this.base=null;this.direction=null;this.lastTime=null;this.started=null;this.excursionFrames=0;this.peak=0;this.sign=0;this.turned=false;this.hold=new StableHold(500);}
 pause(time){this.hold.update(false,time);this.lastTime=time;this.excursionFrames=0;}
 update(frame,time){
  if(!frame)return {complete:false,turned:false,returned:false,progress:0,missing:true};
  if(!this.base||time-this.started>6000){this.reset();this.base=frame;this.direction=frame.direction;this.started=time;}
  const dt=this.lastTime===null?80:Math.max(0,time-this.lastTime);this.lastTime=time;
  this.direction=blend(this.direction,frame.direction,1-Math.exp(-dt/55));
  // Measure flexion in the hand's initial local plane, independent of how the
  // user faces the camera. Moving the whole fist without tilting cancels out.
  const angle=Math.atan2(dot(this.direction,this.base.normal),dot(this.direction,this.base.direction));
  const lateral=Math.abs(Math.asin(clamp(dot(this.direction,this.base.across))));
  const amplitude=Math.abs(angle),direction=Math.sign(angle);
  if(!this.turned){
   if(amplitude>.24&&lateral<.4){
    this.excursionFrames=direction===this.sign?this.excursionFrames+1:1;this.sign=direction;this.peak=Math.max(this.peak,amplitude);
    if(this.excursionFrames>=2&&time-this.started>=100)this.turned=true;
   }else this.excursionFrames=0;
  }else if(direction===this.sign)this.peak=Math.max(this.peak,amplitude);
  const returned=this.turned&&amplitude<Math.max(.19,Math.min(.3,this.peak*.5))&&lateral<.35;
  const hold=this.hold.update(returned,time);
  return {complete:hold.success,turned:this.turned,returned,lateral:lateral>.4,progress:this.turned?.55+hold.progress*.45:Math.min(.45,amplitude/.24*.45)};
 }
}
