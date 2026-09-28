import {GestureRecognizer, extractFeatures} from './recognizer.js?v=20260928-2';
import {Course,SIGNS,LESSON,PHRASE} from './course.js?v=20260928-2';
import {drawOverlay,drawReference} from './diagrams.js?v=20260928-2';
import {HandCommands} from './commands.js?v=20260928-2';
import {HandNavigation} from './navigation.js?v=20260928-2';
import {openReferencePlayer,closeReferencePlayer,toggleReferencePlayer,replayReferencePlayer} from './reference-player.js?v=20260928-2';

const $=id=>document.getElementById(id);
const course=new Course(),recognizer=new GestureRecognizer(),commands=new HandCommands(),navigation=new HandNavigation();
const video=$('camera'),overlay=$('overlay'),reference=$('reference-canvas');
let model=null,stream=null,running=false,paused=false,loading=false,facing='user';
let lastFrame=-1,lastDetection=0,lastReference=0,transitionUntil=0,generation=0,errorsInARow=0;
let correctionKey='',correctionSince=0,correctionRecorded=false,visibleFeedback='',candidateFeedback='',candidateSince=0;
let sound=false,audio=null,toastTimer=null,uiCooldownUntil=0,latestFrame=null;
let cursor={x:0,y:0,ready:false},cursorOrigin=null,dwell={element:null,since:0};
let consumedTarget=null,consumedLeftAt=null,bannerTimer=null,resultsRendered=false,lastCursorTime=null;
const HAND_DWELL_MS=1200;

