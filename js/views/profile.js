// Профиль: показатели, нагрузка, недельный отчёт, цели, напоминания, данные, обновления плана.
import * as store from '../store.js';
import { icon, esc, lineChart, barChart, bar, toast, confirmDialog, openSheet, downloadFile, copyText, sw, alertDialog } from '../ui.js';
import { today, fmtDate, fmtShort, addDays, mondayOf, weekDates, WD_SHORT, WD_LONG, parse, weightEntries, weeklyWeightSeries, weekAvgWeight, lastMeasurement,
  measurementBefore, rangeLoad, dayLoad, weekReport, claudeReport, buildICS, csvExports, fmt, r1, plural, programInfo, diffDays, cycleInfo, ACT_TYPES } from '../logic.js';
import { PLAN_VERSION, CHANGELOG } from '../data/plan-meta.js';
import { weighSheet, measureSheet, dailySheet, activitySheet } from './sheets.js';
import { go } from '../app.js';
import { myCard, shareText, decodeCard, compare, monthProgress, SCORE_RULES, duelScore } from '../duel.js';

export const profileRoutes = [
  { re: /^profile$/, view: ProfileHome },
  { re: /^profile\/metrics$/, view: MetricsView },
  { re: /^profile\/load$/, view: LoadView },
  { re: /^profile\/report$/, view: ReportView },
  { re: /^profile\/edit$/, view: EditView },
  { re: /^profile\/targets$/, view: TargetsView },
  { re: /^profile\/reminders$/, view: RemindersView },
  { re: /^profile\/settings$/, view: SettingsView },
  { re: /^profile\/data$/, view: DataView },
  { re: /^profile\/plan$/, view: PlanView },
  { re: /^profile\/help$/, view: HelpView },
  { re: /^profile\/duel$/, view: DuelView }
];

const li = (go, ic, color, title, val = '', sub = '') => `<button class="li tap with-ic" data-go="${go}"><div class="li-ic" style="background:${color}">${icon(ic)}</div><div class="li-main"><div class="li-title">${title}</div>${sub ? `<div class="li-sub">${sub}</div>` : ''}</div>${val ? `<span class="li-val">${val}</span>` : ''}${icon('chev', 'chev')}</button>`;

function ProfileHome() {
  const s = store.get();
  const p = s.profile;
  const w = weightEntries();
  const curW = weekAvgWeight(mondayOf(today())) || (w.length ? { avg: w[w.length - 1].kg } : null);
  const lm = lastMeasurement();
  const first = s.measurements[0];
  const pi = programInfo();
  const needUpdate = (s.settings.planVersionAccepted || 0) < PLAN_VERSION;
  const html = `
  <div class="page">
    <div class="card row" style="gap:14px">
      <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--tint),var(--purple));display:grid;place-items:center;color:#fff;font-size:26px;font-weight:700;flex:none">${esc((p.name || 'Я')[0].toUpperCase())}</div>
      <div class="grow"><div style="font-weight:600;font-size:20px">${esc(p.name || 'Мой профиль')}</div><div class="muted small">${p.age} лет · ${p.height} см · ${esc(p.level)}</div></div>
      <button class="btn tiny gray" data-go="profile/edit">Изменить</button>
    </div>
    <div class="grid3">
      <div class="card" style="padding:12px"><div class="xs muted">Вес (ср.)</div><div class="mid-num">${curW ? fmt(curW.avg, 1) : '—'}</div><div class="xs muted">старт ${p.startWeight}</div></div>
      <div class="card" style="padding:12px"><div class="xs muted">Талия</div><div class="mid-num">${lm && lm.waist ? fmt(lm.waist, 1) : '—'}</div><div class="xs ${lm && first && lm.waist < first.waist ? 'ok' : 'muted'}">${lm && first && first !== lm && lm.waist ? `${lm.waist - first.waist > 0 ? '+' : ''}${fmt(lm.waist - first.waist, 1)} см` : 'цель ' + p.targetWaist}</div></div>
      <div class="card" style="padding:12px"><div class="xs muted">Тренировок</div><div class="mid-num">${s.sessions.length}</div><div class="xs muted">нед. ${Math.max(1, Math.min(pi.week, 10))}/10</div></div>
    </div>

    ${needUpdate ? `<button class="banner coach" data-go="profile/plan" style="width:100%;text-align:left"><div class="b-ic" style="background:var(--tint)">${icon('sparkle')}</div><div class="grow"><b>Есть обновление программы</b><p>Посмотри, что изменилось и почему</p></div></button>` : ''}

    <div><div class="section-cap">Прогресс</div><div class="list">
      ${li('profile/metrics', 'scale', 'var(--c-weigh)', 'Мои показатели', '', 'Вес, замеры, графики')}
      ${li('profile/report', 'chart', 'var(--tint)', 'Еженедельный отчёт', '', 'Оценка тренера и задачи')}
      ${li('profile/duel', 'sparkle', 'var(--orange)', 'Дуэль недели', '', 'Кто преуспел — в % от своего плана')}
      ${li('profile/load', 'bolt', 'var(--orange)', 'Общая нагрузка', '', 'День, неделя, месяц')}
    </div></div>

    <div><div class="section-cap">Программа</div><div class="list">
      ${li('profile/plan', 'sparkle', 'var(--purple)', 'Программа и обновления', `v${PLAN_VERSION}`)}
      ${li('profile/targets', 'flame', 'var(--c-kcal)', 'Цели и КБЖУ', `${fmt(s.targets.kcal)} ккал`)}
      ${li('profile/reminders', 'bell', 'var(--red)', 'Напоминания')}
    </div></div>

    <div><div class="section-cap">Приложение</div><div class="list">
      ${li('profile/settings', 'gear', 'var(--c-rest)', 'Настройки', '', 'Тема, старт программы, цикл')}
      ${li('profile/data', 'archive', 'var(--blue)', 'Данные и резервная копия')}
      ${li('profile/help', 'info', 'var(--teal)', 'Как пользоваться')}
    </div></div>
    <div class="note" style="text-align:center">Все данные хранятся только на этом устройстве. Без регистрации и передачи третьим лицам.</div>
  </div>`;
  return { title: 'Профиль', html };
}

