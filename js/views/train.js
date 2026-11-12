// Тренировки: программа, упражнения, живая запись, отчёт, история.
import * as store from '../store.js';
import { icon, esc, poseSVG, lineChart, openSheet, closeSheet, toast, confirmDialog, scale5, bindScales, sw } from '../ui.js';
import { today, fmtDate, fmtShort, programInfo, planItems, nextWorkoutId, progression, historyFor, sessionStats, previousEntry, fmt, plural, sessionsBetween, mondayOf, addDays, weekProgress, programWeek, weekTarget } from '../logic.js';
import { WORKOUTS, ORDER, PHASES, TOTAL_WEEKS, RUN_PLAN, PROGRESSION_RULES, MODE, WHO, sessionInfo, RUN_RULES, SEASON } from '../data/program.js';
import { HIM_WARMUP_RUN, HIM_WARMUP_GYM, HIM_COOLDOWN_RUN, MOBILITY_SESSION } from '../data/exercises-him.js';
import { EXERCISES, WARMUP, COOLDOWN } from '../data/exercises.js';
import { go } from '../app.js';

export const trainRoutes = [
  { re: /^train$/, view: TrainHome },
  { re: /^train\/w\/([A-Z0-9]+)$/, view: WorkoutView },
  { re: /^train\/ex\/([a-z_]+)$/, view: ExerciseView },
  { re: /^train\/session$/, view: SessionView },
  { re: /^train\/report\/([a-z0-9]+)$/, view: ReportView },
  { re: /^train\/library$/, view: LibraryView },
  { re: /^train\/history$/, view: HistoryView },
  { re: /^train\/rules$/, view: RulesView }
];

const repsText = (it, ex) => {
  const [lo, hi] = it.reps;
  const u = ex.unit === 'sec' ? ' сек' : '';
  return `${it.sets} × ${lo === hi ? lo : `${lo}–${hi}`}${u}`;
};
const weightText = (it, ex) => ex.unit === 'kg' ? (it.weight > 0 ? `${fmt(it.weight, 1)} кг${ex.perHand ? ' × 2' : ''}` : 'свой вес') : ex.unit === 'sec' ? 'удержание' : 'свой вес';

function TrainHome() {
  if (MODE === 'weekly') return TrainHomeWeekly();
  const s = store.get();
  const t = today();
  const pi = programInfo(t);
  const nextW = s.planned[t] && s.planned[t] !== 'rest' ? s.planned[t] : nextWorkoutId();
  const mon = mondayOf(t);
  const weekSess = sessionsBetween(mon, addDays(mon, 6));
  const html = `
  <div class="page">
    ${s.active ? `<button class="banner" data-go="train/session" style="width:100%;text-align:left"><div class="b-ic" style="background:var(--green)">${icon('play')}</div><div class="grow"><b>Тренировка ${s.active.workout} идёт</b><p>Нажми, чтобы продолжить запись подходов</p></div></button>` : ''}
    <div class="card">
      <div class="row between"><div><div class="muted small">Неделя ${Math.max(1, Math.min(pi.week, TOTAL_WEEKS))} из ${TOTAL_WEEKS}</div><div class="mid-num">${esc(pi.phase.name)}</div></div>
      <span class="chip ${pi.phase.deload ? 'orange' : 'green'}">RIR ${esc(pi.phase.rir)}</span></div>
      <div class="muted small" style="margin-top:6px">${esc(pi.phase.desc)}</div>
      <div class="row" style="gap:4px;margin-top:12px">${Array.from({ length: TOTAL_WEEKS }, (_, i) => { const w = i + 1; const ph = PHASES.find(p => w >= p.from && w <= p.to); const c = ph.deload ? 'var(--orange)' : w <= 3 ? 'var(--teal)' : w <= 6 ? 'var(--green)' : 'var(--tint)'; return `<div style="flex:1;height:6px;border-radius:3px;background:${c};opacity:${w <= pi.week ? 1 : 0.25}"></div>`; }).join('')}</div>
      <div class="row between xs muted" style="margin-top:6px"><span>Техника</span><span>Рост</span><span>Разгрузка</span><span>Развитие</span></div>
    </div>

    <div>
      <div class="section-h"><h2>Следующая</h2><span class="muted small">на этой неделе ${weekSess.length}/${s.targets.workoutsPerWeek}</span></div>
      ${workoutCard(nextW, true)}
    </div>

    <div>
      <div class="section-h"><h2>Программа</h2></div>
      <div class="stack">${ORDER.filter(w => w !== nextW).map(w => workoutCard(w)).join('')}</div>
      <div class="section-foot">Порядок по кругу: A → B → C. Между тренировками минимум день отдыха. После суток — не тренироваться.</div>
    </div>

    <div class="list">
      <button class="li tap with-ic" data-go="train/library"><div class="li-ic" style="background:var(--indigo)">${icon('book')}</div><div class="li-main li-title">Библиотека упражнений</div><span class="li-val">${Object.keys(EXERCISES).length}</span>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="train/history"><div class="li-ic" style="background:var(--green)">${icon('list')}</div><div class="li-main li-title">История тренировок</div><span class="li-val">${s.sessions.length}</span>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="train/rules"><div class="li-ic" style="background:var(--orange)">${icon('chart')}</div><div class="li-main li-title">Прогрессия, кардио и безопасность</div>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="profile/load"><div class="li-ic" style="background:var(--tint)">${icon('bolt')}</div><div class="li-main li-title">Общая нагрузка</div>${icon('chev', 'chev')}</button>
    </div>
  </div>`;
  return { title: 'Тренировки', html };
}

function workoutCard(id, primary = false) {
  const w = WORKOUTS[id];
  const items = planItems(id);
  return `<div class="card tap wk-card" data-go="train/w/${id}">
    <div class="row"><div class="wk-letter" style="background:${w.color}">${id}</div><div class="grow"><div style="font-weight:600;font-size:17px">${esc(w.name)}</div><div class="muted small">${items.length} упражнений · ~${w.duration} мин</div></div>${icon('chev', 'chev')}</div>
    ${primary ? `<div class="chips" style="margin-top:12px">${items.slice(0, 4).map(it => `<span class="chip">${esc(EXERCISES[it.ex].short)}</span>`).join('')}${items.length > 4 ? `<span class="chip">+${items.length - 4}</span>` : ''}</div>` : ''}
  </div>`;
}

