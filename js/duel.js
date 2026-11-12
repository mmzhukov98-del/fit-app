// Недельная дуэль: сравниваем выполнение ЛИЧНЫХ планов (не килограммы и не скорость).
import { get } from './store.js';
import { WHO, sessionInfo } from './data/program.js';
import { weekDates, addDays, mondayOf, today, foodAdherence, dayLog, targetsFor, weekTarget, isTraining, sessionsBetween, programWeek, fmt, parse } from './logic.js';

const PREFIX = 'FITDUEL1:';

// Тренировка «через боль» в зачёт не идёт
function sessionPainful(x) { return !!x.pain || (x.exercises || []).some(e => e.pain); }

export function duelScore(monday) {
  const s = get();
  const days = weekDates(monday);
  const end = days[6];
  const all = sessionsBetween(monday, end);
  const train = all.filter(isTraining);
  const counted = train.filter(x => !sessionPainful(x)).length;
  const target = Math.max(1, weekTarget(monday));
  const mob = all.length - train.length;
  const foodOk = days.filter(d => foodAdherence(d).ok).length;
  const stepsDays = days.filter(d => ((s.daily[d] || {}).steps || 0) >= s.targets.steps).length;
  const waterDays = days.filter(d => (dayLog(d).water || 0) * 250 >= targetsFor(d).waterMl).length;
  const sleepDays = days.filter(d => +((s.daily[d] || {}).sleep || 0) >= 7).length;
  // Одинаковая формула для обоих: всё — в долях от СВОЕГО плана и своих целей
  const t = Math.min(counted / target, 1);
  const f = foodOk / 7;
  const sw = (stepsDays + waterDays) / 14;
  const rec = sleepDays / 7;
  const score = Math.round((0.4 * t + 0.35 * f + 0.15 * sw + 0.1 * rec) * 100);
  const dayMarks = days.map(d => ({
    d,
    train: all.filter(x => x.date === d && isTraining(x)).map(x => x.kind === 'run' ? 'run' : x.kind === 'bike' ? 'bike' : 'gym'),
    food: foodAdherence(d).ok ? 1 : 0
  }));
  return { monday, score, parts: { t: Math.round(t * 100), f: Math.round(f * 100), sw: Math.round(sw * 100), rec: Math.round(rec * 100) }, counted, painful: train.length - counted, target, mob, foodOk, stepsDays, waterDays, sleepDays, days: dayMarks };
}

export function myStreak(uptoMonday) {
  let n = 0, m = uptoMonday;
  for (let i = 0; i < 52; i++) {
    const sc = duelScore(m);
    if (sc.score >= 80) { n++; m = addDays(m, -7); } else break;
  }
  return n;
}

export function myCard(monday) {
  const s = get();
  const sc = duelScore(monday);
  const card = { v: 1, who: WHO, name: s.profile.name || (WHO === 'him' ? 'Он' : 'Она'), week: monday, score: sc.score, parts: sc.parts, counted: sc.counted, target: sc.target, foodOk: sc.foodOk, mob: sc.mob, streak: myStreak(monday), days: sc.days };
  return card;
}

export function encodeCard(card) {
  const json = JSON.stringify(card);
  return PREFIX + btoa(unescape(encodeURIComponent(json)));
}
export function decodeCard(text) {
  const t = String(text || '').trim();
  const i = t.indexOf(PREFIX);
  if (i < 0) throw new Error('Не найден код дуэли (он начинается с FITDUEL1:)');
  const raw = t.slice(i + PREFIX.length).split(/\s/)[0];
  if (raw.length > 8000) throw new Error('Код слишком длинный — похоже, он повреждён');
  let obj;
  try { obj = JSON.parse(decodeURIComponent(escape(atob(raw)))); } catch (e) { throw new Error('Код повреждён — скопируй его целиком'); }
  const card = sanitizeCard(obj);
  if (!card) throw new Error('Код повреждён или от другой версии приложения');
  return card;
}