/* ---------- Показатели ---------- */
function MetricsView() {
  const s = store.get();
  const w = weightEntries();
  const weekly = weeklyWeightSeries(16);
  const t = today();
  const fields = s.measureFields;
  const meas = s.measurements;
  const lm = lastMeasurement();
  const prevM = lm ? measurementBefore(lm.date) : null;
  const val = (m, id) => (m ? (m[id] ?? (m.extra || {})[id]) : undefined);
  const colors = ['var(--tint)', 'var(--purple)', 'var(--teal)', 'var(--orange)', 'var(--green)', 'var(--blue)'];
  const weighDayName = WD_LONG[s.settings.weighDay];
  const html = `
  <div class="page">
    <div>
      <div class="section-h"><h2>Вес</h2><button class="btn tiny" data-a="weigh">${icon('plus')} Внести</button></div>
      <div class="card">
        ${lineChart([
          { points: w.slice(-60).map(x => ({ x: x.date, y: x.kg })), color: 'var(--c-weigh)', faint: true, width: 1.2 },
          { points: weekly.map(x => ({ x: x.date, y: x.y })), color: 'var(--c-weigh)', area: true }
        ], { height: 170 })}
        <div class="xs muted" style="margin-top:6px">Бледные точки — отдельные взвешивания, линия — среднее за неделю. Взвешивание: ${weighDayName}, утром.</div>
      </div>
      ${weekly.length ? `<div class="list" style="margin-top:12px">${[...weekly].reverse().slice(0, 8).map((x, i, arr) => { const prev = arr[i + 1]; const d = prev ? x.y - prev.y : null; return `<div class="li"><div class="li-main"><div class="li-title" style="font-size:15px">Неделя с ${fmtDate(x.date)}</div><div class="li-sub">${x.n} ${plural(x.n, 'взвешивание', 'взвешивания', 'взвешиваний')}</div></div><b class="num">${fmt(x.y, 1)} кг</b>${d !== null ? `<span class="pill-stat ${d < 0 ? 'trend-down' : d > 0 ? 'trend-up' : ''}">${d > 0 ? '+' : ''}${fmt(d, 1)}</span>` : ''}</div>`; }).join('')}</div>` : ''}
      <div class="section-foot">Выводы — только по средним за неделю: вес ежедневно колеблется на 0,5–1,5 кг из-за воды, соли и цикла.</div>
    </div>

    <div>
      <div class="section-h"><h2>Замеры</h2><button class="btn tiny" data-a="measure">${icon('plus')} Внести</button></div>
      <div class="grid3">${fields.slice(0, 6).map(f => { const v = val(lm, f.id), pv = val(prevM, f.id); const d = v !== undefined && pv !== undefined ? v - pv : null; return `<div class="card" style="padding:12px"><div class="xs muted">${esc(f.name)}</div><div class="mid-num">${v !== undefined ? fmt(v, 1) : '—'}</div><div class="xs ${d < 0 ? 'ok' : d > 0 ? 'warn' : 'muted'}">${d !== null ? `${d > 0 ? '+' : ''}${fmt(d, 1)} см за ${diffDays(prevM.date, lm.date)} дн.` : 'см'}</div></div>`; }).join('')}</div>
      <div class="card" style="margin-top:12px">
        ${lineChart(fields.slice(0, 6).map((f, i) => ({ points: meas.filter(m => val(m, f.id) !== undefined).map(m => ({ x: m.date, y: val(m, f.id) })), color: colors[i] })), { height: 170, yFmt: v => fmt(v, 0) })}
        <div class="chips" style="margin-top:8px">${fields.slice(0, 6).map((f, i) => `<span class="chip"><i style="width:8px;height:8px;border-radius:50%;background:${colors[i]};display:inline-block"></i>${esc(f.name)}</span>`).join('')}</div>
      </div>
      ${meas.length ? `<div class="list" style="margin-top:12px">${[...meas].reverse().map(m => `<div class="li"><div class="li-main"><div class="li-title" style="font-size:15px">${fmtDate(m.date, { year: true })}${m.note ? ` <span class="xs muted">· ${esc(m.note)}</span>` : ''}</div><div class="li-sub">${fields.map(f => val(m, f.id) !== undefined ? `${esc(f.name)} ${fmt(val(m, f.id), 1)}` : '').filter(Boolean).join(' · ')}</div></div><button class="nb-icon" data-delm="${m.date}" aria-label="Удалить" style="color:var(--label-3)">${icon('trash')}</button></div>`).join('')}</div>` : ''}
      <div class="section-foot">Раз в месяц, утром, в одинаковых условиях. Если бёдра почти не меняются, а талия уменьшается — это хороший знак: жир уходит, ягодицы растут.</div>
    </div>

    <div>
      <div class="section-h"><h2>Отчёты дня</h2><button class="btn tiny gray" data-a="daily">${icon('edit')} Сегодня</button></div>
      <div class="card">${lineChart([
        { points: Object.keys(s.daily).filter(d => s.daily[d].sleep).sort().slice(-30).map(d => ({ x: d, y: +s.daily[d].sleep })), color: 'var(--indigo)' }
      ], { height: 120, yFmt: v => fmt(v, 1) })}<div class="xs muted">Сон, часов</div></div>
      <div class="card" style="margin-top:12px">${barChart(Array.from({ length: 14 }, (_, i) => addDays(t, -13 + i)).map(d => ({ label: String(parse(d).getDate()), v: +((s.daily[d] || {}).steps || 0), color: 'var(--blue)', hl: d === t })), { target: s.targets.steps, showVals: false })}<div class="xs muted">Шаги за 14 дней · пунктир — цель ${fmt(s.targets.steps)}</div></div>
    </div>
  </div>`;
  return {
    title: 'Мои показатели', back: 'profile', backLabel: 'Профиль', html,
    mount: root => root.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if (a) { ({ weigh: weighSheet, measure: measureSheet, daily: dailySheet })[a.dataset.a](); return; }
      const dm = e.target.closest('[data-delm]');
      if (dm && await confirmDialog('Удалить замеры?', `Замеры за ${fmtDate(dm.dataset.delm)} будут удалены.`, 'Удалить', true)) store.update(st => { st.measurements = st.measurements.filter(m => m.date !== dm.dataset.delm); });
    })
  };
}