function WorkoutView(id) {
  const s = store.get();
  const pi = programInfo();
  const info = sessionInfo(id, Math.max(1, Math.min(pi.week, TOTAL_WEEKS)));
  if (info.kind !== 'strength') return CardioView(id, info);
  const w = WORKOUTS[id];
  const items = planItems(id);
  const WU = WHO === 'him' ? HIM_WARMUP_GYM.items : WARMUP;
  const html = `
  <div class="page">
    <div class="card">
      <div class="row"><div class="wk-letter" style="background:${w.color}">${id}</div><div class="grow"><div class="muted small">Неделя ${Math.max(1, Math.min(pi.week, TOTAL_WEEKS))} · ${esc(pi.phase.name)}</div><div style="font-weight:600">~${w.duration} мин · запас ${esc(pi.phase.rir)} повт.</div></div></div>
      <p class="muted small" style="margin-top:10px;line-height:1.45">${esc(w.goal)}</p>
      ${pi.phase.deload ? '<div class="sugg warn">Неделя разгрузки: подходов меньше, вес не повышаем.</div>' : ''}
    </div>
    <details class="card"><summary style="font-weight:600;cursor:pointer">🔥 Разминка · 10 мин</summary><ul class="ul" style="margin-top:8px">${WU.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
    <div>
      <div class="section-cap">Упражнения</div>
      <div class="list">${items.map((it, i) => {
        const ex = EXERCISES[it.ex];
        const p = progression(it);
        return `<button class="li tap" data-go="train/ex/${it.ex}" style="align-items:flex-start">
          <div class="ex-thumb">${poseSVG(ex.pose, 'end')}</div>
          <div class="li-main"><div class="li-title" style="font-size:16px;font-weight:600">${i + 1}. ${esc(ex.short)}${it.swapped ? ' <span class="chip green" style="font-size:11px">новое</span>' : ''}</div>
            <div class="li-sub">${repsText(it, ex)} · ${weightText(it, ex)} · отдых ${it.rest} с</div>
            ${it.note ? `<div class="li-sub">${esc(it.note)}</div>` : ''}
            ${p.type === 'up' || p.type === 'up-reps' ? '<div class="li-sub ok">▲ готова к прогрессии</div>' : p.type === 'pain' ? '<div class="li-sub bad">⚠︎ была боль — без повышения</div>' : ''}
          </div>${icon('chev', 'chev')}</button>`;
      }).join('')}</div>
    </div>
    <details class="card"><summary style="font-weight:600;cursor:pointer">🧘‍♀️ Заминка · 5–10 мин</summary><ul class="ul" style="margin-top:8px">${COOLDOWN.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="muted small" style="margin-top:8px">${esc(w.cardio)}</p></details>
    ${s.active ? (s.active.workout === id ? `<button class="btn green" data-go="train/session">${icon('play')} Продолжить тренировку</button>` : `<div class="note">Сейчас идёт тренировка ${s.active.workout}. Заверши её, чтобы начать эту.</div>`) : `<button class="btn" id="start">${icon('play')} Начать тренировку ${id}</button>`}
    <div class="note">Веса — ориентир. Если с рекомендованным весом остаётся запас больше 4 повторов или, наоборот, техника ломается — измени вес прямо в тренировке.</div>
  </div>`;
  return {
    title: `Тренировка ${id}`, eyebrow: w.name, back: 'train', backLabel: 'Тренировки', html,
    mount: root => {
      const b = root.querySelector('#start');
      if (b) b.addEventListener('click', () => startSession(id));
    }
  };
}

async function startSession(id) {
  const s = store.get();
  const t = today();
  if ((s.daily[addDays(t, -1)] || {}).shift) {
    const ok = await confirmDialog('Вчера были сутки', 'После бессонной ночи растёт риск травмы и скачков пульса. Лучше сегодня прогулка. Всё равно начать?', 'Начать');
    if (!ok) return;
  }
  const pi = programInfo(t);
  const items = planItems(id, t);
  store.update(st => {
    st.active = {
      id: store.uid(), workout: id, kind: "strength", date: t, week: pi.week, startedAt: Date.now(),
      exercises: items.map(it => {
        const prev = previousEntry(it.key);
        return {
          key: it.key, ex: it.ex,
          planned: { sets: it.sets, reps: it.reps, weight: it.weight, rest: it.rest, unit: it.unit },
          sets: Array.from({ length: it.sets }, (_, i) => ({ w: it.unit === 'kg' ? it.weight : '', r: '', prev: prev && prev.sets[i] ? `${prev.sets[i].w}×${prev.sets[i].r}` : '', done: false })),
          effort: '', pain: false, note: ''
        };
      })
    };
    st.planned[t] = id;
  }, { silent: true });
  go('train/session');
}

/* ---------- Гибрид: недельный план ---------- */
function TrainHomeWeekly() {
  const s = store.get();
  const t = today();
  const pi = programInfo(t);
  const wp = weekProgress(t);
  const target = wp.plan.filter(p => p.kind !== 'mobility' && !p.optional).length;
  const doneMain = wp.plan.filter(p => p.done && p.kind !== 'mobility' && !p.optional).length;
  const em = k => ({ run: '🏃', bike: '🚴', mobility: '🧘', strength: '🏋️' }[k] || '🏋️');
  const curSeason = SEASON.find(x => t >= x.from && t <= x.to) || SEASON[0];
  const html = `
  <div class="page">
    ${s.active ? `<button class="banner" data-go="train/session" style="width:100%;text-align:left"><div class="b-ic" style="background:var(--green)">${icon('play')}</div><div class="grow"><b>Тренировка ${s.active.workout} идёт</b><p>Нажми, чтобы продолжить запись подходов</p></div></button>` : ''}
    <div class="card">
      <div class="row between"><div><div class="muted small">${pi.notStarted ? `Старт ${fmtDate(s.settings.programStart)}` : `Неделя ${Math.max(1, Math.min(pi.week, TOTAL_WEEKS))} из ${TOTAL_WEEKS}`}</div><div class="mid-num">${esc(pi.phase.name)}</div></div>
      <span class="chip ${pi.phase.deload ? 'orange' : 'green'}">RIR ${esc(pi.phase.rir)}</span></div>
      <div class="muted small" style="margin-top:6px;line-height:1.4">${esc(pi.phase.desc)}</div>
      <div class="row" style="gap:3px;margin-top:12px">${Array.from({ length: TOTAL_WEEKS }, (_, i) => { const w = i + 1; const ph = PHASES.find(p => w >= p.from && w <= p.to); const c = ph.deload ? 'var(--orange)' : w <= 4 ? 'var(--teal)' : w === 12 ? 'var(--purple)' : 'var(--green)'; return `<div style="flex:1;height:6px;border-radius:3px;background:${c};opacity:${w <= pi.week ? 1 : 0.25}"></div>`; }).join('')}</div>
      <div class="row between xs muted" style="margin-top:6px"><span>Возвращение</span><span>Основной</span><span>Разгр.</span><span>Основной</span><span>Контроль</span></div>
    </div>

    <div>
      <div class="section-h"><h2>План недели</h2><span class="muted small">${doneMain}/${target}</span></div>
      <div class="list">${wp.plan.map(p => `<button class="li tap with-ic" data-go="train/w/${p.k}">
        <div class="li-ic" style="background:${p.info.color};font-weight:800">${p.kind === 'strength' ? p.k : em(p.kind)}</div>
        <div class="li-main"><div class="li-title" style="font-size:16px">${esc(p.kind === 'strength' ? p.info.name : p.info.name)}${p.optional ? ' <span class="xs muted">по желанию</span>' : ''}</div>
        <div class="li-sub">${p.kind === 'strength' ? `~${p.info.duration} мин · ${(p.info.items || []).length} упражнений` : `${esc(p.info.minText || '')} мин${p.info.quality ? ' · интенсивная' : p.info.long ? ' · длительная' : ''}`}</div></div>
        <span class="check ${p.done ? 'on' : ''}">${p.done ? icon('check') : ''}</span></button>`).join('')}</div>
      <div class="section-foot">Порядок по дням — примерный (Пн A · Вт лёгкий бег · Ср B · Чт интенсивная · Пт C · Сб длительная). Главное: тренировка A не накануне интервалов и длительной; две тренировки в день — утром бег, вечером зал.</div>
    </div>

    <div class="card">
      <div class="card-h"><span class="ic" style="background:var(--tint)">🏁</span>Сезон<span class="right">${esc(curSeason.name)}</span></div>
      <ul class="ul">${SEASON.map(x => `<li style="${t >= x.from && t <= x.to ? 'font-weight:600' : ''}"><b>${fmtDate(x.from)} — ${fmtDate(x.to)}:</b> ${esc(x.name)}</li>`).join('')}</ul>
      <div class="xs muted" style="margin-top:6px">Даты стартов 2027 ещё не объявлены — сверим, когда откроется регистрация.</div>
    </div>

    <div class="list">
      <button class="li tap with-ic" data-go="train/library"><div class="li-ic" style="background:var(--indigo)">${icon('book')}</div><div class="li-main li-title">Библиотека упражнений</div>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="train/history"><div class="li-ic" style="background:var(--green)">${icon('list')}</div><div class="li-main li-title">История тренировок</div><span class="li-val">${s.sessions.length}</span>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="train/rules"><div class="li-ic" style="background:var(--orange)">${icon('chart')}</div><div class="li-main li-title">Правила бега, разминка и прогрессия</div>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="profile/load"><div class="li-ic" style="background:var(--tint)">${icon('bolt')}</div><div class="li-main li-title">Общая нагрузка</div>${icon('chev', 'chev')}</button>
    </div>
  </div>`;
  return { title: 'Тренировки', html };
}

