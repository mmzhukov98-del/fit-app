// Плавное обновление экрана: вместо полной перерисовки (innerHTML) меняем только то,
// что изменилось. Элементы остаются на месте — поэтому играют CSS-переходы (кольца,
// полоски, галочки, переключатели), не сбрасываются раскрытые блоки, фокус и прокрутка.

function syncAttrs(from, to) {
  const tag = from.tagName;
  for (const { name } of [...from.attributes]) {
    if (!to.hasAttribute(name) && !(tag === 'DETAILS' && name === 'open')) from.removeAttribute(name);
  }
  for (const { name, value } of [...to.attributes]) {
    if (tag === 'DETAILS' && name === 'open') continue;   // раскрытость — выбор пользователя
    if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  }
  if (tag === 'INPUT') {
    if (from.type === 'checkbox' || from.type === 'radio') from.checked = to.hasAttribute('checked');
    else if (from !== document.activeElement) { const v = to.getAttribute('value') ?? ''; if (from.value !== v) from.value = v; }
  } else if (tag === 'TEXTAREA' && from !== document.activeElement) {
    if (from.value !== to.value) from.value = to.value;
  }
}

function same(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  return a.tagName === b.tagName && (a.id || '') === (b.id || '') && (a.getAttribute('data-key') || '') === (b.getAttribute('data-key') || '');
}

function morphChildren(from, to) {
  const oldKids = [...from.childNodes];
  const newKids = [...to.childNodes];
  newKids.forEach((n, i) => {
    const o = oldKids[i];
    if (!o) { from.appendChild(n); return; }
    if (!same(o, n)) { from.replaceChild(n, o); return; }
    if (o.nodeType === 1) morphEl(o, n);
    else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  for (let i = newKids.length; i < oldKids.length; i++) oldKids[i].remove();
}

function morphEl(from, to) {
  syncAttrs(from, to);
  if (from.tagName === 'TEXTAREA') return;               // содержимое — через value
  morphChildren(from, to);
  if (from.tagName === 'SELECT' && from !== document.activeElement) {
    const sel = to.querySelector('option[selected]');
    if (sel) from.value = sel.value;
  }
}

// Обновить содержимое контейнера по новой HTML-строке
export function morphInner(container, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const wrap = document.createElement(container.tagName);
  wrap.appendChild(tpl.content);
  morphChildren(container, wrap);
}

// Слушатели, добавленные во время mount() экрана, запоминаем — чтобы снять их перед
// следующим обновлением (элементы теперь переиспользуются, иначе обработчики задвоятся).
export function trackListeners(fn) {
  const rec = [];
  const proto = EventTarget.prototype;
  const orig = proto.addEventListener;
  proto.addEventListener = function (type, cb, opts) { rec.push([this, type, cb, opts]); return orig.call(this, type, cb, opts); };
  try { fn(); } finally { proto.addEventListener = orig; }
  return () => rec.forEach(([el, type, cb, opts]) => el.removeEventListener(type, cb, opts));
}
