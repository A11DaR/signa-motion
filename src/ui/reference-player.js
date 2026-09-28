let apiPromise=null,player=null,version=0;
function youtubeAPI(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{apiPromise=null;reject(new Error('YouTube timeout'));},15000);
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);previous?.();resolve(window.YT);};
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
  script.onerror=()=>{clearTimeout(timeout);apiPromise=null;reject(new Error('YouTube unavailable'));};document.head.append(script);
 });return apiPromise;
}
export async function openReferencePlayer(id,container,play,replay){
 closeReferencePlayer();const current=version;
 play.disabled=true;replay.disabled=true;play.textContent='Загрузка видео…';
 const iframe=document.createElement('iframe');iframe.title='Образец жеста ASL';
 iframe.src=`https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0&autoplay=1&mute=1&origin=${encodeURIComponent(location.origin)}`;
 iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.referrerPolicy='strict-origin-when-cross-origin';container.replaceChildren(iframe);
 try{
  const YT=await youtubeAPI();if(current!==version)return;
  player=new YT.Player(iframe,{events:{onReady(e){if(current!==version)return;e.target.mute();play.disabled=false;replay.disabled=false;play.textContent='▶ Воспроизвести';e.target.playVideo();},onStateChange(e){if(current===version)play.textContent=e.data===1?'Ⅱ Пауза видео':'▶ Воспроизвести';},onError(){if(current===version){play.disabled=true;replay.disabled=true;play.textContent='Видео недоступно';}}}});
 }catch(e){if(current===version){play.textContent='Видео недоступно';play.disabled=true;replay.disabled=true;}throw e;}
}
export function toggleReferencePlayer(){if(!player)return;if(player.getPlayerState()===1)player.pauseVideo();else player.playVideo();}
export function replayReferencePlayer(){if(player){player.seekTo(0,true);player.playVideo();}}
export function closeReferencePlayer(){version++;try{player?.destroy();}catch{}player=null;}
