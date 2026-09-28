export class StableHold {
 constructor(duration=700,grace=320){this.duration=duration;this.grace=grace;this.reset();}
 reset(){this.elapsed=0;this.lastTime=null;this.lastValid=false;this.invalidSince=null;this.goodFrames=0;}
 update(valid,time){
  let delta=this.lastTime===null?0:time-this.lastTime;
  if(delta<0||delta>1200){this.reset();delta=0;}
  if(valid){
   if(this.invalidSince!==null&&time-this.invalidSince>this.grace){this.elapsed=0;this.goodFrames=0;}
   if(this.lastValid)this.elapsed+=Math.min(delta,350);
   this.goodFrames++;this.invalidSince=null;
  }else{
   this.invalidSince??=time;
   if(time-this.invalidSince>this.grace){this.elapsed=0;this.goodFrames=0;}
  }
  this.lastTime=time;this.lastValid=valid;
  return {progress:Math.min(1,this.elapsed/this.duration),success:valid&&this.elapsed>=this.duration&&this.goodFrames>=3,grace:!valid&&this.elapsed>0&&time-this.invalidSince<=this.grace};
 }
}
