import {resultsMarkup} from './ui/results.js?v=20260928-6';
import {saveCompletedLesson} from './lesson/progress.js?v=20260928-6';
import {GestureRecognizer, extractFeatures, matchesLessonPose} from './gestures/recognizer.js?v=20260928-6';
import {Course,SIGNS,LESSON,PHRASE} from './lesson/course.js?v=20260928-6';
import {drawOverlay,drawReference} from './ui/diagrams.js?v=20260928-6';
import {HandCommands} from './navigation/commands.js?v=20260928-6';
import {Calibration} from './vision/calibration.js?v=20260928-6';
import {CameraSession,CAMERA_ERRORS} from './vision/camera.js?v=20260928-6';
import {FrameTracker} from './vision/tracking.js?v=20260928-6';
import {FeedbackGate} from './lesson/feedback.js?v=20260928-6';
import {HandNavigation} from './navigation/navigation.js?v=20260928-6';
import {openReferencePlayer,closeReferencePlayer,toggleReferencePlayer,replayReferencePlayer} from './ui/reference-player.js?v=20260928-6';

const $=id=>document.getElementById(id);
const course=new Course(),recognizer=new GestureRecognizer(),commands=new HandCommands(),navigation=new HandNavigation();
const video=$('camera'),overlay=$('overlay'),reference=$('reference-canvas');
const calibration=new Calibration(),feedbackGate=new FeedbackGate(),tracker=new FrameTracker();
const cameraSession=new CameraSession(video,{onEnded:()=>stopCamera('Камера отключена','Подключи камеру и включи её снова.')});
let running=false,paused=false,loading=false,facing='user',calibrating=false,cameraStartId=0,closed=false,animationRequest=null;
let lastReference=0,transitionUntil=0;

let sound=false,audio=null,toastTimer=null,uiCooldownUntil=0,lastLandmarks=null;
let cursor={x:0,y:0,ready:false},cursorOrigin=null,dwell={element:null,since:0};
let consumedTarget=null,consumedLeftAt=null,resultsRendered=false,lastCursorTime=null;
const HAND_DWELL_MS=1200;

