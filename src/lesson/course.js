export const SIGNS={
 ily:{name:'Я тебя люблю',gloss:'I LOVE YOU',type:'Статичный',hold:'Удержи жест 0,7 секунды',instructions:['Выпрями большой, указательный палец и мизинец.','Согни средний и безымянный. Ладонь — к камере.','Направь пальцы вверх и удержи положение.'],source:'https://www.lifeprint.com/asl101/topics/ily.htm',video:null,image:'https://www.lifeprint.com/asl101/images-layout/ily_asl_1024h.gif'},
 yes:{name:'Да',gloss:'YES',type:'С движением',hold:'Кивок → возврат → полсекунды спокойно',instructions:['Собери пальцы в кулак. Большой палец — поверх пальцев.','Плавно кивни кистью вниз и обратно. Внизу останавливаться не нужно.','После возврата задержи кулак на полсекунды.'],source:'https://www.lifeprint.com/asl101/pages-signs/y/yes.htm',video:'0usayvOXzHo'},
 no:{name:'Нет',gloss:'NO',type:'С движением',hold:'Раскрой → дождись подсказки → сомкни',instructions:['Согни безымянный и мизинец. Указательный и средний раскрой рядом; большой — напротив.','Задержи раскрытые пальцы до подсказки «Теперь сомкни».','Коснись большого обоими кончиками и задержи на полсекунды.'],source:'https://www.lifeprint.com/asl101/pages-signs/n/no.htm',video:'QJXKaOSyl4o'}
};
export const LESSON=['ily','yes','no'];
export const PHRASE=['yes','ily'];

export class Course {
 constructor(){this.restart();}
 restart(){this.stage='learn';this.status='exercise';this.index=0;this.startedAt=null;this.finishedAt=null;this.errors={ily:0,yes:0,no:0};this.learned=new Set();this.events=[];this.pausedAt=null;this.pauseTime=0;this.pending=null;this.observations={};this.lastObservation=null;}
 get target(){return this.stage==='learn'?LESSON[this.index]:this.stage==='phrase'?PHRASE[this.index]:null;}
 begin(time){this.startedAt??=time;}
 recordCorrection(){if(this.target&&this.status==='exercise')this.errors[this.target]++;}
 observe(result,time){
  if(!this.target||this.status!=='exercise'||result.kind==='tracking'){this.lastObservation=null;return;}
  const weight=this.lastObservation===null?0:Math.min(250,Math.max(0,time-this.lastObservation));this.lastObservation=time;
  const row=this.observations[this.target]??={sum:0,weight:0};row.sum+=result.confidence*weight;row.weight+=weight;
 }
 accept(sign,time){
  if(!this.target||sign!==this.target||this.status!=='exercise')return false;
  this.events.push({sign,stage:this.stage,time});this.learned.add(sign);this.status='completed';this.pending={at:time+800,sign};this.lastObservation=null;return true;
 }
 advance(time){
  if(!this.pending||time<this.pending.at)return false;
  this.pending=null;this.status='exercise';
  if(this.stage==='learn'){this.index++;if(this.index===LESSON.length){this.stage='phrase';this.index=0;}}
  else {this.index++;if(this.index===PHRASE.length){this.stage='done';this.status='completed';this.finishedAt=time;}}
  return true;
 }
 pause(time){if(this.startedAt!==null&&this.pausedAt===null)this.pausedAt=time;this.lastObservation=null;}
 resume(time){if(this.pausedAt!==null){this.pauseTime+=time-this.pausedAt;this.pausedAt=null;}this.lastObservation=null;}
 summary(){
  const hints=Object.values(this.errors).reduce((a,b)=>a+b,0),rows=LESSON.map(sign=>({sign,accuracy:this.observations[sign]?.weight?Math.round(this.observations[sign].sum/this.observations[sign].weight*100):0}));
  const measured=rows.filter(v=>this.observations[v.sign]?.weight);
  const pendingPause=this.pausedAt!==null&&this.finishedAt!==null?Math.max(0,this.finishedAt-this.pausedAt):0;
  return {completed:this.stage==='done',signs:this.learned.size,checks:this.events.length,hints,score:this.stage==='done'?Math.max(50,100-hints*3):0,accuracy:measured.length?Math.round(measured.reduce((n,v)=>n+v.accuracy,0)/measured.length):0,bestGesture:[...measured].sort((a,b)=>b.accuracy-a.accuracy||this.errors[a.sign]-this.errors[b.sign])[0]?.sign??null,perGesture:rows,seconds:this.finishedAt===null?0:Math.round(Math.max(0,this.finishedAt-(this.startedAt??this.finishedAt)-this.pauseTime-pendingPause)/1000),errors:{...this.errors}};
 }
}