function feedback(title,detail,kind='working'){
 $('feedback-title').textContent=title;$('feedback-detail').textContent=detail;
 $('feedback').className='feedback '+(kind==='correction'?'warning':kind);
 $('feedback-icon').textContent=kind==='success'?'✓':kind==='correction'?'!':'✧';
}
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3500);}
function showProgress(result){
 const n=Math.round(Math.min(1,result.progress)*100);
 $('hold-percent').textContent=n+'%';$('hold-fill').style.width=n+'%';
 $('recognition-value').textContent=n+'%';$('recognition-ring').style.setProperty('--progress',n+'%');
 const signature=JSON.stringify(result.checks);
 if($('checks').dataset.signature!==signature){$('checks').dataset.signature=signature;$('checks').replaceChildren(...result.checks.map(v=>{const span=document.createElement('span');span.className='check-chip'+(v.pass?' pass':'');span.textContent=(v.pass?'✓ ':'○ ')+v.label;return span;}));}
}
function setLesson(){
 $('camera-task').textContent=course.target?'Повтори: «'+SIGNS[course.target].name+'»':'Урок завершён';
 $('camera-task-count').textContent=course.stage==='done'?'5 / 5':`${(course.stage==='learn'?0:3)+course.index+1} / 5`;
 if(course.stage==='done'){renderResults();return;}
 const sign=SIGNS[course.target];
 $('lesson-eyebrow').textContent=course.stage==='learn'?`ЖЕСТ ${course.index+1} ИЗ 3`:`ФРАЗА · ЧАСТЬ ${course.index+1} ИЗ 2`;
 $('lesson-pill').textContent=sign.type;$('sign-name').textContent=sign.name;$('sign-gloss').textContent=sign.gloss;
 $('instructions').replaceChildren(...sign.instructions.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
 $('hold-label').textContent=sign.hold;$('auto-next').textContent='Получится — перейдём дальше автоматически';
 showProgress({checks:[],progress:0});recognizer.reset();clearCorrection();visibleFeedback='';
 document.querySelectorAll('.vocab-item').forEach(el=>{el.classList.toggle('current',course.target===el.dataset.sign);el.classList.toggle('done',course.learned.has(el.dataset.sign));});
 [0,1,2].forEach(i=>{$('step-'+i).classList.toggle('active',i===(course.stage==='learn'?0:1));$('step-'+i).classList.toggle('complete',course.stage==='phrase'&&i===0);});
 $('phrase-card').classList.toggle('hidden',course.stage!=='phrase');
 PHRASE.forEach((_,i)=>{$('token-'+i).classList.toggle('passed',course.stage==='phrase'&&i<course.index);$('token-'+i).classList.toggle('current',course.stage==='phrase'&&i===course.index);});
 if(running)feedback('Повтори: «'+sign.name+'»',sign.instructions[0]);
 drawReference(reference,course.target);
}
function clearCorrection(){correctionKey='';correctionSince=0;correctionRecorded=false;candidateFeedback='';candidateSince=0;}
function updateFeedback(result,time){
 showProgress(result);
 const key=result.title;
 if(key!==candidateFeedback){candidateFeedback=key;candidateSince=time;}
 // A 450 ms grace period avoids criticizing transitions and single-frame noise.
 if(key!==visibleFeedback&&(time-candidateSince>450||result.kind==='success'||result.kind==='tracking')){feedback(result.title,result.detail,result.kind);visibleFeedback=key;}
 if(result.kind==='correction'){
  if(key!==correctionKey){correctionKey=key;correctionSince=time;correctionRecorded=false;}
  if(!correctionRecorded&&time-correctionSince>=1600){course.recordCorrection();correctionRecorded=true;}
 }else{correctionKey='';correctionSince=0;correctionRecorded=false;}
}
function acceptGesture(time){
 const sign=course.target;
 if(!sign||transitionUntil>time)return;
 if(!course.accept(sign,time))return;
 transitionUntil=time+1200;recognizer.reset();
 // Commit the next visible task immediately. Animation timers cannot block it.
 setLesson();
 $('gesture-banner-text').textContent='«'+SIGNS[sign].name+'» — получилось!';$('gesture-banner').classList.remove('hidden');
 $('camera-stage').classList.add('shake');playSound();
 if(course.target)feedback('Засчитано: «'+SIGNS[sign].name+'»','Следующее задание: «'+SIGNS[course.target].name+'».','success');
 const run=generation;
 clearTimeout(bannerTimer);
 bannerTimer=setTimeout(()=>{if(generation!==run)return;$('gesture-banner').classList.add('hidden');$('camera-stage').classList.remove('shake');},1600);
}
function pauseCourse(reason='Пауза'){
 if(!running||course.stage==='done')return;
 paused=!paused;recognizer.reset();clearCorrection();
 if(paused){course.pause(performance.now());feedback(reason,'Раскрой ладонь и выбери «Продолжить».');}else{course.resume(performance.now());feedback('Продолжаем',SIGNS[course.target]?.instructions[0]??'');}
 $('pause-button').textContent=paused?'Продолжить':'Пауза';
}
function openDialog(id){
 if($(id).open)return;
 if(running&&!paused&&course.stage!=='done'){course.pause(performance.now());$(id).dataset.resume='true';paused=true;}
 else $(id).dataset.resume='false';
 recognizer.reset();$(id).showModal();$(id).append($('hand-cursor'),$('navigation-bar'));resetDwell();
}
function closeDialog(id){
 const dialog=$(id);document.body.append($('hand-cursor'),$('navigation-bar'));dialog.close();
 if(id==='video-dialog'){closeReferencePlayer();$('video-container').replaceChildren();}
 if(dialog.dataset.resume==='true'&&running){paused=false;course.resume(performance.now());$('pause-button').textContent='Пауза';}
 uiCooldownUntil=performance.now()+500;recognizer.reset();resetDwell();
}
function showExample(){
 const sign=SIGNS[course.target??'ily'];
 $('video-title').textContent=sign.name;$('video-source').href=sign.source;
 $('video-container').replaceChildren();
 $('video-controls').classList.toggle('hidden',!sign.video);
 if(sign.video)openReferencePlayer(sign.video,$('video-container'),$('example-play'),$('example-replay')).catch(()=>toast('Видео недоступно. Используй схему и инструкцию к жесту.'));
 else {const img=document.createElement('img');img.src=sign.image;img.alt='Жест I LOVE YOU: раскрыты большой, указательный и мизинец. Образец ASL University.';img.className='reference-image';img.addEventListener('error',()=>{const a=document.createElement('a');a.href=sign.source;a.target='_blank';a.rel='noopener noreferrer';a.className='video-fallback';a.textContent='Открыть образец в ASL University ↗';img.replaceWith(a);});$('video-container').append(img);}
 openDialog('video-dialog');
}
async function loadModel(){
 if(model)return;
 const {FilesetResolver,HandLandmarker}=await import('./vendor/vision_bundle.mjs');
 const files=await FilesetResolver.forVisionTasks(new URL('./vendor/',import.meta.url).href.replace(/\/$/,''));
 if(files.wasmBinaryPath.includes('nosimd'))throw Object.assign(new Error('WebAssembly SIMD is required'),{name:'UnsupportedWasm'});
 const options={baseOptions:{modelAssetPath:new URL('./models/hand_landmarker.task',import.meta.url).href,delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.65};
 try{model=await HandLandmarker.createFromOptions(files,options);}catch(error){console.info('Using CPU inference',error?.name);options.baseOptions.delegate='CPU';model=await HandLandmarker.createFromOptions(files,options);}
}
function setStartLoading(text){$('start-camera').disabled=true;$('start-camera').querySelector('span').textContent=text;$('camera-title').textContent='Готовим камеру';$('camera-description').textContent='Первый запуск может занять немного времени.';}
async function startCamera(){
 if(loading)return;loading=true;setStartLoading('Разреши доступ…');
 if(!audio){try{const C=window.AudioContext||window.webkitAudioContext;if(C){audio=new C();audio.resume();}}catch{}}
 try{
  if(!window.isSecureContext)throw Object.assign(new Error('secure'),{name:'InsecureContext'});
  if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('unsupported'),{name:'Unsupported'});
  const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});
  stream?.getTracks().forEach(track=>track.stop());stream=next;video.srcObject=stream;
  // Metadata must be ready before the first detector call.
  if(video.readyState<1)await new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',reject,{once:true});});
  await video.play();setStartLoading('Загружаем распознавание…');
  syncCameraLayout();
  await loadModel();
  $('camera-stage').classList.add('is-streaming');
  running=true;paused=false;lastFrame=-1;lastDetection=0;errorsInARow=0;recognizer.reset();
  setNavigation(false);try{sessionStorage.setItem('signa-camera','on');}catch{}
  course.begin(performance.now());course.resume(performance.now());
  $('camera-start').classList.add('hidden');$('camera-controls').classList.remove('hidden');$('camera-label').classList.add('on');$('camera-label').innerHTML='<i></i> КАМЕРА ВКЛЮЧЕНА';
  $('pause-button').textContent='Пауза';$('camera-bottom-label').innerHTML='<i class="status-dot"></i> Видео не записывается';
  feedback('Покажи руку целиком','Начни с жеста «'+SIGNS[course.target??'ily'].name+'».');
  stream.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(running)stopCamera('Доступ к камере прерван','Подключи камеру и включи её снова.');},{once:true}));
 }catch(error){
  const messages={NotAllowedError:['Камера пока недоступна','Разреши доступ к камере в настройках сайта, затем попробуй ещё раз.'],NotFoundError:['Камера не найдена','Подключи веб-камеру или открой сайт на телефоне.'],NotReadableError:['Камера занята','Закрой другие приложения с камерой и повтори попытку.'],InsecureContext:['Нужен защищённый адрес','Открой приложение по HTTPS или на localhost.'],Unsupported:['Браузер не поддерживает камеру','Открой сайт в актуальном Chrome, Edge или Safari.'],UnsupportedWasm:['Обнови браузер','Для распознавания нужна поддержка WebAssembly SIMD. Используй актуальный Chrome, Edge или Safari.']};
  const [title,detail]=messages[error.name]??['Не удалось запустить распознавание','Проверь соединение и обнови страницу. Если не поможет, попробуй другой браузер.'];
  console.error('Camera initialization failed',error);stopCamera(title,detail);
 }finally{loading=false;$('start-camera').disabled=false;$('start-camera').querySelector('span').textContent='Включить камеру';}
}
function stopCamera(title='Камера выключена',detail='Включи её, когда будешь готов продолжить.'){
 setNavigation(false);try{sessionStorage.removeItem('signa-camera');}catch{}
 $('camera-stage').classList.remove('is-streaming');
 running=false;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;course.pause(performance.now());recognizer.reset();resetDwell();
 $('camera-start').classList.remove('hidden');$('camera-controls').classList.add('hidden');$('camera-title').textContent=title;$('camera-description').textContent=detail;
 $('camera-label').classList.remove('on');$('camera-label').innerHTML='<i></i> КАМЕРА ВЫКЛЮЧЕНА';$('tracking-label').textContent='Нет видеопотока';
 drawOverlay(overlay,video,null);feedback(title,detail,'tracking');
}
async function switchCamera(){
 if(loading)return;
 if(!paused&&course.stage!=='done')course.pause(performance.now());
 running=false;stream?.getTracks().forEach(t=>t.stop());stream=null;
 facing=facing==='user'?'environment':'user';$('camera-start').classList.remove('hidden');
 await startCamera();
}
function resetDwell(){if(dwell.element)dwell.element.classList.remove('dwell-target');dwell={element:null,since:0};cursor.ready=false;$('hand-cursor').classList.add('hidden');}
function updateNavigationUI(){
 $('navigation-bar').classList.toggle('hidden',!navigation.active);
 $('nav-toggle').setAttribute('aria-pressed',String(navigation.active));
 $('nav-toggle').textContent=navigation.active?'✋ Управление сайтом':'✋ Курсор рукой';
}
function setNavigation(active){navigation.setActive(active);updateNavigationUI();recognizer.reset();clearCorrection();resetDwell();lastCursorTime=null;cursorOrigin=null;consumedTarget=null;consumedLeftAt=null;}
function returnToLesson(){
 for(const id of ['info-dialog','video-dialog'])if($(id).open)closeDialog(id);
 setNavigation(false);if(paused&&running)pauseCourse();
 uiCooldownUntil=performance.now()+250;
}
function processCursor(features,time){
 const state=navigation.update(features,time);
 if(state.changed){cursorOrigin=null;consumedTarget=null;updateNavigationUI();recognizer.reset();clearCorrection();if(!state.active){returnToLesson();uiCooldownUntil=time+250;feedback('Режим урока',course.target?'Повтори: «'+SIGNS[course.target].name+'».':'Урок завершён.');}}
 if(!state.active||!features||features.cropped){resetDwell();lastCursorTime=null;consumedLeftAt??=time;if(time-consumedLeftAt>300)consumedTarget=null;return state.active;}
 const normalizedX=video.dataset.mirrored==='false'?features.center.x:1-features.center.x;
 if(!cursorOrigin){const b=features.bounds;cursorOrigin={x:normalizedX,y:features.center.y,spanX:Math.max(.06,Math.min(.17,b.left-.025,.975-b.right)),spanY:Math.max(.055,Math.min(.13,b.top-.025,.975-b.bottom))};}
 const x=Math.max(18,Math.min(innerWidth-18,(.5+(normalizedX-cursorOrigin.x)/(2*cursorOrigin.spanX))*innerWidth));
 const y=Math.max(18,Math.min(innerHeight-18,(.5+(features.center.y-cursorOrigin.y)/(2*cursorOrigin.spanY))*innerHeight));
 if(!cursor.ready){cursor.x=x;cursor.y=y;cursor.ready=true;}else {cursor.x=cursor.x*.6+x*.4;cursor.y=cursor.y*.6+y*.4;}
 const marker=$('hand-cursor');marker.classList.remove('hidden');marker.style.left=cursor.x+'px';marker.style.top=cursor.y+'px';
 const element=document.elementFromPoint(cursor.x,cursor.y)?.closest('button:not(:disabled),a[href],summary,[data-gesture]');
 const visible=element&&!element.disabled&&element.getClientRects().length>0;
 if(element!==consumedTarget){consumedLeftAt??=time;if(time-consumedLeftAt>300)consumedTarget=null;}else consumedLeftAt=null;
 if(!visible||time<uiCooldownUntil||element===consumedTarget){if(dwell.element)dwell.element.classList.remove('dwell-target');dwell={element:null,since:0};marker.style.setProperty('--dwell','0%');}
 else{
  if(dwell.element!==element){dwell.element?.classList.remove('dwell-target');dwell={element,since:time};element.classList.add('dwell-target');}
  const progress=Math.min(1,(time-dwell.since)/HAND_DWELL_MS);marker.style.setProperty('--dwell',progress*100+'%');
  if(progress===1||state.click){consumedTarget=element;consumedLeftAt=null;element.click();uiCooldownUntil=time+500;resetDwell();}
 }
 // Open-palm cursor also scrolls at screen edges, allowing full hands-free mobile use.
 const scroller=document.querySelector('dialog[open]')??window;
 const rect=scroller===window?{top:0,bottom:innerHeight}:scroller.getBoundingClientRect();
 const step=Math.min(50,(time-(lastCursorTime??time))/1000*400);lastCursorTime=time;
 if(!visible&&cursor.y>rect.bottom-48)scroller.scrollBy(0,step);else if(!visible&&cursor.y<rect.top+48)scroller.scrollBy(0,-step);
 return true;
}
function playSound(){if(!sound||!audio)return;try{if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type='sine';o.frequency.setValueAtTime(640,t);o.frequency.exponentialRampToValueAtTime(980,t+.12);g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.24);}catch{}}
function toggleSound(){
 if(!audio){const C=window.AudioContext||window.webkitAudioContext;if(C)audio=new C();}
 sound=!sound;$('sound-button').textContent='Звук: '+(sound?'вкл.':'выкл.');$('sound-button').setAttribute('aria-pressed',String(sound));
 if(sound){audio?.resume();playSound();}
}
function loadBest(){try{const x=JSON.parse(localStorage.getItem('signa-best-v1')??'null');return x&&Number.isFinite(x.score)&&x.score>=0&&x.score<=100&&Number.isInteger(x.sessions)&&x.sessions>0?x:null;}catch{return null;}}
function renderResults(){
 if(resultsRendered)return;resultsRendered=true;
 const summary=course.summary(),old=loadBest();
 const best={score:Math.max(old?.score??0,summary.score),sessions:(old?.sessions??0)+1};let persisted=true;
 try{localStorage.setItem('signa-best-v1',JSON.stringify(best));}catch{persisted=false;}
 $('results').innerHTML=`<div class="results-top"><div><div class="eyebrow">УРОК ЗАВЕРШЁН</div><h2>У тебя получилось.</h2><p>Ты показал три жеста и собрал фразу<br>«Да. Я тебя люблю!»</p></div><div class="result-badge" aria-hidden="true">✓</div></div><div class="stats"><div class="stat"><strong>${summary.score}<small>/100</small></strong><span>Учебные баллы</span></div><div class="stat"><strong>3/3</strong><span>Жестов освоено</span></div><div class="stat"><strong>${Math.floor(summary.seconds/60)}:${String(summary.seconds%60).padStart(2,'0')}</strong><span>Время практики</span></div></div><table><thead><tr><th>Жест</th><th>Подсказки</th><th>Что повторить</th></tr></thead><tbody>${LESSON.map(s=>`<tr><td>${SIGNS[s].name} ✓</td><td>${summary.errors[s]}</td><td>${summary.errors[s]?s==='ily'?'Форму пальцев':s==='yes'?'Кивок кистью':'Смыкание пальцев':'Всё получилось'}</td></tr>`).join('')}</tbody></table><p class="muted">Баллы = 100 − 3 за каждую устойчивую подсказку (не ниже 50 после завершения). Это результат упражнения, не оценка владения ASL. ${persisted?'Лучший результат в этом браузере: '+best.score+'/100.':'Браузер не разрешил сохранить результат.'}</p><div class="result-actions"><button class="button primary" id="restart-button" data-gesture>Повторить урок ↻</button><button class="button secondary" id="stop-button" data-gesture>Выключить камеру</button></div>`;
 $('results').classList.remove('hidden');$('results').focus({preventScroll:true});$('results').scrollIntoView({behavior:'smooth',block:'start'});
 $('lesson-eyebrow').textContent='3 ИЗ 3 · ГОТОВО';$('auto-next').textContent='Раскрой ладонь, чтобы повторить урок';
 $('pause-button').classList.add('hidden');$('phrase-card').classList.remove('hidden');
 PHRASE.forEach((_,i)=>{$('token-'+i).classList.add('passed');$('token-'+i).classList.remove('current');});
 [0,1,2].forEach(i=>{$('step-'+i).classList.toggle('complete',i<2);$('step-'+i).classList.toggle('active',i===2);});
 $('restart-button').addEventListener('click',restartLesson);$('stop-button').addEventListener('click',()=>stopCamera());
 feedback('Урок завершён!','Раскрой ладонь и выбери «Повторить урок».','success');
}
function restartLesson(){
 generation++;clearTimeout(bannerTimer);resultsRendered=false;course.restart();recognizer.reset();setNavigation(false);paused=false;transitionUntil=0;$('gesture-banner').classList.add('hidden');$('results').classList.add('hidden');$('pause-button').classList.remove('hidden');$('pause-button').textContent='Пауза';
 if(running)course.begin(performance.now());
 setLesson();window.scrollTo({top:0,behavior:'smooth'});
 if(!running)toast('Включи камеру, чтобы начать урок.');
}
function tick(time){
 requestAnimationFrame(tick);
 if(time-lastReference>65){drawReference(reference,course.target??'ily',matchMedia('(prefers-reduced-motion: reduce)').matches?400:time);lastReference=time;}
 if(!running||!model||document.hidden||video.readyState<2||time-lastDetection<70||video.currentTime===lastFrame)return;
 lastDetection=time;lastFrame=video.currentTime;
 try{
  const detection=model.detectForVideo(video,time);
  processDetectionFrame(detection,performance.now());errorsInARow=0;
 }catch(error){errorsInARow++;if(errorsInARow>4){console.error('Tracking stopped',error);stopCamera('Распознавание прервалось','Попробуй включить камеру ещё раз.');}}
}

