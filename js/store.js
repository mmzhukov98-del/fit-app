// Хранилище: всё локально в браузере (localStorage), без серверов и регистрации.
import { PLAN_VERSION } from './data/plan-meta.js';

const KEY = 'fitapp.data.v1';
const SCHEMA = 1;

export function todayStr(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x;
}

export function defaultState() {
  const start = todayStr();
  return {
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    profile: {
      name: '',
      age: 23, height: 160, startWeight: 60, goalText: 'Формы: ягодицы и ноги, меньше жира на животе и талии, рельеф. Без накачанных плеч.',
      goals: ['Ягодицы и ноги', 'Снижение жира (живот, талия)', 'Рельеф и подтянутость'],
      deadline: '2027-07-01',
      targetWeight: '55–57',
      targetWaist: 74,
      level: 'Новичок', experience: '',
      health: '',
      food: '',
      work: ''
    },
    targets: { kcal: 1600, protein: 110, fat: 55, shiftExtra: 200, lutealExtra: 150, longExtra: 200, fiber: 25, waterMl: 1800, steps: 6000, workoutsPerWeek: 3 },
    cycle: { lastStart: null, length: 28 },
    settings: {
      theme: 'auto',
      who: 'her',
      programStart: todayStr(mondayOf()),
      weighDay: 0, // 0 = понедельник
      measureDay: 1, // число месяца
      reminders: { workout: true, weigh: true, measure: true, food: false, recovery: true, backup: true },
      lastBackup: null,
      cardioCleared: false,
      cookForTwo: true,
      planVersionSeen: PLAN_VERSION,
      planVersionAccepted: PLAN_VERSION
    },
    workWeights: {},     // exId -> текущий рабочий вес (подтверждённый)
    sessions: [],        // завершённые тренировки
    active: null,        // идущая тренировка
    planned: {},         // 'YYYY-MM-DD' -> 'A'|'B'|'C'|'rest'
    activities: [],      // кардио и прочая активность
    food: {},            // 'YYYY-MM-DD' -> { slots: {slotId: [entry]}, water: n, swaps: {slotId: [recipeId]} }
    customFoods: {},     // id -> {name, kcal, p, f, c}
    daily: {},           // 'YYYY-MM-DD' -> {weight, sleep, steps, wellbeing, energy, mood, comment, shift, period, sick}
    measurements: [],    // [{date, waist, chest, hips, extra:{}}]
    measureFields: [
      { id: 'waist', name: 'Талия' },
      { id: 'chest', name: 'Грудь' },
      { id: 'hips', name: 'Бёдра' }
    ],
    shopDone: {},
    prices: {},
    budget: 10000,
    partner: { name: '', weeks: {} },
    duel: { goalWorkouts: 30, goalFoodDays: 45, reward: '' },
    dismissed: {},
    acceptedSuggestions: [],
    _seeded: false
  };
}

let state = null;
const listeners = new Set();

export let loadProblem = null;
export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) {
      state = migrate(JSON.parse(raw));
      if (state && validateData(state)) { loadProblem = validateData(state); }
    }
  } catch (e) {
    console.warn('Не удалось прочитать данные', e);
    state = null;
  }
  if (raw && !state) {
    // данные повреждены: не затираем их молча — откладываем копию для восстановления
    try { localStorage.setItem('fitapp.data.corrupt.' + Date.now(), raw); } catch (_) { /* нет места */ }
    loadProblem = 'Сохранённые данные не прочитались. Их копия отложена в памяти браузера — напиши Claude, чтобы восстановить.';
  }
  if (!state) {
    state = defaultState();
    // личные исходные данные не хранятся в коде — импортируются из файла настройки
    persist();
  }
  return state;
}

// Реальные исходные данные из интервью (не выдуманные результаты)
function seedFromInterview(s) {
  const d = todayStr();
  s.daily[d] = { ...(s.daily[d] || {}), weight: 60, fromInterview: true };
  s.measurements.push({ date: d, waist: 80, chest: 90, hips: 99, extra: {}, note: 'Из интервью' });
  s._seeded = true;
}

function migrate(s) {
  const base = defaultState();
  if (!s || typeof s !== 'object') return null;
  // аккуратно дополняем новые поля, не трогая данные пользователя
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.settings = { ...base.settings, ...s.settings, reminders: { ...base.settings.reminders, ...(s.settings && s.settings.reminders) } };
  s.targets = { ...base.targets, ...s.targets };
  s.profile = { ...base.profile, ...s.profile };
  s.cycle = { ...base.cycle, ...s.cycle };
  s.schema = SCHEMA;
  return s;
}

let saveTimer = null;
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error(e);
    alert('Не удалось сохранить данные: память браузера заполнена. Сделайте резервную копию в Профиле.');
  }
}

export function get() { return state; }

