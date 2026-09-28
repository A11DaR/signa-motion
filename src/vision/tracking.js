export class FrameTracker {
 // Window methods must keep their global receiver. Storing the native function
 // and calling this.raf()/this.caf() throws Illegal invocation in browsers.
 constructor({raf=callback=>globalThis.requestAnimationFrame(callback),caf=id=>globalThis.cancelAnimationFrame(id),visible=()=>!document.hidden,canvasFactory=()=>document.createElement('canvas')}={}){this.raf=raf;this.caf=caf;this.visible=visible;this.canvasFactory=canvasFactory;this.epoch=0;this.request=null;this.session=null;this.brightness=null;this.lightAt=0;}
 start(session,onFrame,onError){
  this.stop();this.session=session;const epoch=this.epoch;let busy=false,lastFrame=-1,lastAt=-Infinity,errors=0;
  const tick=async time=>{
   if(epoch!==this.epoch)return;
   this.request=this.raf(tick);
   const video=session.video,model=session.model;
   if(busy||!model||!this.visible()||video.readyState<2||video.currentTime===lastFrame||time-lastAt<70)return;
   lastAt=time;lastFrame=video.currentTime;busy=true;
   try{
    const result=await model.detectForVideo(video,time);
    if(epoch!==this.epoch)return;
    if(time-this.lightAt>1000){this.lightAt=time;this.brightness=this.measureLight(video);}
    onFrame(result,time,{brightness:this.brightness});errors=0;
   }catch(error){if(epoch===this.epoch&&++errors>=5){this.stop();onError(error);}}
   finally{busy=false;}
  };
  this.request=this.raf(tick);
 }
 measureLight(video){try{this.lightCanvas??=this.canvasFactory();const c=this.lightCanvas;c.width=24;c.height=18;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,24,18);const {data}=ctx.getImageData(0,0,24,18);let total=0;for(let i=0;i<data.length;i+=4)total+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];return total/(data.length/4);}catch{return null;}}
 stop(){this.epoch++;if(this.request!==null)this.caf?.(this.request);this.request=null;this.session=null;}
}
