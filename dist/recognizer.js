// Own geometric and temporal rules. MediaPipe supplies landmarks, not ASL labels.
export const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const clamp = (x,min=0,max=1)=>Math.max(min,Math.min(max,x));
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:(a.z??0)-(b.z??0)});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=a=>Math.hypot(a.x,a.y,a.z);
const dist=(a,b)=>norm(sub(a,b));
const angle=(a,b,c)=>{const u=sub(a,b),v=sub(c,b);return Math.acos(clamp(dot(u,v)/(norm(u)*norm(v)||1),-1,1))*180/Math.PI;};
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});

export function extractFeatures(screen, world=null, aspect=4/3, handedness='Right') {
 if(!Array.isArray(screen)||screen.length!==21||screen.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z??0))) return null;
 const validWorld=Array.isArray(world)&&world.length===21&&world.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));
 const p=validWorld?world:screen.map(q=>({x:q.x*aspect,y:q.y,z:(q.z??0)*aspect}));
 const scale=dist(p[5],p[17]);
 if(scale<.00001) return null;
 const fingers=[5,9,13,17].map(m=>{
   const bend=angle(p[m],p[m+1],p[m+2]);
   const tipBend=angle(p[m+1],p[m+2],p[m+3]);
   const reach=dist(p[m+3],p[0])/(dist(p[m+1],p[0])||1);
   return {bend,reach,extended:bend>150&&tipBend>140&&reach>1.055,folded:bend<133||reach<.98};
 });
 const thumbOut=dist(p[4],p[5])/scale>.68&&angle(p[2],p[3],p[4])>140&&dist(p[4],p[17])/scale>1.2;
 const palmNormal=cross(sub(p[5],p[0]),sub(p[17],p[0]));
 // MediaPipe handedness is for the unmirrored input. Sign changes under mirroring.
 const facingCamera=(handedness==='Left'?-1:1)*palmNormal.z/(norm(palmNormal)||1)>.3;
 const v=sub(p[9],p[0]);
 const pitch=Math.atan2(v.z,-v.y);
 const screenScale=Math.hypot((screen[5].x-screen[17].x)*aspect,screen[5].y-screen[17].y);
 const cropped=screen.some(q=>q.x<.015||q.x>.985||q.y<.015||q.y>.985);
 const closeGap=Math.max(dist(p[8],p[4]),dist(p[12],p[4]))/scale;
 return {fingers,thumbOut,facingCamera,pitch,scale,screenScale,cropped,closeGap,
   pairTogether:dist(p[8],p[12])/scale<.6,
   openPalm:fingers.every(f=>f.extended)&&thumbOut&&facingCamera,
   center:{x:(screen[0].x+screen[9].x)/2,y:(screen[0].y+screen[9].y)/2},
   indexUpright:screen[8].y<screen[5].y-.02,
 };
}