/* ---------- Нагрузка ---------- */
let loadMode = 'week';
function LoadView() {
  const t = today();
  const s = store.get();
  let content = '';
  if (loadMode === 'day') {
    const dl = dayLoad(t);
    content = `<div class="card"><div class="row between"><div><div class="muted small">Сегодня</div><div class="big-num">${esc(dl.label)}</div></div><div style="text-align:right"><div class="mid-num">${fmt(dl.total)}</div><div class="xs muted">усл. ед.</div></div></div>
      <div class="kv" style="margin-top:12px"><div><div class="k">Силовая</div><div class="v">${fmt(dl.strength)}</div></div><div><div class="k">Аэробная</div><div class="v">${fmt(dl.cardio)}</div></div><div><div class="k">Минут</div><div class="v">${dl.minutes}</div></div><div><div class="k">Шаги</div><div class="v">${dl.steps ? fmt(dl.steps) : '—'}</div></div></div></div>`;
    const days = Array.from({ length: 14 }, (_, i) => addDays(t, -13 + i));
    content += `<div class="card"><div class="card-h">Последние 14 дней</div>${barChart(days.map(d => { const l = dayLoad(d); return { label: String(parse(d).getDate()), v: l.total, color: l.strength >= l.cardio ? 'var(--c-train)' : 'var(--c-cardio)', hl: d === t }; }), { showVals: false })}</div>`;
  } else {
    const weeks = loadMode === 'week' ? 8 : 6;
    const periods = loadMode === 'week'
      ? Array.from({ length: weeks }, (_, i) => { const m = mondayOf(addDays(t, -7 * (weeks - 1 - i))); return { from: m, to: addDays(m, 6), label: fmtShort(m) }; })
      : Array.from({ length: weeks }, (_, i) => { const d = parse(t); const a = new Date(d.getFullYear(), d.getMonth() - (weeks - 1 - i), 1); const b = new Date(a.getFullYear(), a.getMonth() + 1, 0); return { from: store.todayStr(a), to: store.todayStr(b), label: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][a.getMonth()] }; });
    const data = periods.map(p => ({ ...p, ...rangeLoad(p.from, p.to > t ? t : p.to) }));
    const cur = data[data.length - 1];
    const prevAvg = data.slice(0, -1).filter(x => x.total > 0);
    const avg = prevAvg.length ? prevAvg.reduce((a, x) => a + x.total, 0) / prevAvg.length : 0;
    const ratio = avg > 0 ? cur.total / avg : null;
    const aer = cur.cardio + cur.other, str = cur.strength;
    content = `
      <div class="card"><div class="row between"><div><div class="muted small">${loadMode === 'week' ? 'Эта неделя' : 'Этот месяц'}</div><div class="big-num">${fmt(cur.total)}<small>усл. ед.</small></div></div>
        ${ratio !== null ? `<span class="chip ${ratio > 1.5 ? 'orange' : ratio < 0.6 ? 'blue' : 'green'}">${ratio > 1.5 ? 'резкий рост' : ratio < 0.6 ? 'ниже обычного' : 'в обычном диапазоне'}</span>` : ''}</div>
        <div class="kv" style="margin-top:12px"><div><div class="k">Дней с нагрузкой</div><div class="v">${cur.trainDays}</div></div><div><div class="k">Дней отдыха</div><div class="v">${cur.restDays}</div></div><div><div class="k">Минут</div><div class="v">${fmt(cur.minutes)}</div></div></div>
        <div style="margin-top:14px"><div class="row between small"><span><span style="color:var(--c-train)">●</span> Силовая ${str + aer ? Math.round(str / (str + aer) * 100) : 0}%</span><span>Аэробная ${str + aer ? Math.round(aer / (str + aer) * 100) : 0}% <span style="color:var(--c-cardio)">●</span></span></div>
        <div class="bar" style="margin-top:6px;height:10px"><i style="width:${str + aer ? str / (str + aer) * 100 : 0}%;background:var(--c-train)"></i><i style="left:auto;right:0;width:${str + aer ? aer / (str + aer) * 100 : 0}%;background:var(--c-cardio)"></i></div></div>
      </div>
      <div class="card"><div class="card-h">Динамика</div>${barChart(data.map((d, i) => ({ label: d.label, v: d.total, color: 'var(--orange)', hl: i === data.length - 1 })), { showVals: true })}</div>
      <div class="card"><div class="card-h">Силовая и аэробная</div>${barChart(data.flatMap(d => [{ label: d.label, v: d.strength, color: 'var(--c-train)' }]), { showVals: false, height: 100 })}${barChart(data.map(d => ({ label: d.label, v: d.cardio + d.other, color: 'var(--c-cardio)' })), { showVals: false, height: 100 })}</div>`;
  }
  const recent = [...s.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const html = `<div class="page">
    <div class="seg" id="lm">${[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']].map(([k, l]) => `<button class="${loadMode === k ? 'on' : ''}" data-m="${k}">${l}</button>`).join('')}</div>
    ${content}
    <div><div class="section-h"><h2>Активность</h2><button class="btn tiny" data-add="1">${icon('plus')} Добавить</button></div>
    ${recent.length ? `<div class="list">${recent.map(a => `<button class="li tap" data-act="${a.id}"><div class="li-ic" style="background:var(--c-cardio)">${ACT_TYPES[a.type]?.em}</div><div class="li-main"><div class="li-title" style="font-size:15px">${ACT_TYPES[a.type]?.name} · ${a.min} мин</div><div class="li-sub">${fmtDate(a.date)} · RPE ${a.rpe}${a.km ? ` · ${fmt(a.km, 1)} км` : ''}</div></div>${icon('chev', 'chev')}</button>`).join('')}</div>` : '<div class="muted small" style="padding:0 4px">Бег, велосипед, плавание, прогулки — добавляй, чтобы видеть полную картину.</div>'}</div>
    <div class="note"><b>Как считается:</b> нагрузка = минуты × субъективная сложность (RPE 1–10) — метод sRPE. Это условная оценка для сравнения дней и недель между собой, а не медицинское измерение. Сутки на работе отмечаются отдельно и в баллы не переводятся. Резкий рост (в 1,5 раза выше обычного) — повод добавить восстановление.</div>
  </div>`;
  return {
    title: 'Общая нагрузка', back: 'profile', backLabel: 'Назад', html,
    mount: root => root.addEventListener('click', e => {
      const m = e.target.closest('[data-m]'); if (m) { loadMode = m.dataset.m; window.__rerender(); return; }
      if (e.target.closest('[data-add]')) { activitySheet(); return; }
      const a = e.target.closest('[data-act]'); if (a) activitySheet(undefined, store.get().activities.find(x => x.id === a.dataset.act));
    })
  };
}