export function update(fn, { silent = false } = {}) {
  fn(state);
  clearTimeout(saveTimer);
  persist();
  if (!silent) listeners.forEach(l => l());
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Снимок текущих данных перед восстановлением из файла — чтобы можно было вернуть как было
const SNAP_KEY = 'fitapp.snapshot.beforeRestore';
export function getSnapshotInfo() {
  try { const raw = localStorage.getItem(SNAP_KEY); if (!raw) return null; const o = JSON.parse(raw); return { at: o.at, size: raw.length }; } catch (e) { return null; }
}
export function undoRestore() {
  const raw = localStorage.getItem(SNAP_KEY);
  if (!raw) throw new Error('Снимка нет');
  const o = JSON.parse(raw);
  const m = migrate(o.data);
  if (!m) throw new Error('Снимок повреждён');
  state = m;
  persist();
  localStorage.removeItem(SNAP_KEY);
  listeners.forEach(l => l());
}

export function replaceAll(newState) {
  // глубокая копия, чтобы не держать ссылку на объект из файла
  const m = migrate(JSON.parse(JSON.stringify(newState)));
  if (!m) throw new Error('Неверный формат файла');
  const err = validateData(m);
  if (err) throw new Error(err);
  try { localStorage.setItem(SNAP_KEY, JSON.stringify({ at: new Date().toISOString(), data: state })); }
  catch (e) { throw new Error('Не хватает памяти, чтобы сохранить страховочную копию. Сначала сделай резервную копию в файл.'); }
  state = m;
  persist();
  listeners.forEach(l => l());
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Полная проверка структуры данных (после migrate, т.е. с заполненными по умолчанию полями)
export function validateData(d) {
  if (!isObj(d)) return 'Нет данных';
  for (const k of ['profile', 'targets', 'settings', 'cycle', 'workWeights', 'planned', 'food', 'customFoods', 'daily', 'shopDone', 'dismissed']) if (!isObj(d[k])) return `Раздел «${k}» повреждён`;
  for (const k of ['sessions', 'activities', 'measurements', 'measureFields', 'acceptedSuggestions']) if (!Array.isArray(d[k])) return `Раздел «${k}» повреждён`;
  for (const k of ['kcal', 'protein', 'fat']) { const v = d.targets[k]; if (typeof v !== 'number' || !(v > 0 && v < 10000)) return 'Цели по КБЖУ повреждены'; }
  if (typeof d.settings.programStart !== 'string' || !DATE.test(d.settings.programStart)) return 'Дата старта программы повреждена';
  if (d.settings.who && !['her', 'him'].includes(d.settings.who)) return 'Неизвестный профиль';
  for (const x of d.sessions) {
    if (!isObj(x) || typeof x.date !== 'string' || !DATE.test(x.date) || typeof x.workout !== 'string' || !Array.isArray(x.exercises)) return 'Записи тренировок повреждены';
    for (const e of x.exercises) if (!isObj(e) || !Array.isArray(e.sets) || !isObj(e.planned) || !Array.isArray(e.planned.reps)) return 'Подходы в тренировках повреждены';
  }
  for (const [dt, v] of Object.entries(d.daily)) if (!DATE.test(dt) || !isObj(v)) return 'Дневник дня повреждён';
  for (const [dt, v] of Object.entries(d.food)) {
    if (!DATE.test(dt) || !isObj(v) || (v.slots && !isObj(v.slots))) return 'Дневник питания повреждён';
    if (v.extras && (!Array.isArray(v.extras) || v.extras.some(x => !isObj(x)))) return 'Записи «сверх плана» повреждены';
    for (const arr of Object.values(v.slots || {})) { if (!Array.isArray(arr)) return 'Дневник питания повреждён'; for (const e of arr) if (!isObj(e) || !Array.isArray(e.items)) return 'Записи питания повреждены'; }
  }
  for (const m of d.measurements) if (!isObj(m) || typeof m.date !== 'string' || !DATE.test(m.date)) return 'Замеры повреждены';
  for (const a of d.activities) if (!isObj(a) || typeof a.date !== 'string' || !DATE.test(a.date)) return 'Активности повреждены';
  if (d.active && (!isObj(d.active) || !Array.isArray(d.active.exercises))) return 'Активная тренировка повреждена';
  return null;
}

export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return 'Файл не похож на резервную копию';
  if (obj.app !== 'fitapp' || !isObj(obj.data)) return 'Это не резервная копия этого приложения';
  if (typeof obj.schema === 'number' && obj.schema > SCHEMA) return 'Копия создана более новой версией приложения — сначала обнови приложение';
  const m = migrate(JSON.parse(JSON.stringify(obj.data)));
  return m ? validateData(m) : 'В файле нет нужных разделов';
}

export function backupObject() {
  return { app: 'fitapp', kind: 'backup', exportedAt: new Date().toISOString(), schema: SCHEMA, planVersion: PLAN_VERSION, data: state };
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch (e) { /* не критично */ }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
