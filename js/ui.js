// UI-хелперы: экранирование, иконки, кольца, графики, шторки, диалоги, схемы упражнений.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Иконки (линейные, в духе SF Symbols) ---------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/>',
  dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5"/><path d="M17 21V3c-2.2 0-4 2.5-4 6v4h4"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  back: '<path d="M10 2 2 10l8 8" stroke-width="2.6"/>',
  chev: '<path d="m2 2 4.5 4.5L2 11" stroke-width="2"/>',
  chevL: '<path d="M9 2 2 9l7 7" stroke-width="2.4"/>',
  chevR: '<path d="m2 2 7 7-7 7" stroke-width="2.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  plusCircle: '<circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none"/><path d="M12 7.5v9M7.5 12h9" stroke="#fff"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.9-7-6.8 0-3.2 2.2-5.3 3.6-7.4.4 1.6 1.2 2.7 2.4 3.4C11 6.6 12.6 4 15 2.5c-.3 2.6.7 4.6 2.2 6.4A7.6 7.6 0 0 1 19 14.2C19 18.1 15.9 21 12 21z"/>',
  drop: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  steps: '<path d="M8.5 3c1.7 0 2.5 2 2.5 4.5S9.8 12 8.3 12 6 10 6 7.5 6.8 3 8.5 3zM7 14.5h3.5l-.3 2.8a1.9 1.9 0 0 1-3.6.3zM15.5 7c1.7 0 2.5 2 2.5 4.5S16.8 16 15.3 16 13 14 13 11.5 13.8 7 15.5 7zM14 18.5h3.5l-.3 1.8a1.9 1.9 0 0 1-3.6.3z"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 9.5a5.6 5.6 0 0 1 8 0M12 9.5l1.4-2"/>',
  ruler: '<rect x="2.5" y="8" width="19" height="8" rx="2" transform="rotate(-0 12 12)"/><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V9M10 13h4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.7l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  video: '<rect x="2.5" y="5.5" width="14" height="13" rx="3"/><path d="m16.5 10 5-3v10l-5-3z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8"/>',
  run: '<circle cx="14" cy="4" r="2"/><path d="m6 21 3.5-5.5 3 2.5V22M9 11l2.5-3.5L16 9l2.5 3M4 13l3-4 4-1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  warning: '<path d="M12 3 2 20h20zM12 10v4.5M12 17.5v.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14.6 4.5L21 15M21 20v-5h-5"/>',
  cooking: '<path d="M4 11h16v2a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7zM2 11h20M9 7c0-1 1-1.5 1-2.5S9 3 9 3M13 7c0-1 1-1.5 1-2.5S13 3 13 3"/>'
};
export function icon(name, cls = '') {
  const vb = name === 'back' ? '0 0 12 20' : name === 'chev' ? '0 0 8 13' : (name === 'chevL' || name === 'chevR') ? '0 0 11 18' : '0 0 24 24';
  return `<svg class="${cls}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* ---------- Кольца (Activity-стиль) ---------- */
export function rings(list, size = 120, stroke = 13, gap = 3, center = '') {
  const c = size / 2;
  let html = `<div class="rings" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">`;
  list.forEach((r, i) => {
    const rad = c - stroke / 2 - i * (stroke + gap);
    if (rad <= 0) return;
    const len = 2 * Math.PI * rad;
    const frac = r.max > 0 ? Math.min(r.v / r.max, 1) : 0;
    html += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${r.color}" stroke-opacity="0.2" stroke-width="${stroke}"/>`;
    if (frac > 0) html += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${r.color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - frac)}"/>`;
    if (r.v > r.max && r.max > 0) {
      // перевыполнение — второй круг поверх
      const over = Math.min((r.v - r.max) / r.max, 1);
      html += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${r.color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - over)}" style="filter:brightness(0.8)"/>`;
    }
  });
  html += `</svg>${center ? `<div class="center">${center}</div>` : ''}</div>`;
  return html;
}
export function bar(v, max, color, target = null, cls = '') {
  const pct = max > 0 ? Math.min(v / max, 1) * 100 : 0;
  return `<div class="bar ${cls}"><i style="width:${pct}%;background:${color}"></i>${target !== null ? `<span class="target" style="left:${target}%"></span>` : ''}</div>`;
}

