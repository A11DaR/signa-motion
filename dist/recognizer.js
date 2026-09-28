import {StableHold} from './stability.js?v=20260928-4';
import {validateGesture,assessment,trackingIssue} from './gesture-rules.js?v=20260928-4';
import {extractFeatures} from './landmarks.js?v=20260928-4';
export {extractFeatures,CONNECTIONS,matchesLessonPose} from './landmarks.js?v=20260928-4';
export {StableHold} from './stability.js?v=20260928-4';
export {detectGesture,validateGesture,getGestureErrors} from './gesture-rules.js?v=20260928-4';
const motionCheck=(label,pass,error)=>({label,pass,error,weight:2,score:Number(pass),badFingers:[]});
export class GestureRecognizer {
 constructor(){this.profile=null;this.reset();}
 setProfile(profile){this.profile=profile;this.reset();}
 reset(){this.hold=new StableHold(700);this.openHold=new StableHold(180,200);this.turnHold=new StableHold(150,150);this.lastSeen=null;this.lastTarget=null;this.lostSince=null;this.shapeLostSince=null;this.phase='start';this.basePitch=null;this.lastPitch=null;this.motionStarted=null;this.latched=false;}
 update(screen,world,time,target,aspect=4/3,handedness='Right'){return this.updateFeatures(extractFeatures(screen,world,aspect,handedness),time,target);}
 updateFeatures(f,time,target){
  if(target!==this.lastTarget||(this.lastSeen!==null&&(time-this.lastSeen>1200||time<this.lastSeen))){this.reset();this.lastTarget=target;}
  this.lastSeen=time;
  const report=(a,{title,detail='',progress=0,success=false,tracking=false}={})=>{
   const state=tracking?'Tracking':success||this.latched?'Correct':a.errors.length<=2?'Almost':'Incorrect';
   return {...a,correct:state==='Correct',state,kind:tracking?'tracking':state==='Correct'?'success':a.errors.length?'correction':'working',title:title??a.errors[0]??'Форма верная — удержи жест',detail,progress,success,features:f,poseMatched:a.poseCorrect};
  };
  const issue=trackingIssue(f,this.profile);
  if(issue){
   this.lostSince??=time;const hold=this.hold.update(false,time);
   if(time-this.lostSince>320){const targetBefore=this.lastTarget;this.reset();this.lastTarget=targetBefore;this.lastSeen=time;this.lostSince=time;}
   return report({gesture:target,confidence:0,poseCorrect:false,checks:[],errors:[issue.title],badFingers:[]},{...issue,progress:hold.grace?hold.progress:0,tracking:true});
  }
  this.lostSince=null;
  if(this.latched)return report(validateGesture(target,f),{title:'Жест уже засчитан',progress:1});
  let a=validateGesture(target,f,{phase:this.phase==='start'?'open':'closing'});
  if(!a.poseCorrect){
   this.shapeLostSince??=time;const hold=this.hold.update(false,time);
   if(time-this.shapeLostSince>320){this.phase='start';this.basePitch=null;this.lastPitch=null;this.motionStarted=null;this.openHold.reset();this.turnHold.reset();}
   return report(a,{progress:hold.progress,detail:a.errors.slice(1,3).join(' · ')||'Поправь положение пальцев по подсказке.'});
  }
  this.shapeLostSince=null;
  if(target==='ily'){
   const hold=this.hold.update(true,time);const success=hold.success;
   if(success)this.latched=true;
   return report(a,{title:success?'Получилось! «Я тебя люблю»':'Форма верная — удержи жест',detail:success?'Жест засчитан.':'Держи спокойно ещё '+Math.max(0,(700-this.hold.elapsed)/1000).toFixed(1)+' с.',progress:hold.progress,success});
  }
  if(target==='yes'){
   let pitch=f.pitch;
   if(this.lastPitch!==null){while(pitch-this.lastPitch>Math.PI)pitch-=Math.PI*2;while(pitch-this.lastPitch<-Math.PI)pitch+=Math.PI*2;pitch=this.lastPitch*.6+pitch*.4;}
   this.lastPitch=pitch;
   if(this.basePitch===null||time-this.motionStarted>5000){this.basePitch=pitch;this.motionStarted=time;this.phase='start';this.turnHold.reset();this.hold=new StableHold(500);}
   const displacement=Math.abs(pitch-this.basePitch);
   if(this.phase==='start'&&this.turnHold.update(displacement>.32,time).success){this.phase='return';this.hold.reset();}
   const turned=this.phase==='return';
   const hold=turned?this.hold.update(displacement<.17,time):{progress:0,success:false};
   a=assessment(target,[...a.checks,motionCheck('Кивок кистью',turned,'Кивни кулаком вниз, сгибая запястье'),motionCheck('Возврат',turned&&displacement<.17,'Верни кисть в исходное положение')]);
   if(hold.success)this.latched=true;
   return report(a,{title:hold.success?'Получилось! «Да»':!turned?'Кивни кулаком вниз и обратно':displacement>=.17?'Теперь верни кисть обратно':'Возврат верный — задержи кулак',detail:'Двигай кистью в запястье; перемещение всей руки не считается кивком.',progress:hold.success?1:turned?.55+hold.progress*.45:Math.min(.45,displacement/.32*.45),success:hold.success});
  }
  if(target==='no'){
   if(this.phase!=='start'&&time-this.motionStarted>4500){this.phase='start';this.openHold.reset();this.hold.reset();return this.updateFeatures(f,time,target);}
   if(this.phase==='start'){
    const open=this.openHold.update(true,time);if(open.success){this.phase='close';this.motionStarted=time;this.hold=new StableHold(500);}
    a=assessment(target,[...a.checks,motionCheck('Смыкание',false,'Теперь коснись большого обоими пальцами')]);
    return report(a,{title:'Теперь сомкни два пальца с большим',detail:'Указательный и средний должны коснуться большого.',progress:open.progress*.4});
   }
   const closed=f.closeGap<.32,hold=this.hold.update(closed,time);
   a=assessment(target,[...a.checks,motionCheck('Оба кончика сомкнуты',closed,'Коснись большого обоими пальцами')]);
   if(hold.success)this.latched=true;
   return report(a,{title:hold.success?'Получилось! «Нет»':closed?'Пальцы сомкнуты — задержи жест':'Коснись большого обоими пальцами',detail:'Сохрани согнутыми безымянный палец и мизинец.',progress:.4+hold.progress*.6,success:hold.success});
  }
  return report(a,{title:'Покажи текущий учебный жест'});
 }
}