// The camera loop and integration tests exercise the same landmark-to-UI path.
export function processDetectionFrame(detection,time){
  const aspect=(video.videoWidth||640)/(video.videoHeight||480);
  const allFeatures=detection.landmarks.map((lm,i)=>extractFeatures(lm,detection.worldLandmarks?.[i],aspect,detection.handedness?.[i]?.[0]?.categoryName??'Right'));
  const command=commands.update(allFeatures,time);
  if(detection.landmarks.length>1){
   resetDwell();recognizer.reset();drawOverlay(overlay,video,detection.landmarks[0]);
   if(command.key){
    feedback(command.key==='pause'?'Две ладони: пауза / продолжить':'Два кулака: открыть / закрыть образец','Удержи положение 1,2 секунды.');showProgress({checks:[],progress:command.progress});
    if(command.action==='pause'&&!document.querySelector('dialog[open]')){setNavigation(false);pauseCourse();}
    if(command.action==='example'&&course.stage!=='done'){if($('video-dialog').open)closeDialog('video-dialog');else if(!$('info-dialog').open)showExample();}
   }else {feedback('Для учебного жеста оставь одну руку','Две ладони — пауза. Два кулака — образец.','tracking');showProgress({checks:[],progress:0});}
   return;
  }
  const landmarks=detection.landmarks[0]??null,features=allFeatures[0]??null;latestFrame=features;
  $('tracking-label').textContent=features?'Рука в кадре · 21 точка':'Ожидаем руку';
  const usingCursor=processCursor(features,time);
  if(usingCursor&&!document.querySelector('dialog[open]'))feedback('Управление сайтом рукой','Наведи курсор и сведи большой с указательным. Кулак — вернуться к уроку.');
  if(usingCursor||paused||document.querySelector('dialog[open]')||course.stage==='done'||time<transitionUntil||time<uiCooldownUntil){recognizer.reset();clearCorrection();drawOverlay(overlay,video,landmarks);return;}
  const result=recognizer.updateFeatures(features,time,course.target);
  drawOverlay(overlay,video,landmarks,result);updateFeedback(result,time);
  if(result.success)acceptGesture(time);
  return result;
}

