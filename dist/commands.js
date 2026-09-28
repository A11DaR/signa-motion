// These UI commands are deliberately separate from ASL vocabulary.
export class HandCommands {
 constructor(){this.key=null;this.since=0;this.latched=false;this.releaseSince=null;}
 update(features,time){
  let key=null;
  if(features.length===2&&features.every(f=>f&&!f.cropped&&f.screenScale>.065)){
   if(features.every(f=>f.openPalm))key='pause';
   else if(features.every(f=>f.fingers.every(v=>v.folded)&&!f.thumbOut))key='example';
  }
  if(!key){this.key=null;this.since=0;this.releaseSince??=time;if(time-this.releaseSince>400)this.latched=false;return {key:null,progress:0,action:null};}
  this.releaseSince=null;
  if(key!==this.key){this.key=key;this.since=time;}
  const progress=Math.min(1,(time-this.since)/1200);
  if(progress===1&&!this.latched){this.latched=true;return {key,progress,action:key};}
  return {key,progress,action:null};
 }
}
