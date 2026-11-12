// Календарь в стиле iOS: месяц/неделя, цветные отметки, карточка выбранного дня.
import * as store from '../store.js';
import { icon, esc, bar, rings, toast } from '../ui.js';
import { today, parse, addDays, mondayOf, weekDates, WD_SHORT, MONTHS, fmtDate, sessionsOn, activitiesOn, foodAdherence, hasFood, dayFact, targetsFor,
  planForDate, planTotals, dayLoad, sessionStats, ACT_TYPES, fmt, dayLog, slotFact, programInfo, nextWorkoutId, sessionLoad, activityLoad, programWeek, scheduledOn } from '../logic.js';
import { WORKOUTS, sessionInfo } from '../data/program.js';
import { EXERCISES } from '../data/exercises.js';
import { RECIPES, SLOTS } from '../data/foods.js';
import { dailySheet, activitySheet, weighSheet, measureSheet } from './sheets.js';
import { go } from '../app.js';

export const calendarRoutes = [
  { re: /^calendar$/, view: Calendar },
  { re: /^calendar\/day\/(\d{4}-\d{2}-\d{2})$/, view: DayPage }
];

let mode = 'month';
let sel = null;
let cursor = null; // первый день отображаемого месяца / понедельник недели

function markers(date) {
  const s = store.get();
  const out = [];
  const t = today();
  const ss = sessionsOn(date);
  const aa = activitiesOn(date);
  if (ss.some(x => (x.kind || 'strength') === 'strength')) out.push({ c: 'var(--c-train)' });
  else if (date >= t && s.planned[date] && s.planned[date] !== 'rest') out.push({ c: 'var(--c-train)', ring: true });
  else if (date >= t && !s.planned[date] && !(s.daily[date] || {}).shift) {
    const sc = scheduledOn(date).filter(p => p.kind !== 'mobility' && !p.optional);
    if (sc.some(p => p.kind === 'strength')) out.push({ c: 'var(--c-train)', ring: true });
    if (sc.some(p => p.kind === 'run' || p.kind === 'bike')) out.push({ c: 'var(--c-cardio)', ring: true });
  }
  if (ss.some(x => x.kind === 'run' || x.kind === 'bike') || aa.some(a => ACT_TYPES[a.type]?.aerobic)) out.push({ c: 'var(--c-cardio)' });
  if (!ss.length && !aa.length && (s.planned[date] === 'rest' || (s.daily[date] || {}).shift)) out.push({ c: 'var(--c-rest)' });
  const fa = foodAdherence(date);
  if (fa.logged) out.push({ c: 'var(--c-kcal)', ring: !fa.ok });
  if ((s.daily[date] || {}).weight) out.push({ c: 'var(--c-weigh)' });
  if (s.measurements.some(m => m.date === date)) out.push({ c: 'var(--c-measure)' });
  return out.slice(0, 5);
}

function cell(date, { other = false } = {}) {
  const t = today();
  const d = parse(date).getDate();
  return `<button class="cal-cell ${other ? 'other' : ''} ${date === t ? 'today' : ''} ${date === sel ? 'sel' : ''}" data-d="${date}" aria-label="${fmtDate(date, { weekday: true })}">
    <span class="d">${d}</span><span class="cal-dots">${markers(date).map(m => `<i class="${m.ring ? 'ring' : ''}" style="background:${m.c};border-color:${m.c}"></i>`).join('')}</span></button>`;
}