export function syncCameraLayout(){
 const ratio=(video.videoWidth||640)/(video.videoHeight||480);
 $('camera-stage').style.setProperty('--camera-ratio',String(ratio));
 const actualFacing=stream?.getVideoTracks()[0]?.getSettings?.().facingMode??facing;
 video.dataset.mirrored=String(actualFacing!=='environment');
 video.setAttribute('aria-label',actualFacing==='environment'?'Изображение с задней камеры':'Зеркальное изображение с передней камеры');
}

$('start-camera').addEventListener('click',startCamera);
$('switch-camera').addEventListener('click',switchCamera);
$('pause-button').addEventListener('click',()=>pauseCourse());
$('sound-button').addEventListener('click',toggleSound);
$('nav-toggle').addEventListener('click',()=>setNavigation(!navigation.active));
$('exit-navigation').addEventListener('click',returnToLesson);
$('restart-lesson').addEventListener('click',restartLesson);
$('example-play').addEventListener('click',toggleReferencePlayer);
$('example-replay').addEventListener('click',replayReferencePlayer);
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});
video.addEventListener('resize',syncCameraLayout);
window.addEventListener('resize',syncCameraLayout);
$('example-button').addEventListener('click',showExample);
$('about-button').addEventListener('click',()=>openDialog('info-dialog'));
$('sources-button').addEventListener('click',()=>openDialog('info-dialog'));
$('close-info').addEventListener('click',()=>closeDialog('info-dialog'));
$('close-video').addEventListener('click',()=>closeDialog('video-dialog'));
$('return-practice').addEventListener('click',returnToLesson);
for(const id of ['info-dialog','video-dialog'])$(id).addEventListener('cancel',e=>{e.preventDefault();closeDialog(id);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetDwell();recognizer.reset();if(running&&!paused&&course.stage!=='done')pauseCourse('Пауза: вкладка была скрыта');}});
window.addEventListener('pagehide',()=>{running=false;stream?.getTracks().forEach(t=>t.stop());model?.close();model=null;});
setLesson();requestAnimationFrame(tick);
try{if(sessionStorage.getItem('signa-camera')==='on')startCamera();}catch{}

// Optional agent access reads the same course state; it cannot forge camera passes.
const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();
 const validate=input=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('Expected an empty object');};
 for(const tool of [
  {name:'read_signa_lesson',title:'Прочитать состояние урока',description:'Read current ASL sign, instructions and actual camera-earned progress. Does not start the camera.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){validate(input);return {stage:course.stage,target:course.target,instructions:SIGNS[course.target]?.instructions??[],camera:running,paused,summary:course.summary()};}},
  {name:'restart_signa_lesson',title:'Начать урок заново',description:'Reset the visible lesson and its current unsaved progress. Does not request camera access or award points.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){validate(input);restartLesson();return {stage:course.stage,target:course.target};}}
 ])try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