/* ---------- Графики ---------- */
function niceRange(min, max) {
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  return [min - pad, max + pad];
}
// series: [{points:[{x:'YYYY-MM-DD', y}], color, label, dashed, dots}]
export function lineChart(series, { height = 160, unit = '', yFmt = v => v.toFixed(1).replace('.', ','), xFmt = null, goal = null } = {}) {
  const pts = series.flatMap(s => s.points);
  if (pts.length === 0) return `<div class="chart-empty">Пока нет данных — график появится после первых записей</div>`;
  const W = 340, H = height, L = 34, R = 10, T = 10, B = 22;
  const xs = pts.map(p => Date.parse(p.x));
  let xmin = Math.min(...xs), xmax = Math.max(...xs);
  if (xmin === xmax) { xmin -= 86400000 * 3; xmax += 86400000 * 3; }
  const ys = pts.map(p => p.y).concat(goal !== null ? [goal] : []);
  const [ymin, ymax] = niceRange(Math.min(...ys), Math.max(...ys));
  const X = x => L + ((Date.parse(x) - xmin) / (xmax - xmin)) * (W - L - R);
  const Y = y => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
  let g = `<g class="grid">`;
  for (let i = 0; i <= 3; i++) {
    const v = ymin + ((ymax - ymin) * i) / 3, y = Y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 3}" text-anchor="end">${yFmt(v)}</text>`;
  }
  g += `</g>`;
  const xf = xFmt || (s => { const d = new Date(Date.parse(s)); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const uniqX = [...new Set(pts.map(p => p.x))].sort();
  const step = Math.max(1, Math.ceil(uniqX.length / 5));
  let xl = '';
  uniqX.forEach((x, i) => { if (i % step === 0 || i === uniqX.length - 1) xl += `<text x="${X(x)}" y="${H - 6}" text-anchor="middle">${xf(x)}</text>`; });
  let body = '';
  if (goal !== null) body += `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="var(--green)" stroke-dasharray="4 4" stroke-width="1"/><text x="${W - R}" y="${Y(goal) - 4}" text-anchor="end" style="fill:var(--green)">цель</text>`;
  for (const s of series) {
    const p = [...s.points].sort((a, b) => a.x.localeCompare(b.x));
    if (!p.length) continue;
    const d = p.map((q, i) => `${i ? 'L' : 'M'}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
    if (s.area && p.length > 1) body += `<path d="${d} L${X(p[p.length - 1].x)},${H - B} L${X(p[0].x)},${H - B} Z" fill="${s.color}" opacity="0.12"/>`;
    body += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.2}" stroke-linecap="round" stroke-linejoin="round" ${s.dashed ? 'stroke-dasharray="4 4"' : ''} ${s.faint ? 'opacity="0.45"' : ''}/>`;
    if (s.dots !== false) p.forEach((q, i) => { body += `<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="${i === p.length - 1 ? 3.6 : 2.4}" fill="${s.faint ? 'var(--card)' : s.color}" stroke="${s.color}" stroke-width="1.5"/>`; });
  }
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}${body}${xl}</svg></div>`;
}
// bars: [{label, v, color, sub}], target
export function barChart(bars, { height = 130, target = null, fmtV = v => Math.round(v), showVals = true } = {}) {
  if (!bars.length) return `<div class="chart-empty">Нет данных</div>`;
  const W = 340, H = height, L = 6, R = 6, T = 16, B = 20;
  const max = Math.max(1, ...bars.map(b => b.v), target || 0) * 1.1;
  const bw = (W - L - R) / bars.length;
  let s = '';
  if (target) { const y = T + (1 - target / max) * (H - T - B); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--label-3)" stroke-dasharray="3 3"/>`; }
  bars.forEach((b, i) => {
    const h = (b.v / max) * (H - T - B);
    const x = L + i * bw + bw * 0.2, w = bw * 0.6, y = H - B - h;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, b.v > 0 ? 2 : 0)}" rx="${Math.min(4, w / 2)}" fill="${b.color || 'var(--tint)'}" opacity="${b.dim ? 0.35 : 1}"/>`;
    if (showVals && b.v > 0) s += `<text x="${x + w / 2}" y="${y - 4}" text-anchor="middle">${fmtV(b.v)}</text>`;
    s += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle" ${b.hl ? 'style="fill:var(--tint);font-weight:700"' : ''}>${esc(b.label)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${s}</svg></div>`;
}