const listCard = (block, open = false) => `<details class="card" ${open ? 'open' : ''}><summary style="font-weight:600;cursor:pointer">${esc(block.title)}</summary><ul class="ul" style="margin-top:8px">${block.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${block.video ? `<a href="${esc(block.video.url)}" target="_blank" rel="noopener noreferrer" class="btn tiny gray" style="margin-top:8px">${icon('video')} ${esc(block.video.title)}</a>` : ''}</details>`;

function CardioView(id, info) {
  const pi = programInfo();
  const wp = weekProgress();
  const done = (wp.plan.find(p => p.k === id) || {}).done;
  const isMob = info.kind === 'mobility';
  const html = `
  <div class="page">
    <div class="card">
      <div class="row"><div class="wk-letter" style="background:${info.color}">${{ run: '🏃', bike: '🚴', mobility: '🧘' }[info.kind]}</div>
      <div class="grow"><div class="muted small">Неделя ${Math.max(1, Math.min(pi.week, TOTAL_WEEKS))} · ${esc(pi.phase.name)}</div><div style="font-weight:600">${esc(info.minText || info.duration)} мин${info.quality ? ' · интенсивная' : ''}</div></div>
      ${done ? `<span class="check on">${icon('check')}</span>` : ''}</div>
      <p class="prose" style="margin-top:10px;font-size:15px">${esc(info.goal)}</p>
    </div>
    ${info.kind === 'run' ? listCard(HIM_WARMUP_RUN, info.quality) : ''}
    ${isMob ? listCard(MOBILITY_SESSION, true) : ''}
    ${info.kind === 'run' ? listCard(HIM_COOLDOWN_RUN) : ''}
    ${info.kind === 'run' ? `<div class="sugg info">Стоп-сигналы: боль в стопе или колене — заканчиваем и следующий бег меняем на вело. Пульс покоя утром выше нормы на 7+ или плохой сон — интенсивную переносим.</div>` : ''}
    <button class="btn" id="log-cardio">${icon('check')} ${done ? 'Записать ещё раз' : 'Записать выполнение'}</button>
  </div>`;
  return {
    title: info.name, eyebrow: isMob ? 'Восстановление' : info.kind === 'bike' ? 'Вело' : 'Бег', back: 'train', backLabel: 'Тренировки', html,
    mount: root => root.querySelector('#log-cardio').addEventListener('click', () => cardioSheet(id, info))
  };
}

