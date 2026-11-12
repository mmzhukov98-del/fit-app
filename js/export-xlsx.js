// Excel-файл системы: программы обоих, меню с двумя порциями, рецепты, продукты и цены, журналы + записи этого телефона.
import { get } from './store.js';
import { buildXlsx } from './xlsx.js';
import { PROGRAMS } from './data/program.js';
import { EXERCISES } from './data/exercises.js';
import { FOODS, RECIPES, WEEK_MENU, SLOTS, PICK, PRICE_SRC } from './data/foods.js';
import { recipeTotals, portionGrams, HIM_PORTION, dayFact, dayLog } from './logic.js';

const r0 = n => Math.round(n);

export function buildSystemXlsx() {
  const s = get();
  const sheets = {};
  const him = [['Неделя', 'Фаза', 'Сессия', 'Тип', 'Содержание', 'Мин']];
  for (let w = 1; w <= 12; w++) {
    const ph = PROGRAMS.him.PHASES.find(p => w >= p.from && w <= p.to);
    for (const x of PROGRAMS.him.WEEKS[w]) {
      if (typeof x === 'string') {
        const wo = PROGRAMS.him.WORKOUTS[x];
        const items = wo.items.map(it => { const reps = it.early && w <= 4 ? it.early : it.reps; return `${EXERCISES[it.ex].short} ${ph.setsMod(w, it.sets)}×${reps[0]}${reps[1] !== reps[0] ? '–' + reps[1] : ''}${it.start ? ' @' + it.start + ' кг' : ''}`; }).join('; ');
        him.push([w, ph.name, x, 'Зал', `${wo.name}: ${items} · RIR ${ph.rir}`, wo.duration]);
      } else him.push([w, ph.name, x.k, { run: 'Бег', bike: 'Вело', mobility: 'Мобильность' }[x.kind], `${x.name}${x.optional ? ' (по желанию)' : ''}: ${x.desc}`, x.min]);
    }
  }
  sheets['Он — 12 недель'] = him;
  const her = [['Тренировка', 'Упражнение', 'Подходы', 'Повторы', 'Отдых, с', 'Старт, кг', 'Примечание']];
  for (const [k, wo] of Object.entries(PROGRAMS.her.WORKOUTS)) for (const it of wo.items) her.push([`${k} — ${wo.name}`, EXERCISES[it.ex].name, it.sets, it.reps.join('–'), it.rest, it.start, (it.note || '') + (it.swap ? ` · с ${it.swap.fromWeek}-й нед.: ${EXERCISES[it.swap.ex].name}` : '')]);
  her.push([]); her.push(['Фазы']);
  for (const p of PROGRAMS.her.PHASES) her.push([`Недели ${p.from}–${p.to}`, p.name, `RIR ${p.rir}`, p.desc]);
  sheets['Она — 10 недель'] = her;
  const menu = [['День', 'Приём', 'Блюдо', 'Она ккал', 'Она Б', 'Она Ж', 'Она У', 'Он ккал', 'Он Б', 'Он Ж', 'Он У']];
  WEEK_MENU.forEach((d, i) => {
    const slots = [...SLOTS.map(sl => [sl.name, d[sl.id] || []]), ['Перекус (он)', ['m_snack']]];
    for (const [sn, ids] of slots) for (const id of ids) {
      const a = recipeTotals(id, 1), b = recipeTotals(id, HIM_PORTION), only = RECIPES[id].himOnly;
      menu.push([i + 1, sn, RECIPES[id].name, only ? '' : r0(a.kcal), only ? '' : r0(a.p), only ? '' : r0(a.f), only ? '' : r0(a.c), r0(b.kcal), r0(b.p), r0(b.f), r0(b.c)]);
    }
  });
  sheets['Меню 7 дней'] = menu;
  const rec = [['Блюдо', 'Ингредиент', 'Она, г', 'Он, г', 'Время, мин', 'Как готовить']];
  for (const [id, r] of Object.entries(RECIPES)) r.ing.forEach(([fid, g], j) => rec.push([j ? '' : r.name, FOODS[fid].name, r.himOnly ? '' : portionGrams(id, g, 1), portionGrams(id, g, HIM_PORTION), j ? '' : r.time, j ? '' : r.steps.join(' ')]));
  sheets['Рецепты'] = rec;
  const foods = [['Продукт', 'Ккал/100 г', 'Б', 'Ж', 'У', 'Клетчатка', 'Готовый = сырой ×', '₽/кг', 'Источник цены', 'Как выбрать']];
  for (const [id, f] of Object.entries(FOODS)) foods.push([f.name, f.kcal, f.p, f.f, f.c, f.fib || 0, f.yield || 1, (s.prices || {})[id] || f.price, (s.prices || {})[id] ? 'моя цена' : PRICE_SRC[id] ? 'Магнит, Ставрополь: ' + PRICE_SRC[id] : 'не проверено', PICK[id] || '']);
  sheets['Продукты и цены'] = foods;
  // записи этого телефона
  const log = [['Дата', 'Сессия', 'Тип', 'Упражнение / бег', 'Подход', 'Вес, кг', 'Повторы', 'Км', 'Мин', 'Пульс', 'RPE', 'Боль', 'Комментарий']];
  for (const x of s.sessions) {
    if (x.kind && x.kind !== 'strength') { log.push([x.date, x.workout, x.kind, '', '', '', '', x.run && x.run.km || '', x.durationMin, x.run && x.run.hr || '', x.rpe, x.pain ? 'да' : '', x.note || '']); continue; }
    for (const e of x.exercises) e.sets.forEach((st, i) => { if (st.done) log.push([x.date, x.workout, 'зал', EXERCISES[e.ex] ? EXERCISES[e.ex].name : e.ex, i + 1, st.w, st.r, '', i === 0 ? x.durationMin : '', '', i === 0 ? x.rpe : '', e.pain ? 'да' : '', e.note || '']); });
  }
  sheets['Журнал тренировок'] = log;
  const daily = [['Дата', 'Вес', 'Сон, ч', 'Шаги', 'Ккал', 'Б', 'Ж', 'У', 'Вода, л', 'Энергия', 'Настроение', 'Отметки', 'Комментарий']];
  const dates = [...new Set([...Object.keys(s.daily), ...Object.keys(s.food)])].sort();
  for (const d of dates) { const x = s.daily[d] || {}, f = dayFact(d); daily.push([d, x.weight ?? '', x.sleep ?? '', x.steps ?? '', r0(f.kcal) || '', r0(f.p) || '', r0(f.f) || '', r0(f.c) || '', ((dayLog(d).water || 0) * 0.25) || '', x.energy ?? '', x.mood ?? '', [x.shift && 'сутки', x.period && 'менструация', x.sick && 'болезнь', x.cheat && 'свободный ужин'].filter(Boolean).join(', '), x.comment || '']); }
  sheets['Дневник дня'] = daily;
  const meas = [['Дата', ...s.measureFields.map(f => f.name)]];
  for (const m of s.measurements) meas.push([m.date, ...s.measureFields.map(f => m[f.id] ?? (m.extra || {})[f.id] ?? '')]);
  sheets['Замеры'] = meas;
  const duel = [['Неделя с', 'Партнёр', '% партнёра', 'Тренировки', 'Питание в норме', 'Серия']];
  for (const c of Object.values((s.partner || {}).weeks || {})) duel.push([c.week, c.name, c.score, `${c.counted}/${c.target}`, c.foodOk, c.streak]);
  sheets['Дуэль'] = duel;
  return buildXlsx(sheets);
}