function Calendar() {
  const t = today();
  if (!sel) sel = t;
  if (!cursor) cursor = mode === 'month' ? sel.slice(0, 8) + '01' : mondayOf(sel);
  let grid = '', title = '';
  if (mode === 'month') {
    const first = cursor.slice(0, 8) + '01';
    const fd = parse(first);
    title = `${MONTHS[fd.getMonth()]} ${fd.getFullYear()}`;
    const start = mondayOf(first);
    const lastDay = new Date(fd.getFullYear(), fd.getMonth() + 1, 0).getDate();
    const end = addDays(first, lastDay - 1);
    let d = start;
    while (d <= end || (parse(d).getDay() + 6) % 7 !== 0) {
      grid += cell(d, { other: d.slice(0, 7) !== first.slice(0, 7) });
      d = addDays(d, 1);
      if (d > addDays(end, 7)) break;
    }
  } else {
    const days = weekDates(cursor);
    const a = parse(days[0]), b = parse(days[6]);
    title = a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)}`;
    grid = days.map(x => cell(x)).join('');
  }
  const html = `
  <div class="page">
    <div class="seg" id="cal-mode"><button class="${mode === 'month' ? 'on' : ''}" data-m="month">Месяц</button><button class="${mode === 'week' ? 'on' : ''}" data-m="week">Неделя</button></div>
    <div class="card" style="padding:12px 8px 10px">
      <div class="cal-head"><h2>${esc(title)}</h2><div class="arrows"><button data-nav="-1" aria-label="Назад">${icon('chevL')}</button><button data-nav="1" aria-label="Вперёд">${icon('chevR')}</button></div></div>
      <div class="cal-wd">${WD_SHORT.map((w, i) => `<span class="${i > 4 ? 'we' : ''}">${w}</span>`).join('')}</div>
      <div class="cal-grid" id="cal-grid">${grid}</div>
      <div class="cal-legend">
        <span><i style="background:var(--c-train)"></i>Силовая</span><span><i style="background:var(--c-cardio)"></i>Кардио</span><span><i style="background:var(--c-rest)"></i>Отдых</span>
        <span><i style="background:var(--c-kcal)"></i>Питание в норме</span><span><i style="background:var(--c-weigh)"></i>Взвешивание</span><span><i style="background:var(--c-measure)"></i>Замеры</span>
      </div>
    </div>
    ${dayCard(sel, true)}
  </div>`;
  return {
    title: 'Календарь', html,
    right: sel !== t ? `<button class="nb-btn" data-today="1">Сегодня</button>` : '',
    mount: root => {
      const nav = document.getElementById('navbar');
      nav.addEventListener('click', e => { if (e.target.closest('[data-today]')) { sel = t; cursor = mode === 'month' ? t.slice(0, 8) + '01' : mondayOf(t); window.__rerender(); } });
      root.querySelector('#cal-mode').addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        mode = b.dataset.m; cursor = mode === 'month' ? sel.slice(0, 8) + '01' : mondayOf(sel); window.__rerender();
      });
      root.querySelector('.arrows').addEventListener('click', e => {
        const b = e.target.closest('[data-nav]'); if (!b) return;
        const n = +b.dataset.nav;
        if (mode === 'month') { const d = parse(cursor); d.setMonth(d.getMonth() + n); cursor = store.todayStr(d).slice(0, 8) + '01'; }
        else cursor = addDays(cursor, 7 * n);
        window.__rerender();
      });
      root.querySelector('#cal-grid').addEventListener('click', e => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        sel = b.dataset.d;
        if (mode === 'month' && sel.slice(0, 7) !== cursor.slice(0, 7)) cursor = sel.slice(0, 8) + '01';
        window.__rerender();
      });
      // свайп влево/вправо по календарю
      let x0 = null;
      const g = root.querySelector('#cal-grid');
      g.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      g.addEventListener('touchend', e => {
        if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 60) root.querySelector(`[data-nav="${dx < 0 ? 1 : -1}"]`).click();
      });
      bindDayCard(root, sel);
    }
  };
}

// Карточка дня: тренировки (план/факт), питание (план/факт), нагрузка
export function dayCard(date, compact = false) {
  const s = store.get();
  const t = today();
  const ss = sessionsOn(date);
  const aa = activitiesOn(date);
  const planned = s.planned[date];
  const fact = dayFact(date), tg = targetsFor(date), plan = planTotals(date);
  const load = dayLoad(date);
  const d = s.daily[date] || {};
  const future = date > t;
  const meas = s.measurements.find(m => m.date === date);
  const pw = planned && planned !== 'rest' ? planned : null;

  let train = '';
  if (ss.length) {
    train = ss.map(x => {
      const st = sessionStats(x);
      return `<button class="li tap" data-go="train/report/${x.id}"><div class="li-ic" style="background:${sessionInfo(x.workout, x.week || 1).color};font-weight:800">${x.workout}</div>
        <div class="li-main"><div class="li-title" style="font-size:16px">${esc(sessionInfo(x.workout, x.week || 1).name)}</div><div class="li-sub">${x.durationMin} мин · ${st.exDone}/${st.exTotal} упр. · ${st.sets} подх. · объём ${fmt(st.volume)} кг</div>
        <div class="li-sub">${x.exercises.filter(e => e.sets.some(z => z.done)).map(e => `${esc(EXERCISES[e.ex]?.short)}: ${e.sets.filter(z => z.done).map(z => `${fmt(z.w, 1)}×${z.r}`).join(', ')}`).join(' · ')}</div></div>${icon('chev', 'chev')}</button>`;
    }).join('');
  } else if (pw) {
    train = `<button class="li tap" data-go="train/w/${pw}"><div class="li-ic" style="background:${sessionInfo(pw, programWeek(date)).color};font-weight:800">${pw}</div><div class="li-main"><div class="li-title" style="font-size:16px">Запланирована: ${esc(sessionInfo(pw, programWeek(date)).name)}</div><div class="li-sub">${date < t ? 'Не выполнена' : `~${sessionInfo(pw, programWeek(date)).duration} мин · ${(sessionInfo(pw, programWeek(date)).items || []).length ? (sessionInfo(pw, programWeek(date)).items.length + " упражнений") : esc(sessionInfo(pw, programWeek(date)).minText || "") + " мин"}`}</div></div>${icon('chev', 'chev')}</button>`;
  } else if (!planned && !d.shift && date >= t && scheduledOn(date).length) {
    // по расписанию недели
    train = scheduledOn(date).map(p => `<button class="li tap" data-go="train/w/${p.k}"><div class="li-ic" style="background:${p.info.color};font-weight:800">${p.kind === 'strength' ? p.k : ({ run: '🏃', bike: '🚴', mobility: '🧘' }[p.kind])}</div><div class="li-main"><div class="li-title" style="font-size:16px">По расписанию: ${esc(p.info.name)}${p.optional ? ' (по желанию)' : ''}</div><div class="li-sub">${p.kind === 'strength' ? `~${p.info.duration} мин` : `${esc(p.info.minText || '')} мин`}</div></div>${icon('chev', 'chev')}</button>`).join('');
  } else {
    train = `<div class="li"><div class="li-ic" style="background:var(--c-rest)">🌿</div><div class="li-main"><div class="li-title" style="font-size:16px">${planned === 'rest' ? 'День отдыха' : d.shift ? 'Сутки на работе' : 'Без тренировки'}</div></div></div>`;
  }
  train += aa.map(a => `<button class="li tap" data-act-edit="${a.id}"><div class="li-ic" style="background:var(--c-cardio)">${ACT_TYPES[a.type]?.em || '✨'}</div><div class="li-main"><div class="li-title" style="font-size:16px">${ACT_TYPES[a.type]?.name}</div><div class="li-sub">${a.min} мин${a.km ? ` · ${fmt(a.km, 1)} км` : ''} · RPE ${a.rpe}</div></div>${icon('chev', 'chev')}</button>`).join('');

  const planBlock = future || date === t ? `
    <div class="section-cap" style="margin-top:14px">Запланировать</div>
    <div class="chips" id="plan-chips">${['A', 'B', 'C'].map(w => `<button class="chip ${planned === w ? 'on' : ''}" data-plan="${w}">Тренировка ${w}</button>`).join('')}
      <button class="chip ${planned === 'rest' ? 'on' : ''}" data-plan="rest">Отдых</button>${planned ? '<button class="chip" data-plan="">Снять</button>' : ''}</div>` : '';

  const pl = planForDate(date);
  const foodRows = SLOTS.map(sl => {
    const ids = pl[sl.id] || [];
    const f = slotFact(date, sl.id);
    const entries = ((dayLog(date).slots || {})[sl.id] || []);
    if (!ids.length && !entries.length) return '';
    return `<div class="entry"><div class="grow"><b>${sl.name}</b><span>План: ${ids.map(id => esc(RECIPES[id].name)).join(' + ') || '—'}</span><br><span>Факт: ${entries.length ? entries.map(e => esc(e.name)).join(', ') : 'не записано'}</span></div><div class="k">${entries.length ? fmt(f.kcal) : '—'}</div></div>`;
  }).join('');

  return `
  <div>
    <div class="section-h"><h2 style="text-transform:capitalize">${fmtDate(date, { weekday: true })}</h2>${compact ? `<a class="link" data-go="calendar/day/${date}">Подробно</a>` : ''}</div>
    <div class="stack">
      <div><div class="section-cap">Тренировки</div><div class="list">${train}</div>${planBlock}</div>

      <div class="card">
        <div class="card-h"><span class="ic" style="background:var(--c-kcal)">${icon('food')}</span>Питание<span class="right">план ${fmt(plan.kcal)} ккал</span></div>
        ${hasFood(date) ? `
        <div class="row between"><div class="big-num" style="color:var(--c-kcal)">${fmt(fact.kcal)}<small>/ ${fmt(tg.kcal)} ккал</small></div></div>
        <div class="grid3" style="margin-top:10px">
          ${[['Белки', fact.p, tg.p, 'var(--c-protein)'], ['Жиры', fact.f, tg.f, 'var(--c-fat)'], ['Углев.', fact.c, tg.c, 'var(--c-carb)']].map(([n, v, m, c]) => `<div class="macro"><div class="row"><span class="muted">${n}</span></div><b class="num">${fmt(v)}</b><span class="muted">/${m} г</span><div style="margin-top:4px">${bar(v, m, c, null, 'thin')}</div></div>`).join('')}
        </div>` : `<div class="muted small">${future ? 'План на день — ниже' : 'Питание за этот день не записано'}</div>`}
        ${compact ? '' : `<div class="divider"></div>${foodRows}`}
      </div>

      <div class="card">
        <div class="card-h"><span class="ic" style="background:var(--orange)">${icon('bolt')}</span>Нагрузка<span class="right">оценка приблизительная</span></div>
        <div class="row between"><div class="mid-num">${esc(load.label)}</div><div class="muted small">${load.total ? fmt(load.total) + ' усл. ед.' : ''}</div></div>
        <div class="kv" style="margin-top:10px">
          <div><div class="k">Силовая</div><div class="v">${fmt(load.strength)}</div></div>
          <div><div class="k">Кардио</div><div class="v">${fmt(load.cardio)}</div></div>
          <div><div class="k">Шаги</div><div class="v">${d.steps ? fmt(d.steps) : '—'}</div></div>
          <div><div class="k">Сон</div><div class="v">${d.sleep ? fmt(d.sleep, 1) + ' ч' : '—'}</div></div>
        </div>
        ${d.shift ? '<div class="sugg info">Сутки на работе — значительная бытовая нагрузка, которую мы не переводим в баллы. Следующий день — восстановление.</div>' : ''}
      </div>

      ${d.weight || meas ? `<div class="card"><div class="card-h"><span class="ic" style="background:var(--c-weigh)">${icon('scale')}</span>Измерения</div>
        ${d.weight ? `<div class="row between"><span>Вес</span><b class="num">${fmt(d.weight, 1)} кг</b></div>` : ''}
        ${meas ? `<div class="row between" style="margin-top:6px"><span>Замеры</span><b class="num">Т ${meas.waist ?? '—'} · Г ${meas.chest ?? '—'} · Б ${meas.hips ?? '—'}</b></div>` : ''}</div>` : ''}

      ${!future ? `<div class="btn-row"><button class="btn gray small" data-day-act="daily">${icon('edit')} Отчёт дня</button><button class="btn gray small" data-day-act="activity">${icon('plus')} Активность</button></div>` : ''}
    </div>
  </div>`;
}

export function bindDayCard(root, date) {
  root.addEventListener('click', e => {
    const p = e.target.closest('[data-plan]');
    if (p) {
      const v = p.dataset.plan;
      store.update(s => { if (v) s.planned[date] = v; else delete s.planned[date]; });
      toast(v ? (v === 'rest' ? 'Отмечен день отдыха' : `Тренировка ${v} запланирована`) : 'План снят');
      return;
    }
    const a = e.target.closest('[data-day-act]');
    if (a) { if (a.dataset.dayAct === 'daily') dailySheet(date); else activitySheet(date); return; }
    const ed = e.target.closest('[data-act-edit]');
    if (ed) activitySheet(date, store.get().activities.find(x => x.id === ed.dataset.actEdit));
  });
}

function DayPage(date) {
  return {
    title: fmtDate(date), back: 'calendar', backLabel: 'Календарь', large: false,
    html: `<div class="page" style="padding-top:12px">${dayCard(date, false)}</div>`,
    mount: root => bindDayCard(root, date)
  };
}
