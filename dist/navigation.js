// Navigation has a deliberate open-palm entry and fist exit, so a noisy frame
// cannot steal a learning gesture. Pinching is a click only in navigation mode.
export class HandNavigation {
 constructor(){this.reset();}
 reset(){this.active=false;this.openSince=null;this.fistSince=null;this.pinchSince=null;this.lessonSince=null;this.pinched=false;this.lastSeen=null;this.waitForRelease=false;}
 suspendEntryUntilRelease(){this.waitForRelease=true;}
 setActive(active){this.reset();this.active=active;}
 update(f,time,lessonPose=false){
  if(this.waitForRelease){if(f?.openPalm)return {active:false,changed:false,click:false,entryProgress:0};this.waitForRelease=false;}
  if(!f||f.cropped){this.openSince=null;this.fistSince=null;this.pinchSince=null;this.lessonSince=null;this.pinched=false;return {active:this.active,changed:false,click:false,entryProgress:0};}
  if(this.lastSeen!==null&&time-this.lastSeen>1200){this.openSince=null;this.fistSince=null;this.pinchSince=null;this.lessonSince=null;this.pinched=false;}
  this.lastSeen=time;
  if(!this.active){
   if(f.openPalm)this.openSince??=time;else this.openSince=null;
   const progress=this.openSince===null?0:Math.min(1,(time-this.openSince)/400);
   if(progress===1){this.active=true;this.openSince=null;return {active:true,changed:true,click:false,entryProgress:1};}
   return {active:false,changed:false,click:false,entryProgress:progress};
  }
  if(lessonPose){
   this.lessonSince??=time;
   if(time-this.lessonSince>=400){this.setActive(false);return {active:false,changed:true,click:false,entryProgress:0};}
   return {active:true,changed:false,click:false,intent:'lesson',entryProgress:0};
  }
  this.lessonSince=null;
  const fist=f.fingers.every(v=>v.folded)&&!f.thumbOut;
  if(fist)this.fistSince??=time;else this.fistSince=null;
  if(this.fistSince!==null&&time-this.fistSince>=500){this.setActive(false);return {active:false,changed:true,click:false,entryProgress:0};}
  const gap=f.pinchGap??1;
  if(gap>.48){this.pinched=false;this.pinchSince=null;}
  if(gap<.3&&!fist&&!this.pinched){this.pinchSince??=time;if(time-this.pinchSince>=80){this.pinched=true;return {active:true,changed:false,click:true,entryProgress:0};}}
  else if(gap>=.3)this.pinchSince=null;
  return {active:true,changed:false,click:false,entryProgress:0};
 }
}
