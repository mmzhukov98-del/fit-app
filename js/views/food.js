// Питание: дневник, план vs факт, меню, рецепты, покупки, готовка, таблица продуктов, история.
import * as store from '../store.js';
import { g } from '../gender.js';
import { icon, esc, rings, bar, barChart, toast, confirmDialog, sw } from '../ui.js';
import { WHO } from '../data/program.js';
import { today, fmtDate, addDays, mondayOf, weekDates, WD_SHORT, parse, targetsFor, dayFact, slotFact, planForDate, planTotals, recipeTotals,
  recipeToEntry, dayLog, hasFood, foodAdherence, macrosFor, fmt, r1, menuIndex, entryTotals, fmtShort, portionGrams, HIM_PORTION, EXTRA_CATS, EXTRA_SIZES } from '../logic.js';
import { FOODS, FOOD_CATS, RECIPES, SLOTS, WEEK_MENU, PREP_PLAN, COOKING_GUIDE, PICK, PRICE_SRC, PRICE_DATE, PRICE_SHOP } from '../data/foods.js';
import { entrySheet, dishPicker, saveEntry } from './sheets.js';
import { go } from '../app.js';

export const foodRoutes = [
  { re: /^food$/, view: FoodDiary },
  { re: /^food\/menu$/, view: MenuView },
  { re: /^food\/recipe\/([a-z_]+)$/, view: RecipeView },
  { re: /^food\/shop$/, view: ShopView },
  { re: /^food\/guide$/, view: GuideView },
  { re: /^food\/table$/, view: TableView },
  { re: /^food\/history$/, view: HistoryView }
];

let foodDate = null;