export class GestureRecognizer {
 constructor(){this.reset();}
 reset(){this.ilyStart=null;this.noStart=null;this.noArmed=null;this.yesStart=null;this.yesBase=null;this.yesTurn=null;this.lastSeen=null;this.lastTarget=null;this.lastPitch=null;}
 update(screen,world,time,target,aspect=4/3,handedness='Right'){
   return this.updateFeatures(extractFeatures(screen,world,aspect,handedness),time,target);
 }
 updateFeatures(f,time,target){
  if(target!==this.lastTarget || (this.lastSeen!==null&&time-this.lastSeen>250)) {this.reset();this.lastTarget=target;}
  const result=(title,detail,checks=[],progress=0,success=false,kind='working',badFingers=[])=>({title,detail,checks,progress,success,kind,badFingers,features:f});
  const missing=(title,detail)=>{this.reset();this.lastTarget=target;return result(title,detail,[],0,false,'tracking');};
  if(!f) return missing('Покажи руку целиком','Держи кисть перед камерой на однотонном фоне.');
  this.lastSeen=time;
  if(f.cropped) return missing('Кисть выходит из кадра','Отодвинь руку от края, чтобы были видны все пальцы и запястье.');
  if(f.screenScale<.065) return missing('Поднеси руку ближе','Кисть слишком маленькая в кадре для проверки пальцев.');
  if(f.screenScale>.62) return missing('Отодвинь руку немного дальше','Оставь место вокруг кисти и для её движения.');
  const [index,middle,ring,pinky]=f.fingers;
  const ilyShape=index.extended&&pinky.extended&&middle.folded&&ring.folded&&f.thumbOut;
  const fist=f.fingers.every(x=>x.folded)&&!f.thumbOut;
  if(target==='ily'){
   const checks=[{label:'Пальцы',pass:ilyShape},{label:'Ладонь',pass:f.facingCamera&&f.indexUpright},{label:'Удержание',pass:false}];
   const fail=(title,bad=[])=>{this.ilyStart=null;return result(title,'Поправь положение — подсказка обновится сама.',checks,0,false,'correction',bad);};
   if(!index.extended) return fail('Выпрями указательный палец',[1]);
   if(!pinky.extended) return fail('Выпрями мизинец',[4]);
   if(!middle.folded) return fail('Согни средний палец к ладони',[2]);
   if(!ring.folded) return fail('Согни безымянный палец к ладони',[3]);
   if(!f.thumbOut) return fail('Отведи большой палец в сторону',[0]);
   if(!f.facingCamera) return fail('Разверни ладонь к камере');
   if(!f.indexUpright) return fail('Направь указательный палец вверх',[1]);
   this.ilyStart??=time;
   const progress=clamp((time-this.ilyStart)/1000);checks[2].pass=progress>=1;
   return result(progress>=1?'Получилось! «Я тебя люблю»':'Верно! Удержи положение','Большой, указательный и мизинец раскрыты.',checks,progress,progress>=1,progress>=1?'success':'working');
  }
  if(target==='yes'){
   const checks=[{label:'Кулак',pass:fist},{label:'Движение',pass:this.yesTurn!==null},{label:'Возврат',pass:false}];
   if(!fist){this.yesBase=null;this.yesStart=null;this.yesTurn=null;this.lastPitch=null;return result(ilyShape?'Сейчас нужен жест «Да»':'Собери пальцы в кулак','Большой палец положи поверх согнутых пальцев.',checks,0,false,'correction',f.fingers.map((v,i)=>v.folded?null:i+1).filter(v=>v!==null));}
   // Smooth only relative wrist pitch: translating the entire arm cannot complete YES.
   let pitch=f.pitch;
   if(this.lastPitch!==null){while(pitch-this.lastPitch>Math.PI)pitch-=2*Math.PI;while(pitch-this.lastPitch<-Math.PI)pitch+=2*Math.PI;pitch=.4*pitch+.6*this.lastPitch;}
   this.lastPitch=pitch;
   if(this.yesBase===null||time-this.yesStart>3200){this.yesBase=pitch;this.yesStart=time;this.yesTurn=null;}
   if(Math.abs(pitch-this.yesBase)>.32 && time-this.yesStart>180 && this.yesTurn===null)this.yesTurn=time;
   if(this.yesTurn!==null){
    checks[1].pass=true;
    if(Math.abs(pitch-this.yesBase)<.14&&time-this.yesTurn>150){checks[2].pass=true;return result('Получилось! «Да»','Кивок кистью распознан.',checks,1,true,'success');}
    return result('Теперь верни кисть в исходное положение','Заверши кивок, продолжая держать кулак.',checks,.7);
   }
   return result('Кивни кулаком вниз и обратно','Сгибай кисть в запястье, как будто она кивает «да».',checks,.2+clamp(Math.abs(pitch-this.yesBase)/.32)*.3,false,'correction');
  }
  if(target==='no'){
   const base=ring.folded&&pinky.folded;
   const checks=[{label:'Два пальца',pass:base&&f.pairTogether},{label:'Раскрытие',pass:this.noArmed!==null},{label:'Смыкание',pass:false}];
   if(!base){this.noArmed=null;this.noStart=null;return result('Согни безымянный палец и мизинец','Для «Нет» работают указательный, средний и большой.',checks,0,false,'correction',[...(!ring.folded?[3]:[]),...(!pinky.folded?[4]:[])]);}
   if(this.noArmed!==null&&time-this.noArmed>3500){this.noArmed=null;this.noStart=null;}
   if(this.noArmed===null){
    const open=index.extended&&middle.extended&&f.closeGap>.72&&f.pairTogether;
    if(!open){this.noStart=null;return result(!f.pairTogether?'Держи указательный и средний рядом':'Раскрой указательный и средний пальцы','Отведи большой палец: затем сомкни с ним оба кончика.',checks,0,false,'correction',[1,2]);}
    this.noStart??=time;
    if(time-this.noStart>=180)this.noArmed=time;
    checks[1].pass=this.noArmed!==null;
    return result('Теперь сомкни два пальца с большим','Указательный и средний должны коснуться большого.',checks,.45);
   }
   checks[1].pass=true;
   if(f.closeGap<.32&&time-this.noArmed>150){checks[2].pass=true;return result('Получилось! «Нет»','Смыкание двух пальцев с большим распознано.',checks,1,true,'success');}
   return result('Коснись большого обоими пальцами','Сомкни указательный и средний с большим пальцем.',checks,.5+clamp((.75-f.closeGap)/.43)*.4,false,'correction',[1,2]);
  }
  return result('Урок завершён','Раскрой ладонь для управления кнопками.');
 }
}
