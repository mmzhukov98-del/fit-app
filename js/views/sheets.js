// Общие шторки ввода данных: вес, дневной отчёт, замеры, активность, приём пищи.
import * as store from '../store.js';
import { openSheet, esc, toast, scale5, bindScales, sw, icon, closeSheet, confirmDialog } from '../ui.js';
import { today, fmtDate, ACT_TYPES, macrosFor, foodById, sumM, recipeToEntry, recipeTotals, fmt, r1, lastMeasurement, addDays } from '../logic.js';
import { FOODS, FOOD_CATS, RECIPES, SLOTS } from '../data/foods.js';

import { WHO } from '../data/program.js';

const num = v => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')));
// Свободный ужин уже отмечен в этом месяце (кроме самой даты)
function cheatUsed(date) {
  const d = store.get().daily;
  return Object.keys(d).some(k => k !== date && k.slice(0, 7) === date.slice(0, 7) && d[k].cheat);
}

export function weighSheet(date = today()) {
  const d = store.get().daily[date] || {};
  openSheet({
    title: 'Вес', right: 'Готово',
    body: `
      <div class="card" style="text-align:center">
        <div class="muted small">${fmtDate(date, { weekday: true })}</div>
        <div class="row" style="justify-content:center;margin-top:10px;gap:6px">
          <input id="w-kg" class="num-in" style="width:140px;height:64px;font-size:34px" inputmode="decimal" placeholder="0,0" value="${d.weight ? String(d.weight).replace('.', ',') : ''}">
          <span class="mid-num muted">кг</span>
        </div>
      </div>
      <div class="note">Взвешивайся утром, после туалета, до еды и кофе, в одних условиях. Одно взвешивание ничего не значит: выводы — только по среднему за неделю.</div>`,
    onMount: w => setTimeout(() => w.querySelector('#w-kg').focus(), 350),
    onRight: w => {
      const v = num(w.querySelector('#w-kg').value);
      if (v !== null && (v < 30 || v > 200)) { toast('Проверь значение'); return false; }
      store.update(s => { s.daily[date] = { ...(s.daily[date] || {}), weight: v }; if (v === null) delete s.daily[date].weight; });
      toast(v ? 'Вес сохранён' : 'Вес удалён');
    }
  });
}

export function dailySheet(date = today()) {
  const d = { ...(store.get().daily[date] || {}) };
  openSheet({
    title: 'Отчёт дня', right: 'Готово',
    body: `
      <div class="muted small" style="text-align:center">${fmtDate(date, { weekday: true })}</div>
      <div class="list">
        <div class="li"><div class="li-main li-title">Вес утром</div><input class="li-input" id="d-weight" inputmode="decimal" placeholder="кг" value="${d.weight ?? ''}"></div>
        <div class="li"><div class="li-main li-title">Сон</div><input class="li-input" id="d-sleep" inputmode="decimal" placeholder="часов" value="${d.sleep ?? ''}"></div>
        <div class="li"><div class="li-main li-title">Шаги</div><input class="li-input" id="d-steps" inputmode="numeric" placeholder="0" value="${d.steps ?? ''}"></div>
      </div>
      <div><div class="section-cap">Самочувствие</div>${scale5('wellbeing', d.wellbeing)}</div>
      <div><div class="section-cap">Энергия</div>${scale5('energy', d.energy, ['🪫', '😮‍💨', '😐', '⚡️', '🔥'])}</div>
      <div><div class="section-cap">Настроение</div>${scale5('mood', d.mood, ['😢', '😟', '😐', '😊', '🤩'])}</div>
      <div class="list">
        ${WHO === 'him' ? '' : `<div class="li"><div class="li-ic" style="background:var(--indigo)">🏥</div><div class="li-main"><div class="li-title">Сутки на работе</div><div class="li-sub">+200 ккал, на следующий день — отдых</div></div>${sw('d-shift', d.shift)}</div>
        <div class="li"><div class="li-ic" style="background:var(--tint)">🌸</div><div class="li-main"><div class="li-title">Менструация</div><div class="li-sub">Мягче тренировки, без самокритики</div></div>${sw('d-period', d.period)}</div>`}
        <div class="li"><div class="li-ic" style="background:var(--orange)">🍕</div><div class="li-main"><div class="li-title">Свободный ужин</div><div class="li-sub">Раз в месяц, не снижает балл${cheatUsed(date) ? ' · в этом месяце уже был' : ''}</div></div>${sw('d-cheat', d.cheat)}</div>
        <div class="li"><div class="li-ic" style="background:var(--orange)">🤒</div><div class="li-main"><div class="li-title">Болею</div><div class="li-sub">Тренировки — только после выздоровления</div></div>${sw('d-sick', d.sick)}</div>
      </div>
      <label class="field"><span>Комментарий</span><textarea class="input" id="d-comment" placeholder="Как прошёл день?">${esc(d.comment || '')}</textarea></label>`,
    onMount: w => bindScales(w, (k, v) => { d[k] = v; }),
    onRight: w => {
      const q = id => w.querySelector('#' + id);
      const periodBefore = !!(store.get().daily[date] || {}).period;
      const per = q('d-period') ? q('d-period').checked : false;
      const cheat = q('d-cheat').checked;
      if (cheat && !d.cheat && cheatUsed(date)) { toast('Свободный ужин в этом месяце уже был'); return false; }
      store.update(s => {
        s.daily[date] = {
          ...(s.daily[date] || {}), ...d,
          weight: num(q('d-weight').value), sleep: num(q('d-sleep').value), steps: num(q('d-steps').value),
          shift: q('d-shift') ? q('d-shift').checked : false, period: per, cheat, sick: q('d-sick').checked, comment: q('d-comment').value.trim()
        };
        // первый день менструации — обновляем цикл (для расчёта недели перед ней)
        if (per && !periodBefore && !(s.daily[addDays(date, -1)] || {}).period) {
          if (s.cycle.lastStart && s.cycle.lastStart < date) {
            const len = Math.round((new Date(date) - new Date(s.cycle.lastStart)) / 86400000);
            if (len >= 21 && len <= 40) s.cycle.length = len;
          }
          s.cycle.lastStart = date;
        }
      });
      toast('Сохранено');
    }
  });
}

