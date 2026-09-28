export class FeedbackGate {
 constructor(){this.reset();}
 reset(){this.candidate='';this.since=0;this.visible='';this.errorKey='';this.errorSince=0;this.recorded=false;}
 update(result,time){
  if(result.title!==this.candidate){this.candidate=result.title;this.since=time;}
  const show=!this.visible||this.visible===result.title||time-this.since>=250||result.kind==='tracking'||result.success;
  if(show)this.visible=result.title;
  let correction=false;
  if(result.kind==='correction'){
   const key=result.errors.join('|');if(key!==this.errorKey){this.errorKey=key;this.errorSince=time;this.recorded=false;}
   if(!this.recorded&&time-this.errorSince>=1600){this.recorded=true;correction=true;}
  }else{this.errorKey='';this.recorded=false;}
  return {show,correction};
 }
}