function FoodDiary(params = {}) {
  const t = today();
  if (params.d) foodDate = params.d;
  if (!foodDate || foodDate > t) foodDate = t;
  const date = foodDate;
  const tg = targetsFor(date);
  const f = dayFact(date);
  const plan = planForDate(date);
  const pTot = planTotals(date);
  const log = dayLog(date);
  const left = Math.round(tg.kcal - f.kcal);
  const mon = mondayOf(date);
  const water = log.water || 0;
  const glasses = Math.max(8, Math.ceil(tg.waterMl / 250));

  const slotsHtml = SLOTS.map(sl => {
    const ids = plan[sl.id] || [];
    const entries = (log.slots || {})[sl.id] || [];
    if (!ids.length && !entries.length && sl.optional) return `<button class="btn gray small" data-add-slot="${sl.id}" style="width:100%">${icon('plus')} ${sl.name}</button>`;
    const sf = slotFact(date, sl.id);
    const pk = ids.reduce((a, id) => a + recipeTotals(id).kcal, 0);
    const allEaten = ids.length && ids.every(id => entries.some(e => e.recipeId === id));
    return `<div class="card meal-card">
      <div class="meal-h"><span class="em">${sl.em}</span><div><b>${sl.name}</b></div>
        <div class="meal-kcal">${entries.length ? fmt(sf.kcal) : '—'}<small> / ${fmt(pk)} ккал</small></div></div>
      ${ids.map(id => {
        const r = RECIPES[id], rt = recipeTotals(id);
        const eaten = entries.find(e => e.recipeId === id);
        return `<div class="plan-dish" data-key="${id}">
          <button class="dish-em" style="background:${r.bg}" data-go="food/recipe/${id}" aria-label="Рецепт">${r.em}</button>
          <button class="grow" style="text-align:left" data-go="food/recipe/${id}"><b>${esc(r.name)}</b><span>${eaten ? `${fmt(entryTotals(eaten).kcal)} ккал · записано` : `${fmt(rt.kcal)} ккал · Б ${fmt(rt.p)} · Ж ${fmt(rt.f)} · У ${fmt(rt.c)}`}</span></button>
          ${eaten ? `<button class="check on" data-edit="${sl.id}:${eaten.id}" aria-label="Изменить запись">${icon('check')}</button>` : `<button class="btn tiny" data-eat="${sl.id}:${id}">${g('Съела', 'Съел')}</button>`}
        </div>`;
      }).join('')}
      ${entries.filter(e => !ids.includes(e.recipeId)).length ? `<div style="margin-top:10px">${entries.filter(e => !ids.includes(e.recipeId)).map(e => { const et = entryTotals(e); return `<button class="entry" style="width:100%;text-align:left" data-edit="${sl.id}:${e.id}"><div class="grow"><b>${esc(e.name)}</b><span>${e.items.map(i => `${esc(i.name)} ${fmt(i.g)} г`).join(', ')}</span></div><div class="k">${fmt(et.kcal)}</div>${icon('chev', 'chev')}</button>`; }).join('')}</div>` : ''}
      <div class="row" style="gap:16px">
        <button class="add-line" data-add="${sl.id}">${icon('plusCircle')} Записать</button>
        ${ids.length ? `<button class="add-line" data-swap="${sl.id}" style="color:var(--label-2)">${icon('refresh')} Заменить</button>` : ''}
        ${!allEaten && ids.length > 1 ? `<button class="add-line" data-eatall="${sl.id}" style="color:var(--green)">${icon('check')} Всё по плану</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const html = `
  <div class="page">
    <div class="week-strip" id="wk">${weekDates(mon).map((d, i) => `<button class="ws-day ${d === t ? 'today' : ''} ${d === date ? 'sel' : ''}" data-day="${d}" ${d > t ? 'disabled style="opacity:.35"' : ''}><span class="wd">${WD_SHORT[i]}</span><span class="d">${parse(d).getDate()}</span></button>`).join('')}</div>

    <div class="card">
      <div class="row" style="gap:16px">
        ${rings([{ v: f.kcal, max: tg.kcal, color: 'var(--c-kcal)' }], 112, 14, 0, `<div><div class="mid-num" style="line-height:1">${fmt(Math.abs(left))}</div><div class="xs muted">${left >= 0 ? 'осталось' : 'сверх'}</div></div>`)}
        <div class="grow">
          <div class="row between small"><span class="muted">Цель</span><b class="num">${fmt(tg.kcal)}</b></div>
          <div class="row between small" style="margin-top:4px"><span class="muted">Съедено</span><b class="num" style="color:var(--c-kcal)">${fmt(f.kcal)}</b></div>
          <div class="row between small" style="margin-top:4px"><span class="muted">По плану</span><b class="num">${fmt(pTot.kcal)}</b></div>
        </div>
      </div>
      <div class="grid3" style="margin-top:14px">
        ${[['Белки', f.p, tg.p, 'var(--c-protein)'], ['Жиры', f.f, tg.f, 'var(--c-fat)'], ['Углеводы', f.c, tg.c, 'var(--c-carb)']].map(([n, v, m, c]) => `<div class="macro"><div class="muted">${n}</div><b class="num">${fmt(v)}</b><span class="muted"> / ${m} г</span><div style="margin-top:5px">${bar(v, m, c)}</div></div>`).join('')}
      </div>
      ${tg.reasons.length ? `<div class="chips" style="margin-top:12px">${tg.reasons.map(r => `<span class="chip on">${esc(r)}</span>`).join('')}</div>` : ''}
      ${date < t && hasFood(date) && Math.abs(f.kcal - pTot.kcal) > pTot.kcal * 0.15 ? `<div class="sugg info">Факт отличается от плана на ${fmt(Math.abs(Math.round(f.kcal - pTot.kcal)))} ккал. Это просто информация — один день ничего не решает.</div>` : ''}
    </div>

    <div class="card">
      <div class="card-h"><span class="ic" style="background:var(--c-water)">${icon('drop')}</span>Вода <span class="xs muted" style="font-weight:400">· стакан 250 мл</span><span class="right">${fmt(water * 0.25, 2)} / ${fmt(tg.waterMl / 1000, 1)} л</span></div>
      <div class="water" id="water">${Array.from({ length: glasses }, (_, i) => `<button class="${i < water ? 'on' : ''}" data-w="${i + 1}" aria-label="${i + 1} стакан"></button>`).join('')}</div>
    </div>

    ${slotsHtml}

    ${(log.extras || []).length ? `<div class="card">
      <div class="card-h"><span class="ic" style="background:var(--orange)">🍕</span>Сверх плана<span class="right">${(log.extras || []).length} шт.</span></div>
      ${(log.extras || []).map(x => `<button class="entry" style="width:100%;text-align:left" data-extra="${esc(x.id)}"><span style="font-size:20px">${(EXTRA_CATS[x.cat] || EXTRA_CATS.other).em}</span><div class="grow"><b>${esc(x.what || (EXTRA_CATS[x.cat] || EXTRA_CATS.other).name)}</b><span>${esc((EXTRA_CATS[x.cat] || EXTRA_CATS.other).name)} · ${EXTRA_SIZES[x.size] || ''}${x.kcal ? ` · ${fmt(x.kcal)} ккал` : ' · ккал не известны'}</span></div>${icon('chev', 'chev')}</button>`).join('')}
      <button class="add-line" data-extra-add="1">${icon('plusCircle')} Добавить</button>
    </div>` : `<button class="btn gray small" data-extra-add="1" style="width:100%">🍕 Было что-то сверх плана?</button>`}

    <div class="list">
      <button class="li tap with-ic" data-go="food/menu"><div class="li-ic" style="background:var(--tint)">${icon('calendar')}</div><div class="li-main li-title">Меню на 7 дней</div>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="food/shop"><div class="li-ic" style="background:var(--green)">${icon('cart')}</div><div class="li-main li-title">Список покупок</div>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="food/guide"><div class="li-ic" style="background:var(--orange)">${icon('cooking')}</div><div class="li-main li-title">Как готовить и заготовки</div>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="food/table"><div class="li-ic" style="background:var(--indigo)">${icon('list')}</div><div class="li-main li-title">КБЖУ продуктов</div>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-go="food/history"><div class="li-ic" style="background:var(--blue)">${icon('chart')}</div><div class="li-main li-title">История питания</div>${icon('chev', 'chev')}</button>
    </div>
  </div>`;

  return {
    title: 'Питание', eyebrow: date === t ? 'Сегодня' : fmtDate(date, { weekday: true }), html,
    right: `<button class="nb-icon" data-add-any="1" aria-label="Добавить">${icon('plus')}</button>`,
    mount: root => {
      document.getElementById('navbar').addEventListener('click', e => { if (e.target.closest('[data-add-any]')) entrySheet(date, guessSlot()); });
      root.addEventListener('click', async e => {
        const day = e.target.closest('[data-day]');
        if (day) { foodDate = day.dataset.day; window.__rerender(); return; }
        const wb = e.target.closest('[data-w]');
        if (wb) {
          const n = +wb.dataset.w;
          store.update(s => { s.food[date] = s.food[date] || { slots: {}, water: 0, swaps: {} }; s.food[date].water = (s.food[date].water || 0) === n ? n - 1 : n; });
          return;
        }
        const eat = e.target.closest('[data-eat]');
        if (eat) { const [sl, id] = eat.dataset.eat.split(':'); saveEntry(date, sl, recipeToEntry(id, true)); toast('Отмечено по плану'); return; }
        const ea = e.target.closest('[data-eatall]');
        if (ea) {
          const sl = ea.dataset.eatall;
          const entries = (dayLog(date).slots || {})[sl] || [];
          (planForDate(date)[sl] || []).forEach(id => { if (!entries.some(x => x.recipeId === id)) saveEntry(date, sl, recipeToEntry(id, true)); });
          toast('Отмечено по плану'); return;
        }
        const add = e.target.closest('[data-add]');
        if (add) { addChooser(date, add.dataset.add); return; }
        const as = e.target.closest('[data-add-slot]');
        if (as) { addChooser(date, as.dataset.addSlot); return; }
        const swp = e.target.closest('[data-swap]');
        if (swp) { dishPicker(date, swp.dataset.swap, { mode: 'swap' }); return; }
        const ed = e.target.closest('[data-edit]');
        if (ed) { const [sl, id] = ed.dataset.edit.split(':'); const en = ((dayLog(date).slots || {})[sl] || []).find(x => x.id === id); if (en) entrySheet(date, sl, en); return; }
        if (e.target.closest('[data-extra-add]')) { extraSheet(date); return; }
        const ex = e.target.closest('[data-extra]');
        if (ex) extraSheet(date, (dayLog(date).extras || []).find(x => x.id === ex.dataset.extra));
      });
    }
  };
}

// Запись «сверх плана»: категория, что именно, примерный размер, калории — если известны
async function extraSheet(date, existing = null) {
  const { openSheet, closeSheet } = await import('../ui.js');
  const x = existing ? { ...existing } : { cat: 'sweet', size: 'm', what: '', kcal: null };
  openSheet({
    title: existing ? 'Сверх плана' : 'Что было лишнего?', right: 'Готово',
    body: `
      <div class="chips" id="x-cat">${Object.entries(EXTRA_CATS).map(([k, c]) => `<button class="chip ${x.cat === k ? 'on' : ''}" data-c="${k}">${c.em} ${c.name}</button>`).join('')}</div>
      <label class="field"><span>Что именно</span><input class="input" id="x-what" maxlength="80" placeholder="Например: 2 бокала вина, кусок торта" value="${esc(x.what || '')}"></label>
      <div><div class="section-cap">Сколько примерно</div><div class="seg" id="x-size">${Object.entries(EXTRA_SIZES).map(([k, l]) => `<button class="${x.size === k ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}</div></div>
      <label class="field"><span>Калории, если знаешь (необязательно)</span><input class="input" id="x-kcal" inputmode="numeric" placeholder="можно оставить пустым" value="${x.kcal || ''}"></label>
      <div class="note">Калории, если указаны, войдут в итог дня. Если нет — запись всё равно попадёт в недельный отчёт, и Claude оценит неделю целиком.</div>
      ${existing ? '<button class="btn gray" id="x-del" style="color:var(--red)">Удалить</button>' : ''}`,
    onMount: w => {
      w.querySelector('#x-cat').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; x.cat = b.dataset.c; w.querySelectorAll('#x-cat .chip').forEach(c => c.classList.toggle('on', c === b)); });
      w.querySelector('#x-size').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; x.size = b.dataset.s; w.querySelectorAll('#x-size button').forEach(c => c.classList.toggle('on', c === b)); });
      const del = w.querySelector('#x-del');
      if (del) del.addEventListener('click', () => { store.update(s => { s.food[date].extras = (s.food[date].extras || []).filter(e => e.id !== existing.id); }); closeSheet(); });
    },
    onRight: w => {
      const kcal = parseInt(w.querySelector('#x-kcal').value, 10);
      const rec = { id: existing ? existing.id : store.uid(), cat: x.cat, size: x.size, what: w.querySelector('#x-what').value.trim().slice(0, 80), kcal: kcal > 0 && kcal < 5000 ? kcal : null };
      store.update(s => {
        s.food[date] = s.food[date] || { slots: {}, water: 0, swaps: {} };
        const arr = (s.food[date].extras || []).filter(e => e.id !== rec.id);
        arr.push(rec);
        s.food[date].extras = arr;
      });
      toast('Записано');
    }
  });
}

function guessSlot() {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
}

async function addChooser(date, slot) {
  const { openSheet, closeSheet } = await import('../ui.js');
  openSheet({
    title: SLOTS.find(s => s.id === slot).name,
    body: `<div class="list">
      <button class="li tap with-ic" data-c="dish"><div class="li-ic" style="background:var(--tint)">${icon('book')}</div><div class="li-main"><div class="li-title">Блюдо из меню</div><div class="li-sub">С граммовками рецепта</div></div>${icon('chev', 'chev')}</button>
      <button class="li tap with-ic" data-c="custom"><div class="li-ic" style="background:var(--green)">${icon('edit')}</div><div class="li-main"><div class="li-title">Своё блюдо или продукты</div><div class="li-sub">Поиск по базе, граммы, свой продукт</div></div>${icon('chev', 'chev')}</button>
    </div>`,
    onMount: w => w.querySelector('.list').addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      closeSheet(true);
      if (b.dataset.c === 'dish') dishPicker(date, slot); else entrySheet(date, slot);
    })
  });
}

/* ---------- Меню ---------- */
function MenuView() {
  const t = today();
  const cur = menuIndex(t);
  const html = `<div class="page">
    <div class="note">Простые блюда из двух коротких готовок (Вс и Ср) и одно «блюдо недели» в субботу. Любое блюдо можно заменить в дневнике.</div>
    ${WEEK_MENU.map((day, i) => {
      const ids = Object.values(day).flat();
      const tot = ids.reduce((a, id) => { const r = recipeTotals(id); return { kcal: a.kcal + r.kcal, p: a.p + r.p, f: a.f + r.f, c: a.c + r.c }; }, { kcal: 0, p: 0, f: 0, c: 0 });
      return `<div><div class="section-h"><h2>${['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][i]}${i === cur ? ' · сегодня' : ''}</h2><span class="muted small">${fmt(tot.kcal)} ккал · Б ${fmt(tot.p)}</span></div>
      <div class="list">${SLOTS.filter(sl => day[sl.id]).map(sl => day[sl.id].map(id => { const r = RECIPES[id], rt = recipeTotals(id); return `<button class="li tap" data-go="food/recipe/${id}"><div class="li-ic" style="background:${r.bg};font-size:20px">${r.em}</div><div class="li-main"><div class="li-sub" style="margin:0">${sl.name}</div><div class="li-title" style="font-size:16px">${esc(r.name)}${r.special ? ' <span class="chip orange" style="font-size:11px">⭐ блюдо недели</span>' : ''}</div><div class="li-sub">${fmt(rt.kcal)} ккал · Б ${fmt(rt.p)}${r.time && !r.sweet ? ` · ⏱ ${r.time} мин` : ''}</div></div>${icon('chev', 'chev')}</button>`; }).join('')).join('')}</div>
      <div class="section-foot">Ж ${fmt(tot.f)} г · У ${fmt(tot.c)} г. В дни суток добавляется перекус ~215 ккал; в неделю перед менструацией — +100–150 ккал крупой или фруктом.</div></div>`;
    }).join('')}
  </div>`;
  return { title: 'Меню на неделю', back: 'food', backLabel: 'Питание', html };
}

/* ---------- Рецепт ---------- */
function RecipeView(id) {
  const r = RECIPES[id];
  if (!r) return { title: 'Рецепт', back: 'food', html: '' };
  const t = recipeTotals(id);
  const cook2 = cookForTwo();
  const two = cook2 && !r.sweet && !r.himOnly;
  const tHer = recipeTotals(id, 1), tHim = recipeTotals(id, HIM_PORTION);
  const slot = SLOTS.find(s => s.id === r.slot);
  const html = `<div class="page">
    <div class="dish-hero" style="background:${r.bg}">${r.em}</div>
    <div class="chips"><span class="chip">${esc(slot ? slot.name : '')}</span>${r.special ? '<span class="chip orange">⭐ Блюдо недели</span>' : ''}${r.time ? `<span class="chip">⏱ ${r.time} мин</span>` : ''}${r.prep ? `<span class="chip green">Можно заготовить на ${r.prep} дн.</span>` : ''}</div>
    <div class="kv">
      <div><div class="k">Ккал</div><div class="v" style="color:var(--c-kcal)">${fmt(t.kcal)}</div></div>
      <div><div class="k">Белки</div><div class="v" style="color:var(--c-protein)">${fmt(t.p)} г</div></div>
      <div><div class="k">Жиры</div><div class="v" style="color:var(--c-fat)">${fmt(t.f)} г</div></div>
      <div><div class="k">Углеводы</div><div class="v" style="color:var(--c-carb)">${fmt(t.c)} г</div></div>
    </div>
    ${two ? `<div class="card"><div class="row between small"><span class="muted">Её порция</span><b class="num">${fmt(tHer.kcal)} ккал · Б ${fmt(tHer.p)}</b></div><div class="row between small" style="margin-top:4px"><span class="muted">Его порция (×${String(HIM_PORTION).replace('.', ',')})</span><b class="num">${fmt(tHim.kcal)} ккал · Б ${fmt(tHim.p)}</b></div></div>` : ''}
    <div class="toggle-row card" style="padding:12px 16px"><div><b>Готовим на двоих</b><div class="xs muted">${two ? 'Граммовки — на общую кастрюлю' : 'Граммовки — только на твою порцию'}</div></div>${sw('cook2', cook2)}</div>
    <div><div class="section-cap">${two ? 'Ингредиенты на двоих (всего · она + он)' : 'Ингредиенты на твою порцию'}</div><div class="card">
      ${r.ing.map(([fid, g0]) => { const g = portionGrams(id, g0, 1), gh = portionGrams(id, g0, HIM_PORTION), mine = portionGrams(id, g0); const f = FOODS[fid], m = macrosFor(fid, mine); const shown = two ? g + gh : mine; return `<div class="ing"><div><div>${esc(f.name)}</div><div class="xs muted">${two ? `она ${fmt(g)} г + он ${fmt(gh)} г` : `${fmt(m.kcal)} ккал · Б ${fmt(m.p, 1)} · Ж ${fmt(m.f, 1)} · У ${fmt(m.c, 1)}`}${f.yield && f.yield !== 1 ? ` · готового ≈ ${fmt(shown * f.yield)} г` : ''}</div></div><span class="g"><b>${fmt(shown)} г</b>${f.unit ? `<br><span class="xs">≈ ${fmt(shown / f.unit.g, 1)} ${f.unit.name}</span>` : ''}</span></div>`; }).join('')}
    </div><div class="section-foot">Вес — в сыром/сухом виде, если не указано иное. ${two ? 'Готовая еда делится по весу в той же пропорции: ей ≈ 43%, ему ≈ 57%.' : ''} Клетчатка в твоей порции: ${fmt(t.fib)} г.</div></div>
    <div><div class="section-cap">Приготовление</div><div class="card"><ol class="ol">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div></div>
    ${r.tips ? `<div class="card"><div class="card-h"><span class="ic" style="background:var(--orange)">💡</span>Совет</div><p class="prose">${esc(r.tips)}</p></div>` : ''}
    ${r.alts && r.alts.length ? `<div><div class="section-cap">Если чего-то нет — замены</div><div class="card"><ul class="ul">${r.alts.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div></div>` : ''}
    <button class="btn" id="log-now">${icon('check')} Записать в дневник (сегодня)</button>
  </div>`;
  return {
    title: r.name, back: 'food', backLabel: 'Назад', html,
    mount: root => {
      root.querySelector('#log-now').addEventListener('click', () => {
        saveEntry(today(), r.slot, recipeToEntry(id, true));
        toast('Записано в дневник');
      });
      bindCookToggle(root);
    }
  };
}

// «Готовим на двоих»: настройка своя на каждом телефоне
export function cookForTwo() { return store.get().settings.cookForTwo !== false; }
function bindCookToggle(root) {
  const el = root.querySelector('#cook2');
  if (el) el.addEventListener('change', () => store.update(st => { st.settings.cookForTwo = el.checked; }));
}
// Сколько продуктов нужно на набор рецептов с учётом режима готовки
function needFor(rids, two) {
  const agg = {};
  const add = (fid, g) => { agg[fid] = (agg[fid] || 0) + g; };
  rids.forEach(rid => RECIPES[rid].ing.forEach(([fid, g]) => {
    if (two) { if (!RECIPES[rid].himOnly) add(fid, portionGrams(rid, g, 1)); add(fid, portionGrams(rid, g, HIM_PORTION)); }
    else add(fid, portionGrams(rid, g));
  }));
  return agg;
}

/* ---------- Список покупок ---------- */
function ShopView() {
  const s = store.get();
  const agg = {};
  // На двоих: её порция + его порция (×1,35), сладкое — каждому. Выкл — только своя порция.
  const two = cookForTwo();
  const add = (fid, g) => { agg[fid] = (agg[fid] || 0) + g; };
  Object.entries(needFor(WEEK_MENU.flatMap(day => Object.values(day).flat()), two)).forEach(([fid, g]) => add(fid, g));
  // его ежедневный белковый перекус и её запас на дни суток (~2 в неделю)
  if (two || WHO === 'him') RECIPES.m_snack.ing.forEach(([fid, g]) => add(fid, g * 7));
  if (two || WHO !== 'him') RECIPES.s_shift.ing.forEach(([fid, g]) => add(fid, g * 2));
  const byCat = {};
  let total = 0;
  for (const [fid, g] of Object.entries(agg)) {
    const f = FOODS[fid];
    const buy = f.unit ? `${Math.ceil(g / f.unit.g)} ${f.unit.name}` : g >= 1000 ? `${fmt(Math.ceil(g / 100) / 10, 1)} кг` : `${fmt(Math.ceil(g / 10) * 10)} г`;
    const own = (s.prices || {})[fid];
    const perKg = own || f.price || 0;
    const price = Math.round((g / 1000) * perKg);
    total += price;
    (byCat[f.cat] = byCat[f.cat] || []).push({ fid, f, g, buy, price, perKg, own: !!own });
  }
  const html = `<div class="page">
    <div class="card"><div class="row between"><div><div class="muted small">${two ? `На неделю на двоих · бюджет ${fmt(s.budget || 10000)} ₽` : 'На неделю — только на тебя'}</div><div class="big-num">≈ ${fmt(Math.round(total / 50) * 50)} ₽</div></div><button class="btn tiny gray" id="shop-reset">Сбросить отметки</button></div>
    <div style="margin-top:8px">${bar(total, s.budget || 10000, total > (s.budget || 10000) ? 'var(--orange)' : 'var(--green)')}</div>
    <div class="xs muted" style="margin-top:6px">«Магнит ✓» — цены из каталога: ${esc(PRICE_SHOP)}, ${PRICE_DATE}. «Не проверено» — ориентир. Нажми на цену и впиши свою из чека — бюджет пересчитается. Специи, соль и чеснок не учтены.</div></div>
    ${FOOD_CATS.filter(c => byCat[c]).map(c => `<div><div class="section-cap">${esc(c)}</div><div class="list">${byCat[c].map(x => `<div class="shop-item ${s.shopDone[x.fid] ? 'done' : ''}">
      <button data-shop="${x.fid}" aria-label="Отметить"><span class="check ${s.shopDone[x.fid] ? 'on' : ''}">${s.shopDone[x.fid] ? icon('check') : ''}</span></button>
      <div class="grow"><div>${esc(x.f.name)}</div>
        <button class="xs ${x.own ? 'ok' : 'muted'}" data-price="${x.fid}" style="text-decoration:underline dotted">${x.perKg ? `≈ ${x.price} ₽ · ${fmt(x.perKg)} ₽/кг${x.own ? ' (моя цена)' : PRICE_SRC[x.fid] ? ' · Магнит ✓' : ' · не проверено'}` : 'цена не указана — впиши из чека'}</button>
        ${!x.own && PRICE_SRC[x.fid] ? `<div class="xs muted">${esc(PRICE_SRC[x.fid])}</div>` : ''}
        ${PICK[x.fid] ? `<details style="margin-top:2px"><summary class="xs tint" style="cursor:pointer">Как выбрать</summary><div class="xs muted" style="line-height:1.4;margin-top:4px">${esc(PICK[x.fid])}</div></details>` : ''}</div>
      <b class="num">${x.buy}</b></div>`).join('')}</div></div>`).join('')}
    <div class="note">Экономия: курицу и индейку выгоднее брать упаковкой 1–2 кг и делить на порции в морозилку; овощные смеси — замороженными; творог — на развес.</div>
  </div>`;
  return {
    title: 'Список покупок', back: 'food', backLabel: 'Питание', html,
    mount: root => root.addEventListener('click', e => {
      const b = e.target.closest('[data-shop]');
      if (b) { store.update(st => { st.shopDone[b.dataset.shop] = !st.shopDone[b.dataset.shop]; }); return; }
      const pr = e.target.closest('[data-price]');
      if (pr) {
        const fid = pr.dataset.price;
        const cur = (store.get().prices || {})[fid] || FOODS[fid].price;
        const v = prompt(`Цена за 1 кг: ${FOODS[fid].name}\n(пусто — вернуть ориентир)`, cur ? String(cur) : '');
        if (v === null) return;
        const n = parseFloat(String(v).replace(',', '.'));
        store.update(st => { st.prices = st.prices || {}; if (!v.trim() || Number.isNaN(n)) delete st.prices[fid]; else st.prices[fid] = n; });
        return;
      }
      if (e.target.closest('#shop-reset')) store.update(st => { st.shopDone = {}; });
    })
  };
}

/* ---------- Готовка ---------- */
function GuideView() {
  const two = cookForTwo();
  // что закупить и отвесить на каждую готовку (основные блюда, которые заготавливаются заранее)
  // для готовки — блюда тех приёмов пищи, которые она закрывает
  const prepRids = meals => meals.flatMap(([d, sl]) => WEEK_MENU[d][sl] || []);
  const needList = meals => Object.entries(needFor(prepRids(meals), two)).sort((a, b) => b[1] - a[1]).map(([fid, g]) => `<div class="ing"><span>${esc(FOODS[fid].name)}</span><span class="g"><b>${fmt(Math.round(g / 5) * 5)} г</b></span></div>`).join('');
  const html = `<div class="page">
    <div class="toggle-row card"><div><b>Готовим на двоих</b><div class="xs muted" style="line-height:1.4;margin-top:2px">${two ? 'Вкл: заготовки и граммовки в рецептах — на двоих (её порция + его ×1,35). Готовая еда делится по весу: ей ≈ 43%, ему ≈ 57%.' : `Выкл: всё считается только на ${WHO === 'him' ? 'твою порцию (×1,35)' : 'твою порцию'}.`}</div></div>${sw('cook2', two)}</div>
    ${PREP_PLAN.map((p, i) => `<div><div class="section-cap">${esc(p.name)}</div><div class="card"><div class="muted small" style="margin-bottom:6px">${esc(p.when)}</div><ol class="ol">${p.tasks.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      <details style="margin-top:8px"><summary class="tint small" style="cursor:pointer;font-weight:600">Сколько отвесить (сырой вес) — ${two ? 'на двоих' : 'на тебя'}</summary><div style="margin-top:6px">${needList(p.meals)}</div></details></div></div>`).join('')}
    <div><div class="section-cap">Рекомендации</div><div class="stack">${COOKING_GUIDE.map(g => `<div class="card"><b>${esc(g.t)}</b><p class="prose muted" style="margin-top:4px;font-size:15px">${esc(g.d)}</p></div>`).join('')}</div></div>
    <div><div class="section-cap">Сырой → готовый вес</div><div class="list">${Object.values(FOODS).filter(f => f.yield && f.yield !== 1).map(f => `<div class="li"><div class="li-main"><div class="li-title" style="font-size:15px">${esc(f.name)}</div></div><span class="li-val num">×${String(f.yield).replace('.', ',')}</span></div>`).join('')}</div>
    <div class="section-foot">Например: 60 г сухих макарон × 2,3 ≈ 140 г готовых; 150 г сырой курицы × 0,7 ≈ 105 г готовой.</div></div>
  </div>`;
  return { title: 'Как готовить', back: 'food', backLabel: 'Питание', html, mount: root => bindCookToggle(root) };
}

/* ---------- Таблица продуктов ---------- */
function TableView() {
  const html = `<div class="page">
    <div class="search">${icon('search')}<input id="tq" placeholder="Поиск продукта"></div>
    <div id="tlist">${tableList('')}</div>
  </div>`;
  return {
    title: 'КБЖУ продуктов', back: 'food', backLabel: 'Питание', html,
    mount: root => root.querySelector('#tq').addEventListener('input', e => { root.querySelector('#tlist').innerHTML = tableList(e.target.value.trim().toLowerCase()); })
  };
}
function tableList(q) {
  return FOOD_CATS.map(c => {
    const list = Object.entries(FOODS).filter(([, f]) => f.cat === c && (!q || f.name.toLowerCase().includes(q)));
    if (!list.length) return '';
    return `<div style="margin-top:16px"><div class="section-cap">${esc(c)} · на 100 г</div><div class="list">${list.map(([, f]) => `<details class="li" style="display:block"><summary style="display:flex;justify-content:space-between;gap:8px;cursor:pointer;list-style:none"><span style="font-size:16px">${esc(f.name)}</span><span class="num muted" style="white-space:nowrap">${fmt(f.kcal)} ккал</span></summary>
      <div class="kv" style="margin-top:8px"><div><div class="k">Белки</div><div class="v">${fmt(f.p, 1)}</div></div><div><div class="k">Жиры</div><div class="v">${fmt(f.f, 1)}</div></div><div><div class="k">Углев.</div><div class="v">${fmt(f.c, 1)}</div></div><div><div class="k">Клетч.</div><div class="v">${fmt(f.fib || 0, 1)}</div></div></div>
      ${f.yield && f.yield !== 1 ? `<div class="small" style="margin-top:8px">Готовый вес ≈ сырой × ${String(f.yield).replace('.', ',')} · в 100 г готового ≈ ${fmt(f.kcal / f.yield)} ккал</div>` : ''}
      ${f.unit ? `<div class="small muted" style="margin-top:4px">1 ${f.unit.name} ≈ ${f.unit.g} г</div>` : ''}
      ${f.cook ? `<div class="small" style="margin-top:6px;line-height:1.4">🍳 ${esc(f.cook)}</div>` : ''}</details>`).join('')}</div></div>`;
  }).join('') || '<div class="empty-state">Ничего не найдено</div>';
}

/* ---------- История ---------- */
let histMode = 'days';
function HistoryView() {
  const t = today();
  let content = '';
  if (histMode === 'days') {
    const days = Array.from({ length: 14 }, (_, i) => addDays(t, -13 + i));
    content = `<div class="card"><div class="card-h">Калории за 14 дней</div>${barChart(days.map(d => ({ label: String(parse(d).getDate()), v: Math.round(dayFact(d).kcal), color: foodAdherence(d).ok ? 'var(--c-kcal)' : 'var(--label-3)', hl: d === t })), { target: store.get().targets.kcal, showVals: false })}
      <div class="xs muted">Розовым — дни в норме (±10% калорий и белок ≥ 90%). Пунктир — базовая цель.</div></div>
      <div class="card"><div class="card-h">Белок, г</div>${barChart(days.map(d => ({ label: String(parse(d).getDate()), v: Math.round(dayFact(d).p), color: 'var(--c-protein)', dim: !hasFood(d) })), { target: store.get().targets.protein, showVals: false })}</div>
      <div class="list">${[...days].reverse().map(d => { const f = dayFact(d), tg = targetsFor(d), a = foodAdherence(d); return `<button class="li tap" data-day="${d}"><div class="li-main"><div class="li-title" style="font-size:15px">${fmtDate(d, { weekday: true })}</div><div class="li-sub">${a.logged ? `${fmt(f.kcal)} / ${fmt(tg.kcal)} ккал · Б ${fmt(f.p)} · Ж ${fmt(f.f)} · У ${fmt(f.c)}` : 'не записано'}</div></div>${a.logged ? `<span class="chip ${a.ok ? 'green' : ''}">${a.ok ? 'в норме' : (a.diff > 0 ? '+' : '') + fmt(a.diff)}</span>` : ''}${icon('chev', 'chev')}</button>`; }).join('')}</div>`;
  } else {
    const weeks = Array.from({ length: 8 }, (_, i) => mondayOf(addDays(t, -7 * (7 - i))));
    const rows = weeks.map(m => {
      const ds = weekDates(m).filter(d => d <= t);
      const logged = ds.filter(hasFood);
      const avg = logged.length ? logged.reduce((a, d) => a + dayFact(d).kcal, 0) / logged.length : 0;
      const avgP = logged.length ? logged.reduce((a, d) => a + dayFact(d).p, 0) / logged.length : 0;
      const ok = ds.filter(d => foodAdherence(d).ok).length;
      return { m, avg, avgP, ok, logged: logged.length };
    });
    content = `<div class="card"><div class="card-h">Средние калории по неделям</div>${barChart(rows.map(r => ({ label: fmtShort(r.m), v: Math.round(r.avg), color: 'var(--c-kcal)', dim: !r.logged })), { target: store.get().targets.kcal })}</div>
      <div class="list">${[...rows].reverse().map(r => `<div class="li"><div class="li-main"><div class="li-title" style="font-size:15px">Неделя с ${fmtDate(r.m)}</div><div class="li-sub">${r.logged ? `ср. ${fmt(r.avg)} ккал · белок ${fmt(r.avgP)} г · записано ${r.logged} дн.` : 'нет записей'}</div></div><span class="chip ${r.ok >= 5 ? 'green' : ''}">${r.ok}/7 в норме</span></div>`).join('')}</div>`;
  }
  const html = `<div class="page"><div class="seg" id="hm"><button class="${histMode === 'days' ? 'on' : ''}" data-m="days">Дни</button><button class="${histMode === 'weeks' ? 'on' : ''}" data-m="weeks">Недели</button></div>${content}</div>`;
  return {
    title: 'История питания', back: 'food', backLabel: 'Питание', html,
    mount: root => root.addEventListener('click', e => {
      const m = e.target.closest('[data-m]'); if (m) { histMode = m.dataset.m; window.__rerender(); return; }
      const d = e.target.closest('[data-day]'); if (d) { foodDate = d.dataset.day; go('food'); }
    })
  };
}