/* ---------- Схема упражнения (стилизованная фигура) ---------- */
const SEGS = [['H', 'S', 'neck'], ['S', 'P', 'SP'], ['S', 'E', 'SE'], ['E', 'W', 'EW'], ['P', 'K', 'PK'], ['K', 'A', 'KA'], ['A', 'T', 'AT'],
  ['S', 'E2', 'SE'], ['E2', 'W2', 'EW'], ['P', 'K2', 'PK'], ['K2', 'A2', 'KA'], ['A2', 'T2', 'AT']];
export function poseSVG(pose, which = 'start', { accent = 'var(--tint)', size = null } = {}) {
  const p = pose[which];
  const hl = new Set(pose.hl || []);
  let s = `<svg viewBox="0 0 120 90" ${size ? `width="${size}" height="${size * 0.75}"` : ''} fill="none" stroke-linecap="round" stroke-linejoin="round">`;
  s += `<line x1="4" y1="82.5" x2="116" y2="82.5" stroke="currentColor" stroke-opacity="0.18" stroke-width="1"/>`;
  if (pose.props) s += `<g stroke="currentColor" stroke-opacity="0.35" stroke-width="2" fill="none">${pose.props.replace(/<rect /g, '<rect fill="currentColor" fill-opacity="0.12" ')}</g>`;
  if (p.cable) s += `<line x1="${p.cable[0][0]}" y1="${p.cable[0][1]}" x2="${p.cable[1][0]}" y2="${p.cable[1][1]}" stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="2 2"/>`;
  if (p.plate) s += `<line x1="${p.plate[0][0]}" y1="${p.plate[0][1]}" x2="${p.plate[1][0]}" y2="${p.plate[1][1]}" stroke="currentColor" stroke-opacity="0.5" stroke-width="3"/>`;
  // вторая сторона — бледнее (дальняя)
  for (const [a, b, k] of SEGS) {
    if (!p[a] || !p[b]) continue;
    const far = b.endsWith('2');
    const on = hl.has(k);
    s += `<line x1="${p[a][0]}" y1="${p[a][1]}" x2="${p[b][0]}" y2="${p[b][1]}" stroke="${on ? accent : 'currentColor'}" stroke-opacity="${far ? (on ? 0.45 : 0.3) : (on ? 1 : 0.85)}" stroke-width="${k === 'SP' ? 5 : 4}"/>`;
  }
  if (hl.has('P') && p.P) s += `<circle cx="${p.P[0]}" cy="${p.P[1]}" r="5" fill="${accent}" opacity="0.9"/>`;
  if (p.H) s += `<circle cx="${p.H[0]}" cy="${p.H[1]}" r="5" fill="currentColor" fill-opacity="0.85"/>`;
  if (p.bar) s += `<circle cx="${p.bar[0]}" cy="${p.bar[1]}" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="${p.bar[0]}" cy="${p.bar[1]}" r="1.4" fill="currentColor"/>`;
  if (p.db) s += `<rect x="${p.db[0] - 5}" y="${p.db[1] - 2}" width="10" height="4" rx="1.5" fill="currentColor"/>`;
  if (p.roller) s += `<circle cx="${p.roller[0]}" cy="${p.roller[1]}" r="3.5" fill="currentColor" fill-opacity="0.4"/>`;
  s += `</svg>`;
  return s;
}

