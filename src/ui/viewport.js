export function videoRect(width,height,videoWidth,videoHeight){
 if(!(width>0&&height>0&&videoWidth>0&&videoHeight>0))return {x:0,y:0,width:0,height:0};
 const scale=Math.min(width/videoWidth,height/videoHeight),w=videoWidth*scale,h=videoHeight*scale;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
export function projectLandmark(point,rect,mirrored=true){return [rect.x+(mirrored?1-point.x:point.x)*rect.width,rect.y+point.y*rect.height];}
