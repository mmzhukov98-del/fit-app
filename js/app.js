// Точка входа: роутер, навбар, таб-бар, тема, мини-плеер тренировки.
import * as store from './store.js';
import { icon, esc } from './ui.js';
import { homeRoutes } from './views/home.js';
import { calendarRoutes } from './views/calendar.js';
import { trainRoutes } from './views/train.js';
import { foodRoutes } from './views/food.js';
import { profileRoutes } from './views/profile.js';
import { WORKOUTS, useProgram } from './data/program.js';
import { morphInner, trackListeners } from './morph.js';
import './data/exercises-him.js';

store.load();
useProgram(store.get().settings.who);
store.requestPersistence();

const TABS = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'calendar', label: 'Календарь', icon: 'calendar' },
  { id: 'train', label: 'Тренировки', icon: 'dumbbell' },
  { id: 'food', label: 'Питание', icon: 'food' },
  { id: 'profile', label: 'Профиль', icon: 'person' }
];

const ROUTES = [...homeRoutes, ...calendarRoutes, ...trainRoutes, ...foodRoutes, ...profileRoutes];

const appEl = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
const lastPathPerTab = {};
const scrollMemo = {};
let currentPath = null;
let prevDepth = 0;
let current = null;

export function go(path, { replace = false } = {}) {
  const h = '#/' + path.replace(/^#?\/?/, '');
  if (replace) location.replace(h); else location.hash = h;
}
export function back(fallback) {
  if (history.length > 1 && sessionStorage.getItem('fit.nav') === '1') history.back();
  else go(fallback || 'home', { replace: true });
}
window.__go = go;

function match(path) {
  const [p, q] = path.split('?');
  const params = Object.fromEntries(new URLSearchParams(q || ''));
  for (const r of ROUTES) {
    const m = p.match(r.re);
    if (m) return { route: r, args: m.slice(1), params };
  }
  return null;
}

function applyTheme() {
  const t = store.get().settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#000000' : '#f2f2f7');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

function renderTabbar(tab) {
  morphInner(tabbar, TABS.map(t => `<button class="tab ${t.id === tab ? 'active' : ''}" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<span>${t.label}</span></button>`).join(''));
}
tabbar.addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  const tab = b.dataset.tab;
  const curTab = (currentPath || 'home').split('/')[0].split('?')[0];
  if (tab === curTab) { // повторное нажатие — к корню вкладки / вверх
    if (currentPath !== tab) go(tab); else appEl.scrollTo({ top: 0, behavior: "smooth" });
  } else go(lastPathPerTab[tab] || tab);
});

