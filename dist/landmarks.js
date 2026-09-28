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
 const projected=screen.map(q=>({x:q.x*aspect,y:q.y,z:0}));
 const p=validWorld?world:screen.map(q=>({x:q.x*aspect,y:q.y,z:(q.z??0)*aspect}));
 const scale=dist(p[5],p[17]);
 if(scale<.00001) return null;
 const fingers=[5,9,13,17].map(m=>{
   const bend=angle(p[m],p[m+1],p[m+2]);
   const tipBend=angle(p[m+1],p[m+2],p[m+3]);
   const reach=dist(p[m+3],p[0])/(dist(p[m+1],p[0])||1);
   // A straight finger may have a naturally bent distal joint. Require the
   // main joint and actual reach too, instead of treating DIP alone as a veto.
   return {bend,tipBend,reach,extended:bend>145&&tipBend>125&&reach>1.07,folded:bend<133||reach<.98};
 });
 const thumbOut=dist(p[4],p[5])/scale>.68&&angle(p[2],p[3],p[4])>140&&dist(p[4],p[17])/scale>1.2;
 const palmNormal=cross(sub(p[5],p[0]),sub(p[17],p[0]));
 // Use the observed image winding, not the inferred world-space winding.
 // With MediaPipe's labels a front-facing Right palm has a negative winding;
 // Left has a positive one. CSS mirroring must never change detector input.
 const imageNormal=cross(sub(projected[5],projected[0]),sub(projected[17],projected[0]));
 const facingCamera=(handedness==='Left'?1:-1)*imageNormal.z>0&&Math.abs(palmNormal.z)/(norm(palmNormal)||1)>.2;
 const v=sub(p[9],p[0]);
 const pitch=Math.atan2(v.z,-v.y);
 const screenScale=Math.hypot((screen[5].x-screen[17].x)*aspect,screen[5].y-screen[17].y);
 const cropped=screen.some(q=>q.x<.015||q.x>.985||q.y<.015||q.y>.985);
 const closeGap=Math.max(dist(p[8],p[4]),dist(p[12],p[4]))/scale;
 return {fingers,thumbOut,facingCamera,pitch,scale,screenScale,cropped,closeGap,
   pairTogether:dist(p[8],p[12])/scale<.6,pinchGap:dist(p[8],p[4])/scale,
   openPalm:fingers.every(f=>f.extended)&&thumbOut&&facingCamera,
   center:{x:(screen[0].x+screen[9].x)/2,y:(screen[0].y+screen[9].y)/2},
   bounds:{left:Math.min(...screen.map(p=>p.x)),right:Math.max(...screen.map(p=>p.x)),top:Math.min(...screen.map(p=>p.y)),bottom:Math.max(...screen.map(p=>p.y))},
   indexUpright:screen[8].y<screen[5].y-.02,
 };
}

// This only identifies a plausible starting pose for leaving cursor mode.
// It never awards a lesson pass; the temporal recognizer still has to finish.
export function matchesLessonPose(f,target){
 if(!f||f.cropped||f.screenScale<.065||f.screenScale>.62)return false;
 const [index,middle,ring,pinky]=f.fingers;
 if(target==='ily')return index.extended&&pinky.extended&&middle.folded&&ring.folded&&f.thumbOut&&f.facingCamera&&f.indexUpright;
 if(target==='yes')return f.fingers.every(x=>x.folded)&&!f.thumbOut;
 if(target==='no')return index.extended&&middle.extended&&ring.folded&&pinky.folded&&f.pairTogether&&f.closeGap>.72;
 return false;
}