/* ---------- Шторка, диалоги, тост ---------- */
let sheetEl = null;
export function openSheet({ title = '', left = 'Отмена', right = null, body = '', onRight = null, onMount = null, onClose = null }) {
  closeSheet(true);
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grabber"></div>
    <div class="sheet-h"><button class="nb-btn l" data-sheet="close">${esc(left)}</button><b>${esc(title)}</b>${right ? `<button class="nb-btn strong r" data-sheet="ok">${esc(right)}</button>` : '<span></span>'}</div>
    <div class="sheet-body">${body}</div></div>`;
  document.body.appendChild(wrap);
  sheetEl = wrap;
  wrap._onClose = onClose;
  wrap.querySelector('.sheet-bg').addEventListener('click', () => closeSheet());
  wrap.querySelector('[data-sheet="close"]').addEventListener('click', () => closeSheet());
  const ok = wrap.querySelector('[data-sheet="ok"]');
  if (ok && onRight) ok.addEventListener('click', async () => { const res = await onRight(wrap); if (res !== false) closeSheet(); });
  // свайп вниз по шапке
  let y0 = null;
  const sh = wrap.querySelector('.sheet');
  const head = wrap.querySelector('.sheet-h');
  [head, wrap.querySelector('.grabber')].forEach(el => {
    el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchmove', e => { if (y0 === null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
    el.addEventListener('touchend', e => { const dy = (e.changedTouches[0].clientY - (y0 || 0)); y0 = null; if (dy > 90) closeSheet(); else sh.style.transform = ''; });
  });
  if (onMount) onMount(wrap);
  return wrap;
}
export function closeSheet(immediate = false) {
  if (!sheetEl) return;
  const el = sheetEl; sheetEl = null;
  const cb = el._onClose;
  if (immediate) { el.remove(); return; }
  el.classList.add('closing');
  el.querySelector('.sheet').classList.add('closing');
  setTimeout(() => el.remove(), 220);
  if (cb) cb();
}
export function alertDialog({ title, text = '', buttons = [{ label: 'OK', value: true, primary: true }] }) {
  return new Promise(res => {
    const w = document.createElement('div');
    w.className = 'alert-wrap';
    w.innerHTML = `<div class="alert" role="alertdialog"><div class="a-body"><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}</div><div class="a-btns">${buttons.map((b, i) => `<button data-i="${i}" class="${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      w.remove();
      res(buttons[+b.dataset.i].value);
    });
  });
}
export const confirmDialog = (title, text, okLabel = 'Да', danger = false) =>
  alertDialog({ title, text, buttons: [{ label: 'Отмена', value: false }, { label: okLabel, value: true, primary: !danger, danger }] });

let toastTimer = null;
export function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

export function downloadFile(name, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    return navigator.share({ files: [file], title: name }).catch(() => {});
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return Promise.resolve();
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove(); return ok;
  }
}

export function scale5(name, value, emojis = ['😣', '😕', '😐', '🙂', '😄']) {
  return `<div class="scale5" data-scale="${name}">${emojis.map((e, i) => `<button type="button" data-v="${i + 1}" class="${+value === i + 1 ? 'on' : ''}" aria-label="${i + 1} из 5">${e}</button>`).join('')}</div>`;
}
export function bindScales(root, cb) {
  root.querySelectorAll('[data-scale]').forEach(g => {
    g.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      cb(g.dataset.scale, +b.dataset.v);
    });
  });
}
export function sw(id, checked, attrs = '') {
  return `<label class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${attrs}><i></i></label>`;
}