export function measureSheet(date = today()) {
  const s = store.get();
  const last = lastMeasurement();
  const fields = s.measureFields;
  openSheet({
    title: 'Замеры', right: 'Готово',
    body: `
      <div class="list">
        <div class="li"><div class="li-main li-title">Дата</div><input class="li-input" type="date" id="m-date" value="${date}" max="${today()}"></div>
        ${fields.map(f => `<div class="li"><div class="li-main"><div class="li-title">${esc(f.name)}</div>${last && (last[f.id] ?? (last.extra || {})[f.id]) ? `<div class="li-sub">Прошлый раз: ${last[f.id] ?? last.extra[f.id]} см</div>` : ''}</div><input class="li-input" id="m-${f.id}" inputmode="decimal" placeholder="см"></div>`).join('')}
      </div>
      <button class="btn gray small" id="m-addfield">${icon('plus')} Добавить показатель</button>
      <div class="note">Как мерить: утром натощак, лента горизонтально, без натяжения. Талия — самое узкое место (обычно чуть выше пупка); бёдра — самая широкая часть ягодиц; грудь — по самым выступающим точкам.</div>`,
    onMount: w => {
      w.querySelector('#m-addfield').addEventListener('click', async () => {
        const name = prompt('Название показателя (например, «Бедро правое», «Плечо»)');
        if (!name) return;
        const id = 'f' + Date.now().toString(36);
        store.update(st => { st.measureFields.push({ id, name: name.trim() }); }, { silent: true });
        closeSheet(true);
        measureSheet(date);
      });
    },
    onRight: w => {
      const d = w.querySelector('#m-date').value || date;
      const rec = { date: d, extra: {} };
      let any = false;
      for (const f of fields) {
        const v = num(w.querySelector('#m-' + f.id).value);
        if (v !== null) { any = true; if (['waist', 'chest', 'hips'].includes(f.id)) rec[f.id] = v; else rec.extra[f.id] = v; }
      }
      if (!any) { toast('Введи хотя бы один показатель'); return false; }
      store.update(st => {
        st.measurements = st.measurements.filter(m => m.date !== d);
        st.measurements.push(rec);
        st.measurements.sort((a, b) => a.date.localeCompare(b.date));
      });
      toast('Замеры сохранены');
    }
  });
}