// Строгая проверка кода партнёра: принимаем только ожидаемые поля и диапазоны,
// всё остальное отбрасываем. Защищает экран дуэли от повреждённых или подделанных кодов.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
export function sanitizeCard(c) {
  if (!c || typeof c !== 'object' || c.v !== 1) return null;
  if (typeof c.week !== 'string' || !DATE_RE.test(c.week) || Number.isNaN(Date.parse(c.week))) return null;
  if (!['her', 'him'].includes(c.who)) return null;
  const score = int(c.score, 0, 100);
  if (score === null) return null;
  const parts = {};
  for (const k of ['t', 'f', 'sw', 'rec']) { const v = int((c.parts || {})[k], 0, 100); if (v === null) return null; parts[k] = v; }
  const counted = int(c.counted, 0, 50), target = int(c.target, 1, 50), foodOk = int(c.foodOk, 0, 7);
  if (counted === null || target === null || foodOk === null) return null;
  const days = Array.isArray(c.days) ? c.days.slice(0, 7).filter(d => d && typeof d.d === 'string' && DATE_RE.test(d.d)).map(d => ({
    d: d.d,
    train: Array.isArray(d.train) ? d.train.filter(x => ['gym', 'run', 'bike'].includes(x)).slice(0, 5) : [],
    food: d.food ? 1 : 0
  })) : [];
  const name = typeof c.name === 'string' ? c.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30) : '';
  return { v: 1, who: c.who, name: name || (c.who === 'him' ? 'Он' : 'Она'), week: c.week, score, parts, counted, target, foodOk, mob: int(c.mob, 0, 14) ?? 0, streak: int(c.streak, 0, 520) ?? 0, days };
}

export function shareText(card) {
  return `🏁 Мои итоги недели с ${card.week}: ${card.score}% плана, тренировки ${card.counted}/${card.target}, питание в норме ${card.foodOk}/7${card.streak ? `, серия ${card.streak} нед.` : ''}.\nОткрой «Мой фитнес» → Профиль → Дуэль → «Вставить код»:\n${encodeCard(card)}`;
}

// Результат сравнения — по-доброму
export function compare(mine, theirs) {
  const diff = mine.score - theirs.score;
  const me = mine.name, th = theirs.name;
  let title, text, winner = null;
  if (Math.abs(diff) <= 2) {
    title = '🤝 Ничья!';
    text = `${me} — ${mine.score}%, ${th} — ${theirs.score}%. Отличная командная неделя.`;
  } else {
    winner = diff > 0 ? 'me' : 'them';
    const W = diff > 0 ? mine : theirs, L = diff > 0 ? theirs : mine;
    title = `🏆 Победитель недели — ${W.name}!`;
    const weak = Object.entries(L.parts).sort((a, b) => a[1] - b[1])[0][0];
    const tip = { t: 'тренировках', f: 'питании', sw: 'шагах и воде', rec: 'сне и восстановлении' }[weak];
    text = `${W.name}: ${W.score}% плана против ${L.score}%. ${L.name} — догоняющий 🐢, есть запас в ${tip}. Реванш на следующей неделе? 😉`;
  }
  const together = (mine.counted || 0) + (theirs.counted || 0);
  const foodTogether = (mine.foodOk || 0) + (theirs.foodOk || 0);
  return { title, text, winner, together, foodTogether };
}

export function monthProgress(ym) {
  const s = get();
  const goal = s.duel || {};
  const mineSess = s.sessions.filter(x => x.date.startsWith(ym) && isTraining(x)).length;
  const mineFood = Object.keys(s.daily).concat(Object.keys(s.food)).filter((d, i, a) => a.indexOf(d) === i && d.startsWith(ym) && foodAdherence(d).ok).length;
  let theirSess = 0, theirFood = 0;
  for (const c of partnerWeeks()) {
    for (const d of c.days || []) {
      if (!d.d.startsWith(ym)) continue;
      theirSess += (d.train || []).length;
      theirFood += d.food ? 1 : 0;
    }
  }
  return { sess: mineSess + theirSess, food: mineFood + theirFood, goalSess: goal.goalWorkouts || 30, goalFood: goal.goalFoodDays || 45, mineSess, theirSess, mineFood, theirFood };
}

// Сохранённые итоги партнёра — только прошедшие проверку
export function partnerWeeks() {
  return Object.values((get().partner || {}).weeks || {}).map(sanitizeCard).filter(Boolean);
}
export function partnerWeek(monday) {
  return sanitizeCard(((get().partner || {}).weeks || {})[monday]);
}

export const SCORE_RULES = [
  'Тренировки — 40%: выполненные / запланированные на неделю по своей программе. Тренировки, отмеченные с болью, в зачёт не идут.',
  'Питание — 35%: дни, когда калории в пределах ±10% от своей цели и белок ≥ 90%. Свободный ужин (раз в месяц) не снижает балл.',
  'Шаги и вода — 15%: дни с выполненной целью по шагам + дни с нормой воды.',
  'Восстановление — 10%: ночи сна от 7 часов.',
  'Формула одинаковая для обоих: всё считается в процентах от своего плана (у неё 3 тренировки = 100%, у него 6 = 100%), поэтому шансы равные.',
  'Неделя ≥ 80% продлевает серию. Сравниваются проценты личных планов — не килограммы, не скорость и не рабочие веса.',
  'Не поощряем тренировки через боль, недосып и жёсткие ограничения в еде.'
];
