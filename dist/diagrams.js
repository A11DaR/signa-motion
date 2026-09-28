import {CONNECTIONS} from './recognizer.js?v=20260928-2';
import {videoRect,projectLandmark} from './viewport.js?v=20260928-2';
// Instructional landmark diagram, not a depiction of a human or a reference video.
export function drawReference(canvas,sign,time=0){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 c.clearRect(0,0,w,h);c.save();c.translate(w*.50,h*.10);
 const phase=(Math.sin(time/650)+1)/2;
 const base=[[0,280],[-55,223],[-91,189],[-120,160],[-151,138],[-46,171],[-52,97],[-54,53],[-55,15],[0,158],[0,83],[0,39],[0,2],[43,170],[47,108],[49,68],[50,38],[79,192],[95,148],[105,115],[112,83]];
 const p=base.map(v=>[...v]);
 const curl=(i)=>{const b=p[i];p[i+1]=[b[0]*1.05,b[1]-37];p[i+2]=[b[0]*1.02,b[1]+5];p[i+3]=[b[0]*.96,b[1]+35];};
 if(sign==='ily'){curl(9);curl(13);}
 if(sign==='yes'){
  [5,9,13,17].forEach(curl);p[3]=[-30,187];p[4]=[14,192];
  for(let i=1;i<21;i++){p[i][1]=280+(p[i][1]-280)*(.75+phase*.35);p[i][0]+=phase*14;}
 }
 if(sign==='no'){
  curl(13);curl(17);
  p[9]=[-9,164];p[10]=[-19,91];p[11]=[-22,47];p[12]=[-24,12];
  p[2]=[-91,189];p[3]=[-99,137];p[4]=[-89,96];
  const a=phase;
  for(const i of [6,7,8,10,11,12]){const k=[8,12].includes(i)?1:[7,11].includes(i)?.65:.25;p[i][0]=p[i][0]*(1-a*k)+p[4][0]*a*k;p[i][1]=p[i][1]*(1-a*k)+p[4][1]*a*k;}
 }
 c.scale(.82,.82);c.lineCap='round';c.lineJoin='round';
 c.beginPath();[0,5,9,13,17,0].forEach((i,j)=>j?c.lineTo(...p[i]):c.moveTo(...p[i]));c.fillStyle='#dae5ce';c.fill();
 for(const [a,b] of CONNECTIONS){c.beginPath();c.moveTo(...p[a]);c.lineTo(...p[b]);c.strokeStyle='#799168';c.lineWidth=5;c.stroke();}
 for(let i=0;i<21;i++){c.beginPath();c.arc(...p[i],[4,8,12,16,20].includes(i)?7:4,0,Math.PI*2);c.fillStyle=[4,8,20].includes(i)&&sign==='ily'?'#385b26':'#b4c3a3';c.fill();}
 if(sign==='yes'){c.font='60px Arial';c.fillStyle='#849f6a';c.fillText('↕',130,170);}
 if(sign==='no'){c.font='28px Arial';c.fillStyle='#6b8255';c.fillText(phase>.7?'Сомкни':'Раскрой',-235,280);}
 c.restore();
}

export function drawOverlay(canvas,video,landmarks,result){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
 if(!landmarks)return;
 c.save();c.scale(dpr,dpr);
 const rect=videoRect(w,h,video.videoWidth||640,video.videoHeight||480);
 const point=i=>projectLandmark(landmarks[i],rect,video.dataset.mirrored!=='false');
 const bad=new Set((result?.badFingers??[]).flatMap(f=>f===0?[1,2,3,4]:[f*4+1,f*4+2,f*4+3,f*4+4]));
 c.lineWidth=3;c.lineCap='round';
 for(const [a,b] of CONNECTIONS){c.beginPath();c.moveTo(...point(a));c.lineTo(...point(b));c.strokeStyle=bad.has(b)?'#ffd4a2':'#cef569';c.shadowBlur=5;c.shadowColor=c.strokeStyle;c.stroke();}
 c.shadowBlur=0;
 for(let i=0;i<21;i++){c.beginPath();c.arc(...point(i),[4,8,12,16,20].includes(i)?5:3,0,Math.PI*2);c.fillStyle=bad.has(i)?'#ffe6c5':'#f0ffd1';c.fill();}
 c.restore();
}
