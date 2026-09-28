import {LESSON,SIGNS} from './course.js?v=20260928-6';
const duration=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
const date=timestamp=>new Date(timestamp).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

function progressMarkup(progress,persisted,previousScore,score){
 const delta=previousScore===null?null:score-previousScore;
 const comparison=delta===null?'Первый результат в истории':delta===0?'Столько же баллов, как в прошлый раз':`${delta>0?'+':''}${delta} балл. к прошлому уроку`;
 const awards=[
  {title:'Первый шаг',detail:'Заверши один урок',earned:progress.sessions>=1},
  {title:'Без исправлений',detail:'Пройди урок без устойчивых ошибок',earned:progress.cleanLesson},
  {title:'В ритме',detail:'Заверши три урока',earned:progress.sessions>=3}
 ];
 return `<section class="progress-panel" aria-label="Личный прогресс">
  <div class="progress-heading"><div><h3>Твой прогресс</h3><p>${persisted?'Сохранён в этом браузере':'Текущий результат · сохранение недоступно'}</p></div><strong>${progress.sessions}<span>уроков завершено</span></strong></div>
  <div class="personal-record"><span>Личный рекорд <strong>${progress.score}/100</strong></span><span>${comparison}</span></div>
  <h4>Лучшее соответствие по жестам</h4>
  <div class="gesture-records">${LESSON.map(s=>`<div><span>${SIGNS[s].name}</span><strong>${progress.gestureBest[s]??0}<small>%</small></strong></div>`).join('')}</div>
  <h4>Твои достижения</h4>
  <div class="lesson-awards">${awards.map(a=>`<div class="lesson-award${a.earned?' earned':''}"><b aria-hidden="true">${a.earned?'✓':'○'}</b><div><strong>${a.title}</strong><span>${a.earned?'Получено · ':''}${a.detail}</span></div></div>`).join('')}</div>
  <h4>Последние прохождения</h4>
  <ol class="progress-history">${[...progress.history].reverse().map(h=>`<li><time datetime="${new Date(h.at).toISOString()}">${date(h.at)}</time><strong>${h.score}/100</strong><span>${duration(h.seconds)} · подсказок: ${h.hints}</span></li>`).join('')}</ol>
 </section>`;
}

export function resultsMarkup(summary,progress,persisted,previousScore=null){return `
 <div class="results-top"><div><div class="eyebrow">УРОК ЗАВЕРШЁН</div><h2>У тебя получилось.</h2><p>Ты показал три жеста и собрал фразу<br>«Да. Я тебя люблю!»</p></div><div class="result-badge" aria-hidden="true">✓</div></div>
 <div class="stats">
  <div class="stat"><strong>${summary.score}<small>/100</small></strong><span>Учебные баллы</span></div>
  <div class="stat"><strong>3/3</strong><span>Жестов освоено</span></div>
  <div class="stat"><strong>${duration(summary.seconds)}</strong><span>Время урока</span></div>
  <div class="stat"><strong>${summary.accuracy}<small>%</small></strong><span>Среднее соответствие</span></div>
  <div class="stat"><strong>${summary.hints}</strong><span>Подсказок получено</span></div>
  <div class="stat"><strong class="best-gesture">${SIGNS[summary.bestGesture]?.name??'—'}</strong><span>Лучший жест</span></div>
 </div>
 <table><thead><tr><th>Жест</th><th>Подсказки</th><th>Что повторить</th></tr></thead><tbody>${LESSON.map(s=>`<tr><td>${SIGNS[s].name} ✓</td><td>${summary.errors[s]}</td><td>${summary.errors[s]?s==='ily'?'Форму пальцев':s==='yes'?'Кивок кистью':'Смыкание пальцев':'Всё получилось'}</td></tr>`).join('')}</tbody></table>
 <p class="muted">Соответствие — средняя доля соблюдённых правил во время практики. Баллы = 100 − 3 за каждую устойчивую подсказку (не ниже 50 после завершения). Это результат упражнения, не оценка владения ASL. ${persisted?'Прогресс сохранён только на этом устройстве.':'Браузер не разрешил сохранить результат.'}</p>
 <div class="result-actions"><button class="button primary" id="restart-button" data-gesture>Повторить урок ↻</button><button class="button secondary" id="stop-button" data-gesture>Выключить камеру</button></div>
 ${progressMarkup(progress,persisted,previousScore,summary.score)}`;}