function cardioSheet(id, info) {
  const st = { rpe: info.quality ? 7 : info.kind === 'mobility' ? 2 : 4 };
  const dist = info.kind !== 'mobility';
  openSheet({
    title: info.name, right: 'Сохранить',
    body: `
      <div class="list">
        <div class="li"><div class="li-main li-title">Дата</div><input class="li-input" type="date" id="c-date" value="${today()}" max="${today()}"></div>
        <div class="li"><div class="li-main li-title">Длительность</div><input class="li-input" id="c-min" inputmode="numeric" placeholder="мин" value="${info.duration || ''}"></div>
        ${dist ? `<div class="li"><div class="li-main li-title">Дистанция</div><input class="li-input" id="c-km" inputmode="decimal" placeholder="км"></div>
        <div class="li"><div class="li-main li-title">Средний пульс</div><input class="li-input" id="c-hr" inputmode="numeric" placeholder="уд/мин"></div>` : ''}
      </div>
      <div><div class="section-cap">Насколько тяжело (RPE 1–10)</div>
        <div class="rpe-scale" id="c-rpe">${Array.from({ length: 10 }, (_, i) => `<button class="${i + 1 === st.rpe ? 'on' : ''}" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
        <div class="section-foot">Лёгкий бег — 3–4, темповая — 6–7, интервалы — 7–8. Если лёгкий бег ощущается на 6+, это сигнал усталости.</div></div>
      <div class="toggle-row card"><span>Боль или дискомфорт</span><label class="switch"><input type="checkbox" id="c-pain"><i></i></label></div>
      <label class="field"><span>Заметка</span><textarea class="input" id="c-note" placeholder="Самочувствие, погода, дорожка/улица"></textarea></label>`,
    onMount: w => w.querySelector('#c-rpe').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; st.rpe = +b.dataset.v; w.querySelectorAll('#c-rpe button').forEach(x => x.classList.toggle('on', x === b)); }),
    onRight: w => {
      const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
      const min = num(w.querySelector('#c-min').value);
      if (!min) { toast('Укажи длительность'); return false; }
      const date = w.querySelector('#c-date').value || today();
      const km = dist ? num(w.querySelector('#c-km').value) : null;
      const hr = dist ? num(w.querySelector('#c-hr').value) : null;
      const id2 = store.uid();
      store.update(s => {
        s.sessions.push({ id: id2, workout: id, kind: info.kind, date, week: programWeek(date), startedAt: Date.now(), endedAt: Date.now(), durationMin: min, rpe: st.rpe, pain: w.querySelector('#c-pain').checked, note: w.querySelector('#c-note').value.trim(), run: { km, hr }, exercises: [] });
        s.sessions.sort((a, b) => a.date.localeCompare(b.date) || a.endedAt - b.endedAt);
      }, { silent: true });
      setTimeout(() => go(`train/report/${id2}`, { replace: true }), 250);
    }
  });
}

function CardioReport(sess) {
  const info = sessionInfo(sess.workout, sess.week || 1);
  const km = sess.run && sess.run.km;
  const pace = km ? sess.durationMin / km : null;
  const paceTxt = pace ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')}` : '—';
  const prev = [...store.get().sessions].filter(x => x.workout === sess.workout && x.id !== sess.id && x.date <= sess.date).pop();
  const html = `
  <div class="page" style="padding-top:8px">
    <div class="card" style="text-align:center"><div style="font-size:44px">${{ run: '🏃', bike: '🚴', mobility: '🧘' }[sess.kind] || '✅'}</div>
      <div style="font-weight:700;font-size:20px;margin-top:4px">${esc(info.name)} — выполнено</div>
      <div class="muted small">${fmtDate(sess.date, { weekday: true })} · неделя ${sess.week}</div></div>
    <div class="kv">
      <div><div class="k">Время</div><div class="v">${sess.durationMin} мин</div></div>
      ${sess.kind !== 'mobility' ? `<div><div class="k">Дистанция</div><div class="v">${km ? fmt(km, 2) + ' км' : '—'}</div></div>
      <div><div class="k">Темп</div><div class="v">${paceTxt}${pace ? '/км' : ''}</div></div>
      <div><div class="k">Пульс</div><div class="v">${sess.run && sess.run.hr ? sess.run.hr : '—'}</div></div>` : ''}
      <div><div class="k">RPE</div><div class="v">${sess.rpe}</div></div>
      <div><div class="k">Нагрузка</div><div class="v">${Math.round(sess.durationMin * sess.rpe)}</div></div>
    </div>
    ${sess.pain ? '<div class="sugg warn">Отмечена боль. Следующий бег замени велосипедом, пока боль не пройдёт полностью. Если боль держится дольше нескольких дней — к врачу.</div>' : ''}
    ${sess.kind === 'run' && !info.quality && sess.rpe >= 6 ? '<div class="sugg warn">Лёгкий бег ощущался тяжело (RPE 6+) — возможна усталость. Проверь сон и пульс покоя; следующую интенсивную можно облегчить.</div>' : ''}
    ${prev && prev.run && prev.run.km && km ? `<div class="sugg info">Прошлый раз (${fmtDate(prev.date)}): ${fmt(prev.run.km, 2)} км за ${prev.durationMin} мин${prev.run.hr ? `, пульс ${prev.run.hr}` : ''}.</div>` : ''}
    ${sess.note ? `<div class="card"><div class="muted small">Заметка</div><div>${esc(sess.note)}</div></div>` : ''}
    <button class="btn gray" data-del="1" style="color:var(--red)">Удалить запись</button>
  </div>`;
  return {
    title: 'Отчёт', back: 'train', backLabel: 'Тренировки', large: false, html,
    mount: root => root.addEventListener('click', async e => {
      if (e.target.closest('[data-del]') && await confirmDialog('Удалить запись?', 'Запись будет удалена без возможности восстановления.', 'Удалить', true)) {
        store.update(s => { s.sessions = s.sessions.filter(x => x.id !== sess.id); }, { silent: true });
        go('train', { replace: true });
      }
    })
  };
}

/* ---------- Живая тренировка ---------- */
let restTimer = null;
let sessIv = null;
function SessionView() {
  const s = store.get();
  const a = s.active;
  if (!a) return { title: 'Тренировка', back: 'train', large: false, html: `<div class="page"><div class="empty-state"><div class="em">🏋️‍♀️</div><b>Нет активной тренировки</b>Начни тренировку из раздела «Тренировки».</div></div>` };
  const w = WORKOUTS[a.workout];
  const html = `
  <div class="page" style="padding-top:8px">
    <div class="card" style="display:flex;align-items:center;gap:12px">
      <div class="wk-letter" style="background:${w.color};width:44px;height:44px;font-size:20px">${a.workout}</div>
      <div class="grow"><div style="font-weight:600">${esc(w.name)}</div><div class="muted small num" id="elapsed">0:00</div></div>
      <div style="text-align:right"><div class="mid-num" id="sets-done">0</div><div class="xs muted">подходов</div></div>
    </div>
    ${a.exercises.map((e, ei) => exLive(e, ei)).join('')}
    <button class="btn green" id="finish">${icon('check')} Тренировка выполнена</button>
    <button class="btn gray" id="cancel" style="color:var(--red)">Отменить тренировку</button>
    <div style="height:70px"></div>
  </div>`;
  return {
    title: `Тренировка ${a.workout}`, back: 'train', backLabel: 'Свернуть', large: false, html,
    mount: root => {
      const el = root.querySelector('#elapsed');
      const tick = () => { const sec = Math.floor((Date.now() - a.startedAt) / 1000); el.textContent = `${Math.floor(sec / 3600) ? Math.floor(sec / 3600) + ':' : ''}${String(Math.floor(sec / 60) % 60).padStart(Math.floor(sec / 3600) ? 2 : 1, '0')}:${String(sec % 60).padStart(2, '0')}`; };
      tick();
      clearInterval(sessIv); sessIv = setInterval(tick, 1000);
      const countDone = () => { root.querySelector('#sets-done').textContent = store.get().active.exercises.reduce((n, e) => n + e.sets.filter(x => x.done).length, 0); };
      countDone();
      markCurrent(root);

      root.addEventListener('input', ev => {
        const inp = ev.target;
        const ei = inp.dataset.ei, si = inp.dataset.si;
        if (ei === undefined) return;
        const field = inp.dataset.f;
        store.update(st => {
          const ex = st.active.exercises[+ei];
          const val = inp.value.replace(',', '.');
          if (field === 'note') { ex.note = inp.value; return; }
          const old = ex.sets[+si][field];
          ex.sets[+si][field] = val;
          // смена веса переносится на следующие невыполненные подходы
          if (field === 'w') ex.sets.forEach((x, j) => { if (j > +si && !x.done && String(x.w) === String(old)) { x.w = val; const o = root.querySelector(`[data-ei="${ei}"][data-si="${j}"][data-f="w"]`); if (o) o.value = val; } });
        }, { silent: true });
      });

      root.addEventListener('click', async ev => {
        const done = ev.target.closest('[data-done]');
        if (done) {
          const [ei, si] = done.dataset.done.split(':').map(Number);
          let nowDone = false, rest = 60;
          store.update(st => {
            const ex = st.active.exercises[ei];
            const set = ex.sets[si];
            if (!set.done && (set.r === '' || set.r === null)) set.r = String(ex.planned.reps[1]);
            set.done = !set.done; nowDone = set.done; rest = ex.planned.rest;
            const row = done.closest('.set-row');
            row.classList.toggle('done', set.done);
            const ri = row.querySelector('[data-f="r"]'); if (ri) ri.value = set.r;
          }, { silent: true });
          countDone();
          markCurrent(root);
          if (nowDone) startRest(rest);
          return;
        }
        const add = ev.target.closest('[data-addset]');
        if (add) {
          const ei = +add.dataset.addset;
          store.update(st => { const ex = st.active.exercises[ei]; const last = ex.sets[ex.sets.length - 1]; ex.sets.push({ w: last ? last.w : ex.planned.weight, r: '', prev: '', done: false }); });
          return;
        }
        const rm = ev.target.closest('[data-rmset]');
        if (rm) {
          const ei = +rm.dataset.rmset;
          store.update(st => { const ex = st.active.exercises[ei]; if (ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done) ex.sets.pop(); });
          return;
        }
        const eff = ev.target.closest('[data-effort]');
        if (eff) {
          const [ei, v] = eff.dataset.effort.split(':');
          store.update(st => { const ex = st.active.exercises[+ei]; ex.effort = ex.effort === v ? '' : v; }, { silent: true });
          eff.parentElement.querySelectorAll('[data-effort]').forEach(c => c.classList.toggle('on', c === eff && store.get().active.exercises[+ei].effort === v));
          return;
        }
        if (ev.target.closest('#finish')) { finishSheet(); return; }
        if (ev.target.closest('#cancel')) {
          if (await confirmDialog('Отменить тренировку?', 'Записанные подходы этой тренировки будут удалены.', 'Отменить', true)) {
            stopRest();
            store.update(st => { st.active = null; }, { silent: true });
            go('train', { replace: true });
          }
        }
      });
      root.addEventListener('change', ev => {
        const p = ev.target.closest('[data-pain]');
        if (p) store.update(st => { st.active.exercises[+p.dataset.pain].pain = p.checked; }, { silent: true });
      });
    },
    unmount: () => clearInterval(sessIv)
  };
}

function exLive(e, ei) {
  const ex = EXERCISES[e.ex];
  const it = { ...e.planned, ex: e.ex, key: e.key };
  const p = progression(it);
  const unitLbl = ex.unit === 'kg' ? (ex.perHand ? 'кг/рука' : 'кг') : ex.unit === 'sec' ? '—' : '—';
  const repLbl = ex.unit === 'sec' ? 'сек' : 'повт.';
  return `<div class="card ex-live" id="ex-${ei}">
    <div class="row" style="align-items:flex-start">
      <a class="ex-thumb" data-go="train/ex/${e.ex}" style="width:48px;height:48px">${poseSVG(ex.pose, 'end')}</a>
      <div class="grow"><div style="font-weight:600;font-size:17px">${esc(ex.name)}</div>
      <div class="plan-line">План: ${e.planned.sets} × ${e.planned.reps[0] === e.planned.reps[1] ? e.planned.reps[0] : e.planned.reps.join('–')} ${repLbl}${ex.unit === 'kg' ? ` · ${fmt(e.planned.weight, 1)} кг` : ''} · отдых ${e.planned.rest} с</div></div>
    </div>
    ${p.type !== 'start' ? `<div class="sugg ${p.type === 'pain' || p.type === 'down' ? 'warn' : p.type === 'up' || p.type === 'up-reps' ? '' : 'info'}">${esc(p.text)}</div>` : ''}
    <div style="margin-top:10px">
      <div class="set-row head"><span style="text-align:center">#</span><span style="text-align:center">${ex.unit === 'kg' ? unitLbl : ''}</span><span style="text-align:center">${repLbl}</span><span></span></div>
      ${e.sets.map((st, si) => `<div class="set-row ${st.done ? 'done' : ''}">
        <span class="n">${si + 1}</span>
        ${ex.unit === 'kg' ? `<input class="num-in" inputmode="decimal" data-ei="${ei}" data-si="${si}" data-f="w" value="${st.w}" placeholder="${e.planned.weight}" aria-label="вес">` : `<span class="muted small" style="text-align:center">${ex.unit === 'sec' ? 'удержание' : 'свой вес'}</span>`}
        <input class="num-in" inputmode="numeric" data-ei="${ei}" data-si="${si}" data-f="r" value="${st.r}" placeholder="${e.planned.reps[1]}" aria-label="повторы">
        <button class="set-done" data-done="${ei}:${si}" aria-label="Подход выполнен">${icon('check')}</button>
      </div>${st.prev ? `<div class="xs muted" style="margin:-4px 0 2px 38px">прошлый раз: ${esc(st.prev)}</div>` : ''}`).join('')}
      <div class="row" style="gap:8px;margin-top:6px"><button class="btn tiny gray" data-addset="${ei}">+ подход</button><button class="btn tiny gray" data-rmset="${ei}">− подход</button></div>
    </div>
    <div class="divider"></div>
    <div class="section-cap" style="padding:0 0 6px">Как далось</div>
    <div class="chips">${[['easy', '🙂 Легко'], ['ok', '💪 Нормально'], ['hard', '🥵 Тяжело']].map(([k, l]) => `<button class="chip ${e.effort === k ? 'on' : ''}" data-effort="${ei}:${k}">${l}</button>`).join('')}</div>
    <div class="toggle-row" style="margin-top:12px"><span>Боль или дискомфорт</span><label class="switch"><input type="checkbox" data-pain="${ei}" ${e.pain ? 'checked' : ''}><i></i></label></div>
    <input class="input" style="margin-top:10px;background:var(--card-2)" data-ei="${ei}" data-si="0" data-f="note" placeholder="Комментарий (необязательно)" value="${esc(e.note)}">
  </div>`;
}

function markCurrent(root) {
  const a = store.get().active; if (!a) return;
  const idx = a.exercises.findIndex(e => e.sets.some(x => !x.done));
  root.querySelectorAll('.ex-live').forEach((c, i) => c.classList.toggle('current', i === idx));
}

function startRest(sec) {
  stopRest();
  const el = document.createElement('div');
  el.className = 'rest-timer';
  el.id = 'rest-timer';
  const end = Date.now() + sec * 1000;
  let endAt = end;
  el.innerHTML = `<div class="grow"><div class="xs muted" style="font-weight:600;text-transform:uppercase">Отдых</div><div class="t" id="rt">${sec}</div></div>
    <button class="btn tiny gray" data-rt="-15">−15</button><button class="btn tiny gray" data-rt="15">+15</button><button class="btn tiny" data-rt="x">Готово</button>`;
  document.body.appendChild(el);
  const upd = () => {
    const left = Math.round((endAt - Date.now()) / 1000);
    const t = el.querySelector('#rt');
    if (!t) return;
    if (left >= 0) { t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; t.classList.remove('over'); }
    else { t.textContent = `+${Math.floor(-left / 60)}:${String(-left % 60).padStart(2, '0')}`; t.classList.add('over'); }
    if (left === 0 && navigator.vibrate) navigator.vibrate(200);
  };
  upd();
  restTimer = setInterval(upd, 500);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-rt]'); if (!b) return;
    if (b.dataset.rt === 'x') stopRest(); else { endAt += +b.dataset.rt * 1000; upd(); }
  });
}
function stopRest() { clearInterval(restTimer); const el = document.getElementById('rest-timer'); if (el) el.remove(); }
window.addEventListener('hashchange', () => { if (!location.hash.includes('train/session')) stopRest(); });

