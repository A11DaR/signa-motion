import {matchesLessonPose} from './landmarks.js?v=20260928-4';
const clamp=x=>Math.max(0,Math.min(1,x));
const fingerScore=(f,extended)=>extended?clamp((f.bend-105)/50)*clamp((f.reach-.94)/.3):Math.max(clamp((145-f.bend)/55),clamp((1.08-f.reach)/.3));
function check(label,pass,error,badFingers=[],score=Number(pass),weight=1){return {label,pass,error,badFingers,score:pass?Math.max(.9,score):Math.min(.85,score),weight};}
export function trackingIssue(f,profile=null){
 if(!f)return {code:'missing',title:'Покажи руку целиком',detail:'Помести кисть перед камерой. Свет должен падать на ладонь.'};
 if(f.cropped)return {code:'cropped',title:'Кисть выходит из кадра',detail:'Отодвинь руку от края: нужны все пальцы и запястье.'};
 const min=profile?Math.max(.05,profile.palmSize*.38):.065,max=profile?Math.min(.7,Math.max(.4,profile.palmSize*2.4)):.62;
 if(f.screenScale<min)return {code:'far',title:'Поднеси руку ближе',detail:'Кисть слишком маленькая, чтобы уверенно различать пальцы.'};
 if(f.screenScale>max)return {code:'near',title:'Отодвинь руку немного дальше',detail:'Оставь место вокруг кисти и для её движения.'};
 return null;
}
export function validateGesture(gesture,f,{phase='open'}={}){
 if(!f)return {gesture,confidence:0,poseCorrect:false,checks:[],errors:['Покажи руку целиком'],badFingers:[]};
 const [index,middle,ring,pinky]=f.fingers;
 const finger=(label,v,extended,error,id)=>check(label,extended?v.extended:v.folded,error,[id],fingerScore(v,extended));
 let checks=[];
 if(gesture==='ily')checks=[
  check('Большой раскрыт',f.thumbOut,'Отведи большой палец в сторону',[0]),
  finger('Указательный прямой',index,true,'Выпрями указательный палец',1),
  finger('Средний согнут',middle,false,'Согни средний палец к ладони',2),
  finger('Безымянный согнут',ring,false,'Согни безымянный палец к ладони',3),
  finger('Мизинец прямой',pinky,true,'Выпрями мизинец',4),
  check('Ладонь к камере',f.facingCamera,'Разверни ладонь к камере'),
  check('Пальцы вверх',f.indexUpright,'Направь указательный палец вверх',[1])
 ];
 if(gesture==='yes')checks=[...f.fingers.map((v,i)=>finger(['Указательный согнут','Средний согнут','Безымянный согнут','Мизинец согнут'][i],v,false,'Согни '+['указательный палец','средний палец','безымянный палец','мизинец'][i]+' к ладони',i+1)),check('Большой поверх пальцев',!f.thumbOut,'Положи большой палец поверх кулака',[0])];
 if(gesture==='no'){
  checks=[finger('Безымянный согнут',ring,false,'Согни безымянный палец',3),finger('Мизинец согнут',pinky,false,'Согни мизинец',4)];
  if(phase==='open')checks.push(finger('Указательный прямой',index,true,'Раскрой указательный палец',1),finger('Средний прямой',middle,true,'Раскрой средний палец',2),check('Два пальца рядом',f.pairTogether,'Держи указательный и средний рядом',[1,2]),check('Пальцы раскрыты',f.closeGap>.72,'Разведи большой палец и два кончика перед смыканием',[0,1,2]));
 }
 return assessment(gesture,checks);
}
export function assessment(gesture,checks){
 const failures=checks.filter(v=>!v.pass),weight=checks.reduce((n,v)=>n+(v.weight??1),0);
 return {gesture,confidence:weight?checks.reduce((n,v)=>n+(v.score??Number(v.pass))*(v.weight??1),0)/weight:0,poseCorrect:checks.length>0&&!failures.length,checks,errors:failures.map(v=>v.error),badFingers:[...new Set(failures.flatMap(v=>v.badFingers??[]))]};
}
export function getGestureErrors(gesture,features,options){return validateGesture(gesture,features,options).errors;}
export function detectGesture(f){
 if(!f)return {gesture:null,confidence:0};
 if(matchesLessonPose(f,'ily'))return {gesture:'ily',confidence:validateGesture('ily',f).confidence};
 if(f.openPalm)return {gesture:'open_palm',confidence:.95};
 if(f.fingers.every(v=>v.folded)&&!f.thumbOut)return {gesture:'fist',confidence:validateGesture('yes',f).confidence};
 const [i,m,r,p]=f.fingers;
 if(i.extended&&m.extended&&r.folded&&p.folded)return {gesture:'two_fingers',confidence:.85};
 return {gesture:null,confidence:0};
}
