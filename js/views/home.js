// Главная: сегодня — что запланировано, что сделано, что осталось.
import * as store from '../store.js';
import { icon, rings, bar, esc } from '../ui.js';
import { today, fmtDate, programInfo, nextWorkoutId, sessionsOn, targetsFor, dayFact, planTotals, dayRings, dayLoad, dueReminders,
  weekDates, mondayOf, WD_SHORT, rangeLoad, weekTarget, fmt, hasFood, foodAdherence, dayLog, planForDate, weekAvgWeight, addDays, plural } from '../logic.js';
import { WORKOUTS, sessionInfo, MODE } from '../data/program.js';
import { RECIPES, SLOTS } from '../data/foods.js';
import { PLAN_VERSION, CHANGELOG } from '../data/plan-meta.js';
import { weighSheet, dailySheet, measureSheet, activitySheet } from './sheets.js';
import { go } from '../app.js';
import { doBackup } from './profile.js';

export const homeRoutes = [{ re: /^home$/, view: Home }];

function Home() {
  const s = store.get();
  const t = today();
  const pi = programInfo(t);
  const tg = targetsFor(t);
  const fact = dayFact(t);
  const ring = dayRings(t);
  const ss = sessionsOn(t);
  const nextW = nextWorkoutId();
  const planned = s.planned[t];
  const load = dayLoad(t);
  const d = s.daily[t] || {};
  const yesterdayShift = (s.daily[addDays(t, -1)] || {}).shift;
  const reminders = dueReminders();
  const planUpdate = (s.settings.planVersionAccepted || 0) < PLAN_VERSION;
  const isWeekly = MODE === 'weekly';

  // что сегодня
  const items = [];
  const SI = (k, w) => sessionInfo(k, w || Math.max(1, pi.week));
  const label = (k, w) => { const i = SI(k, w); return i.kind === 'strength' ? `тренировка ${k}` : i.name.toLowerCase(); };
  const em = k => ({ run: '🏃', bike: '🚴', mobility: '🧘' }[SI(k).kind] || '🏋️');
  const nextKey = planned && planned !== 'rest' ? planned : nextW;
  const doneTraining = ss.filter(x => x.kind !== 'mobility');
  if (doneTraining.length) doneTraining.forEach(x => items.push({ done: true, ic: em(x.workout), bg: SI(x.workout, x.week).color, title: `${label(x.workout, x.week)[0].toUpperCase() + label(x.workout, x.week).slice(1)} — выполнено`, sub: `${x.durationMin} мин · ${SI(x.workout, x.week).name}`, go: `train/report/${x.id}` }));
  if (doneTraining.length) { /* выполненное уже показано */ }
  else if (s.active) items.push({ done: false, ic: '▶️', bg: 'var(--c-train)', title: `Тренировка ${s.active.workout} идёт`, sub: 'Продолжить запись', go: 'train/session' });
  else if (d.shift) items.push({ done: false, ic: '🏥', bg: 'var(--indigo)', title: 'Сегодня сутки', sub: 'Тренировки нет — бери контейнеры и воду', go: null });
  else if (yesterdayShift) items.push({ done: false, ic: '😴', bg: 'var(--indigo)', title: 'День восстановления после суток', sub: 'Прогулка 20–30 мин вместо силовой', go: null });
  else if (planned === 'rest') items.push({ done: false, ic: '🌿', bg: 'var(--c-rest)', title: 'День отдыха', sub: 'Шаги и растяжка по желанию', go: null });
  else items.push({ done: false, ic: em(nextKey), bg: SI(nextKey).color, title: `${planned ? 'Запланировано' : 'Следующее'}: ${label(nextKey)}`, sub: `${SI(nextKey).name} · ~${SI(nextKey).minText || SI(nextKey).duration} мин`, go: `train/w/${nextKey}` });

  const logged = hasFood(t);
  const left = Math.round(tg.kcal - fact.kcal);
  items.push({ done: logged && Math.abs(left) <= tg.kcal * 0.1, ic: '🍽', bg: 'var(--c-kcal)', title: logged ? `Питание: ${fmt(fact.kcal)} из ${fmt(tg.kcal)} ккал` : 'Питание ещё не записано', sub: logged ? (left > 0 ? `Осталось ${fmt(left)} ккал · белок ${fmt(fact.p)}/${tg.p} г` : `Сверх цели ${fmt(-left)} ккал — ничего страшного`) : 'Отметь приёмы пищи — одним касанием', go: 'food' });
  const water = (dayLog(t).water || 0) * 250;
  items.push({ done: water >= tg.waterMl, ic: '💧', bg: 'var(--c-water)', title: `Вода: ${fmt(water / 1000, 2)} из ${fmt(tg.waterMl / 1000, 1)} л`, sub: 'Отмечай стаканы в разделе «Питание»', go: 'food' });
  const dailyFilled = d.sleep || d.energy || d.steps;
  items.push({ done: !!dailyFilled, ic: '📝', bg: 'var(--purple)', title: 'Отчёт дня', sub: dailyFilled ? `Сон ${d.sleep ?? '—'} ч · шаги ${d.steps ? fmt(d.steps) : '—'}` : 'Сон, шаги, самочувствие — 30 секунд', act: 'daily' });

  const doneCount = items.filter(i => i.done).length;
  const kcalColor = ring.kcal.state === 'over' ? 'var(--orange)' : 'var(--c-kcal)';
  const kcalLabel = { none: 'не записано', under: 'недобор', ok: 'в норме', over: 'сверх нормы' }[ring.kcal.state];

  // неделя
  const mon = mondayOf(t);
  const wd = weekDates(mon);
  const wSess = s.sessions.filter(x => x.date >= mon && x.date <= wd[6] && x.kind !== 'mobility').length;
  const wTarget = weekTarget(mon);
  const wFood = wd.filter(x => foodAdherence(x).ok).length;
  const wLoad = rangeLoad(mon, wd[6]);
  const wAvg = weekAvgWeight(mon), wPrevAvg = weekAvgWeight(addDays(mon, -7));

  const html = `
  <div class="page">
    ${planUpdate ? planUpdateBanner(s) : ''}
    ${reminders.map(r => `<div class="banner"><div class="b-ic" style="background:${r.color}">${icon(r.icon)}</div><div class="grow"><b>${esc(r.title)}</b><p>${esc(r.text)}</p>
      <div class="b-act">${r.act ? `<button class="btn tiny" data-rem="${r.act}">${esc(r.actText)}</button>` : ''}<button class="btn tiny gray" data-dismiss="${r.id}">Скрыть</button></div></div></div>`).join('')}

    <div class="card">
      <div class="row" style="gap:16px;align-items:center">
        ${rings([
          { v: ring.kcal.v, max: ring.kcal.max, color: kcalColor },
          { v: ring.activity.v, max: ring.activity.max, color: 'var(--c-train)' },
          { v: ring.water.v, max: ring.water.max, color: 'var(--c-water)' }
        ], 124, 14, 3)}
        <div class="legend grow">
          <button data-go="food" style="text-align:left"><div class="lbl small muted">Питание · ${kcalLabel}</div><div class="v num" style="color:${kcalColor};font-weight:700;font-size:19px">${fmt(fact.kcal)}<small style="color:var(--label-2);font-size:13px;font-weight:500">/${fmt(tg.kcal)} ккал</small></div></button>
          <button data-go="profile/load" style="text-align:left"><div class="lbl small muted">Активность${ring.activity.trainMin ? ` · трен. ${ring.activity.trainMin} мин` : ''}</div><div class="v num" style="color:var(--c-train);font-weight:700;font-size:19px">${fmt(ring.activity.v)}<small style="color:var(--label-2);font-size:13px;font-weight:500">/${ring.activity.max} мин</small></div></button>
          <button data-go="food" style="text-align:left"><div class="lbl small muted">Вода</div><div class="v num" style="color:var(--c-water);font-weight:700;font-size:19px">${fmt(water / 1000, 2)}<small style="color:var(--label-2);font-size:13px;font-weight:500">/${fmt(tg.waterMl / 1000, 1)} л</small></div></button>
        </div>
      </div>
      <div class="xs muted" style="margin-top:10px">Активность = тренировки и кардио + шаги (1000 шагов ≈ 10 мин). Цель: 45 мин в день тренировки, 30 — в остальные.</div>
      ${tg.reasons.length ? `<div class="chips" style="margin-top:12px">${tg.reasons.map(r => `<span class="chip on">${esc(r)}</span>`).join('')}</div>` : ''}
    </div>

    <div>
      <div class="section-h"><h2>План дня</h2><span class="muted small">${doneCount} из ${items.length}</span></div>
      <div class="list today-list">
        ${items.map(i => `<button class="li tap with-ic" ${i.go ? `data-go="${i.go}"` : ''} ${i.act ? `data-act="${i.act}"` : ''}>
          <div class="li-ic" style="background:${i.bg}">${i.ic}</div>
          <div class="li-main"><div class="li-title" style="font-size:16px;font-weight:500">${esc(i.title)}</div><div class="li-sub">${esc(i.sub)}</div></div>
          <span class="check ${i.done ? 'on' : ''}">${i.done ? icon('check') : ''}</span></button>`).join('')}
      </div>
    </div>

    ${!doneTraining.length && !s.active && !d.shift && planned !== 'rest' ? `<button class="btn" data-go="train/w/${nextKey}">${icon('play')} Начать: ${label(nextKey)}</button>` : ''}

    <div class="grid2">
      <div class="card tap" data-go="profile/load">
        <div class="card-h"><span class="ic" style="background:var(--orange)">${icon('bolt')}</span>Нагрузка</div>
        <div class="mid-num">${esc(load.label)}</div>
        <div class="muted small" style="margin-top:2px">${load.total ? `${fmt(load.total)} усл. ед. · ${load.minutes} мин` : load.shift ? 'Сутки на работе' : 'Без тренировок'}</div>
        <div style="margin-top:10px">${bar(load.level, 4, 'var(--orange)')}</div>
      </div>
      <div class="card tap" data-act="steps">
        <div class="card-h"><span class="ic" style="background:var(--blue)">${icon('steps')}</span>Шаги</div>
        <div class="mid-num">${d.steps ? fmt(d.steps) : '—'}</div>
        <div class="muted small" style="margin-top:2px">цель ${fmt(s.targets.steps)}</div>
        <div style="margin-top:10px">${bar(d.steps || 0, s.targets.steps, 'var(--blue)')}</div>
      </div>
    </div>

    <div>
      <div class="section-h"><h2>Питание по плану</h2><a class="link" data-go="food/menu">Меню</a></div>
      <div class="list">
        ${SLOTS.filter(sl => (planForDate(t)[sl.id] || []).length).map(sl => {
          const ids = planForDate(t)[sl.id];
          const eaten = ((dayLog(t).slots || {})[sl.id] || []).length > 0;
          return `<button class="li tap with-ic" data-go="food"><div class="li-ic" style="background:${RECIPES[ids[0]].bg};font-size:18px">${RECIPES[ids[0]].em}</div>
          <div class="li-main"><div class="li-sub" style="margin:0 0 1px">${sl.name}</div><div class="li-title" style="font-size:15px">${ids.map(id => esc(RECIPES[id].name)).join(' + ')}</div></div>
          <span class="check ${eaten ? 'on' : ''}">${eaten ? icon('check') : ''}</span></button>`;
        }).join('')}
      </div>
      <div class="section-foot">План дня: ${fmt(planTotals(t).kcal)} ккал · Б ${fmt(planTotals(t).p)} г</div>
    </div>

    <div>
      <div class="section-h"><h2>Эта неделя</h2><a class="link" data-go="profile/report">Отчёт</a></div>
      <div class="card">
        <div class="week-rings">
          ${wd.map((x, i) => {
            const r = dayRings(x);
            const future = x > t;
            return `<button class="wr ${x === t ? 'today' : ''}" data-go="calendar/day/${x}">${rings(future ? [] : [
              { v: r.kcal.v, max: r.kcal.max, color: r.kcal.state === 'over' ? 'var(--orange)' : 'var(--c-kcal)' },
              { v: r.activity.v, max: r.activity.max, color: 'var(--c-train)' },
              { v: r.water.v, max: r.water.max, color: 'var(--c-water)' }], 38, 5, 1.5)}<span>${WD_SHORT[i]}</span></button>`;
          }).join('')}
        </div>
        <div class="divider"></div>
        <div class="grid3" style="text-align:center">
          <div><div class="mid-num" style="color:var(--c-train)">${wSess}<span class="muted" style="font-size:14px">/${wTarget}</span></div><div class="xs muted">тренировки</div></div>
          <div><div class="mid-num" style="color:var(--c-kcal)">${wFood}<span class="muted" style="font-size:14px">/7</span></div><div class="xs muted">дней питание в норме</div></div>
          <div><div class="mid-num" style="color:var(--c-weigh)">${wAvg ? fmt(wAvg.avg, 1) : '—'}</div><div class="xs muted">ср. вес${wAvg && wPrevAvg ? ` (${wAvg.avg - wPrevAvg.avg > 0 ? '+' : ''}${fmt(wAvg.avg - wPrevAvg.avg, 1)})` : ''}</div></div>
        </div>
      </div>
    </div>

    <div class="grid2">
      <button class="card tap" data-act="weigh" style="text-align:left"><div class="card-h"><span class="ic" style="background:var(--c-weigh)">${icon('scale')}</span>Вес</div><div class="mid-num">${d.weight ? fmt(d.weight, 1) + ' кг' : 'Внести'}</div></button>
      <button class="card tap" data-act="activity" style="text-align:left"><div class="card-h"><span class="ic" style="background:var(--c-cardio)">${icon('run')}</span>Кардио</div><div class="mid-num">Добавить</div></button>
    </div>

    <div class="note" style="text-align:center">${pi.notStarted ? `Программа начнётся ${fmtDate(s.settings.programStart)}` : pi.done ? 'Программа на 10 недель завершена — сделай замеры и отправь отчёт Claude для следующего цикла' : `Неделя ${pi.week} из 10 · ${esc(pi.phase.name)} · запас повторов ${esc(pi.phase.rir)}`}</div>
  </div>`;

  return {
    title: 'Сегодня', eyebrow: fmtDate(t, { weekday: true }), html,
    right: `<button class="nb-icon" data-act="daily" aria-label="Отчёт дня">${icon('edit')}</button>`,
    mount: root => {
      const nav = document.getElementById('navbar');
      const handler = e => {
        const a = e.target.closest('[data-act]');
        if (a) {
          const k = a.dataset.act;
          if (k === 'daily' || k === 'steps') dailySheet();
          if (k === 'weigh') weighSheet();
          if (k === 'activity') activitySheet();
          return;
        }
        const r = e.target.closest('[data-rem]');
        if (r) {
          const k = r.dataset.rem;
          if (k === 'weigh') weighSheet();
          else if (k === 'measure') measureSheet();
          else if (k === 'backup') doBackup();
          else if (k === 'setup') go('profile/data');
          else if (k.startsWith('report:')) go('profile/report?w=' + k.slice(7));
          return;
        }
        const dm = e.target.closest('[data-dismiss]');
        if (dm) store.update(st => { st.dismissed[dm.dataset.dismiss] = true; });
        const pu = e.target.closest('[data-plan]');
        if (pu) go('profile/plan');
      };
      root.addEventListener('click', handler);
      nav.addEventListener('click', handler);
    }
  };
}

function planUpdateBanner(s) {
  const last = CHANGELOG[CHANGELOG.length - 1];
  return `<div class="banner coach"><div class="b-ic" style="background:var(--tint)">${icon('sparkle')}</div><div class="grow"><b>Обновление программы от Claude</b><p>${esc(last.title)}. Посмотри, что изменилось и почему, и подтверди.</p><div class="b-act"><button class="btn tiny" data-plan="1">Посмотреть</button></div></div></div>`;
}
