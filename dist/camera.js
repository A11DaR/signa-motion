export async function loadHandModel(){
 const {FilesetResolver,HandLandmarker}=await import('./vendor/vision_bundle.mjs');
 const files=await FilesetResolver.forVisionTasks(new URL('./vendor/',import.meta.url).href.replace(/\/$/,''));
 if(files.wasmBinaryPath.includes('nosimd'))throw Object.assign(new Error('WebAssembly SIMD required'),{name:'UnsupportedWasm'});
 const options={baseOptions:{modelAssetPath:new URL('./models/hand_landmarker.task',import.meta.url).href,delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.65};
 try{return await HandLandmarker.createFromOptions(files,options);}catch{options.baseOptions.delegate='CPU';return HandLandmarker.createFromOptions(files,options);}
}
export const CAMERA_ERRORS={
 NotAllowedError:['Доступ к камере запрещён','Разреши камеру в настройках сайта и нажми «Включить камеру».'],
 NotFoundError:['Камера не найдена','Подключи веб-камеру или открой сайт на телефоне.'],
 NotReadableError:['Камера занята','Закрой другие приложения с камерой и попробуй ещё раз.'],
 InsecureContext:['Нужен защищённый адрес','Открой приложение по HTTPS или на localhost.'],
 Unsupported:['Камера не поддерживается','Открой сайт в актуальном Chrome, Edge или Safari.'],
 UnsupportedWasm:['Нужно обновить браузер','Распознаванию нужна поддержка WebAssembly SIMD.'],
 CameraTimeout:['Нет изображения с камеры','Попробуй другую камеру или повтори подключение.'],
 AbortError:['Подключение отменено','Можно включить камеру снова.']
};
const stopTracks=stream=>stream?.getTracks().forEach(track=>track.stop());
export class CameraSession {
 constructor(video,{mediaDevices=globalThis.navigator?.mediaDevices,secure=()=>globalThis.isSecureContext??window.isSecureContext,modelFactory=loadHandModel,onEnded=()=>{}}={}){this.video=video;this.mediaDevices=mediaDevices;this.secure=secure;this.modelFactory=modelFactory;this.onEnded=onEnded;this.epoch=0;this.stream=null;this.model=null;this.pending=null;this.abort=null;}
 start(facing='user',onStage=()=>{}){
  if(this.pending)return this.pending;
  this.stop();const epoch=this.epoch,controller=new AbortController();this.abort=controller;
  const job=(async()=>{
   if(!this.secure())throw Object.assign(new Error('HTTPS required'),{name:'InsecureContext'});
   if(!this.mediaDevices?.getUserMedia)throw Object.assign(new Error('No camera API'),{name:'Unsupported'});
   onStage('permission');
   const stream=await this.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});
   if(epoch!==this.epoch){stopTracks(stream);return false;}
   this.stream=stream;this.video.srcObject=stream;
   if(this.video.readyState<1)await new Promise((resolve,reject)=>{
    let timer;const clear=()=>{clearTimeout(timer);this.video.removeEventListener('loadedmetadata',ready);this.video.removeEventListener('error',failed);controller.signal.removeEventListener('abort',cancelled);};
    const ready=()=>{clear();resolve();},failed=()=>{clear();reject(Object.assign(new Error('Camera failed'),{name:'NotReadableError'}));},cancelled=()=>{clear();reject(Object.assign(new Error('Cancelled'),{name:'AbortError'}));};
    this.video.addEventListener('loadedmetadata',ready);this.video.addEventListener('error',failed);controller.signal.addEventListener('abort',cancelled,{once:true});timer=setTimeout(()=>{clear();reject(Object.assign(new Error('Camera timeout'),{name:'CameraTimeout'}));},12000);
   });
   await this.video.play();if(epoch!==this.epoch)return false;
   onStage('model');const model=await this.modelFactory();
   if(epoch!==this.epoch){model.close();return false;}
   this.model=model;
   stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(epoch===this.epoch)this.onEnded();},{once:true}));
   return true;
  })();
  this.pending=job;
  job.catch(()=>{if(epoch===this.epoch)this.stop();}).finally(()=>{if(this.pending===job)this.pending=null;});
  return job;
 }
 stop(){this.epoch++;this.abort?.abort();this.abort=null;this.pending=null;stopTracks(this.stream);this.stream=null;this.video.srcObject=null;try{this.model?.close();}catch{}this.model=null;}
 get facing(){return this.stream?.getVideoTracks()[0]?.getSettings?.().facingMode;}
}
