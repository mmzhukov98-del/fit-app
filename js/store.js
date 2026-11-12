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

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = migrate(JSON.parse(raw));
    }
  } catch (e) {
    console.warn('Не удалось прочитать данные', e);
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

export function replaceAll(newState) {
  const m = migrate(newState);
  if (!m) throw new Error('Неверный формат файла');
  state = m;
  persist();
  listeners.forEach(l => l());
}

export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return 'Файл не похож на резервную копию';
  if (obj.app !== 'fitapp' || !obj.data) return 'Это не резервная копия этого приложения';
  const d = obj.data;
  if (typeof d.profile !== 'object' || typeof d.sessions !== 'object') return 'В файле нет нужных разделов';
  return null;
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
