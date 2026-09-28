// Synthetic landmarks exercise geometry and UI state. They are not camera data.
export function hand(type='palm',{pitch=0,closed=false,dx=0,dy=0,mirrored=false}={}){
 const p=[[.5,.8],[.4,.68],[.32,.61],[.25,.55],[.18,.49],[.42,.55],[.42,.39],[.42,.28],[.42,.19],[.5,.52],[.5,.34],[.5,.22],[.5,.12],[.58,.54],[.58,.39],[.58,.29],[.58,.2],[.65,.59],[.65,.47],[.65,.39],[.65,.3]].map(([x,y])=>({x,y,z:0}));
 const fold=m=>{p[m+1]={x:p[m].x,y:p[m].y-.07,z:0};p[m+2]={x:p[m].x,y:p[m].y+.02,z:0};p[m+3]={x:p[m].x,y:p[m].y+.09,z:0};};
 if(type==='ily')[9,13].forEach(fold);
 if(type==='fist'){[5,9,13,17].forEach(fold);p[3]={x:.46,y:.6,z:0};p[4]={x:.55,y:.62,z:0};}
 if(type==='no'){[13,17].forEach(fold);[9,10,11,12].forEach(i=>p[i].x-=.045);if(closed){p[8]={...p[4]};p[12]={...p[4],x:p[4].x+.01};}}
 if(type==='pinch'){p[8]={...p[4],x:p[4].x+.008};}
 const world=p.map(q=>({x:q.x*4/3,y:.8+(q.y-.8)*Math.cos(pitch),z:(q.y-.8)*Math.sin(pitch)}));
 const screen=world.map(q=>({x:q.x/(4/3)+dx,y:q.y+dy,z:q.z/(4/3)}));
 if(mirrored){screen.forEach(q=>q.x=1-q.x);world.forEach(q=>q.x=-q.x);}
 // Thumb on image-left with palm toward the camera is MediaPipe's Left label.
 return {landmarks:[screen],worldLandmarks:[world],handedness:[[{categoryName:mirrored?'Right':'Left'}]]};
}