function finishSheet() {
  const a = store.get().active;
  const doneSets = a.exercises.reduce((n, e) => n + e.sets.filter(x => x.done).length, 0);
  const st = { rpe: 6, feel: 4 };
  openSheet({
    title: 'Завершить тренировку', right: 'Сохранить',
    body: `
      <div class="card" style="text-align:center"><div class="big-num">${doneSets}</div><div class="muted small">${plural(doneSets, 'подход выполнен', 'подхода выполнено', 'подходов выполнено')}</div></div>
      ${doneSets === 0 ? '<div class="sugg warn">Ни один подход не отмечен. Отметь выполненные подходы галочкой или отмени тренировку.</div>' : ''}
      <div><div class="section-cap">Насколько тяжело в целом (RPE 1–10)</div>
        <div class="rpe-scale" id="f-rpe">${Array.from({ length: 10 }, (_, i) => `<button class="${i + 1 === st.rpe ? 'on' : ''}" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
        <div class="section-foot">Ориентир для тебя — 5–7: тяжело, но с запасом. Используется для расчёта нагрузки.</div></div>
      <div><div class="section-cap">Самочувствие после</div>${scale5('feel', st.feel)}</div>
      <label class="field"><span>Заметка</span><textarea class="input" id="f-note" placeholder="Что получилось, что было сложно"></textarea></label>`,
    onMount: w => {
      w.querySelector('#f-rpe').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; st.rpe = +b.dataset.v; w.querySelectorAll('#f-rpe button').forEach(x => x.classList.toggle('on', x === b)); });
      bindScales(w, (k, v) => { st[k] = v; });
    },
    onRight: w => {
      if (doneSets === 0) { toast('Нет выполненных подходов'); return false; }
      const now = Date.now();
      let id;
      store.update(s => {
        const sess = { ...s.active, endedAt: now, durationMin: Math.max(1, Math.round((now - s.active.startedAt) / 60000)), rpe: st.rpe, feel: st.feel, note: w.querySelector('#f-note').value.trim() };
        sess.exercises = sess.exercises.map(e => ({ ...e, sets: e.sets.map(x => ({ w: x.w === '' ? 0 : +x.w, r: x.r === '' ? 0 : +x.r, done: x.done })) }));
        id = sess.id;
        s.sessions.push(sess);
        s.active = null;
      }, { silent: true });
      stopRest();
      setTimeout(() => go(`train/report/${id}`, { replace: true }), 250);
    }
  });
}

/* ---------- Отчёт о тренировке ---------- */
function ReportView(id) {
  const s = store.get();
  const sess = s.sessions.find(x => x.id === id);
  if (!sess) return { title: 'Отчёт', back: 'train', large: false, html: '<div class="page"><div class="empty-state"><b>Тренировка не найдена</b></div></div>' };
  if (sess.kind && sess.kind !== 'strength') return CardioReport(sess);
  const st = sessionStats(sess);
  const prevSess = [...s.sessions].filter(x => x.workout === sess.workout && x.date <= sess.date && x.id !== sess.id && (x.endedAt || 0) < (sess.endedAt || Infinity)).pop();
  const pst = prevSess ? sessionStats(prevSess) : null;
  const dv = pst ? st.volume - pst.volume : null;
  const isLatest = [...s.sessions].reverse().find(x => x.workout === sess.workout && (x.kind || "strength") === "strength").id === sess.id;
  const rows = sess.exercises.filter(e => e.sets.some(x => x.done)).map(e => {
    const ex = EXERCISES[e.ex];
    const done = e.sets.filter(x => x.done);
    const prevE = prevSess ? prevSess.exercises.find(x => x.key === e.key) : null;
    const prevDone = prevE ? prevE.sets.filter(x => x.done) : [];
    const top = Math.max(...done.map(x => x.w)), ptop = prevDone.length ? Math.max(...prevDone.map(x => x.w)) : null;
    const reps = done.reduce((a, x) => a + x.r, 0), preps = prevDone.reduce((a, x) => a + x.r, 0);
    let delta = '';
    if (ptop !== null) {
      if (ex.unit === 'kg' && top !== ptop) delta = `<span class="${top > ptop ? 'ok' : 'warn'}">${top > ptop ? '▲' : '▼'} ${fmt(Math.abs(top - ptop), 1)} кг</span>`;
      else if (reps !== preps) delta = `<span class="${reps > preps ? 'ok' : 'warn'}">${reps > preps ? '▲' : '▼'} ${Math.abs(reps - preps)} ${ex.unit === 'sec' ? 'сек' : 'повт.'}</span>`;
      else delta = '<span class="muted">без изменений</span>';
    }
    const it = { ...e.planned, ex: e.ex, key: e.key, weight: s.workWeights[e.key] ?? e.planned.weight };
    const p = isLatest ? progression(it) : null;
    return `<div class="card">
      <div class="row between"><b style="font-size:16px">${esc(ex.short)}</b><span class="small">${delta}</span></div>
      <div class="muted small" style="margin-top:4px">${done.map(x => ex.unit === 'kg' ? `${fmt(x.w, 1)}×${x.r}` : `${x.r}${ex.unit === 'sec' ? 'с' : ''}`).join(' · ')}${e.effort ? ` · ${{ easy: 'легко', ok: 'нормально', hard: 'тяжело' }[e.effort]}` : ''}${e.pain ? ' · <span class="bad">боль</span>' : ''}</div>
      ${e.note ? `<div class="small" style="margin-top:4px">«${esc(e.note)}»</div>` : ''}
      ${p && (p.type === 'up' || p.type === 'down') ? `<div class="sugg ${p.type === 'down' ? 'warn' : ''}">${esc(p.text)}<div class="row" style="gap:8px;margin-top:8px"><button class="btn tiny ${p.type === 'down' ? 'gray' : 'green'}" data-accept="${e.key}:${p.newWeight}">Принять ${fmt(p.newWeight, 1)} кг</button><button class="btn tiny gray" data-keep="1">Оставить</button></div></div>` : p && p.type !== 'start' ? `<div class="sugg info">${esc(p.text)}</div>` : ''}
    </div>`;
  }).join('');
  const html = `
  <div class="page" style="padding-top:8px">
    <div class="card" style="text-align:center">
      <div style="font-size:44px">🎉</div>
      <div style="font-weight:700;font-size:20px;margin-top:4px">Тренировка ${sess.workout} выполнена</div>
      <div class="muted small">${fmtDate(sess.date, { weekday: true })} · неделя ${sess.week}</div>
    </div>
    <div class="kv">
      <div><div class="k">Время</div><div class="v">${sess.durationMin} мин</div></div>
      <div><div class="k">Упражнений</div><div class="v">${st.exDone}/${st.exTotal}</div></div>
      <div><div class="k">Подходов</div><div class="v">${st.sets}</div></div>
      <div><div class="k">Объём</div><div class="v">${fmt(st.volume)} кг</div></div>
      <div><div class="k">RPE</div><div class="v">${sess.rpe ?? '—'}</div></div>
      <div><div class="k">К прошлой ${sess.workout}</div><div class="v ${dv > 0 ? 'ok' : dv < 0 ? 'warn' : ''}">${dv === null ? 'первая' : (dv > 0 ? '+' : '') + fmt(dv) + ' кг'}</div></div>
    </div>
    <div class="note">Объём = сумма (вес × повторы) по всем подходам. Для гантелей указан вес одной гантели.</div>
    <div class="section-cap">Упражнения и сравнение</div>
    ${rows}
    ${sess.note ? `<div class="card"><div class="muted small">Заметка</div><div>${esc(sess.note)}</div></div>` : ''}
    <div class="note">Новый рабочий вес применяется только после твоего подтверждения. Повышаем, когда все подходы выполнены на верхней границе с запасом и без боли.</div>
    <button class="btn gray" data-del="1" style="color:var(--red)">Удалить тренировку</button>
  </div>`;
  return {
    title: 'Отчёт о тренировке', back: 'train', backLabel: 'Тренировки', large: false, html,
    mount: root => root.addEventListener('click', async e => {
      const a = e.target.closest('[data-accept]');
      if (a) {
        const [key, w] = a.dataset.accept.split(':');
        store.update(st2 => { st2.workWeights[key] = +w; st2.acceptedSuggestions.push({ date: today(), key, weight: +w }); });
        toast(`Новый рабочий вес: ${fmt(+w, 1)} кг`);
        return;
      }
      if (e.target.closest('[data-keep]')) { e.target.closest('.sugg').remove(); toast('Вес оставлен прежним'); return; }
      if (e.target.closest('[data-del]')) {
        if (await confirmDialog('Удалить тренировку?', 'Запись о тренировке и все подходы будут удалены без возможности восстановления.', 'Удалить', true)) {
          store.update(st2 => { st2.sessions = st2.sessions.filter(x => x.id !== id); }, { silent: true });
          go('train/history', { replace: true });
        }
      }
    })
  };
}

/* ---------- Упражнение ---------- */
function ExerciseView(id) {
  const ex = EXERCISES[id];
  if (!ex) return { title: 'Упражнение', back: 'train/library', html: '' };
  const s = store.get();
  const keys = [id, id + ':heavy'];
  const hist = keys.flatMap(k => historyFor(k).map(h => ({ ...h, key: k }))).sort((a, b) => a.date.localeCompare(b.date));
  const wk = keys.filter(k => s.workWeights[k] !== undefined);
  const series = ex.unit === 'kg' ? keys.map((k, i) => ({ points: historyFor(k).map(h => ({ x: h.date, y: h.top })), color: i ? 'var(--purple)' : 'var(--tint)' })).filter(x => x.points.length) : [{ points: hist.map(h => ({ x: h.date, y: h.reps.reduce((a, b) => a + b, 0) })), color: 'var(--tint)' }];
  const html = `
  <div class="page">
    <div class="ex-illus">
      <figure>${poseSVG(ex.pose, 'start')}<figcaption>Исходное</figcaption></figure>
      <figure>${poseSVG(ex.pose, 'end')}<figcaption>${ex.unit === 'sec' ? 'Удержание' : 'Конечное'}</figcaption></figure>
    </div>
    <div class="note">Схема положения тела; цветом выделены работающие мышцы. Точную технику смотри в видео и пошаговой инструкции.</div>

    <div class="card">
      <div class="chips"><span class="chip on">${esc(ex.group)}</span></div>
      <div style="margin-top:10px"><div class="muted small">Основные мышцы</div><div style="font-weight:600">${ex.primary.map(esc).join(', ')}</div></div>
      <div style="margin-top:8px"><div class="muted small">Вспомогательные</div><div>${ex.secondary.map(esc).join(', ')}</div></div>
      <div style="margin-top:8px"><div class="muted small">Оборудование</div><div>${esc(ex.equipment)}</div></div>
    </div>

    ${ex.video ? `<a class="card tap row" href="${esc(ex.video.url)}" target="_blank" rel="noopener noreferrer" style="color:inherit">
      <div class="li-ic" style="background:var(--red);width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#fff">${icon('video')}</div>
      <div class="grow"><div style="font-weight:600">Видео техники</div><div class="muted small">${esc(ex.video.title)}${ex.video.author ? ' · ' + esc(ex.video.author) : ''}${ex.video.lang ? ' · ' + esc(ex.video.lang) : ''}</div></div>${icon('chev', 'chev')}</a>`
      : `<div class="card row"><div class="li-ic" style="background:var(--fill);width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:var(--label-2)">${icon('video')}</div><div class="grow"><div style="font-weight:600">Видео пока не подобрано</div><div class="muted small">Проверенной ссылки на это упражнение нет — опирайся на инструкцию ниже.</div></div></div>`}

    <div><div class="section-cap">Как выполнять</div><div class="card"><ol class="ol">${ex.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div></div>
    <div><div class="section-cap">Частые ошибки</div><div class="card"><ul class="ul bad">${ex.mistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <div class="card"><div class="card-h"><span class="ic" style="background:var(--cyan)">💨</span>Дыхание</div><p class="prose">${esc(ex.breathing)}</p>
      ${ex.safety ? `<div class="sugg warn" style="margin-top:10px">${icon('warning').replace('<svg ', '<svg style="width:16px;height:16px;display:inline;vertical-align:-3px;margin-right:4px" ')}${esc(ex.safety)}</div>` : ''}</div>

    <div>
      <div class="section-h"><h2>Мой прогресс</h2></div>
      <div class="card">
        ${wk.length ? `<div class="row" style="gap:16px;margin-bottom:10px">${wk.map(k => `<div><div class="muted small">Рабочий вес${k.endsWith(':heavy') ? ' (тяжёлый день)' : ''}</div><div class="mid-num">${fmt(s.workWeights[k], 1)} кг</div></div>`).join('')}</div>` : ''}
        ${lineChart(series, { height: 150, yFmt: v => fmt(v, ex.unit === 'kg' ? 1 : 0) })}
        <div class="section-foot" style="padding:6px 0 0">${ex.unit === 'kg' ? 'Максимальный рабочий вес на тренировке' + (series.length > 1 ? ' (фиолетовый — тяжёлый день C)' : '') : 'Сумма повторов/секунд за тренировку'}</div>
      </div>
      ${hist.length ? `<div class="list" style="margin-top:12px">${[...hist].reverse().slice(0, 12).map(h => `<div class="li"><div class="li-main"><div class="li-title" style="font-size:15px">${fmtDate(h.date)}</div><div class="li-sub">${h.sets.map(x => ex.unit === 'kg' ? `${fmt(x.w, 1)}×${x.r}` : `${x.r}`).join(' · ')}${h.effort ? ' · ' + { easy: 'легко', ok: 'нормально', hard: 'тяжело' }[h.effort] : ''}${h.pain ? ' · боль' : ''}</div></div></div>`).join('')}</div>` : ''}
      <button class="btn gray small" id="setw" style="margin-top:12px">${icon('edit')} Изменить рабочий вес вручную</button>
    </div>
  </div>`;
  return {
    title: ex.short, eyebrow: ex.group, back: 'train', backLabel: 'Назад', html,
    mount: root => {
      root.querySelector('#setw').addEventListener('click', () => {
        const items = ['A', 'B', 'C'].flatMap(w => planItems(w)).filter(it => it.ex === id);
        const uniq = [...new Map(items.map(it => [it.key, it])).values()];
        if (!uniq.length) { toast('Упражнение сейчас не входит в программу'); return; }
        openSheet({
          title: 'Рабочий вес', right: 'Сохранить',
          body: `<div class="list">${uniq.map(it => `<div class="li"><div class="li-main"><div class="li-title">${it.key.endsWith(':heavy') ? 'Тяжёлый день (C)' : 'Обычный'}</div><div class="li-sub">сейчас ${fmt(it.weight, 1)} кг</div></div><input class="li-input" data-k="${it.key}" inputmode="decimal" value="${it.weight}"></div>`).join('')}</div>
          <div class="note">Меняй вручную, если стартовый вес не подошёл. Обычно вес меняется через предложения после тренировки.</div>`,
          onRight: w => {
            store.update(st2 => { w.querySelectorAll('[data-k]').forEach(inp => { const v = parseFloat(inp.value.replace(',', '.')); if (!Number.isNaN(v)) st2.workWeights[inp.dataset.k] = v; }); });
            toast('Сохранено');
          }
        });
      });
    }
  };
}

function LibraryView() {
  const groups = {};
  for (const [id, ex] of Object.entries(EXERCISES)) (groups[ex.group] = groups[ex.group] || []).push([id, ex]);
  const html = `<div class="page">${Object.entries(groups).map(([g, list]) => `<div><div class="section-cap">${esc(g)}</div><div class="list">${list.map(([id, ex]) => `<button class="li tap" data-go="train/ex/${id}"><div class="ex-thumb" style="width:52px;height:52px">${poseSVG(ex.pose, 'end')}</div><div class="li-main"><div class="li-title" style="font-size:16px">${esc(ex.name)}</div><div class="li-sub">${ex.primary.map(esc).join(', ')}${ex.video ? ' · 🎬' : ''}</div></div>${icon('chev', 'chev')}</button>`).join('')}</div></div>`).join('')}</div>`;
  return { title: 'Упражнения', back: 'train', backLabel: 'Тренировки', html };
}

function HistoryView() {
  const s = store.get();
  const list = [...s.sessions].reverse();
  const html = `<div class="page">${list.length ? `<div class="list">${list.map(x => { const st = sessionStats(x); return `<button class="li tap" data-go="train/report/${x.id}"><div class="li-ic" style="background:${sessionInfo(x.workout, x.week || 1).color};font-weight:800">${(x.kind || "strength") === "strength" ? x.workout : ({ run: "🏃", bike: "🚴", mobility: "🧘" }[x.kind])}</div><div class="li-main"><div class="li-title" style="font-size:16px">${fmtDate(x.date, { weekday: true })}</div><div class="li-sub">${esc(sessionInfo(x.workout, x.week || 1).name)} · ${x.durationMin} мин${x.run && x.run.km ? " · " + fmt(x.run.km, 1) + " км" : st.sets ? " · " + st.sets + " подх." : ""} · RPE ${x.rpe ?? '—'}</div></div>${icon('chev', 'chev')}</button>`; }).join('')}</div>` : '<div class="empty-state"><div class="em">📒</div><b>Пока пусто</b>Здесь появятся выполненные тренировки.</div>'}</div>`;
  return { title: 'История', back: 'train', backLabel: 'Тренировки', html };
}

function RulesView() {
  const s = store.get();
  if (WHO === 'him') {
    const html = `<div class="page">
      <div><div class="section-cap">Бег: правила гибрида</div><div class="card"><ul class="ul good">${RUN_RULES.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
      ${listCard(HIM_WARMUP_RUN, true)}
      ${listCard(HIM_WARMUP_GYM)}
      ${listCard(HIM_COOLDOWN_RUN)}
      ${listCard(MOBILITY_SESSION)}
      <div><div class="section-cap">Двойная прогрессия в зале</div><div class="card"><ul class="ul">${PROGRESSION_RULES.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="section-foot">Прошлые результаты (110 кг жим, 80 × 7) — ориентир прошлого, не стартовый вес. Тест на 1ПМ после перерыва не делаем.</div></div>
      <div><div class="section-cap">Когда снижать нагрузку или отменять тренировку</div><div class="card"><ul class="ul bad">
        <li>Боль в стопе, колене, голеностопе — во время или утром после.</li>
        <li>Пульс покоя утром выше нормы на 7+ уд. (норма сейчас ≈ 66).</li>
        <li>Сон меньше 6 часов, болезнь, температура, алкоголь накануне.</li>
        <li>Лёгкий бег ощущается на 6+ из 10 два раза подряд.</li>
        <li>Изжога/дискомфорт в желудке — не тренироваться сразу после еды (ждать 1,5–2 ч), обратиться к гастроэнтерологу.</li>
      </ul></div></div>
      <div><div class="section-cap">Переход из «Возвращения» в основной цикл (после 4-й недели)</div><div class="card"><ul class="ul good">
        <li>Нет боли в течение 2 недель.</li><li>Длительная 45–50 мин даётся комфортно (RPE ≤ 4).</li><li>Все силовые выполнены с запасом 2+ повтора.</li>
      </ul><div class="xs muted" style="margin-top:6px">Если не выполнено — повторяем 4-ю неделю. Это быстрее, чем снова выпасть на месяцы.</div></div></div>
    </div>`;
    return { title: 'Правила', back: 'train', backLabel: 'Тренировки', html };
  }
  const html = `<div class="page">
    <div><div class="section-cap">Двойная прогрессия</div><div class="card"><ul class="ul good">${PROGRESSION_RULES.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="section-foot">Пример: 3 × 10–12. Выполнила 12/12/12 с запасом и без боли — следующий раз +2,5 кг и снова от 10 повторов.</div></div>
    <div><div class="section-cap">Безопасность</div><div class="card"><ul class="ul">
      <li>Запас 2–3 повтора в каждом подходе, без работы «до отказа» — пока нет допуска врача к интенсивным нагрузкам.</li>
      <li>Никакой задержки дыхания на усилии: выдох — на самой тяжёлой части движения.</li>
      <li>Шея: без штанги на плечах, без тяг за голову и шрагов. Голова — в продолжение позвоночника.</li>
      <li>Головокружение, боль в груди, перебои, необычная одышка — сразу прекратить тренировку и обратиться к врачу.</li>
      <li>После суток — без силовой. В дни менструации — можно мягче (на подход меньше) или прогулка.</li>
    </ul></div></div>
    <div><div class="section-cap">Кардио и бег</div><div class="card">
      <div class="toggle-row"><div><b>Допуск врача к бегу получен</b><div class="muted small">Открывает план интервалов бег/ходьба с 4-й недели</div></div>${sw('cleared', s.settings.cardioCleared)}</div>
      <div class="divider"></div>
      ${s.settings.cardioCleared ? `<ul class="ul">${RUN_PLAN.map(r => `<li><b>Неделя ${r.week}:</b> ${esc(r.text)}</li>`).join('')}</ul><div class="note" style="padding:8px 0 0">Темп — разговорный. 1–2 раза в неделю, в дни без силовой или после неё. Ограничение по пульсу — по рекомендации врача.</div>`
      : '<p class="muted small">Пока основа кардио — шаги (цель растёт с 6 до 8 тысяч) и 15–20 минут ходьбы на дорожке с наклоном после тренировок A и B.</p>'}
    </div></div>
  </div>`;
  return {
    title: 'Правила', back: 'train', backLabel: 'Тренировки', html,
    mount: root => root.querySelector('#cleared').addEventListener('change', e => store.update(st => { st.settings.cardioCleared = e.target.checked; }))
  };
}
