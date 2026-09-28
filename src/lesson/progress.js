import {LESSON} from './course.js?v=20260928-6';

export const PROGRESS_KEY='signa-best-v1';
const integer=(value,max)=>Number.isInteger(value)&&value>=0&&value<=max;
const empty=()=>({score:0,sessions:0,gestureBest:{},history:[],cleanLesson:false});
function readProgress(storage){
 try{
  const raw=JSON.parse(storage.getItem(PROGRESS_KEY));
  if(!raw||!integer(raw.score,100)||!integer(raw.sessions,1e9))return empty();
  const history=Array.isArray(raw.history)?raw.history.filter(v=>v&&integer(v.at,8640000000000000)&&integer(v.score,100)&&integer(v.accuracy,100)&&integer(v.seconds,31536000)&&integer(v.hints,1e6)).slice(-5):[];
  const gestureBest=Object.fromEntries(LESSON.filter(s=>integer(raw.gestureBest?.[s],100)).map(s=>[s,raw.gestureBest[s]]));
  return {score:raw.score,sessions:raw.sessions,gestureBest,history,cleanLesson:raw.cleanLesson===true||history.some(v=>v.hints===0)};
 }catch{return empty();}
}

export function saveCompletedLesson(summary,{storage,now=Date.now()}={}){
 if(!summary.completed)throw new TypeError('Only completed lessons can earn progress');
 // Accessing localStorage itself may throw in a restricted browser context.
 try{storage??=globalThis.localStorage;}catch{}
 const old=readProgress(storage),previousScore=old.history.at(-1)?.score??null;
 const gestureBest={...old.gestureBest};
 for(const row of summary.perGesture)if(LESSON.includes(row.sign)&&integer(row.accuracy,100))gestureBest[row.sign]=Math.max(gestureBest[row.sign]??0,row.accuracy);
 const entry={at:Math.trunc(now),score:summary.score,accuracy:summary.accuracy,seconds:summary.seconds,hints:summary.hints};
 const progress={score:Math.max(old.score,summary.score),sessions:old.sessions+1,gestureBest,history:[...old.history,entry].slice(-5),cleanLesson:old.cleanLesson||summary.hints===0};
 let persisted=false;
 try{storage.setItem(PROGRESS_KEY,JSON.stringify(progress));persisted=true;}catch{}
 return {progress,persisted,previousScore};
}
