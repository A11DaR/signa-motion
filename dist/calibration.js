import {StableHold} from './stability.js?v=20260928-6';
import {trackingIssue} from './gesture-rules.js?v=20260928-6';
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
export class Calibration {
 constructor(){this.reset();}
 reset(){this.hold=new StableHold(1400);this.samples=[];this.profile=null;this.lastCenter=null;this.lastTime=null;}
 update(features,time,{brightness=null,mirrored=true}={}){
  const f=features.length===1?features[0]:null;
  let issue=features.length>1?{title:'Для настройки оставь одну руку',detail:'Раскрой одну ладонь перед камерой.'}:trackingIssue(f);
  if(!f&&brightness!==null&&brightness<28)issue={title:'Добавь свет перед собой',detail:'Кадр слишком тёмный. Повернись лицом к источнику света.'};
  if(!issue&&!f.facingCamera)issue={title:'Разверни ладонь к камере',detail:'Нужна внутренняя сторона ладони, пальцы направлены вверх.'};
  if(!issue&&!f.openPalm)issue={title:'Раскрой все пять пальцев',detail:'Для настройки покажи открытую ладонь. Это ещё не учебное задание.'};
  const delta=this.lastTime===null?0:time-this.lastTime;
  if(!issue&&this.lastCenter&&delta>0&&delta<500&&Math.hypot(f.center.x-this.lastCenter.x,f.center.y-this.lastCenter.y)/(delta/1000)>f.screenScale*3)issue={title:'Задержи ладонь на месте',detail:'Не двигай рукой пару секунд: настроим рабочее расстояние.'};
  this.lastCenter=f?.center??null;this.lastTime=time;
  const hold=this.hold.update(!issue,time);
  if(!issue){this.samples.push(f.viewScale??f.screenScale);if(this.samples.length>40)this.samples.shift();}
  else if(!hold.grace)this.samples=[];
  if(hold.success&&this.samples.length>=5)this.profile={palmSize:median(this.samples),mirrored,calibratedAt:time};
  return {complete:!!this.profile,progress:hold.progress,title:issue?.title??'Ладонь видна — держи спокойно',detail:issue?.detail??'Настраиваем размер руки. После этого урок начнётся сам.',profile:this.profile};
 }
}
