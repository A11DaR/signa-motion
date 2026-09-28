import {StableHold} from './stability.js?v=20260928-6';
import {validateGesture,assessment,trackingIssue} from './gesture-rules.js?v=20260928-6';
import {extractFeatures} from './landmarks.js?v=20260928-6';
import {WristNod} from './wrist-nod.js?v=20260928-6';
export {extractFeatures,CONNECTIONS,matchesLessonPose} from './landmarks.js?v=20260928-6';
export {StableHold} from './stability.js?v=20260928-6';
export {detectGesture,validateGesture,getGestureErrors} from './gesture-rules.js?v=20260928-6';
const motionCheck=(label,pass,error)=>({label,pass,error,weight:2,score:Number(pass),badFingers:[]});
export class GestureRecognizer {
 constructor(){this.profile=null;this.reset();}
 setProfile(profile){this.profile=profile;this.reset();}
 reset(){this.hold=new StableHold(700);this.openHold=new StableHold(180,200);this.yesMotion=new WristNod();this.lastSeen=null;this.lastTarget=null;this.lostSince=null;this.shapeLostSince=null;this.phase='start';this.openGap=null;this.motionStarted=null;this.latched=false;this.lastProgress=0;}
 update(screen,world,time,target,aspect=4/3,handedness='Right'){return this.updateFeatures(extractFeatures(screen,world,aspect,handedness),time,target);}
 updateFeatures(f,time,target){
  if(target!==this.lastTarget||(this.lastSeen!==null&&(time-this.lastSeen>1200||time<this.lastSeen))){this.reset();this.lastTarget=target;}
  this.lastSeen=time;
  const report=(a,{title,detail='',progress=0,success=false,tracking=false}={})=>{
   const state=tracking?'Tracking':success||this.latched?'Correct':a.errors.length<=2?'Almost':'Incorrect';
   if(!tracking)this.lastProgress=progress;
   return {...a,correct:state==='Correct',state,kind:tracking?'tracking':state==='Correct'?'success':a.errors.length?'correction':'working',title:title??a.errors[0]??'Форма верная — удержи жест',detail,progress,success,features:f,poseMatched:a.poseCorrect};
  };
  const issue=trackingIssue(f,this.profile);
  if(issue){
   this.lostSince??=time;this.hold.update(false,time);this.openHold.update(false,time);this.yesMotion.pause(time);
   if(time-this.lostSince>320){const targetBefore=this.lastTarget;this.reset();this.lastTarget=targetBefore;this.lastSeen=time;this.lostSince=time;}
   return report({gesture:target,confidence:0,poseCorrect:false,checks:[],errors:[issue.title],badFingers:[]},{...issue,progress:time-this.lostSince<=320?this.lastProgress:0,tracking:true});
  }
  this.lostSince=null;
  if(this.latched)return report(validateGesture(target,f),{title:'Жест уже засчитан',progress:1});
  let a=validateGesture(target,f,{phase:this.phase==='start'?'open':'closing'});
  if(!a.poseCorrect){
   this.shapeLostSince??=time;this.hold.update(false,time);this.openHold.update(false,time);this.yesMotion.pause(time);
   if(time-this.shapeLostSince>320){this.phase='start';this.openGap=null;this.motionStarted=null;this.openHold.reset();this.yesMotion.reset();}
   return report(a,{progress:time-this.shapeLostSince<=320?this.lastProgress:0,detail:a.errors.slice(1,3).join(' · ')||'Поправь положение пальцев по подсказке.'});
  }
  this.shapeLostSince=null;
  if(target==='ily'){
   const hold=this.hold.update(true,time);const success=hold.success;
   if(success)this.latched=true;
   return report(a,{title:success?'Получилось! «Я тебя люблю»':'Форма верная — удержи жест',detail:success?'Жест засчитан.':'Держи спокойно ещё '+Math.max(0,(700-this.hold.elapsed)/1000).toFixed(1)+' с.',progress:hold.progress,success});
  }
  if(target==='yes'){
   const motion=this.yesMotion.update(f.palmFrame,time);
   a=assessment(target,[...a.checks,motionCheck('Кивок кистью',motion.turned,'Кивни кулаком вниз, сгибая запястье'),motionCheck('Возврат',motion.returned,motion.turned?'Верни кулак обратно и задержи на полсекунды':'После кивка верни кулак обратно')]);
   if(motion.complete)this.latched=true;
   const title=motion.complete?'Получилось! «Да»':motion.missing?'Поверни кулак немного к камере':motion.lateral?'Кивни кистью вниз, а не вбок':!motion.turned?'Кулак верный — плавно кивни вниз и обратно':!motion.returned?'Кивок замечен — верни кулак обратно':'Возврат верный — задержи кулак';
   return report(a,{title,detail:motion.returned?'Задержи кулак на полсекунды — жест будет засчитан.':'Согни кисть и разогни обратно одним движением. Внизу останавливаться не нужно.',progress:motion.progress,success:motion.complete});
  }
  if(target==='no'){
   if(this.phase!=='start'&&time-this.motionStarted>4500){this.phase='start';this.openGap=null;this.openHold.reset();this.hold.reset();return this.updateFeatures(f,time,target);}
   if(this.phase==='start'){
    this.openGap=Math.max(this.openGap??0,f.closeGap);const open=this.openHold.update(true,time);if(open.success){this.phase='close';this.motionStarted=time;this.hold=new StableHold(500);}
    a=assessment(target,[...a.checks,motionCheck('Смыкание',false,open.success?'Теперь коснись большого обоими пальцами':'Задержи раскрытые пальцы до подсказки')]);
    return report(a,{title:open.success?'Теперь сомкни два пальца с большим':'Раскрой два пальца и ненадолго задержи',detail:open.success?'Указательный и средний должны коснуться большого.':'Подожди подсказку «Теперь сомкни» перед движением.',progress:open.progress*.4});
   }
   const fingersForward=f.fingers.slice(0,2).every(v=>v.reach>.98);
   const closed=f.closeGap<.48&&f.screenCloseGap<.5&&f.closeGap<this.openGap*.55&&fingersForward,hold=this.hold.update(closed,time);
   a=assessment(target,[...a.checks,motionCheck('Два пальца к большому',fingersForward,'Не сжимай кулак: направь указательный и средний к большому'),motionCheck('Оба кончика сомкнуты',closed,'Коснись большого обоими пальцами')]);
   if(hold.success)this.latched=true;
   return report(a,{title:hold.success?'Получилось! «Нет»':!fingersForward?'Не сжимай всю руку в кулак':closed?'Пальцы сомкнуты — задержи жест':'Теперь сомкни два пальца с большим',detail:'Сохрани согнутыми безымянный палец и мизинец.',progress:.4+hold.progress*.6,success:hold.success});
  }
  return report(a,{title:'Покажи текущий учебный жест'});
 }
}
