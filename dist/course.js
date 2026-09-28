export const SIGNS={
 ily:{name:'Я тебя люблю',gloss:'I LOVE YOU',type:'Статичный',hold:'Удержи жест 1 секунду',instructions:['Выпрями большой, указательный палец и мизинец.','Согни средний и безымянный. Ладонь — к камере.','Направь пальцы вверх и удержи положение.'],source:'https://www.lifeprint.com/asl101/topics/ily.htm',video:null,image:'https://www.lifeprint.com/asl101/images-layout/ily_asl_1024h.gif'},
 yes:{name:'Да',gloss:'YES',type:'С движением',hold:'Кивни кистью и верни её обратно',instructions:['Собери пальцы в кулак. Большой палец — поверх пальцев.','Кивни кулаком вниз, сгибая кисть в запястье.','Верни кисть обратно, завершая движение.'],source:'https://www.lifeprint.com/asl101/pages-signs/y/yes.htm',video:'0usayvOXzHo'},
 no:{name:'Нет',gloss:'NO',type:'С движением',hold:'Раскрой → сомкни пальцы',instructions:['Согни безымянный и мизинец к ладони.','Указательный и средний держи рядом; большой — напротив.','Сомкни кончики указательного и среднего с большим.'],source:'https://www.lifeprint.com/asl101/pages-signs/n/no.htm',video:'QJXKaOSyl4o'}
};
export const LESSON=['ily','yes','no'];
export const PHRASE=['yes','ily'];

export class Course {
 constructor(){this.restart();}
 restart(){this.stage='learn';this.index=0;this.startedAt=null;this.finishedAt=null;this.errors={ily:0,yes:0,no:0};this.learned=new Set();this.events=[];this.pausedAt=null;this.pauseTime=0;}
 get target(){return this.stage==='learn'?LESSON[this.index]:this.stage==='phrase'?PHRASE[this.index]:null;}
 begin(time){this.startedAt??=time;}
 recordCorrection(){if(this.target)this.errors[this.target]++;}
 accept(sign,time){
   if(!this.target||sign!==this.target)return false;
   this.events.push({sign,stage:this.stage,time});
   if(this.stage==='learn'){this.learned.add(sign);this.index++;if(this.index===LESSON.length){this.stage='phrase';this.index=0;}}
   else {this.index++;if(this.index===PHRASE.length){this.stage='done';this.finishedAt=time;}}
   return true;
 }
 pause(time){if(this.pausedAt===null)this.pausedAt=time;}
 resume(time){if(this.pausedAt!==null){this.pauseTime+=time-this.pausedAt;this.pausedAt=null;}}
 summary(){const hints=Object.values(this.errors).reduce((a,b)=>a+b,0);return {completed:this.stage==='done',signs:this.learned.size,checks:this.events.length,hints,score:this.stage==='done'?Math.max(50,100-hints*3):0,seconds:this.finishedAt===null?0:Math.round(Math.max(0,this.finishedAt-(this.startedAt??this.finishedAt)-this.pauseTime)/1000),errors:{...this.errors}};}
}