/* ---------- Еженедельный отчёт ---------- */
function ReportView(params = {}) {
  const t = today();
  const defMon = [5, 6].includes((parse(t).getDay() + 6) % 7) ? mondayOf(t) : mondayOf(addDays(t, -7));
  const mon = params.w || defMon;
  const r = weekReport(mon);
  const s = store.get();
  const V = {
    praise: { em: '🔥', title: 'Отличная неделя!', bg: 'linear-gradient(135deg, rgba(255,55,95,.16), rgba(255,149,0,.14))' },
    good: { em: '💪', title: 'Хорошая неделя', bg: 'linear-gradient(135deg, rgba(52,199,89,.14), rgba(48,176,199,.12))' },
    support: { em: '🌱', title: 'Новая неделя — новый старт', bg: 'linear-gradient(135deg, rgba(88,86,214,.12), rgba(175,82,222,.1))' },
    incomplete: { em: '📝', title: 'Недостаточно данных', bg: 'var(--card)' }
  }[r.verdict];
  const stat = (label, v, max, color) => `<div><div class="row between small"><span>${label}</span><b class="num">${v}/${max}</b></div><div style="margin-top:4px">${bar(v, max, color)}</div></div>`;
  const html = `<div class="page">
    <div class="row between">
      <button class="nb-icon" data-wk="-7" aria-label="Предыдущая неделя">${icon('chevL')}</button>
      <div style="text-align:center"><div style="font-weight:600">${fmtDate(r.monday)} — ${fmtDate(r.end)}</div><div class="xs muted">${r.finished ? 'неделя завершена' : 'неделя идёт'}</div></div>
      <button class="nb-icon" data-wk="7" aria-label="Следующая неделя" ${addDays(mon, 7) > t ? 'disabled style="opacity:.3"' : ''}>${icon('chevR')}</button>
    </div>

    <div class="card" style="background:${V.bg}">
      <div style="font-size:40px">${V.em}</div>
      <div style="font-weight:700;font-size:22px;margin-top:4px">${V.title}</div>
      <p class="prose" style="margin-top:6px">${esc(r.message)}</p>
      ${r.verdict !== 'incomplete' ? `<div class="divider"></div><div class="small"><b>Цель на следующую неделю:</b> ${esc(r.goal)}</div>` : ''}
    </div>

    <div class="card stack">
      ${stat('Тренировки', r.sess.length, r.target, 'var(--c-train)')}
      ${stat('Питание записано', r.foodDays, 7, 'var(--label-3)')}
      ${stat('Калории в норме (±10%)', r.kcalOk, 7, 'var(--c-kcal)')}
      ${stat('Белок в норме', r.protOk, 7, 'var(--c-protein)')}
      ${stat('Вода в норме', r.waterOk, 7, 'var(--c-water)')}
    </div>

    <div class="kv">
      <div><div class="k">Ср. вес</div><div class="v">${r.wNow ? fmt(r.wNow.avg, 1) + ' кг' : '—'}</div></div>
      <div><div class="k">К прошлой неделе</div><div class="v ${r.wDelta < 0 ? 'ok' : r.wDelta > 0 ? 'warn' : ''}">${r.wDelta !== null ? (r.wDelta > 0 ? '+' : '') + fmt(r.wDelta, 1) + ' кг' : '—'}</div></div>
      <div><div class="k">Шаги ср.</div><div class="v">${r.steps ? fmt(r.steps) : '—'}</div></div>
      <div><div class="k">Сон ср.</div><div class="v">${r.sleep ? fmt(r.sleep, 1) + ' ч' : '—'}</div></div>
      <div><div class="k">Энергия</div><div class="v">${r.energy ? fmt(r.energy, 1) + '/5' : '—'}</div></div>
      <div><div class="k">Нагрузка</div><div class="v">${fmt(r.load.total)}</div></div>
    </div>
    ${r.shifts || r.lutealDays || r.sick ? `<div class="chips">${r.shifts ? `<span class="chip">🏥 суток: ${r.shifts}</span>` : ''}${r.lutealDays ? `<span class="chip">🌸 цикл учтён</span>` : ''}${r.sick ? `<span class="chip">🤒 болезнь: ${r.sick} дн.</span>` : ''}</div>` : ''}

    ${r.wins.length ? `<div><div class="section-cap">Что получилось</div><div class="card"><ul class="ul good">${r.wins.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div></div>` : ''}
    ${r.missedSessions && r.finished ? `<div><div class="section-cap">Что пропущено</div><div class="card"><ul class="ul"><li>${r.missedSessions} ${plural(r.missedSessions, 'тренировка', 'тренировки', 'тренировок')} из плана</li>${7 - r.foodDays ? `<li>питание не записано ${7 - r.foodDays} ${plural(7 - r.foodDays, 'день', 'дня', 'дней')}</li>` : ''}</ul></div></div>` : ''}
    ${r.ready.length ? `<div><div class="section-cap">Готова к прогрессии</div><div class="list">${r.ready.map(x => `<div class="li"><div class="li-main"><div class="li-title" style="font-size:15px">${esc(x.name)}</div><div class="li-sub">${esc(x.text)}</div></div></div>`).join('')}</div><div class="section-foot">Новый вес принимается в отчёте о тренировке.</div></div>` : ''}
    ${r.measNow ? `<div class="card"><div class="card-h">Замеры</div>${['waist', 'chest', 'hips'].map(k => `<div class="row between small" style="margin-top:4px"><span>${{ waist: 'Талия', chest: 'Грудь', hips: 'Бёдра' }[k]}</span><b class="num">${r.measNow[k] ?? '—'} см ${r.measPrev && r.measNow[k] && r.measPrev[k] ? `<span class="${r.measNow[k] - r.measPrev[k] < 0 ? 'ok' : 'muted'}">(${r.measNow[k] - r.measPrev[k] > 0 ? '+' : ''}${fmt(r.measNow[k] - r.measPrev[k], 1)})</span>` : ''}</b></div>`).join('')}</div>` : ''}

    ${r.advice.length ? `<div><div class="section-cap">Предложения</div><div class="stack">${r.advice.map((a, i) => `<div class="card"><p class="prose" style="font-size:15px">${esc(a.text)}</p>${a.action ? `<div class="row" style="gap:8px;margin-top:10px"><button class="btn tiny" data-adv="${i}">Применить</button><span class="xs muted">изменение только после подтверждения</span></div>` : ''}</div>`).join('')}</div></div>` : ''}

    <div class="card">
      <div class="card-h"><span class="ic" style="background:var(--purple)">${icon('sparkle')}</span>Разбор неделю с Claude</div>
      <p class="small muted" style="line-height:1.45">Скопируй отчёт и отправь его в чат с Claude — он подробно разберёт неделю и при необходимости обновит программу или питание. Обновление придёт в приложение само, с объяснением, что и почему изменилось.</p>
      <div class="btn-row" style="margin-top:12px"><button class="btn small" id="copy-rep">${icon('copy')} Скопировать</button><button class="btn small secondary" id="save-rep">${icon('share')} Файл</button></div>
    </div>
  </div>`;
  return {
    title: 'Отчёт за неделю', back: 'profile', backLabel: 'Назад', large: false, html,
    mount: root => {
      store.update(st => { st.dismissed['report-' + mon] = true; }, { silent: true });
      root.addEventListener('click', async e => {
        const wk = e.target.closest('[data-wk]');
        if (wk) { go('profile/report?w=' + addDays(mon, +wk.dataset.wk), { replace: true }); return; }
        const adv = e.target.closest('[data-adv]');
        if (adv) { await applyAdvice(r.advice[+adv.dataset.adv].action); return; }
        if (e.target.closest('#copy-rep')) { const ok = await copyText(claudeReport(mon).full); toast(ok ? 'Отчёт скопирован — вставь его в чат с Claude' : 'Не удалось скопировать'); return; }
        if (e.target.closest('#save-rep')) { const c = claudeReport(mon); downloadFile(`отчёт-${mon}.json`, JSON.stringify({ ...c.json, summary: c.text }, null, 2)); }
      });
    }
  };
}

async function applyAdvice(a) {
  const s = store.get();
  if (a.type === 'kcal') {
    const nv = s.targets.kcal + a.delta;
    if (!(await confirmDialog('Изменить калорийность?', `${fmt(s.targets.kcal)} → ${fmt(nv)} ккал (изменение за счёт углеводов). Белок и жиры не меняются.`, 'Изменить'))) return;
    store.update(st => { st.targets.kcal = nv; st.acceptedSuggestions.push({ date: today(), type: 'kcal', value: nv }); });
    toast(`Новая цель: ${fmt(nv)} ккал`);
  } else if (a.type === 'workouts') {
    if (!(await confirmDialog('2 тренировки в неделю?', 'Цель по тренировкам станет 2 в неделю. Порядок A → B → C сохраняется. Вернуть 3 можно в «Цели и КБЖУ».', 'Применить'))) return;
    store.update(st => { st.targets.workoutsPerWeek = a.value; });
    toast('Цель: 2 тренировки в неделю');
  } else if (a.type === 'deload') {
    await alertDialog({ title: 'Облегчённая неделя', text: 'На этой неделе делай на 1 подход меньше в каждом упражнении и не повышай веса. Приоритет — сон и прогулки. Отметки «Как далось» помогут понять, когда вернуться к полному объёму.' });
  }
}

/* ---------- Профиль: редактирование ---------- */
function EditView() {
  const p = store.get().profile;
  const f = (id, label, val, type = 'text', mode = '') => `<div class="li"><div class="li-main li-title">${label}</div><input class="li-input" id="p-${id}" type="${type}" ${mode ? `inputmode="${mode}"` : ''} value="${esc(val ?? '')}"></div>`;
  const ta = (id, label, val) => `<div><div class="section-cap">${label}</div><div class="list"><div class="li"><textarea id="p-${id}">${esc(val || '')}</textarea></div></div></div>`;
  const html = `<div class="page">
    <div class="list">${f('name', 'Имя', p.name)}${f('age', 'Возраст', p.age, 'text', 'numeric')}${f('height', 'Рост, см', p.height, 'text', 'numeric')}${f('startWeight', 'Стартовый вес', p.startWeight, 'text', 'decimal')}${f('targetWeight', 'Цель по весу', p.targetWeight)}${f('targetWaist', 'Цель по талии, см', p.targetWaist, 'text', 'decimal')}${f('deadline', 'Срок', p.deadline, 'date')}${f('level', 'Уровень', p.level)}</div>
    ${ta('goalText', 'Цель', p.goalText)}${ta('experience', 'Тренировочный стаж', p.experience)}${ta('health', 'Здоровье и ограничения (со слов)', p.health)}${ta('food', 'Пищевые предпочтения', p.food)}${ta('work', 'Работа и режим', p.work)}
    <div class="note">Эти данные используются для расчётов и рекомендаций. Медицинские сведения указаны со слов и не являются диагнозом.</div>
  </div>`;
  return {
    title: 'Мои данные', back: 'profile', backLabel: 'Профиль', large: false, html,
    right: `<button class="nb-btn strong" id="p-save">Готово</button>`,
    mount: root => document.getElementById('p-save').addEventListener('click', () => {
      const v = id => document.getElementById('p-' + id).value.trim();
      store.update(st => { Object.assign(st.profile, { name: v('name'), age: +v('age') || st.profile.age, height: +v('height') || st.profile.height, startWeight: +v('startWeight').replace(',', '.') || st.profile.startWeight, targetWeight: v('targetWeight'), targetWaist: +v('targetWaist').replace(',', '.') || st.profile.targetWaist, deadline: v('deadline'), level: v('level'), goalText: v('goalText'), experience: v('experience'), health: v('health'), food: v('food'), work: v('work') }); }, { silent: true });
      toast('Сохранено'); go('profile', { replace: true });
    })
  };
}

/* ---------- Цели и КБЖУ ---------- */
function TargetsView() {
  const s = store.get();
  const p = s.profile, t = s.targets;
  const lastW = weightEntries().slice(-1)[0];
  const kg = lastW ? lastW.kg : p.startWeight;
  const bmr = Math.round(10 * kg + 6.25 * p.height - 5 * p.age - 161);
  const carbs = Math.round((t.kcal - t.protein * 4 - t.fat * 9) / 4);
  const f = (id, label, val, hint = '') => `<div class="li"><div class="li-main"><div class="li-title">${label}</div>${hint ? `<div class="li-sub">${hint}</div>` : ''}</div><input class="li-input" id="t-${id}" inputmode="decimal" value="${val}"></div>`;
  const html = `<div class="page">
    <div class="card"><div class="card-h">Расчёт</div>
      <div class="small" style="line-height:1.55">
        <b>Базовый обмен</b> (Миффлин — Сан Жеор): 10 × ${fmt(kg, 1)} + 6,25 × ${p.height} − 5 × ${p.age} − 161 = <b>${fmt(bmr)} ккал</b><br>
        <b>Расход</b> с учётом суток (~2 в неделю), 3 тренировок и малой активности в остальные дни ≈ <b>1900 ккал</b> (±10%)<br>
        <b>Цель</b>: умеренный дефицит ~15% → ${fmt(t.kcal)} ккал. Нижняя граница — не ниже базового обмена (${fmt(bmr)}).<br>
        <b>Углеводы</b> = (${fmt(t.kcal)} − ${t.protein}×4 − ${t.fat}×9) / 4 = <b>${carbs} г</b>
      </div></div>
    <div><div class="section-cap">Питание</div><div class="list">
      ${f('kcal', 'Калории', t.kcal, 'обычный и тренировочный день')}
      ${f('protein', 'Белок, г', t.protein, `${fmt(t.protein / kg, 1)} г/кг`)}
      ${f('fat', 'Жиры, г', t.fat, `${fmt(t.fat / kg, 1)} г/кг · не ниже 0,8 г/кг`)}
      ${f('shiftExtra', 'Сутки, +ккал', t.shiftExtra)}
      ${f('lutealExtra', 'Перед менструацией, +ккал', t.lutealExtra)}
      ${f('fiber', 'Клетчатка, г', t.fiber)}
      ${f('waterMl', 'Вода, мл', t.waterMl, '+500 мл в день тренировки и в сутки')}
    </div></div>
    <div><div class="section-cap">Активность</div><div class="list">
      ${f('steps', 'Шаги', t.steps)}
      ${f('workoutsPerWeek', 'Тренировок в неделю', t.workoutsPerWeek)}
    </div></div>
    <div class="note">Меняй цели осознанно: не ниже ${fmt(bmr)} ккал, не меньше 1,6 г белка и 0,8 г жиров на кг. Если есть сомнения — отправь недельный отчёт Claude.</div>
  </div>`;
  return {
    title: 'Цели и КБЖУ', back: 'profile', backLabel: 'Профиль', large: false, html,
    right: `<button class="nb-btn strong" id="t-save">Готово</button>`,
    mount: root => document.getElementById('t-save').addEventListener('click', async () => {
      const v = id => parseFloat(document.getElementById('t-' + id).value.replace(',', '.'));
      const n = { kcal: v('kcal'), protein: v('protein'), fat: v('fat'), shiftExtra: v('shiftExtra'), lutealExtra: v('lutealExtra'), fiber: v('fiber'), waterMl: v('waterMl'), steps: v('steps'), workoutsPerWeek: v('workoutsPerWeek') };
      if (Object.values(n).some(x => Number.isNaN(x))) { toast('Проверь значения'); return; }
      if (n.kcal < bmr && !(await confirmDialog('Калорийность ниже базового обмена', 'Такой дефицит может вредить гормонам, циклу и мышцам. Сохранить всё равно?', 'Сохранить', true))) return;
      store.update(st => { Object.assign(st.targets, n); }, { silent: true });
      toast('Цели сохранены'); go('profile', { replace: true });
    })
  };
}

/* ---------- Напоминания ---------- */
function RemindersView() {
  const s = store.get();
  const r = s.settings.reminders;
  const row = (k, ic, color, title, sub) => `<div class="li with-ic"><div class="li-ic" style="background:${color}">${ic}</div><div class="li-main"><div class="li-title">${title}</div><div class="li-sub">${sub}</div></div>${sw('r-' + k, r[k], `data-r="${k}"`)}</div>`;
  const html = `<div class="page">
    <div class="list">
      ${row('workout', '🏋️‍♀️', 'var(--c-train)', 'Тренировки', 'Для дней, запланированных в календаре')}
      ${row('weigh', '⚖️', 'var(--c-weigh)', 'Взвешивание', 'Раз в неделю утром')}
      ${row('measure', '📏', 'var(--c-measure)', 'Замеры', 'Раз в месяц')}
      ${row('recovery', '😴', 'var(--indigo)', 'День восстановления', 'После суток')}
      ${row('food', '🍽', 'var(--c-kcal)', 'Дневник питания', 'Каждый вечер в 21:00')}
      ${row('backup', '💾', 'var(--blue)', 'Резервная копия', 'Раз в неделю')}
    </div>
    <div class="list">
      <div class="li"><div class="li-main li-title">День взвешивания</div><select class="li-input" id="weighDay">${WD_LONG.map((d, i) => `<option value="${i}" ${s.settings.weighDay === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div class="li"><div class="li-main li-title">Число месяца для замеров</div><input class="li-input" id="measureDay" inputmode="numeric" value="${s.settings.measureDay}"></div>
    </div>
    <div class="card">
      <div class="card-h"><span class="ic" style="background:var(--red)">${icon('calendar')}</span>Уведомления на iPhone</div>
      <p class="small muted" style="line-height:1.45">Приложение работает без сервера, поэтому присылать push-уведомления само не может. Надёжный способ — добавить напоминания в стандартный Календарь iPhone: он сам пришлёт уведомление в нужное время.</p>
      <button class="btn small" id="ics" style="margin-top:12px">${icon('calendar')} Добавить в Календарь</button>
      <div class="xs muted" style="margin-top:8px">Откроется файл с событиями — нажми «Добавить все». После изменения расписания или новых планов в календаре приложения добавь заново. Внутри приложения напоминания показываются на главном экране.</div>
    </div>
  </div>`;
  return {
    title: 'Напоминания', back: 'profile', backLabel: 'Профиль', large: false, html,
    mount: root => {
      root.addEventListener('change', e => {
        const k = e.target.dataset.r;
        if (k) store.update(st => { st.settings.reminders[k] = e.target.checked; }, { silent: true });
        if (e.target.id === 'weighDay') store.update(st => { st.settings.weighDay = +e.target.value; }, { silent: true });
        if (e.target.id === 'measureDay') store.update(st => { st.settings.measureDay = Math.min(28, Math.max(1, +e.target.value || 1)); }, { silent: true });
      });
      root.querySelector('#ics').addEventListener('click', () => {
        const blob = new Blob([buildICS()], { type: 'text/calendar' });
        if (/iPhone|iPad/i.test(navigator.userAgent)) { location.href = URL.createObjectURL(blob); }
        else downloadFile('напоминания-фитнес.ics', blob, 'text/calendar');
      });
    }
  };
}

/* ---------- Настройки ---------- */
function SettingsView() {
  const s = store.get();
  const c = cycleInfo(today());
  const html = `<div class="page">
    <div><div class="section-cap">Чья программа на этом телефоне</div><div class="seg" id="who">${[['her', 'Её (A/B/C)'], ['him', 'Его (гибрид)']].map(([k, l]) => `<button class="${(s.settings.who || 'her') === k ? 'on' : ''}" data-w="${k}">${l}</button>`).join('')}</div>
    <div class="section-foot">Меняет программу тренировок, порции и подсказки. Цели по КБЖУ задаются в «Цели и КБЖУ» (или загружаются из файла настройки).</div></div>
    <div><div class="section-cap">Оформление</div><div class="seg" id="theme">${[['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, l]) => `<button class="${s.settings.theme === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div></div>
    <div><div class="section-cap">Программа</div><div class="list">
      <div class="li"><div class="li-main"><div class="li-title">Старт программы</div><div class="li-sub">От этой даты считаются недели и дни меню</div></div><input class="li-input" type="date" id="pstart" value="${s.settings.programStart}"></div>
    </div></div>
    <div><div class="section-cap">Менструальный цикл</div><div class="list">
      <div class="li"><div class="li-main"><div class="li-title">Начало последней</div><div class="li-sub">Обновляется само, когда отмечаешь «Менструация» в отчёте дня</div></div><input class="li-input" type="date" id="cstart" value="${s.cycle.lastStart || ''}" max="${today()}"></div>
      <div class="li"><div class="li-main li-title">Длина цикла, дней</div><input class="li-input" id="clen" inputmode="numeric" value="${s.cycle.length}"></div>
    </div><div class="section-foot">${c.known ? `Сейчас ${c.day}-й день цикла${c.luteal ? ' — неделя перед менструацией: +150 ккал, мягче к себе' : ''}.` : 'Нужно для учёта фазы цикла: +150 ккал и мягкие тренировки за неделю до менструации, а также чтобы не путать задержку воды с ростом жира.'}</div></div>
  </div>`;
  return {
    title: 'Настройки', back: 'profile', backLabel: 'Профиль', large: false, html,
    mount: root => {
      root.querySelector('#theme').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) store.update(st => { st.settings.theme = b.dataset.t; }); });
      root.querySelector('#who').addEventListener('click', async e => {
        const b = e.target.closest('[data-w]'); if (!b || b.dataset.w === store.get().settings.who) return;
        if (!(await confirmDialog('Сменить программу?', 'Записи сохранятся, но план тренировок и порции переключатся. Обычно это делается один раз при настройке.', 'Сменить'))) { window.__rerender(); return; }
        store.update(st => { st.settings.who = b.dataset.w; });
      });
      root.addEventListener('change', e => {
        if (e.target.id === 'pstart' && e.target.value) store.update(st => { st.settings.programStart = e.target.value; }, { silent: true });
        if (e.target.id === 'cstart') store.update(st => { st.cycle.lastStart = e.target.value || null; }, { silent: true });
        if (e.target.id === 'clen') store.update(st => { st.cycle.length = Math.min(40, Math.max(21, +e.target.value || 28)); }, { silent: true });
        toast('Сохранено');
      });
    }
  };
}

/* ---------- Данные ---------- */
export async function doBackup() {
  const obj = store.backupObject();
  await downloadFile(`фитнес-копия-${today()}.json`, JSON.stringify(obj));
  store.update(st => { st.settings.lastBackup = new Date().toISOString(); });
  toast('Резервная копия создана');
}

function DataView() {
  const s = store.get();
  const size = new Blob([JSON.stringify(s)]).size;
  const html = `<div class="page">
    <div class="card"><div class="row between"><div><div class="muted small">Последняя копия</div><div style="font-weight:600">${s.settings.lastBackup ? fmtDate(s.settings.lastBackup.slice(0, 10), { year: true }) : 'ещё не делалась'}</div></div><div class="muted small">${fmt(size / 1024, 1)} КБ</div></div></div>
    <div class="list">
      <button class="li tap with-ic action" id="b-save"><div class="li-ic" style="background:var(--blue)">${icon('archive')}</div><div class="li-main"><div class="li-title">Сохранить резервную копию</div><div class="li-sub">JSON-файл — сохрани в «Файлы» или iCloud Drive</div></div></button>
      <label class="li tap with-ic action" style="cursor:pointer"><div class="li-ic" style="background:var(--green)">${icon('refresh')}</div><div class="li-main"><div class="li-title">Восстановить из копии</div><div class="li-sub">Заменит текущие данные</div></div><input type="file" id="b-load" accept="application/json,.json" style="display:none"></label>
    </div>
    <div class="list"><button class="li tap with-ic action" id="b-xlsx"><div class="li-ic" style="background:var(--green)">${icon('chart')}</div><div class="li-main"><div class="li-title">Excel-таблица системы</div><div class="li-sub">Программы обоих, меню на двоих, рецепты, цены, журналы и твои записи</div></div>${icon('share', 'chev')}</button></div>
    <div><div class="section-cap">Экспорт для таблиц (CSV)</div><div class="list">${Object.keys(csvExports()).map(n => `<button class="li tap with-ic action" data-csv="${n}"><div class="li-ic" style="background:var(--teal)">${icon('doc')}</div><div class="li-main li-title">${n}</div>${icon('share', 'chev')}</button>`).join('')}</div>
    <div class="section-foot">CSV открывается в Numbers, Excel, Google Таблицах.</div></div>
    <div class="list"><button class="li tap destructive" id="b-wipe">Удалить все данные</button></div>
    <div class="note"><b>Конфиденциальность:</b> приложение не отправляет данные в интернет — всё хранится в памяти этого браузера. На iPhone добавь приложение на экран «Домой», тогда система не очищает его данные. Копии храни в надёжном месте: в них есть сведения о здоровье.</div>
  </div>`;
  return {
    title: 'Данные', back: 'profile', backLabel: 'Профиль', large: false, html,
    mount: root => {
      root.querySelector('#b-save').addEventListener('click', doBackup);
      root.querySelector('#b-xlsx').addEventListener('click', async () => {
        const { buildSystemXlsx } = await import('../export-xlsx.js');
        downloadFile(`фитнес-система-${today()}.xlsx`, buildSystemXlsx(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      });
      root.querySelector('#b-load').addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const obj = JSON.parse(await file.text());
          const err = store.validateBackup(obj);
          if (err) { await alertDialog({ title: 'Не получилось', text: err }); return; }
          if (!(await confirmDialog('Восстановить данные?', `Копия от ${fmtDate(obj.exportedAt.slice(0, 10), { year: true })}. Текущие данные будут заменены.`, 'Восстановить', true))) return;
          store.replaceAll(obj.data);
          toast('Данные восстановлены');
        } catch (er) { await alertDialog({ title: 'Ошибка чтения файла', text: String(er.message || er) }); }
        e.target.value = '';
      });
      root.addEventListener('click', async e => {
        const c = e.target.closest('[data-csv]');
        if (c) { downloadFile(c.dataset.csv, csvExports()[c.dataset.csv], 'text/csv'); return; }
        if (e.target.closest('#b-wipe')) {
          if (!(await confirmDialog('Удалить все данные?', 'Тренировки, питание, вес и замеры будут удалены с этого устройства без возможности восстановления. Сначала сделай резервную копию.', 'Удалить всё', true))) return;
          if (!(await confirmDialog('Точно удалить?', 'Это действие нельзя отменить.', 'Удалить', true))) return;
          localStorage.clear(); location.reload();
        }
      });
    }
  };
}

/* ---------- Программа и обновления ---------- */
function PlanView() {
  const s = store.get();
  const acc = s.settings.planVersionAccepted || 0;
  const pending = CHANGELOG.filter(c => c.version > acc);
  const html = `<div class="page">
    ${pending.length ? `<div class="banner coach"><div class="b-ic" style="background:var(--tint)">${icon('sparkle')}</div><div class="grow"><b>Новая версия программы</b><p>Claude обновил план по твоим результатам. Прочитай, что изменилось, и подтверди.</p><div class="b-act"><button class="btn tiny" id="accept">Принять изменения</button></div></div></div>` : ''}
    ${[...CHANGELOG].reverse().map(c => `<div class="card">
      <div class="row between"><b style="font-size:17px">${esc(c.title)}</b><span class="chip ${c.version > acc ? 'on' : 'green'}">${c.version > acc ? 'новое' : 'действует'} · v${c.version}</span></div>
      <div class="muted small">${fmtDate(c.date, { year: true })}</div>
      <p class="prose" style="margin-top:8px;font-size:15px"><b>Почему:</b> ${esc(c.why)}</p>
      <ul class="ul" style="margin-top:4px">${c.changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>`).join('')}
    <div class="note">Как обновляется программа: раз в неделю отправляй отчёт Claude (Профиль → Еженедельный отчёт → Скопировать). Он разберёт результаты и, если нужно, скорректирует тренировки или питание. Новая версия приходит в приложение сама при следующем открытии, твои записи при этом сохраняются.</div>
  </div>`;
  return {
    title: 'Программа', back: 'profile', backLabel: 'Профиль', large: false, html,
    mount: root => { const b = root.querySelector('#accept'); if (b) b.addEventListener('click', () => { store.update(st => { st.settings.planVersionAccepted = PLAN_VERSION; }); toast('Изменения приняты'); }); }
  };
}

/* ---------- Дуэль недели ---------- */
function DuelView(params = {}) {
  const s = store.get();
  const t = today();
  const wd = (parse(t).getDay() + 6) % 7;
  const defMon = wd >= 5 ? mondayOf(t) : mondayOf(addDays(t, -7));
  const mon = params.w || defMon;
  const mine = myCard(mon);
  const theirs = ((s.partner || {}).weeks || {})[mon] || null;
  const res = theirs ? compare(mine, theirs) : null;
  const ym = mon.slice(0, 7);
  const mp = monthProgress(ym);
  const partName = (s.partner && s.partner.name) || 'Партнёр';
  const PARTS = [['t', 'Тренировки', 'var(--c-train)'], ['f', 'Питание', 'var(--c-kcal)'], ['sw', 'Шаги и вода', 'var(--c-water)'], ['rec', 'Сон', 'var(--indigo)']];
  const col = (c, name) => `<div class="card" style="padding:12px">
    <div class="xs muted">${esc(name)}</div><div class="big-num">${c.score}<small>%</small></div>
    <div class="xs muted">${c.counted}/${c.target} трен. · еда ${c.foodOk}/7${c.streak ? ` · 🔥${c.streak}` : ''}</div>
    <div style="margin-top:8px" class="stack">${PARTS.map(([k, n, cl]) => `<div><div class="row between xs"><span class="muted">${n}</span><b>${c.parts[k]}%</b></div><div style="margin-top:2px">${bar(c.parts[k], 100, cl, null, 'thin')}</div></div>`).join('')}</div>
  </div>`;
  const history = Object.values((s.partner || {}).weeks || {}).sort((a, b) => b.week.localeCompare(a.week)).slice(0, 8).map(c => { const m = myCard(c.week); const r = compare(m, c); return `<button class="li tap" data-wk="${c.week}"><div class="li-main"><div class="li-title" style="font-size:15px">Неделя с ${fmtDate(c.week)}</div><div class="li-sub">${esc(m.name)} ${m.score}% · ${esc(c.name)} ${c.score}%</div></div><span class="chip ${r.winner === 'me' ? 'green' : r.winner ? 'orange' : ''}">${r.winner === 'me' ? 'победа' : r.winner ? 'реванш!' : 'ничья'}</span></button>`; }).join('');
  const html = `<div class="page">
    <div class="row between">
      <button class="nb-icon" data-nav="-7" aria-label="Предыдущая неделя">${icon('chevL')}</button>
      <div style="text-align:center"><div style="font-weight:600">${fmtDate(mon)} — ${fmtDate(addDays(mon, 6))}</div><div class="xs muted">${addDays(mon, 6) < t ? 'неделя завершена' : 'неделя идёт'}</div></div>
      <button class="nb-icon" data-nav="7" aria-label="Следующая неделя" ${addDays(mon, 7) > t ? 'disabled style="opacity:.3"' : ''}>${icon('chevR')}</button>
    </div>
    ${res ? `<div class="card" style="background:linear-gradient(135deg, rgba(255,149,0,.16), rgba(255,55,95,.12)), var(--card)"><div style="font-weight:700;font-size:21px">${esc(res.title)}</div><p class="prose" style="margin-top:6px;font-size:15px">${esc(res.text)}</p><div class="divider"></div><div class="small">💪 Вместе: <b>${res.together}</b> тренировок и <b>${res.foodTogether}</b> дней питания в норме${s.duel && s.duel.reward ? ` · 🎁 ${esc(s.duel.reward)}` : ''}</div></div>`
      : `<div class="banner"><div class="b-ic" style="background:var(--orange)">🏁</div><div class="grow"><b>Ждём итоги партнёра</b><p>Обменяйтесь кодами недели: «Поделиться итогами» → отправь в мессенджер; код партнёра вставь кнопкой ниже.</p></div></div>`}
    <div class="grid2">${col(mine, mine.name + ' (ты)')}${theirs ? col(theirs, theirs.name) : `<div class="card" style="display:grid;place-items:center;text-align:center"><div class="muted small">Итогов ${esc(partName)} за эту неделю пока нет</div></div>`}</div>
    <div class="btn-row"><button class="btn small" id="d-share">${icon('share')} Поделиться итогами</button><button class="btn small secondary" id="d-paste">Вставить код</button></div>

    <div class="card">
      <div class="card-h"><span class="ic" style="background:var(--green)">🎯</span>Общая цель месяца<span class="right"><button class="btn tiny gray" id="d-goal">Изменить</button></span></div>
      <div class="row between small"><span>Тренировки вместе</span><b class="num">${mp.sess}/${mp.goalSess}</b></div><div style="margin:4px 0 10px">${bar(mp.sess, mp.goalSess, 'var(--c-train)')}</div>
      <div class="row between small"><span>Дни питания в норме вместе</span><b class="num">${mp.food}/${mp.goalFood}</b></div><div style="margin-top:4px">${bar(mp.food, mp.goalFood, 'var(--c-kcal)')}</div>
      <div class="xs muted" style="margin-top:8px">Твоё — точно, партнёра — по присланным недельным кодам.${s.duel && s.duel.reward ? ` Награда победителю месяца: ${esc(s.duel.reward)}.` : ''}</div>
    </div>

    ${history ? `<div><div class="section-cap">История дуэлей</div><div class="list">${history}</div></div>` : ''}
    <div><div class="section-cap">Правила зачёта</div><div class="card"><ul class="ul">${SCORE_RULES.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
  </div>`;
  return {
    title: 'Дуэль недели', back: 'profile', backLabel: 'Профиль', large: false, html,
    mount: root => root.addEventListener('click', async e => {
      const n = e.target.closest('[data-nav]'); if (n) { go('profile/duel?w=' + addDays(mon, +n.dataset.nav), { replace: true }); return; }
      const wk = e.target.closest('[data-wk]'); if (wk) { go('profile/duel?w=' + wk.dataset.wk, { replace: true }); return; }
      if (e.target.closest('#d-share')) {
        const txt = shareText(mine);
        if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) { navigator.share({ text: txt }).catch(() => {}); }
        else { const ok = await copyText(txt); toast(ok ? 'Скопировано — отправь партнёру' : 'Не удалось скопировать'); }
        return;
      }
      if (e.target.closest('#d-paste')) {
        openSheet({
          title: 'Код партнёра', right: 'Добавить',
          body: `<label class="field"><span>Вставь сообщение с кодом FITDUEL1:…</span><textarea class="input" id="d-code" rows="5" placeholder="FITDUEL1:..."></textarea></label><div class="note">Код содержит только проценты выполнения плана и отметки дней — без веса, питания и медицинских данных.</div>`,
          onMount: async w => { try { const clip = await navigator.clipboard.readText(); if (clip && clip.includes('FITDUEL1:')) w.querySelector('#d-code').value = clip; } catch (_) {} },
          onRight: w => {
            try {
              const card = decodeCard(w.querySelector('#d-code').value);
              if (card.who === (s.settings.who || 'her')) { toast('Это твой собственный код'); return false; }
              store.update(st => { st.partner = st.partner || { weeks: {} }; st.partner.weeks = st.partner.weeks || {}; st.partner.weeks[card.week] = card; st.partner.name = card.name; });
              toast(`Итоги ${card.name} добавлены`);
              if (card.week !== mon) go('profile/duel?w=' + card.week, { replace: true });
            } catch (er) { toast(er.message || 'Не удалось прочитать код'); return false; }
          }
        });
        return;
      }
      if (e.target.closest('#d-goal')) {
        const g = s.duel || {};
        openSheet({
          title: 'Цель месяца', right: 'Сохранить',
          body: `<div class="list">
            <div class="li"><div class="li-main li-title">Тренировок вместе</div><input class="li-input" id="g-w" inputmode="numeric" value="${g.goalWorkouts || 30}"></div>
            <div class="li"><div class="li-main li-title">Дней питания в норме вместе</div><input class="li-input" id="g-f" inputmode="numeric" value="${g.goalFoodDays || 45}"></div>
          </div><label class="field"><span>Награда победителю</span><input class="input" id="g-r" placeholder="Например: проигравший готовит в выходные" value="${esc(g.reward || '')}"></label>
          <div class="note">Договоритесь о цели и награде вместе — и впишите одинаково на обоих телефонах.</div>`,
          onRight: w => { store.update(st => { st.duel = { goalWorkouts: +w.querySelector('#g-w').value || 30, goalFoodDays: +w.querySelector('#g-f').value || 45, reward: w.querySelector('#g-r').value.trim() }; }); }
        });
      }
    })
  };
}

/* ---------- Инструкция ---------- */
function HelpView() {
  const steps = [
    ['📲', 'Установка на iPhone', 'Открой ссылку в Safari → кнопка «Поделиться» → «На экран „Домой“». Приложение откроется на весь экран, будет работать без интернета, и система не будет очищать его данные.'],
    ['🏠', 'Главная', 'Что запланировано, что сделано, что осталось. Кольца: калории, белок, вода. Напоминания о взвешивании, замерах и копии появляются здесь.'],
    ['🏋️‍♀️', 'Тренировка', 'Тренировки → Начать. Вписывай вес и повторы, отмечай подход галочкой — запустится таймер отдыха. После каждого упражнения отметь, как далось, и была ли боль. В конце — «Тренировка выполнена».'],
    ['📈', 'Прогрессия', 'После тренировки приложение предложит новый вес, если все подходы выполнены на верхней границе без боли. Новый вес начинает действовать только после твоего подтверждения.'],
    ['🍽', 'Питание', 'В каждом приёме — блюдо из плана. «Съела» записывает его с граммовками рецепта. Можно заменить блюдо или записать своё из базы продуктов. Вода — нажатием на стаканы.'],
    ['📝', 'Отчёт дня', 'Карандаш на главной: вес, сон, шаги, самочувствие, сутки, менструация. Это занимает 30 секунд, а точность рекомендаций от этого растёт.'],
    ['⚖️', 'Вес и замеры', 'Вес — раз в неделю в выбранный день, утром. Замеры — раз в месяц. Графики и сравнение — в Профиль → Мои показатели.'],
    ['📊', 'Недельный отчёт', 'В выходные появляется оценка недели: похвала за выполненное или спокойная поддержка и одна цель. Отчёт можно скопировать и отправить Claude.'],
    ['💾', 'Резервная копия', 'Профиль → Данные → Сохранить копию. Делай раз в неделю, файл сохраняй в «Файлы» или iCloud.']
  ];
  const html = `<div class="page"><div class="stack">${steps.map(([e, t, d]) => `<div class="card row" style="align-items:flex-start"><div style="font-size:26px">${e}</div><div class="grow"><b>${t}</b><p class="small muted" style="margin-top:3px;line-height:1.45">${d}</p></div></div>`).join('')}</div>
  <div class="note">Важно: приложение не заменяет врача. Перед бегом и интенсивными нагрузками нужен допуск врача. При боли в груди, головокружении, перебоях в сердце сразу прекрати тренировку.</div></div>`;
  return { title: 'Как пользоваться', back: 'profile', backLabel: 'Профиль', html };
}
