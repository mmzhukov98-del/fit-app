// Расчёты: даты, программа, прогрессия, питание, нагрузка, отчёты.
import { get, todayStr } from './store.js';
import { EXERCISES } from './data/exercises.js';
import { WORKOUTS, ORDER, phaseForWeek, TOTAL_WEEKS, MODE, WHO, weekPlan, sessionInfo } from './data/program.js';
import { FOODS, RECIPES, WEEK_MENU, SLOTS } from './data/foods.js';

/* ---------- Даты ---------- */
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return todayStr(d); }
export function diffDays(a, b) { // b - a в днях
  const A = parse(a), B = parse(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
}
export function weekday(s) { return (parse(s).getDay() + 6) % 7; } // 0 = Пн
export function mondayOf(s) { return addDays(s, -weekday(s)); }
export function weekDates(monday) { return Array.from({ length: 7 }, (_, i) => addDays(monday, i)); }
export function fmtDate(s, opts = {}) {
  const d = parse(s);
  const base = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  if (opts.weekday) return `${WD_LONG[weekday(s)]}, ${base}`;
  if (opts.year) return `${base} ${d.getFullYear()}`;
  return base;
}
export function fmtShort(s) { const d = parse(s); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`; }
export const today = () => todayStr();
const mod = (n, m) => ((n % m) + m) % m;

/* ---------- Числа ---------- */
export function r1(n) { return Math.round(n * 10) / 10; }
export function fmt(n, d = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: d });
}
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* ---------- Программа ---------- */
export function programWeek(date = today()) {
  const s = get();
  const d = diffDays(s.settings.programStart, date);
  return Math.floor(d / 7) + 1;
}
export function programInfo(date = today()) {
  const week = programWeek(date);
  const w = Math.min(Math.max(week, 1), TOTAL_WEEKS);
  return { week, weekClamped: w, phase: phaseForWeek(w), done: week > TOTAL_WEEKS, notStarted: week < 1 };
}
export function weightKey(item) { return item.ex + (item.heavy ? ':heavy' : ''); }

export function planItems(workoutId, date = today()) {
  const s = get();
  const { weekClamped: week, phase } = programInfo(date);
  return WORKOUTS[workoutId].items.map(it => {
    let item = { ...it };
    if (it.swap && week >= it.swap.fromWeek) item = { ...item, ex: it.swap.ex, reps: it.swap.reps, start: it.swap.start, swapped: true };
    if (it.early && week <= 4) item.reps = it.early;
    const key = weightKey(item);
    const ex = EXERCISES[item.ex];
    const sets = phase.setsMod(week, item.sets);
    let weight = s.workWeights[key];
    if (weight === undefined) weight = item.start;
    return { ...item, key, sets, weight, unit: ex.unit, rir: phase.rir, exData: ex };
  });
}

export function lastSession() {
  const s = get();
  return s.sessions.length ? s.sessions[s.sessions.length - 1] : null;
}
export function isTraining(sess) { return (sess.kind || 'strength') !== 'mobility'; }
// Неделя программы: даты [начало, конец]
export function programWeekRange(date = today()) {
  const s = get();
  const w = programWeek(date);
  const from = addDays(s.settings.programStart, (w - 1) * 7);
  return { week: w, from, to: addDays(from, 6) };
}
export function weekProgress(date = today()) {
  const { week, from, to } = programWeekRange(date);
  const plan = weekPlan(week) || [];
  const done = sessionsBetween(from, to);
  const doneKeys = new Set(done.map(x => x.workout));
  return { week, from, to, plan: plan.map(p => ({ ...p, done: doneKeys.has(p.k), info: sessionInfo(p.k, week) })) };
}
export function nextWorkoutId() {
  if (MODE === 'weekly') {
    const wp = weekProgress();
    const next = wp.plan.find(p => !p.done && p.kind !== 'mobility' && !p.optional);
    return next ? next.k : (wp.plan.find(p => !p.done) || {}).k || 'A';
  }
  const last = [...get().sessions].reverse().find(x => (x.kind || 'strength') === 'strength');
  if (!last) return 'A';
  return ORDER[(ORDER.indexOf(last.workout) + 1) % ORDER.length];
}
export function weekTarget(monday) {
  if (MODE === 'weekly') return (weekPlan(programWeek(monday)) || []).filter(p => p.kind !== 'mobility' && !p.optional).length;
  return get().targets.workoutsPerWeek;
}
export function myPortion() { return WHO === 'him' ? HIM_PORTION : 1; }
export const HIM_PORTION = 1.35;
export function sessionsOn(date) { return get().sessions.filter(x => x.date === date); }
export function activitiesOn(date) { return get().activities.filter(a => a.date === date); }
export function sessionsBetween(from, to) { return get().sessions.filter(x => x.date >= from && x.date <= to); }

export function sessionStats(sess) {
  let sets = 0, reps = 0, volume = 0;
  const weights = [];
  for (const e of sess.exercises) {
    for (const st of e.sets) {
      if (!st.done) continue;
      sets++;
      reps += +st.r || 0;
      volume += (+st.w || 0) * (+st.r || 0);
    }
    const top = Math.max(0, ...e.sets.filter(x => x.done).map(x => +x.w || 0));
    weights.push({ key: e.key, ex: e.ex, top });
  }
  const exDone = sess.exercises.filter(e => e.sets.some(x => x.done)).length;
  return { sets, reps, volume: Math.round(volume), exDone, exTotal: sess.exercises.length, weights };
}

export function historyFor(key) {
  const out = [];
  for (const sess of get().sessions) {
    const e = sess.exercises.find(x => x.key === key);
    if (!e) continue;
    const done = e.sets.filter(x => x.done);
    if (!done.length) continue;
    const top = Math.max(...done.map(x => +x.w || 0));
    const reps = done.map(x => +x.r || 0);
    out.push({ date: sess.date, sessionId: sess.id, top, reps, sets: done, effort: e.effort, pain: e.pain, planned: e.planned, note: e.note });
  }
  return out;
}

export function previousEntry(key, beforeSessionId) {
  const h = historyFor(key).filter(x => x.sessionId !== beforeSessionId);
  return h.length ? h[h.length - 1] : null;
}

function roundTo(v, step) { return Math.max(0, Math.round(v / step) * step); }

// Двойная прогрессия: предложение (никогда не применяется без подтверждения)
export function progression(item) {
  const ex = EXERCISES[item.ex];
  const hist = historyFor(item.key);
  const last = hist[hist.length - 1];
  const [lo, hi] = item.reps;
  const unitWord = ex.unit === 'sec' ? 'сек' : 'повт.';
  if (!last) return { type: 'start', text: ex.unit === 'kg' ? `Стартовый вес — ${fmt(item.weight, 1)} кг. Если он слишком лёгкий (запас больше 4 повторов) — увеличь и отметь это.` : `Начни с ${lo} ${unitWord}, следи за техникой.` };
  if (last.pain) return { type: 'pain', text: 'В прошлый раз была боль или дискомфорт — нагрузку не повышаем. Если боль повторится, остановись и обсуди упражнение с врачом/тренером.' };
  const plannedSets = last.planned ? last.planned.sets : item.sets;
  const allTop = last.sets.length >= plannedSets && last.reps.every(r => r >= hi);
  if (allTop && last.effort !== 'hard') {
    if (ex.unit === 'kg') {
      const inc = ex.inc || 2.5;
      const base = Math.max(last.top, item.weight);
      return { type: 'up', newWeight: roundTo(base + inc, ex.inc >= 2.5 ? 2.5 : 0.5), text: `В прошлый раз ${last.reps.join('/')} на ${fmt(last.top, 1)} кг без боли и с запасом — можно добавить +${fmt(inc, 1)} кг. Повторения вернутся к ${lo}.` };
    }
    return { type: 'up-reps', text: `Верхняя граница ${hi} ${unitWord} выполнена во всех подходах — можно усложнить: +${ex.unit === 'sec' ? '5 сек' : '2 повтора'} или медленнее темп.` };
  }
  if (allTop && last.effort === 'hard') return { type: 'hold', text: `Повторы выполнены, но было тяжело — закрепим вес ${fmt(last.top, 1)} кг ещё на одну тренировку.` };
  // два раза подряд ниже нижней границы
  const prev = hist[hist.length - 2];
  const below = e => e && e.reps.some(r => r < lo);
  if (ex.unit === 'kg' && below(last) && below(prev) && last.top > 0) {
    return { type: 'down', newWeight: roundTo(last.top * 0.9, ex.inc >= 2.5 ? 2.5 : 0.5), text: `Две тренировки подряд не получается ${lo} повторов — разумно снизить вес на ~10% и отработать технику.` };
  }
  return { type: 'hold', text: `Держим ${ex.unit === 'kg' ? fmt(Math.max(last.top, 0), 1) + ' кг' : 'нагрузку'} и добавляем повторы до ${hi} во всех подходах. Прошлый раз: ${last.reps.join('/')}.` };
}

/* ---------- Цикл и особые дни ---------- */
export function cycleInfo(date) {
  const { cycle } = get();
  if (!cycle.lastStart) return { known: false };
  const since = diffDays(cycle.lastStart, date);
  if (since < 0) return { known: true, luteal: false, period: false };
  const day = mod(since, cycle.length);
  const untilNext = cycle.length - day;
  return { known: true, day: day + 1, untilNext, luteal: untilNext >= 1 && untilNext <= 7, period: day < 5 };
}
export function dayFlags(date) {
  const d = get().daily[date] || {};
  const c = cycleInfo(date);
  return { shift: !!d.shift, sick: !!d.sick, period: !!d.period, cheat: !!d.cheat, luteal: WHO !== "him" && !!(c.known && c.luteal), cycle: c };
}

/* ---------- Питание ---------- */
export function foodById(id) {
  if (!id) return null;
  if (id.startsWith('custom:')) return get().customFoods[id.slice(7)] || null;
  return FOODS[id] || null;
}
export function macrosFor(foodId, grams, cooked = false) {
  const f = foodById(foodId);
  if (!f) return { kcal: 0, p: 0, f: 0, c: 0, fib: 0 };
  const raw = cooked && f.yield && f.yield !== 1 ? grams / f.yield : grams;
  const k = raw / 100;
  return { kcal: f.kcal * k, p: f.p * k, f: f.f * k, c: f.c * k, fib: (f.fib || 0) * k };
}
export function sumM(list) {
  return list.reduce((a, m) => ({ kcal: a.kcal + (m.kcal || 0), p: a.p + (m.p || 0), f: a.f + (m.f || 0), c: a.c + (m.c || 0), fib: a.fib + (m.fib || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fib: 0 });
}
// Порция: у неё — как в рецепте, у него — ×1,35 (сладкое и его личный перекус не масштабируются)
export function portionGrams(rid, g, factor = myPortion()) {
  const r = RECIPES[rid];
  if (!r || r.sweet || r.himOnly) return g;
  return Math.round((g * factor) / 5) * 5;
}
export function recipeTotals(rid, factor = myPortion()) {
  const r = RECIPES[rid];
  if (!r) return sumM([]);
  return sumM(r.ing.map(([id, g]) => macrosFor(id, portionGrams(rid, g, factor))));
}
export function recipeToEntry(rid, planned = true, factor = myPortion()) {
  const r = RECIPES[rid];
  return {
    id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: r.name, recipeId: rid, planned,
    items: r.ing.map(([id, g]) => { const gg = portionGrams(rid, g, factor); return { food: id, name: FOODS[id].name, g: gg, cooked: false, ...macrosFor(id, gg) }; })
  };
}
export function entryTotals(e) { return sumM(e.items); }
export function dayLog(date) { return get().food[date] || { slots: {}, water: 0, swaps: {} }; }
export function dayFact(date) {
  const log = dayLog(date);
  const all = [];
  for (const sl of Object.values(log.slots || {})) for (const e of sl) all.push(entryTotals(e));
  return sumM(all);
}
export function slotFact(date, slot) { return sumM(((dayLog(date).slots || {})[slot] || []).map(entryTotals)); }
export function hasFood(date) { const log = dayLog(date); return Object.values(log.slots || {}).some(a => a.length); }

export function menuIndex(date) { return mod(diffDays(get().settings.programStart, date), 7); }
export function planForDate(date) {
  const base = WEEK_MENU[menuIndex(date)];
  const swaps = (dayLog(date).swaps) || {};
  const plan = {};
  for (const sl of SLOTS) {
    plan[sl.id] = swaps[sl.id] || base[sl.id] || [];
  }
  if (WHO === 'him') { if (!swaps.brunch) plan.brunch = ['m_snack']; }
  else if (dayFlags(date).shift && !(swaps.brunch)) plan.brunch = ['s_shift'];
  return plan;
}
export function planTotals(date) {
  const plan = planForDate(date);
  return sumM(Object.values(plan).flat().map(id => recipeTotals(id)));
}

export function targetsFor(date) {
  const s = get();
  const t = s.targets;
  const fl = dayFlags(date);
  let kcal = t.kcal;
  const reasons = [];
  if (WHO === 'him') {
    const ss = sessionsOn(date).filter(isTraining);
    const long = ss.some(x => x.workout === 'L' || (x.durationMin || 0) >= 60 && x.kind === 'run') || (get().planned[date] === 'L');
    if (ss.length >= 2 || long) { kcal += t.longExtra || 200; reasons.push(`+${t.longExtra || 200} ккал — ${ss.length >= 2 ? 'две тренировки' : 'длительная'}`); }
  } else {
    if (fl.shift) { kcal += t.shiftExtra; reasons.push(`+${t.shiftExtra} ккал — сутки`); }
    if (fl.luteal) { kcal += t.lutealExtra; reasons.push(`+${t.lutealExtra} ккал — неделя перед менструацией`); }
  }
  if (fl.cheat) reasons.push('свободный ужин');
  const p = t.protein, f = t.fat;
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  const waterMl = t.waterMl + (sessionsOn(date).filter(isTraining).length ? 500 : 0) + (fl.shift ? 500 : 0);
  return { kcal, p, f, c, fib: t.fiber, waterMl, reasons, flags: fl };
}

export function foodAdherence(date) {
  if ((get().daily[date] || {}).cheat) return { logged: true, kcalOk: true, protOk: true, ok: true, diff: 0, cheat: true };
  if (!hasFood(date)) return { logged: false };
  const t = targetsFor(date), f = dayFact(date);
  const kcalOk = Math.abs(f.kcal - t.kcal) <= t.kcal * 0.1;
  const protOk = f.p >= t.p * 0.9;
  return { logged: true, kcalOk, protOk, ok: kcalOk && protOk, diff: Math.round(f.kcal - t.kcal) };
}

/* ---------- Нагрузка (условные единицы sRPE = минуты × RPE) ---------- */
export const ACT_TYPES = {
  run: { name: 'Бег', em: '🏃‍♀️', aerobic: true },
  walk: { name: 'Ходьба', em: '🚶‍♀️', aerobic: true },
  bike: { name: 'Велосипед', em: '🚴‍♀️', aerobic: true },
  swim: { name: 'Плавание', em: '🏊‍♀️', aerobic: true },
  ellip: { name: 'Эллипс / степпер', em: '⛰️', aerobic: true },
  stretch: { name: 'Растяжка / йога', em: '🧘‍♀️', aerobic: false },
  other: { name: 'Другое', em: '✨', aerobic: true }
};
export function sessionLoad(sess) { return Math.round((sess.durationMin || 0) * (sess.rpe || 6)); }
export function activityLoad(a) { return Math.round((a.min || 0) * (a.rpe || 4)); }
export function dayLoad(date) {
  const ss = sessionsOn(date), aa = activitiesOn(date);
  const kindOf = x => x.kind || 'strength';
  const strength = ss.filter(x => kindOf(x) === 'strength').reduce((a, x) => a + sessionLoad(x), 0);
  const cardio = ss.filter(x => kindOf(x) === 'run' || kindOf(x) === 'bike').reduce((a, x) => a + sessionLoad(x), 0) + aa.filter(a => ACT_TYPES[a.type]?.aerobic).reduce((a, x) => a + activityLoad(x), 0);
  const other = ss.filter(x => kindOf(x) === 'mobility').reduce((a, x) => a + sessionLoad(x), 0) + aa.filter(a => !ACT_TYPES[a.type]?.aerobic).reduce((a, x) => a + activityLoad(x), 0);
  const minutes = ss.reduce((a, x) => a + (x.durationMin || 0), 0) + aa.reduce((a, x) => a + (x.min || 0), 0);
  const total = strength + cardio + other;
  const fl = dayFlags(date);
  let label = 'Отдых', level = 0;
  if (total > 0) { label = 'Лёгкая'; level = 1; }
  if (total >= 200) { label = 'Умеренная'; level = 2; }
  if (total >= 400) { label = 'Высокая'; level = 3; }
  if (total >= 600) { label = 'Очень высокая'; level = 4; }
  const steps = (get().daily[date] || {}).steps || 0;
  return { strength, cardio, other, total, minutes, label, level, shift: fl.shift, steps };
}
export function rangeLoad(from, to) {
  let d = from; const days = [];
  while (d <= to) { days.push({ date: d, ...dayLoad(d) }); d = addDays(d, 1); }
  const sum = k => days.reduce((a, x) => a + x[k], 0);
  return {
    days, total: sum('total'), strength: sum('strength'), cardio: sum('cardio'), other: sum('other'), minutes: sum('minutes'),
    trainDays: days.filter(x => x.total > 0).length, restDays: days.filter(x => x.total === 0).length
  };
}

/* ---------- Вес и замеры ---------- */
export function weightEntries() {
  const d = get().daily;
  return Object.keys(d).filter(k => d[k] && d[k].weight).sort().map(k => ({ date: k, kg: +d[k].weight }));
}
export function weekAvgWeight(monday) {
  const end = addDays(monday, 6);
  const list = weightEntries().filter(x => x.date >= monday && x.date <= end);
  if (!list.length) return null;
  return { avg: list.reduce((a, x) => a + x.kg, 0) / list.length, n: list.length };
}
export function weeklyWeightSeries(weeks = 12) {
  const m = mondayOf(today());
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const mon = addDays(m, -7 * i);
    const w = weekAvgWeight(mon);
    if (w) out.push({ date: mon, y: r1(w.avg), n: w.n });
  }
  return out;
}
export function lastMeasurement() { const m = get().measurements; return m.length ? m[m.length - 1] : null; }
export function measurementBefore(date) {
  const m = get().measurements.filter(x => x.date < date);
  return m.length ? m[m.length - 1] : null;
}

/* ---------- Кольца дня ---------- */
export function dayRings(date) {
  const t = targetsFor(date), f = dayFact(date), log = dayLog(date);
  const d = get().daily[date] || {};
  const ss = sessionsOn(date);
  const planned = get().planned[date];
  const trainVal = ss.length ? 1 : 0;
  // Активность: минуты тренировок и кардио + шаги (1000 шагов ≈ 10 мин движения)
  const trainMin = ss.reduce((a, x) => a + (x.durationMin || 0), 0) + activitiesOn(date).reduce((a, x) => a + (x.min || 0), 0);
  const stepMin = Math.round((d.steps || 0) / 100);
  const actGoal = ss.length || (planned && planned !== 'rest') ? 45 : 30;
  const ratio = t.kcal ? f.kcal / t.kcal : 0;
  const kcalState = f.kcal === 0 ? 'none' : ratio < 0.9 ? 'under' : ratio <= 1.1 ? 'ok' : 'over';
  return {
    kcal: { v: f.kcal, max: t.kcal, state: kcalState },
    activity: { v: trainMin + stepMin, max: actGoal, trainMin, stepMin },
    protein: { v: f.p, max: t.p },
    train: { v: trainVal, max: 1, planned: planned && planned !== 'rest' },
    water: { v: (log.water || 0) * 250, max: t.waterMl },
    steps: { v: d.steps || 0, max: get().targets.steps }
  };
}

/* ---------- Еженедельный отчёт и «тренер» ---------- */
export function weekReport(monday) {
  const s = get();
  const days = weekDates(monday);
  const end = days[6];
  const t = today();
  const finished = end < t;
  const allSess = sessionsBetween(monday, end);
  const sess = allSess.filter(isTraining);
  const mobility = allSess.length - sess.length;
  const target = weekTarget(monday);
  const foodDays = days.filter(hasFood);
  const adh = days.map(foodAdherence);
  const kcalOk = adh.filter(a => a.logged && a.kcalOk).length;
  const protOk = adh.filter(a => a.logged && a.protOk).length;
  const waterOk = days.filter(d => (dayLog(d).water || 0) * 250 >= targetsFor(d).waterMl).length;
  const dl = days.map(d => s.daily[d] || {});
  const avg = arr => (arr.length ? arr.reduce((a, x) => a + x, 0) / arr.length : null);
  const steps = avg(dl.filter(x => x.steps).map(x => +x.steps));
  const sleep = avg(dl.filter(x => x.sleep).map(x => +x.sleep));
  const energy = avg(dl.filter(x => x.energy).map(x => +x.energy));
  const mood = avg(dl.filter(x => x.mood).map(x => +x.mood));
  const shifts = dl.filter(x => x.shift).length;
  const sick = dl.filter(x => x.sick).length;
  const lutealDays = days.filter(d => dayFlags(d).luteal || (s.daily[d] || {}).period).length;
  const wNow = weekAvgWeight(monday), wPrev = weekAvgWeight(addDays(monday, -7));
  const wDelta = wNow && wPrev ? wNow.avg - wPrev.avg : null;
  const pains = [];
  const ready = [];
  const keysSeen = new Set();
  for (const x of sess) for (const e of x.exercises) {
    if (e.pain) pains.push(EXERCISES[e.ex]?.short || e.ex);
    if (!keysSeen.has(e.key)) {
      keysSeen.add(e.key);
      const p = progression({ ...e.planned, ex: e.ex, key: e.key, weight: e.planned.weight, reps: e.planned.reps, sets: e.planned.sets });
      if (p.type === 'up' || p.type === 'up-reps') ready.push({ name: EXERCISES[e.ex]?.short || e.ex, text: p.text });
    }
  }
  const missedSessions = Math.max(0, target - sess.length);
  const meas = s.measurements.filter(m => m.date >= monday && m.date <= end);
  const measNow = meas.length ? meas[meas.length - 1] : null;
  const measPrev = measNow ? measurementBefore(measNow.date) : null;
  const load = rangeLoad(monday, end);

  const dataDays = days.filter(d => hasFood(d) || Object.keys(s.daily[d] || {}).length).length;
  const complete = foodDays.length >= 5 && (finished || t === end);
  const wScore = Math.min(sess.length / target, 1);
  const fScore = kcalOk / 7, pScore = protOk / 7;
  const score = 0.45 * wScore + 0.35 * fScore + 0.2 * pScore;
  const hardContext = shifts >= 3 || sick > 0 || lutealDays >= 3;

  let verdict = 'incomplete';
  if (complete) verdict = score >= 0.75 ? 'praise' : score >= 0.5 ? 'good' : 'support';

  const wins = [];
  if (sess.length >= target) wins.push(`все ${target} тренировки выполнены`);
  else if (sess.length > 0) wins.push(`${sess.length} ${plural(sess.length, 'тренировка', 'тренировки', 'тренировок')} из ${target}`);
  if (kcalOk >= 5) wins.push(`калории в норме ${kcalOk} ${plural(kcalOk, 'день', 'дня', 'дней')}`);
  if (protOk >= 5) wins.push(`белок в норме ${protOk} ${plural(protOk, 'день', 'дня', 'дней')}`);
  if (waterOk >= 4) wins.push(`вода в норме ${waterOk} ${plural(waterOk, 'день', 'дня', 'дней')}`);
  if (ready.length) wins.push(`готова к прогрессии в ${ready.length} ${plural(ready.length, 'упражнении', 'упражнениях', 'упражнениях')}`);
  if (wDelta !== null && wDelta <= -0.1 && wDelta >= -0.7) wins.push(`средний вес −${fmt(Math.abs(wDelta), 1)} кг`);

  // одна маленькая цель на следующую неделю — по самому слабому месту
  const weak = [
    { k: 'train', v: wScore, goal: sess.length < 2 ? 'Сделать хотя бы 2 тренировки — пусть даже укороченные (первые 4 упражнения).' : 'Добавить третью тренировку — можно короткую, 40 минут.' },
    { k: 'kcal', v: fScore, goal: 'Записывать питание каждый день — даже «примерно». Отметка «Съела по плану» — одно касание.' },
    { k: 'prot', v: pScore, goal: 'Белок: добавить творог или яйца в перекус — это +20–25 г белка.' },
    { k: 'water', v: waterOk / 7, goal: 'Вода: начинать день со стакана воды и держать бутылку на смене.' }
  ].sort((a, b) => a.v - b.v);

  let message = '';
  if (verdict === 'incomplete') {
    message = `Чтобы я честно оценил неделю, нужно заполнить питание хотя бы за 5 дней (сейчас — ${foodDays.length}) и внести тренировки.`;
  } else if (verdict === 'praise') {
    message = `Отличная неделя! ${capitalize(wins.join(', '))}. Именно такая регулярность и меняет фигуру — гордись собой.`;
  } else if (verdict === 'good') {
    message = `Хорошая неделя${wins.length ? ': ' + wins.join(', ') : ''}. Есть над чем поработать, но направление верное.`;
  } else {
    message = hardContext
      ? 'Неделя выдалась тяжёлой — смены, самочувствие или цикл. Это нормально, без самокритики. Возвращаемся к плану спокойно, с одной небольшой цели.'
      : 'Эта неделя получилась слабее плана — без осуждения, такое бывает у всех. Не нужно «наверстывать», просто возьмём одну небольшую цель.';
  }

  const advice = [];
  if (wDelta !== null) {
    if (wDelta < -0.8) advice.push({ k: 'fast', text: `Вес снижается быстро (−${fmt(Math.abs(wDelta), 1)} кг за неделю). Это может съедать мышцы — предлагаю добавить 100 ккал (углеводы).`, action: { type: 'kcal', delta: 100 } });
    else if (wDelta > 0.4 && lutealDays >= 3) advice.push({ k: 'water', text: 'Вес немного вырос — на этой неделе была фаза перед менструацией, это задержка воды. Выводы не делаем.' });
  }
  const plateau = checkPlateau(monday);
  if (plateau) advice.push(plateau);
  if (energy !== null && energy <= 2.4 || sleep !== null && sleep < 6) advice.push({ k: 'fatigue', text: 'Энергия или сон ниже нормы. Предлагаю облегчённую неделю: на 1 подход меньше в каждом упражнении, без повышения весов.', action: { type: 'deload' } });
  if (pains.length) advice.push({ k: 'pain', text: `Отмечалась боль: ${[...new Set(pains)].join(', ')}. В этих упражнениях вес не повышаем; если боль повторится — замена упражнения и консультация врача.` });
  const prevSess = sessionsBetween(addDays(monday, -7), addDays(monday, -1)).length;
  if (finished && sess.length < 2 && prevSess < 2) advice.push({ k: 'volume', text: 'Две недели подряд меньше двух тренировок. Возможно, план сейчас слишком объёмный для графика — можно перейти на 2 тренировки в неделю или сократить каждую до 45 минут.', action: { type: 'workouts', value: 2 } });

  return {
    monday, end, finished, complete, verdict, message, wins, goal: weak[0].goal, advice,
    sess, mobility, target, missedSessions, foodDays: foodDays.length, kcalOk, protOk, waterOk, steps, sleep, energy, mood,
    shifts, sick, lutealDays, wNow, wPrev, wDelta, pains: [...new Set(pains)], ready, measNow, measPrev, load, dataDays
  };
}

function checkPlateau(monday) {
  const s = get();
  const ws = [0, 1, 2, 3].map(i => weekAvgWeight(addDays(monday, -7 * i)));
  if (ws.some(x => !x)) return null;
  const change = ws[0].avg - ws[3].avg;
  if (Math.abs(change) > 0.3) return null;
  // соблюдение хорошее 3 недели
  let good = 0;
  for (let i = 0; i < 3; i++) {
    const days = weekDates(addDays(monday, -7 * i));
    if (days.filter(d => foodAdherence(d).kcalOk).length >= 5) good++;
  }
  if (good < 3) return null;
  if (s.targets.kcal <= 1450) return { k: 'plateau', text: 'Вес стоит 3 недели, но калорийность уже невысокая. Снижать дальше не будем — добавим шаги (+1500 в день) и проверим замеры: талия может уменьшаться и без изменений на весах.' };
  return { k: 'plateau', text: 'Вес стоит 3 недели при хорошем соблюдении плана. Предлагаю снизить калорийность на 100 ккал (за счёт углеводов) или добавить +1500 шагов в день.', action: { type: 'kcal', delta: -100 } };
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/* ---------- Отчёт для Claude ---------- */
export function claudeReport(monday) {
  const s = get();
  const rep = weekReport(monday);
  const days = weekDates(monday);
  const dayRows = days.map(d => {
    const f = dayFact(d), t = targetsFor(d), dd = s.daily[d] || {};
    return {
      date: d, kcal: Math.round(f.kcal), p: Math.round(f.p), f: Math.round(f.f), c: Math.round(f.c), target: t.kcal,
      water_ml: (dayLog(d).water || 0) * 250, weight: dd.weight ?? null, sleep: dd.sleep ?? null, steps: dd.steps ?? null,
      energy: dd.energy ?? null, mood: dd.mood ?? null, wellbeing: dd.wellbeing ?? null, shift: !!dd.shift, period: !!dd.period, sick: !!dd.sick, comment: dd.comment || ''
    };
  });
  const sessions = rep.sess.map(x => ({
    date: x.date, workout: x.workout, kind: x.kind || 'strength', run: x.run || null, week: x.week, min: x.durationMin, rpe: x.rpe, feel: x.feel, pain: !!x.pain, note: x.note || '',
    ex: x.exercises.map(e => ({ ex: e.key, plan: `${e.planned.sets}x${e.planned.reps.join('-')} @${e.planned.weight}`, sets: e.sets.filter(z => z.done).map(z => `${z.w}x${z.r}`).join(' '), effort: e.effort || '', pain: !!e.pain, note: e.note || '' }))
  }));
  const acts = s.activities.filter(a => a.date >= monday && a.date <= rep.end).map(a => ({ date: a.date, type: a.type, min: a.min, rpe: a.rpe, km: a.km || null }));
  const lines = [];
  lines.push(`ОТЧЁТ ЗА НЕДЕЛЮ ${fmtDate(monday)} — ${fmtDate(rep.end)} (неделя программы ${programWeek(monday)})`);
  lines.push(`Тренировки: ${rep.sess.length}/${rep.target}. Питание записано: ${rep.foodDays}/7 дней, калории в норме ${rep.kcalOk}, белок ${rep.protOk}, вода ${rep.waterOk}.`);
  lines.push(`Вес (ср. за неделю): ${rep.wNow ? fmt(rep.wNow.avg, 1) + ' кг' : 'нет данных'}${rep.wDelta !== null ? ` (${rep.wDelta > 0 ? '+' : ''}${fmt(rep.wDelta, 1)} к прошлой неделе)` : ''}.`);
  if (rep.measNow) lines.push(`Замеры ${rep.measNow.date}: талия ${rep.measNow.waist}, грудь ${rep.measNow.chest}, бёдра ${rep.measNow.hips}.`);
  lines.push(`Сон ср.: ${rep.sleep ? fmt(rep.sleep, 1) : '—'} ч, шаги ср.: ${rep.steps ? fmt(rep.steps) : '—'}, энергия: ${rep.energy ? fmt(rep.energy, 1) : '—'}/5. Суток: ${rep.shifts}.`);
  if (rep.pains.length) lines.push(`Боль/дискомфорт: ${rep.pains.join(', ')}.`);
  lines.push(`Оценка приложения: ${rep.verdict}.`);
  const json = {
    app: 'fitapp', kind: 'weekly-report', version: 2, who: WHO, week: monday, programWeek: programWeek(monday),
    targets: s.targets, workWeights: s.workWeights, days: dayRows, sessions, activities: acts,
    measurements: s.measurements.slice(-3), cycleKnown: !!s.cycle.lastStart
  };
  return { text: lines.join('\n'), json, full: lines.join('\n') + '\n\nДАННЫЕ (JSON):\n' + JSON.stringify(json) };
}

/* ---------- Напоминания внутри приложения ---------- */
export function dueReminders() {
  const s = get();
  const t = today();
  const r = s.settings.reminders;
  const out = [];
  const dd = s.daily[t] || {};
  if (r.weigh && weekday(t) === s.settings.weighDay && !dd.weight) out.push({ id: 'weigh', icon: 'scale', color: 'var(--c-weigh)', title: 'День взвешивания', text: 'Утром, после туалета, до завтрака и кофе, в одной и той же одежде.', act: 'weigh', actText: 'Внести вес' });
  const lm = lastMeasurement();
  if (r.measure && (lm ? diffDays(lm.date, t) >= 28 : !!s.dismissed.setup)) out.push({ id: 'measure', icon: 'ruler', color: 'var(--c-measure)', title: 'Пора сделать замеры', text: 'Раз в месяц: талия, грудь, бёдра. Утром, натощак, сантиметровая лента горизонтально.', act: 'measure', actText: 'Внести замеры' });
  const yesterday = addDays(t, -1);
  if (r.recovery && (s.daily[yesterday] || {}).shift && !sessionsOn(t).length) out.push({ id: 'recovery-' + t, icon: 'moon', color: 'var(--indigo)', title: 'День восстановления', text: 'Вчера были сутки — сегодня без силовой. Прогулка 20–30 минут, вода, сон.' });
  if (!s.profile.health && !s.measurements.length && !s.dismissed.setup) out.push({ id: 'setup', icon: 'person', color: 'var(--tint)', title: 'Настрой профиль', text: 'Открой файл настройки, который тебе прислали (Профиль → Данные → Восстановить из копии), или заполни профиль и первые замеры вручную.', act: 'setup', actText: 'Открыть' });
  const hasData = s.sessions.length || Object.keys(s.food).length > 2;
  if (r.backup && hasData && (!s.settings.lastBackup || diffDays(s.settings.lastBackup.slice(0, 10), t) >= 7)) out.push({ id: 'backup-' + mondayOf(t), icon: 'archive', color: 'var(--blue)', title: 'Резервная копия', text: 'Данные хранятся только на этом телефоне. Сохрани копию в «Файлы» — займёт 10 секунд.', act: 'backup', actText: 'Сохранить копию' });
  if (weekday(t) === 0 || weekday(t) === 6) {
    const mon = weekday(t) === 0 ? addDays(t, -7) : mondayOf(t);
    if (!s.dismissed['report-' + mon]) out.push({ id: 'report-' + mon, icon: 'chart', color: 'var(--tint)', title: 'Итоги недели готовы', text: 'Посмотри, что получилось, и получи оценку тренера.', act: 'report:' + mon, actText: 'Открыть отчёт' });
  }
  return out.filter(x => !s.dismissed[x.id]);
}

/* ---------- Календарь iPhone (.ics) ---------- */
export function buildICS() {
  const s = get();
  const t = today();
  const pad = n => String(n).padStart(2, '0');
  const dt = (date, hh, mm) => date.replace(/-/g, '') + 'T' + pad(hh) + pad(mm) + '00';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const ev = [];
  const add = (uid, start, end, title, desc, rrule) => {
    ev.push(['BEGIN:VEVENT', `UID:${uid}@fitapp.local`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${title}`, `DESCRIPTION:${desc}`, rrule ? `RRULE:${rrule}` : null,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT'].filter(Boolean).join('\r\n'));
  };
  const r = s.settings.reminders;
  if (r.weigh) {
    let d = t; while (weekday(d) !== s.settings.weighDay) d = addDays(d, 1);
    add('weigh', dt(d, 8, 0), dt(d, 8, 10), '⚖️ Взвешивание', 'Утром после туалета\\, до завтрака. Внеси вес в приложение.', `FREQ=WEEKLY;BYDAY=${BYDAY[s.settings.weighDay]}`);
  }
  if (r.measure) {
    const d0 = parse(t); const day = Math.min(28, s.settings.measureDay || 1);
    const first = new Date(d0.getFullYear(), d0.getMonth() + (d0.getDate() > day ? 1 : 0), day);
    const fd = todayStr(first);
    add('measure', dt(fd, 8, 15), dt(fd, 8, 30), '📏 Замеры тела', 'Талия\\, грудь\\, бёдра — внеси в приложение.', `FREQ=MONTHLY;BYMONTHDAY=${day}`);
  }
  if (r.food) add('food', dt(t, 21, 0), dt(t, 21, 5), '🍽 Дневник питания', 'Проверь\\, всё ли записано за сегодня.', 'FREQ=DAILY');
  if (r.backup) {
    let d = t; while (weekday(d) !== 6) d = addDays(d, 1);
    add('backup', dt(d, 20, 0), dt(d, 20, 5), '💾 Резервная копия фитнес-дневника', 'Профиль → Данные → Сохранить копию.', 'FREQ=WEEKLY;BYDAY=SU');
  }
  if (r.workout) {
    for (const [date, w] of Object.entries(s.planned)) {
      if (date < t || w === 'rest') continue;
      add('w-' + date, dt(date, 17, 0), dt(date, 18, 15), `🏋️‍♀️ Тренировка ${w}`, WORKOUTS[w] ? WORKOUTS[w].name : 'Тренировка', null);
    }
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//fitapp//RU', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Фитнес-дневник', ...ev, 'END:VCALENDAR'].join('\r\n');
}

/* ---------- CSV ---------- */
function csv(rows) {
  return '﻿' + rows.map(r => r.map(v => {
    const x = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x;
  }).join(';')).join('\n');
}
export function csvExports() {
  const s = get();
  const daily = [['Дата', 'Вес', 'Сон', 'Шаги', 'Самочувствие', 'Энергия', 'Настроение', 'Сутки', 'Менструация', 'Болезнь', 'Ккал', 'Белки', 'Жиры', 'Углеводы', 'Вода мл', 'Комментарий']];
  const dates = new Set([...Object.keys(s.daily), ...Object.keys(s.food)]);
  [...dates].sort().forEach(d => {
    const x = s.daily[d] || {}, f = dayFact(d);
    daily.push([d, x.weight, x.sleep, x.steps, x.wellbeing, x.energy, x.mood, x.shift ? 1 : 0, x.period ? 1 : 0, x.sick ? 1 : 0, Math.round(f.kcal), Math.round(f.p), Math.round(f.f), Math.round(f.c), (dayLog(d).water || 0) * 250, x.comment]);
  });
  const sets = [['Дата', 'Тренировка', 'Упражнение', 'Подход', 'Вес', 'Повторы', 'Сложность', 'Боль', 'План']];
  s.sessions.forEach(x => x.exercises.forEach(e => e.sets.forEach((st, i) => {
    if (st.done) sets.push([x.date, x.workout, EXERCISES[e.ex]?.name || e.ex, i + 1, st.w, st.r, e.effort, e.pain ? 1 : 0, `${e.planned.sets}x${e.planned.reps.join('-')}`]);
  })));
  const meas = [['Дата', ...s.measureFields.map(f => f.name)]];
  s.measurements.forEach(m => meas.push([m.date, ...s.measureFields.map(f => (m[f.id] ?? (m.extra || {})[f.id] ?? ''))]));
  const food = [['Дата', 'Приём', 'Блюдо', 'Продукт', 'Граммы', 'Ккал', 'Б', 'Ж', 'У']];
  Object.keys(s.food).sort().forEach(d => {
    const slots = s.food[d].slots || {};
    for (const [sl, arr] of Object.entries(slots)) arr.forEach(e => e.items.forEach(it => food.push([d, SLOTS.find(z => z.id === sl)?.name || sl, e.name, it.name, it.g, Math.round(it.kcal), r1(it.p), r1(it.f), r1(it.c)])));
  });
  return { 'дневник.csv': csv(daily), 'тренировки.csv': csv(sets), 'замеры.csv': csv(meas), 'питание.csv': csv(food) };
}