export function activitySheet(date = today(), existing = null) {
  const a = existing ? { ...existing } : { type: 'walk', min: 30, rpe: 3, km: '' };
  const types = Object.entries(ACT_TYPES);
  openSheet({
    title: existing ? 'Активность' : 'Новая активность', right: 'Готово',
    body: `
      <div class="chips" id="a-types">${types.map(([k, t]) => `<button class="chip ${a.type === k ? 'on' : ''}" data-t="${k}">${t.em} ${t.name}</button>`).join('')}</div>
      <div class="list">
        <div class="li"><div class="li-main li-title">Дата</div><input class="li-input" type="date" id="a-date" value="${existing ? existing.date : date}" max="${today()}"></div>
        <div class="li"><div class="li-main li-title">Длительность</div><input class="li-input" id="a-min" inputmode="numeric" value="${a.min}" placeholder="мин"></div>
        <div class="li"><div class="li-main li-title">Дистанция</div><input class="li-input" id="a-km" inputmode="decimal" value="${a.km || ''}" placeholder="км (необяз.)"></div>
      </div>
      <div><div class="section-cap">Субъективная сложность (RPE)</div>
        <div class="rpe-scale" id="a-rpe">${Array.from({ length: 10 }, (_, i) => `<button class="${a.rpe === i + 1 ? 'on' : ''}" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
        <div class="section-foot">1–3 — легко, можно петь · 4–6 — можно говорить · 7–8 — тяжело говорить · 9–10 — предел. Для тебя сейчас ориентир — не выше 6–7.</div>
      </div>
      ${existing ? '<button class="btn gray" id="a-del" style="color:var(--red)">Удалить</button>' : ''}`,
    onMount: w => {
      w.querySelector('#a-types').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; a.type = b.dataset.t; w.querySelectorAll('#a-types .chip').forEach(c => c.classList.toggle('on', c === b)); });
      w.querySelector('#a-rpe').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; a.rpe = +b.dataset.v; w.querySelectorAll('#a-rpe button').forEach(c => c.classList.toggle('on', c === b)); });
      const del = w.querySelector('#a-del');
      if (del) del.addEventListener('click', async () => { if (await confirmDialog('Удалить запись?', '', 'Удалить', true)) { store.update(s => { s.activities = s.activities.filter(x => x.id !== existing.id); }); closeSheet(); } });
    },
    onRight: w => {
      const min = num(w.querySelector('#a-min').value);
      if (!min || min <= 0) { toast('Укажи длительность'); return false; }
      const rec = { id: existing ? existing.id : store.uid(), date: w.querySelector('#a-date').value || date, type: a.type, min, rpe: a.rpe, km: num(w.querySelector('#a-km').value) };
      store.update(s => { s.activities = s.activities.filter(x => x.id !== rec.id); s.activities.push(rec); });
      toast('Сохранено');
    }
  });
}

/* ---------- Питание ---------- */
function allFoodsList() {
  const s = store.get();
  const base = Object.entries(FOODS).map(([id, f]) => ({ id, ...f }));
  const custom = Object.entries(s.customFoods).map(([id, f]) => ({ id: 'custom:' + id, cat: 'Мои продукты', ...f }));
  return [...custom, ...base];
}

// Редактор приёма пищи: список продуктов с граммовкой (сырой/готовый вес)
export function entrySheet(date, slot, entry = null) {
  const isNew = !entry;
  const e = entry ? JSON.parse(JSON.stringify(entry)) : { id: 'e' + Date.now().toString(36), name: '', items: [], planned: false };
  const slotName = SLOTS.find(x => x.id === slot)?.name || '';
  const draw = w => {
    const t = sumM(e.items);
    w.querySelector('#en-items').innerHTML = e.items.length ? e.items.map((it, i) => {
      const f = foodById(it.food);
      const canCook = f && f.yield && f.yield !== 1;
      return `<div class="entry" data-i="${i}">
        <div class="grow"><b>${esc(it.name)}</b><span>${fmt(it.kcal)} ккал · Б ${fmt(it.p, 1)} · Ж ${fmt(it.f, 1)} · У ${fmt(it.c, 1)}${it.cooked ? ' · вес готового' : ''}</span>
        ${canCook ? `<div style="margin-top:6px"><button class="chip ${it.cooked ? 'on' : ''}" data-cook="${i}">${it.cooked ? 'Готовый вес ✓' : 'Взвешено готовым?'}</button></div>` : ''}</div>
        <input class="num-in" style="width:76px" inputmode="decimal" data-g="${i}" value="${it.g}" aria-label="граммы"><span class="muted small">г</span>
        <button class="nb-icon" data-rm="${i}" style="color:var(--red)" aria-label="Удалить">${icon('close')}</button>
      </div>`;
    }).join('') : '<div class="muted small" style="padding:8px 0">Добавь продукты из базы или свой продукт</div>';
    w.querySelector('#en-total').innerHTML = `<b class="num">${fmt(t.kcal)}</b> ккал · Б <b>${fmt(t.p)}</b> · Ж <b>${fmt(t.f)}</b> · У <b>${fmt(t.c)}</b>`;
  };
  const recalc = it => { const m = it.food ? macrosFor(it.food, it.g, it.cooked) : null; if (m) Object.assign(it, m); };
  openSheet({
    title: isNew ? `Добавить: ${slotName}` : 'Редактировать', right: 'Готово',
    body: `
      <label class="field"><span>Название блюда</span><input class="input" id="en-name" placeholder="Например: «Обед в столовой»" value="${esc(e.name)}"></label>
      <div class="card">
        <div id="en-items"></div>
        <div class="divider"></div>
        <div class="small" id="en-total"></div>
      </div>
      <div class="search">${icon('search')}<input id="en-q" placeholder="Поиск продукта"></div>
      <div class="list" id="en-res" style="max-height:260px;overflow:auto"></div>
      <button class="btn gray small" id="en-custom">${icon('plus')} Свой продукт (КБЖУ на 100 г)</button>
      ${!isNew ? '<button class="btn gray" id="en-del" style="color:var(--red)">Удалить приём</button>' : ''}
      <div class="note">Крупы, макароны и мясо в базе — в сыром виде. Если взвешиваешь готовое, отметь «Взвешено готовым» — приложение пересчитает по коэффициенту развара/ужарки.</div>`,
    onMount: w => {
      draw(w);
      const res = w.querySelector('#en-res');
      const showRes = q => {
        const list = allFoodsList().filter(f => !q || f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
        res.innerHTML = list.map(f => `<button class="li tap" data-add="${f.id}"><div class="li-main"><div class="li-title" style="font-size:16px">${esc(f.name)}</div><div class="li-sub">${fmt(f.kcal)} ккал · Б ${fmt(f.p, 1)} · Ж ${fmt(f.f, 1)} · У ${fmt(f.c, 1)} на 100 г</div></div><span class="tint">${icon('plus', 'chev')}</span></button>`).join('') || '<div class="li muted">Ничего не найдено — добавь свой продукт</div>';
      };
      showRes('');
      w.querySelector('#en-q').addEventListener('input', ev => showRes(ev.target.value.trim()));
      res.addEventListener('click', ev => {
        const b = ev.target.closest('[data-add]'); if (!b) return;
        const f = foodById(b.dataset.add);
        const g = f.unit ? f.unit.g : 100;
        const it = { food: b.dataset.add, name: f.name, g, cooked: false };
        recalc(it); e.items.push(it); draw(w);
        toast(`${f.name}: ${g} г`);
      });
      const items = w.querySelector('#en-items');
      items.addEventListener('input', ev => {
        const i = ev.target.dataset.g; if (i === undefined) return;
        const it = e.items[+i]; it.g = num(ev.target.value) || 0; recalc(it);
        const t = sumM(e.items);
        w.querySelector('#en-total').innerHTML = `<b class="num">${fmt(t.kcal)}</b> ккал · Б <b>${fmt(t.p)}</b> · Ж <b>${fmt(t.f)}</b> · У <b>${fmt(t.c)}</b>`;
        ev.target.closest('.entry').querySelector('.grow span').textContent = `${fmt(it.kcal)} ккал · Б ${fmt(it.p, 1)} · Ж ${fmt(it.f, 1)} · У ${fmt(it.c, 1)}${it.cooked ? ' · вес готового' : ''}`;
      });
      items.addEventListener('click', ev => {
        const rm = ev.target.closest('[data-rm]');
        if (rm) { e.items.splice(+rm.dataset.rm, 1); draw(w); return; }
        const ck = ev.target.closest('[data-cook]');
        if (ck) { const it = e.items[+ck.dataset.cook]; it.cooked = !it.cooked; recalc(it); draw(w); }
      });
      w.querySelector('#en-custom').addEventListener('click', () => customFoodSheet(date, slot, e));
      const del = w.querySelector('#en-del');
      if (del) del.addEventListener('click', async () => {
        if (!(await confirmDialog('Удалить запись?', 'Запись исчезнет из дневника этого дня.', 'Удалить', true))) return;
        store.update(s => { const sl = s.food[date].slots[slot]; s.food[date].slots[slot] = sl.filter(x => x.id !== e.id); });
        closeSheet();
      });
    },
    onRight: w => {
      e.name = w.querySelector('#en-name').value.trim() || (e.items[0] ? e.items[0].name : 'Приём пищи');
      if (!e.items.length) { toast('Добавь хотя бы один продукт'); return false; }
      saveEntry(date, slot, e);
      toast('Записано');
    }
  });
}

export function saveEntry(date, slot, e) {
  store.update(s => {
    s.food[date] = s.food[date] || { slots: {}, water: 0, swaps: {} };
    s.food[date].slots = s.food[date].slots || {};
    const arr = s.food[date].slots[slot] || [];
    const i = arr.findIndex(x => x.id === e.id);
    if (i >= 0) arr[i] = e; else arr.push(e);
    s.food[date].slots[slot] = arr;
  });
}

function customFoodSheet(date, slot, entryDraft) {
  // открывается поверх: после сохранения возвращаемся к редактору с добавленным продуктом
  openSheet({
    title: 'Свой продукт', right: 'Добавить', left: 'Назад',
    body: `
      <label class="field"><span>Название</span><input class="input" id="cf-name" placeholder="Например: «Сырок глазированный»"></label>
      <div class="section-cap">На 100 г (смотри на упаковке)</div>
      <div class="grid-inputs">
        <label><span>Ккал</span><input class="num-in" id="cf-k" inputmode="decimal"></label>
        <label><span>Белки</span><input class="num-in" id="cf-p" inputmode="decimal"></label>
        <label><span>Жиры</span><input class="num-in" id="cf-f" inputmode="decimal"></label>
        <label><span>Углев.</span><input class="num-in" id="cf-c" inputmode="decimal"></label>
      </div>
      <label class="field"><span>Сколько съедено, г</span><input class="input" id="cf-g" inputmode="decimal" value="100"></label>
      <div class="note">Продукт сохранится в «Мои продукты» и будет доступен в поиске.</div>`,
    onClose: () => setTimeout(() => entrySheet(date, slot, entryDraft), 240),
    onRight: w => {
      const name = w.querySelector('#cf-name').value.trim();
      const k = num(w.querySelector('#cf-k').value);
      if (!name || k === null) { toast('Нужны название и калории'); return false; }
      const f = { name, kcal: k, p: num(w.querySelector('#cf-p').value) || 0, f: num(w.querySelector('#cf-f').value) || 0, c: num(w.querySelector('#cf-c').value) || 0, fib: 0 };
      const id = 'u' + Date.now().toString(36);
      store.update(s => { s.customFoods[id] = f; }, { silent: true });
      const g = num(w.querySelector('#cf-g').value) || 100;
      entryDraft.items.push({ food: 'custom:' + id, name, g, cooked: false, ...macrosFor('custom:' + id, g) });
      if (!entryDraft.name) entryDraft.name = name;
    }
  });
}

// Выбор блюда из меню/рецептов для слота (замена в плане или запись факта)
export function dishPicker(date, slot, { mode = 'log' } = {}) {
  const list = Object.entries(RECIPES).filter(([id, r]) => r.slot === slot || (slot === 'brunch' && r.slot === 'snack') || (slot === 'snack' && r.slot === 'brunch'));
  openSheet({
    title: mode === 'swap' ? 'Заменить блюдо' : 'Выбрать блюдо',
    body: `<div class="note">${mode === 'swap' ? 'Замена из того же приёма пищи — калорийность дня почти не изменится.' : 'Запишется как съеденное с граммовками рецепта — их можно поправить.'}</div>
    <div class="list">${list.map(([id, r]) => { const t = recipeTotals(id); return `<button class="li tap" data-r="${id}"><div class="li-ic" style="background:${r.bg};font-size:20px">${r.em}</div><div class="li-main"><div class="li-title" style="font-size:16px">${esc(r.name)}</div><div class="li-sub">${fmt(t.kcal)} ккал · Б ${fmt(t.p)} · Ж ${fmt(t.f)} · У ${fmt(t.c)}</div></div>${icon('chev', 'chev')}</button>`; }).join('')}</div>`,
    onMount: w => w.querySelector('.list').addEventListener('click', ev => {
      const b = ev.target.closest('[data-r]'); if (!b) return;
      if (mode === 'swap') {
        store.update(s => {
          s.food[date] = s.food[date] || { slots: {}, water: 0, swaps: {} };
          s.food[date].swaps = s.food[date].swaps || {};
          const sweet = slot === 'snack' ? ['sw_choc'] : [];
          s.food[date].swaps[slot] = RECIPES[b.dataset.r].sweet ? [b.dataset.r] : [b.dataset.r, ...sweet];
        });
        toast('Блюдо заменено');
      } else {
        saveEntry(date, slot, recipeToEntry(b.dataset.r, false));
        toast('Записано');
      }
      closeSheet();
    })
  });
}