function render(opts = {}) {
  const path = (location.hash || '#/home').replace(/^#\/?/, '') || 'home';
  const m = match(path);
  if (!m) { go('home', { replace: true }); return; }
  const tab = path.split('/')[0].split('?')[0];
  lastPathPerTab[tab] = path;
  const depth = path.split('/').length;
  const sameRoute = path === currentPath;
  const anim = opts.keep || sameRoute ? '' : depth > prevDepth ? 'view-enter' : depth < prevDepth ? 'view-back' : 'view-fade';
  // Прокрутка: уходя с экрана, запоминаем место; возвращаясь назад или на другую вкладку —
  // восстанавливаем. Новый (более глубокий) экран открывается сверху.
  if (currentPath && !sameRoute) scrollMemo[currentPath] = appEl.scrollTop;
  const scrollY = sameRoute ? appEl.scrollTop : depth > prevDepth ? 0 : (scrollMemo[path] || 0);
  prevDepth = depth;
  currentPath = path;

  if (current && current.unmount) try { current.unmount(); } catch (e) { console.error(e); }
  if (current && current._off) current._off();
  let v;
  try { v = m.route.view(...m.args, m.params); }
  catch (e) { console.error(e); v = errorView(e, path); }
  current = v;
  const backBtn = v.back ? `<button class="nb-back" data-nav-back="${esc(v.back)}">${icon('back')}<span>${esc(v.backLabel || 'Назад')}</span></button>` : '<span></span>';
  const right = v.right || '<span></span>';
  const large = v.large !== false;
  const html = `
    <header class="navbar ${large ? '' : 'solid'}${sameRoute && appEl.scrollTop > 30 ? ' scrolled' : ''}" id="navbar">${backBtn}<div class="nb-title">${esc(v.title)}</div><div class="nb-right">${right}</div></header>
    <main class="${anim}" id="view">
      ${large ? `<div class="large-title">${v.eyebrow ? `<div class="eyebrow">${esc(v.eyebrow)}</div>` : ''}<h1>${esc(v.title)}</h1>${v.sub ? `<div class="sub">${v.sub}</div>` : ''}</div>` : ''}
      ${v.html}
    </main>`;
  // тот же экран после изменения данных — обновляем на месте, без мигания
  if (sameRoute && document.getElementById('view')) morphInner(appEl, html);
  else appEl.innerHTML = html;
  renderTabbar(tab);
  renderLivePill(tab, path);
  if (v.mount) v._off = trackListeners(() => { try { v.mount(document.getElementById('view')); } catch (e) { console.error(e); } });
  if (appEl.scrollTop !== scrollY) appEl.scrollTop = scrollY;
  onScroll();
}

// Экран ошибки вместо белого экрана: данные не трогаем, предлагаем сохранить копию
function errorView(e, path) {
  const msg = String((e && e.message) || e).slice(0, 300);
  return {
    title: 'Что-то пошло не так', large: false, back: 'home', backLabel: 'Главная',
    html: `<div class="page" style="padding-top:12px">
      <div class="card"><div style="font-size:40px">🛟</div><b style="display:block;font-size:18px;margin-top:6px">Этот экран не открылся</b>
      <p class="small muted" style="margin-top:6px;line-height:1.45">Твои записи не удалены. На всякий случай сохрани резервную копию и напиши Claude, что произошло — приложи текст ошибки.</p>
      <div class="sugg info" style="font-family:ui-monospace,monospace;font-size:12px;word-break:break-word">${esc(path)}: ${esc(msg)}</div></div>
      <button class="btn" id="err-backup">${icon('archive')} Сохранить резервную копию</button>
      <button class="btn gray" data-go="home">На главную</button></div>`,
    mount: root => root.querySelector('#err-backup').addEventListener('click', async () => {
      const { doBackup } = await import('./views/profile.js');
      doBackup();
    })
  };
}

// Глобальные ошибки (например, в обработчике нажатия) — не теряем, показываем подсказку
window.addEventListener('error', ev => console.error('Ошибка:', ev.message));
window.addEventListener('unhandledrejection', ev => console.error('Ошибка:', ev.reason));

function renderLivePill(tab, path) {
  let pill = document.getElementById('live-pill');
  const a = store.get().active;
  if (!a || path.startsWith('train/session')) { if (pill) pill.remove(); document.body.classList.remove('has-pill'); return; }
  if (!pill) { pill = document.createElement('button'); pill.id = 'live-pill'; pill.className = 'live-pill'; document.body.appendChild(pill); pill.addEventListener('click', () => go('train/session')); }
  const w = WORKOUTS[a.workout];
  const upd = () => {
    const sec = Math.floor((Date.now() - a.startedAt) / 1000);
    const t = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    pill.innerHTML = `<span class="dot"></span><span class="grow"><b>Тренировка ${a.workout} идёт</b><small>${t} · ${esc(w ? w.name : '')}</small></span>${icon('chev', 'chev')}`;
  };
  upd();
  clearInterval(pill._t); pill._t = setInterval(upd, 1000);
  document.body.classList.add('has-pill');
}

function onScroll() {
  const nb = document.getElementById('navbar');
  if (nb) nb.classList.toggle("scrolled", appEl.scrollTop > 30);
}
appEl.addEventListener("scroll", onScroll, { passive: true });

appEl.addEventListener('click', e => {
  const b = e.target.closest('[data-nav-back]');
  if (b) { e.preventDefault(); back(b.dataset.navBack); return; }
  const l = e.target.closest('[data-go]');
  if (l) { e.preventDefault(); go(l.dataset.go); }
});

window.addEventListener('hashchange', () => { sessionStorage.setItem('fit.nav', '1'); render(); });
store.subscribe(() => { useProgram(store.get().settings.who); applyTheme(); render({ keep: true }); });

// клавиатура: поле ввода не прячется под клавиатурой
document.addEventListener('focusin', e => {
  if (e.target.matches('input, textarea, select')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
});

applyTheme();
if (!location.hash) location.replace('#/home');
render();
if (store.loadProblem) setTimeout(() => import('./ui.js').then(u => u.alertDialog({ title: 'Проблема с данными', text: store.loadProblem })), 600);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          // новая версия приложения (например, обновлённая программа) — применится при следующем открытии
          sessionStorage.setItem('fit.updateReady', '1');
        }
      });
    });
  }).catch(() => {});
}

export function rerender() { render({ keep: true }); }
window.__rerender = rerender;