function feedback(title,detail,kind='working'){
 $('feedback-title').textContent=title;$('feedback-detail').textContent=detail;
 $('feedback').className='feedback '+(kind==='correction'?'warning':kind);
 $('feedback-icon').textContent=kind==='success'?'✓':kind==='correction'?'!':'✧';
}
function recognitionState(text,kind='working'){$('recognition-state').textContent=text;$('recognition-state').dataset.kind=kind;}
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3500);}
function showProgress(result){
 const n=Math.round(Math.min(1,result.progress)*100);
 $('hold-percent').textContent=n+'%';$('hold-fill').style.width=n+'%';
 const confidence=Number.isFinite(result.confidence)?Math.round(result.confidence*100):null;
 $('recognition-value').textContent=confidence===null?'—':confidence+'%';$('recognition-ring').style.setProperty('--progress',(confidence??0)+'%');$('confidence-value').textContent=confidence===null?'—':confidence+'%';
 const states={Incorrect:'Исправь жест',Almost:'Почти',Correct:'Верно',Tracking:'Ожидаю руку'};
 $('state-badge').textContent=states[result.state]??'Твой ход';$('state-badge').dataset.state=result.state??'Tracking';
 const errors=(result.errors??[]).slice(0,2),signatureErrors=JSON.stringify(errors);
 if($('error-list').dataset.signature!==signatureErrors){$('error-list').dataset.signature=signatureErrors;$('error-list').replaceChildren(...errors.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));}
 const signature=JSON.stringify(result.checks.map(({label,pass})=>[label,pass]));
 if($('checks').dataset.signature!==signature){$('checks').dataset.signature=signature;$('checks').replaceChildren(...result.checks.map(v=>{const span=document.createElement('span');span.className='check-chip'+(v.pass?' pass':'');span.textContent=(v.pass?'✓ ':'○ ')+v.label;return span;}));}
}
function setLesson(){
 $('lesson-card').classList.remove('is-completed');$('nav-toggle').disabled=false;$('pause-button').disabled=false;$('example-button').disabled=false;$('calibrate-button').disabled=!running;
 recognitionState(running?'Покажи текущий жест':'Включи камеру');
 $('camera-task').textContent=course.target?'Повтори: «'+SIGNS[course.target].name+'»':'Урок завершён';
 $('camera-task-count').textContent=course.stage==='done'?'5 / 5':`${(course.stage==='learn'?0:3)+course.index+1} / 5`;
 if(course.stage==='done'){renderResults();return;}
 const sign=SIGNS[course.target];
 $('lesson-eyebrow').textContent=course.stage==='learn'?`ЖЕСТ ${course.index+1} ИЗ 3`:`ФРАЗА · ЧАСТЬ ${course.index+1} ИЗ 2`;
 $('lesson-pill').textContent=sign.type;$('sign-name').textContent=sign.name;$('sign-gloss').textContent=sign.gloss;
 $('instructions').replaceChildren(...sign.instructions.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
 $('hold-label').textContent=sign.hold;$('auto-next').textContent='Получится — перейдём дальше автоматически';
 showProgress({checks:[],progress:0});recognizer.reset();clearCorrection();
 document.querySelectorAll('.vocab-item').forEach(el=>{el.classList.toggle('current',course.target===el.dataset.sign);el.classList.toggle('done',course.learned.has(el.dataset.sign));});
 [0,1,2].forEach(i=>{$('step-'+i).classList.toggle('active',i===(course.stage==='learn'?0:1));$('step-'+i).classList.toggle('complete',course.stage==='phrase'&&i===0);});
 $('phrase-card').classList.toggle('hidden',course.stage!=='phrase');
 PHRASE.forEach((_,i)=>{$('token-'+i).classList.toggle('passed',course.stage==='phrase'&&i<course.index);$('token-'+i).classList.toggle('current',course.stage==='phrase'&&i===course.index);});
 if(running)feedback('Повтори: «'+sign.name+'»',sign.instructions[0]);
 drawReference(reference,course.target);
}
function clearCorrection(){feedbackGate.reset();}
function updateFeedback(result,time){
 showProgress(result);
 const labels={Incorrect:'Исправь положение',Almost:'Почти получилось',Correct:'Жест засчитан',Tracking:'Проверь положение руки'};
 recognitionState(labels[result.state]??'Проверяю жест',result.kind);
 const update=feedbackGate.update(result,time);
 if(update.show)feedback(result.title,result.detail,result.kind);
 if(update.correction)course.recordCorrection();
 course.observe(result,time);
}
function acceptGesture(time,result){
 const sign=course.target;
 if(!course.accept(sign,time))return;
 recognizer.reset();showProgress({...result,progress:1,state:'Correct'});
 $('calibrate-button').disabled=true;
 $('lesson-card').classList.add('is-completed');
 recognitionState('✓ «'+SIGNS[sign].name+'» засчитан','success');
 $('gesture-banner-text').textContent='«'+SIGNS[sign].name+'» — получилось!';$('gesture-banner').classList.remove('hidden');
 $('camera-stage').classList.add('shake');playSound();
 feedback('Жест засчитан!','Сейчас автоматически откроется следующий этап.','success');
}
function advanceLesson(time){
 if(!course.advance(time))return false;
 $('gesture-banner').classList.add('hidden');$('camera-stage').classList.remove('shake');$('lesson-card').classList.remove('is-completed');
 transitionUntil=time+250;setLesson();return true;
}
function pauseCourse(reason='Пауза'){
 if(!running||course.stage==='done')return;
 paused=!paused;recognizer.reset();clearCorrection();
 if(paused){course.pause(performance.now());feedback(reason,'Раскрой ладонь и выбери «Продолжить».');}else{course.resume(performance.now());feedback('Продолжаем',SIGNS[course.target]?.instructions[0]??'');}
 $('pause-button').textContent=paused?'Продолжить':'Пауза';
 recognitionState(paused?'Урок на паузе':'Покажи текущий жест');
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
function setStartLoading(text){$('camera-start').classList.add('is-loading');$('start-camera').disabled=true;$('start-camera').querySelector('span').textContent=text;$('camera-title').textContent='Готовим камеру';$('camera-description').textContent='Разреши доступ в окне браузера. После загрузки покажи открытую ладонь.';$('cancel-camera').classList.remove('hidden');}
async function startCamera(){
 if(loading)return;const call=++cameraStartId;let startupStage='permission';loading=true;setStartLoading('Разреши доступ…');
 prepareAudio();
 try{
  const ready=await cameraSession.start(facing,stage=>{startupStage=stage;setStartLoading(stage==='model'?'Загружаем распознавание…':'Разреши доступ…');});
  if(!ready||call!==cameraStartId)return;
  startupStage='tracking';
  running=true;paused=false;syncCameraLayout();$('camera-stage').classList.add('is-streaming');
  try{sessionStorage.setItem('signa-camera','on');}catch{}
  $('camera-start').classList.add('hidden');$('camera-controls').classList.remove('hidden');$('camera-label').classList.add('on');$('camera-label').innerHTML='<i></i> КАМЕРА ВКЛЮЧЕНА';
  $('pause-button').textContent='Пауза';$('calibrate-button').disabled=false;$('camera-bottom-label').innerHTML='<i class="status-dot"></i> Видео не записывается';
  startCalibration();tracker.start(cameraSession,processDetectionFrame,()=>stopCamera('Распознавание прервалось','Попробуй включить камеру ещё раз.'));
 }catch(error){if(call!==cameraStartId)return;const fallback=startupStage==='model'?['Не удалось загрузить распознавание','Обнови страницу и повтори запуск. Для загрузки нужен доступ к сети.']:['Не удалось запустить распознавание','Обнови страницу и повтори запуск. Если ошибка повторяется, попробуй другой браузер.'];const [title,detail]=CAMERA_ERRORS[error.name]??fallback;stopCamera(title,detail);}
 finally{if(call===cameraStartId){loading=false;$('camera-start').classList.remove('is-loading');$('start-camera').disabled=false;$('start-camera').querySelector('span').textContent='Включить камеру';$('cancel-camera').classList.add('hidden');}}
}
function stopCamera(title='Камера выключена',detail='Включи её, когда будешь готов продолжить.'){
 const wasCalibrating=calibrating;
 cameraStartId++;loading=false;running=false;calibrating=false;tracker.stop();cameraSession.stop();setNavigation(false);recognizer.reset();
 if(wasCalibrating)setLesson();
 try{sessionStorage.removeItem('signa-camera');}catch{}
 course.pause(performance.now());$('camera-stage').classList.remove('is-streaming');
 $('camera-start').classList.remove('is-loading');
 $('start-camera').disabled=false;$('start-camera').querySelector('span').textContent='Включить камеру';$('cancel-camera').classList.add('hidden');$('calibrate-button').disabled=true;
 $('camera-start').classList.remove('hidden');$('camera-controls').classList.add('hidden');$('camera-title').textContent=title;$('camera-description').textContent=detail;
 $('camera-label').classList.remove('on');$('camera-label').innerHTML='<i></i> КАМЕРА ВЫКЛЮЧЕНА';$('tracking-label').textContent='Нет видеопотока';
 recognitionState('Камера выключена');drawOverlay(overlay,video,null);feedback(title,detail,'tracking');
}
async function switchCamera(){
 if(loading)return;stopCamera();facing=facing==='user'?'environment':'user';await startCamera();
}
export function startCalibration(){
 if(course.pending)return;
 calibration.reset();calibrating=true;paused=false;setNavigation(false);recognizer.reset();course.pause(performance.now());
 $('nav-toggle').disabled=true;$('pause-button').disabled=true;$('example-button').disabled=true;$('calibrate-button').disabled=true;
 $('camera-task').textContent='Настроим камеру';$('camera-task-count').textContent='Настройка';
 $('lesson-eyebrow').textContent='ПЕРЕД УРОКОМ';$('lesson-pill').textContent='1–2 секунды';$('sign-name').textContent='Открой ладонь';$('sign-gloss').textContent='НАСТРОЙКА КАМЕРЫ';
 const steps=['Покажи одну раскрытую ладонь перед камерой.','Оставь в кадре все пальцы и запястье.','Держи спокойно — урок начнётся автоматически.'];
 $('instructions').replaceChildren(...steps.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
 $('hold-label').textContent='Держи ладонь 1,4 секунды';$('auto-next').textContent='Настройка под размер твоей руки';
 showProgress({progress:0,checks:[],errors:[],state:'Tracking'});recognitionState('Покажи открытую ладонь');feedback('Покажи открытую ладонь','Настроим рабочее расстояние перед первым заданием.');drawReference(reference,'palm');
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
 const lessonPose=!paused&&!document.querySelector('dialog[open]')&&matchesLessonPose(features,course.target);
 const state=navigation.update(features,time,lessonPose);
 if(state.changed){cursorOrigin=null;consumedTarget=null;updateNavigationUI();recognizer.reset();clearCorrection();if(!state.active){returnToLesson();uiCooldownUntil=time+250;feedback('Режим урока',course.target?'Повтори: «'+SIGNS[course.target].name+'».':'Урок завершён.');}}
 if(!state.active||!features||features.cropped){resetDwell();lastCursorTime=null;consumedLeftAt??=time;if(time-consumedLeftAt>300)consumedTarget=null;return state.active;}
 if(state.intent==='lesson'){resetDwell();return true;}
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
function prepareAudio(){try{if(!audio||audio.state==='closed'){const C=window.AudioContext||window.webkitAudioContext;audio=C?new C():null;}if(audio?.state==='suspended')audio.resume().catch(()=>{});}catch{audio=null;}}
function playSound(){if(!sound)return;prepareAudio();if(!audio)return;try{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type='sine';o.frequency.setValueAtTime(640,t);o.frequency.exponentialRampToValueAtTime(980,t+.12);g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.24);}catch{}}
function toggleSound(){
 sound=!sound;$('sound-button').textContent='Звук: '+(sound?'вкл.':'выкл.');$('sound-button').setAttribute('aria-pressed',String(sound));
 if(sound)playSound();
}
function renderResults(){
 recognitionState('✓ Урок завершён','success');
 if(resultsRendered)return;resultsRendered=true;
 const summary=course.summary(),{progress,persisted,previousScore}=saveCompletedLesson(summary);
 $('results').innerHTML=resultsMarkup(summary,progress,persisted,previousScore);
 $('results').classList.remove('hidden');$('results').focus({preventScroll:true});$('results').scrollIntoView({behavior:'smooth',block:'start'});
 $('lesson-eyebrow').textContent='3 ИЗ 3 · ГОТОВО';$('auto-next').textContent='Раскрой ладонь, чтобы повторить урок';
 $('pause-button').classList.add('hidden');$('phrase-card').classList.remove('hidden');
 PHRASE.forEach((_,i)=>{$('token-'+i).classList.add('passed');$('token-'+i).classList.remove('current');});
 [0,1,2].forEach(i=>{$('step-'+i).classList.toggle('complete',i<2);$('step-'+i).classList.toggle('active',i===2);});
 $('restart-button').addEventListener('click',restartLesson);$('stop-button').addEventListener('click',()=>stopCamera());
 feedback('Урок завершён!','Раскрой ладонь и выбери «Повторить урок».','success');
}
function restartLesson(){
 resultsRendered=false;course.restart();recognizer.reset();setNavigation(false);paused=false;transitionUntil=0;$('gesture-banner').classList.add('hidden');$('results').classList.add('hidden');$('pause-button').classList.remove('hidden');$('pause-button').textContent='Пауза';
 calibrating=false;
 if(running&&calibration.profile)course.begin(performance.now());
 setLesson();if(running&&!calibration.profile)startCalibration();window.scrollTo({top:0,behavior:'smooth'});
 if(!running)toast('Включи камеру, чтобы начать урок.');
}
function tick(time){
 if(closed)return;
 animationRequest=requestAnimationFrame(tick);advanceLesson(time);
 if(!document.hidden&&time-lastReference>100){drawReference(reference,calibrating?'palm':course.target??'ily',matchMedia('(prefers-reduced-motion: reduce)').matches?400:time);lastReference=time;}
}

// The camera loop and integration tests exercise the same landmark-to-UI path.
export function processDetectionFrame(detection,time,{brightness=null}={}){
  advanceLesson(time);
  const aspect=(video.videoWidth||640)/(video.videoHeight||480);
  const allFeatures=detection.landmarks.map((lm,i)=>extractFeatures(lm,detection.worldLandmarks?.[i],aspect,detection.handedness?.[i]?.[0]?.categoryName??'Right'));
  if(calibrating){
   const lm=detection.landmarks[0]??null;lastLandmarks=lm;drawOverlay(overlay,video,lm);
   $('tracking-label').textContent=allFeatures[0]?'Рука в кадре · 21 точка':'Ожидаем руку';
   if(document.querySelector('dialog[open]')){processCursor(allFeatures.length===1?allFeatures[0]:null,time);return;}
   const state=calibration.update(allFeatures,time,{brightness,mirrored:video.dataset.mirrored!=='false'});
   showProgress({progress:state.progress,checks:[],errors:[],state:'Tracking'});feedback(state.title,state.detail);recognitionState('Настройка · '+Math.round(state.progress*100)+'%');
   if(state.complete){calibrating=false;paused=false;setNavigation(false);recognizer.setProfile(state.profile);navigation.suspendEntryUntilRelease();$('pause-button').textContent='Пауза';course.begin(time);course.resume(time);transitionUntil=time+400;setLesson();feedback('Камера настроена',SIGNS[course.target??'ily'].instructions[0],'success');}
   return state;
  }
  if(course.pending){drawOverlay(overlay,video,detection.landmarks[0]??null);return;}
  const command=commands.update(allFeatures,time);
  if(detection.landmarks.length>1){
   recognitionState('Вижу две руки · команды управления');
   resetDwell();const waiting=recognizer.updateFeatures(null,time,course.target);lastLandmarks=detection.landmarks[0];drawOverlay(overlay,video,lastLandmarks);$('tracking-label').textContent='В кадре две руки';
   if(command.key){
    feedback(command.key==='pause'?'Две ладони: пауза / продолжить':'Два кулака: открыть / закрыть образец','Удержи положение 1,2 секунды.');showProgress({checks:[],progress:command.progress});
    if(command.action==='pause'&&!document.querySelector('dialog[open]')){setNavigation(false);pauseCourse();}
    if(command.action==='example'&&course.stage!=='done'){if($('video-dialog').open)closeDialog('video-dialog');else if(!$('info-dialog').open)showExample();}
   }else {feedback('Для учебного жеста оставь одну руку','Две ладони — пауза. Два кулака — образец.','tracking');showProgress({...waiting,checks:[],errors:[]});}
   return;
  }
  const landmarks=detection.landmarks[0]??null,features=allFeatures[0]??null;lastLandmarks=landmarks;
  $('tracking-label').textContent=features?'Рука в кадре · 21 точка':'Ожидаем руку';
  const usingCursor=processCursor(features,time);
  if(usingCursor)recognitionState('Курсор · покажи учебный жест, чтобы вернуться');
  else if(paused||document.querySelector('dialog[open]'))recognitionState('Урок на паузе');
  else if(!features&&course.stage!=='done')recognitionState('Рука не видна','tracking');
  if(usingCursor&&!document.querySelector('dialog[open]'))feedback('Управление сайтом рукой','Наведи курсор и сведи большой с указательным. Кулак — вернуться к уроку.');
  if(usingCursor||paused||document.querySelector('dialog[open]')||course.stage==='done'||time<transitionUntil||time<uiCooldownUntil){recognizer.reset();clearCorrection();drawOverlay(overlay,video,landmarks);return;}
  const result=recognizer.updateFeatures(features,time,course.target);
  if(!features&&brightness!==null&&brightness<28){result.title="Добавь свет перед собой";result.detail="Кадр тёмный. Повернись к источнику света и покажи ладонь.";}
  drawOverlay(overlay,video,landmarks,result);updateFeedback(result,time);
  if(result.success)acceptGesture(time,result);
  return result;
}

export function syncCameraLayout(){
 const ratio=(video.videoWidth||640)/(video.videoHeight||480);
 $('camera-stage').style.setProperty('--camera-ratio',String(ratio));
 const actualFacing=cameraSession.facing??facing;
 video.dataset.mirrored=String(actualFacing!=='environment');
 video.setAttribute('aria-label',actualFacing==='environment'?'Изображение с задней камеры':'Зеркальное изображение с передней камеры');
 if(lastLandmarks)drawOverlay(overlay,video,lastLandmarks);
}

$('start-camera').addEventListener('click',startCamera);
$('cancel-camera').addEventListener('click',()=>stopCamera());
$('calibrate-button').addEventListener('click',startCalibration);
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
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetDwell();recognizer.reset();if(calibrating)calibration.reset();else if(running&&!paused&&course.stage!=='done')pauseCourse('Пауза: вкладка была скрыта');}});
window.addEventListener('pagehide',()=>{closed=true;running=false;cameraStartId++;tracker.stop();cameraSession.stop();cancelAnimationFrame(animationRequest);clearTimeout(toastTimer);toastTimer=null;$('toast').classList.add('hidden');try{audio?.close().catch(()=>{});}catch{}audio=null;closeReferencePlayer();});
window.addEventListener('pageshow',e=>{if(e.persisted){closed=false;animationRequest=requestAnimationFrame(tick);stopCamera();}});
setLesson();requestAnimationFrame(tick);
try{if(sessionStorage.getItem('signa-camera')==='on')startCamera();}catch{}

// Optional agent access reads the same course state; it cannot forge camera passes.
const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();
 const validate=input=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('Expected an empty object');};
 for(const tool of [
  {name:'read_signa_lesson',title:'Прочитать состояние урока',description:'Read current ASL sign, instructions and actual camera-earned progress. Does not start the camera.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){validate(input);return {stage:course.stage,target:course.target,instructions:SIGNS[course.target]?.instructions??[],camera:running,paused,calibrating,status:course.status,summary:course.summary()};}},
  {name:'restart_signa_lesson',title:'Начать урок заново',description:'Reset the visible lesson and its current unsaved progress. Does not request camera access or award points.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){validate(input);restartLesson();return {stage:course.stage,target:course.target};}}
 ])try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
