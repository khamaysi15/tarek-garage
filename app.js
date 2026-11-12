/* מוסך טארק ת.ד בע״מ – דיווח עבודות
   גרסת ניסיון: כל הנתונים נשמרים במכשיר (IndexedDB). שכבת הנתונים מרוכזת ב-DB כדי לחבר ענן בשלב הבא. */
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
function fill(el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false).map(k => (k instanceof Node ? k : document.createTextNode(String(k))))); }
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (typeof v === 'boolean') { el[k] = v; el.setAttribute(k, ''); }
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const ICONS = {
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
  camera: '<path d="M3 8.5a2 2 0 0 1 2-2h2.2L9 4.5h6l1.8 2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/>',
  trash: '<path d="M3.5 6h17M9 6V4h6v2M6 6l1 14h10l1-14M10 10.5v6M14 10.5v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19.5 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  down: '<path d="M12 3.5v12M7 10.5l5 5 5-5M4.5 20.5h15"/>',
  up: '<path d="M12 15.5v-12M7 8.5l5-5 5 5M4.5 20.5h15"/>',
  truck: '<path d="M2 6.5h11v9H2zM13 9.5h4.5l3.5 3.5v2.5h-8z"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  trailer: '<path d="M2 6h17v9.5H2zM19 13.5h3"/><circle cx="6" cy="17.5" r="2"/><circle cx="11" cy="17.5" r="2"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9.5 15.5a1.8 1.8 0 1 0 0-.1M11.3 15.4V10l3 1"/>',
};
function ic(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = ICONS[name] || ''; return s;
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const local = {
  get(k, d = null) { try { const v = localStorage.getItem('tg_' + k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { v == null ? localStorage.removeItem('tg_' + k) : localStorage.setItem('tg_' + k, v); } catch {} },
};
const normPlate = s => String(s || '').replace(/\D/g, '');
function fmtPlate(p) {
  p = normPlate(p);
  if (p.length === 7) return p.slice(0, 2) + '-' + p.slice(2, 5) + '-' + p.slice(5);
  if (p.length === 8) return p.slice(0, 3) + '-' + p.slice(3, 5) + '-' + p.slice(5);
  return p;
}
const dFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const tFmt = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDate = t => dFmt.format(new Date(t));
const fmtTime = t => tFmt.format(new Date(t));
const fmtDT = t => fmtDate(t) + ' · ' + fmtTime(t);
const fmtNum = n => Number(n).toLocaleString('he-IL');
const fmtDur = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const typeName = t => (t === 'trailer' ? 'נגרר' : 'משאית');
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function plateBadge(p, lg) {
  return h('span', { class: 'plate' + (lg ? ' lg' : '') }, h('span', { class: 'il' }, 'IL'), h('span', { class: 'num' }, fmtPlate(p) || '—'));
}
function typeTag(t) { return h('span', { class: 'tag ' + t }, ic(t === 'trailer' ? 'trailer' : 'truck'), typeName(t)); }
function toast(msg, kind = '') {
  const t = h('div', { class: 'toast ' + kind }, msg); document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
}
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}
function loadImg(src) {
  return new Promise((res, rej) => {
    const url = src instanceof Blob ? URL.createObjectURL(src) : src;
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
  });
}
async function compressImage(file, max = 1600, q = 0.82) {
  try {
    const img = await loadImg(file);
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', q));
  } catch { return file; }
}

/* ---------- storage (local IndexedDB) ---------- */
const DB = {
  _p: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const r = indexedDB.open('tarek-garage', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        const rs = d.createObjectStore('reports', { keyPath: 'id' });
        rs.createIndex('plate', 'plate');
        d.createObjectStore('vehicles', { keyPath: 'plate' });
        d.createObjectStore('employees', { keyPath: 'id' });
        d.createObjectStore('blobs', { keyPath: 'id' });
        d.createObjectStore('settings', { keyPath: 'key' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this._p;
  },
  async tx(store, mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store);
      let out; const r = fn(s);
      if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  get(s, k) { return this.tx(s, 'readonly', st => st.get(k)); },
  all(s) { return this.tx(s, 'readonly', st => st.getAll()); },
  put(s, v) { return this.tx(s, 'readwrite', st => st.put(v)); },
  del(s, k) { return this.tx(s, 'readwrite', st => st.delete(k)); },
  byPlate(p) { return this.tx('reports', 'readonly', st => st.index('plate').getAll(p)); },
  async setting(k, d = null) { const r = await this.get('settings', k); return r ? r.value : d; },
  setSetting(k, v) { return this.put('settings', { key: k, value: v }); },
};
const urlCache = new Map();
async function saveBlob(blob) {
  const id = uid();
  const data = await new Response(blob).arrayBuffer();
  await DB.put('blobs', { id, type: blob.type || 'application/octet-stream', data, size: blob.size, at: Date.now() });
  return id;
}
async function blobURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await DB.get('blobs', id); if (!b) return null;
  const u = URL.createObjectURL(new Blob([b.data], { type: b.type })); urlCache.set(id, u); return u;
}
async function employees(all) {
  const list = (await DB.all('employees')).sort((a, b) => a.name.localeCompare(b.name, 'he'));
  return all ? list : list.filter(e => e.active !== false);
}
async function reportsSorted() {
  return (await DB.all('reports')).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
}
async function upsertVehicle(r) {
  const v = (await DB.get('vehicles', r.plate)) || { plate: r.plate, firstSeen: r.createdAt };
  v.type = r.type;
  if (r.customer) v.customer = r.customer;
  if (r.type === 'truck' && r.model) v.model = r.model;
  if (r.km && r.createdAt >= (v.lastKmAt || 0)) { v.lastKm = r.km; v.lastKmAt = r.createdAt; }
  v.lastSeen = Math.max(v.lastSeen || 0, r.updatedAt || r.createdAt);
  if (r.demo) v.demo = true;
  await DB.put('vehicles', v);
}

/* ---------- plate OCR (Tesseract, loaded on first use) ---------- */
const OCR = {
  _w: null,
  async worker() {
    if (this._w) return this._w;
    if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
    this._w = await Tesseract.createWorker('eng', 1);
    await this._w.setParameters({ tessedit_char_whitelist: '0123456789' });
    return this._w;
  },
  // find the yellow Israeli plate in the photo
  findYellow(img) {
    const W = 320, sc = W / img.naturalWidth, H = Math.max(1, Math.round(img.naturalHeight * sc));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      mask[i] = (r > 120 && g > 95 && b < Math.min(r, g) * 0.62 && r - b > 60 && Math.abs(r - g) < 95) ? 1 : 0;
    }
    const seen = new Uint8Array(W * H); let best = null; const q = new Int32Array(W * H);
    for (let s = 0; s < W * H; s++) {
      if (!mask[s] || seen[s]) continue;
      let qh = 0, qt = 0, n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0; q[qt++] = s; seen[s] = 1;
      while (qh < qt) {
        const p = q[qh++], px = p % W, py = (p / W) | 0; n++;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        for (const nb of [p - 1, p + 1, p - W, p + W]) {
          if (nb < 0 || nb >= W * H || seen[nb] || !mask[nb]) continue;
          if ((nb === p - 1 && px === 0) || (nb === p + 1 && px === W - 1)) continue;
          seen[nb] = 1; q[qt++] = nb;
        }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, ar = bw / bh;
      if (n > 150 && ar > 1.8 && ar < 7.5 && (!best || n > best.n)) best = { n, x0, y0, bw, bh };
    }
    if (!best) return null;
    return { x: best.x0 / sc, y: best.y0 / sc, w: best.bw / sc, h: best.bh / sc };
  },
  prep(img, box, targetH = 110) {
    const sc = targetH / box.h, pad = 16;
    const c = document.createElement('canvas');
    c.width = Math.round(box.w * sc) + pad * 2; c.height = Math.round(box.h * sc) + pad * 2;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, box.x, box.y, box.w, box.h, pad, pad, c.width - pad * 2, c.height - pad * 2);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data, hist = new Array(256).fill(0), n = d.length / 4;
    const g = new Uint8Array(n);
    for (let i = 0; i < n; i++) { g[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0; hist[g[i]]++; }
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, mx = 0, th = 128;
    for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += i * hist[i];
      const m = (sB / wB - (sum - sB) / wF); const bt = wB * wF * m * m; if (bt > mx) { mx = bt; th = i; } }
    for (let i = 0; i < n; i++) { const v = g[i] > th ? 255 : 0; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; }
    x.putImageData(id, 0, 0); return c;
  },
  pick(text) {
    const groups = (text || '').split(/\n/).map(l => l.replace(/\D/g, '')).filter(Boolean);
    const all = (text || '').replace(/\D/g, '');
    for (const s of [...groups, all]) if (s.length === 8 || s.length === 7) return s;
    for (const s of [...groups, all]) { const m = s.match(/\d{8}/) || s.match(/\d{7}/); if (m) return m[0]; }
    return null;
  },
  async readPlate(blob) {
    const img = await loadImg(blob);
    const w = await this.worker();
    const tries = [];
    const box = this.findYellow(img);
    if (box) {
      const px = box.w * 0.02, py = box.h * 0.06;
      tries.push([this.prep(img, { x: Math.max(0, box.x - px), y: Math.max(0, box.y - py), w: box.w + px * 2, h: box.h + py * 2 }), '7']);
    }
    const W = img.naturalWidth, H = img.naturalHeight;
    tries.push([this.prep(img, { x: W * 0.1, y: H * 0.3, w: W * 0.8, h: H * 0.4 }, 300), '11']);
    tries.push([this.prep(img, { x: 0, y: 0, w: W, h: H }, Math.min(900, H)), '11']);
    let raw = '';
    for (const [canvas, psm] of tries) {
      await w.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await w.recognize(canvas);
      raw = data.text; const p = this.pick(raw);
      if (p) return { plate: p, raw, found: !!box };
    }
    return { plate: null, raw, found: !!box };
  },
};

/* ---------- cloud transcription fallback (optional, OpenAI key per device) ---------- */
async function cloudTranscribe(blob) {
  const key = local.get('openaiKey'); if (!key) throw new Error('no key');
  const ext = /mp4|m4a|aac/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : /wav/.test(blob.type) ? 'wav' : /mpeg|mp3/.test(blob.type) ? 'mp3' : 'webm';
  const fd = new FormData(); fd.append('file', blob, 'rec.' + ext); fd.append('model', 'whisper-1'); fd.append('language', 'he');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return ((await r.json()).text || '').trim();
}

/* ---------- UI building blocks ---------- */
function openSheet(title, content) {
  const prev = document.body.style.overflow;
  const ov = h('div', { class: 'sheet-ov' });
  const close = () => { ov.remove(); document.body.style.overflow = prev; };
  const body = h('div', {}, content);
  ov.append(h('div', { class: 'sheet' }, h('div', { class: 'sheet-head' }, h('h3', {}, title), h('button', { class: 'btn sm', type: 'button', onclick: close }, ic('x'), 'סגור')), body));
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.body.append(ov); document.body.style.overflow = 'hidden';
  return { close, body };
}
function openLightbox(urls, i = 0) {
  const img = h('img', { alt: '' });
  const sc = h('div', { class: 'lb-scroll' }, img);
  const cnt = h('span', { class: 'grow' });
  const show = () => { img.src = urls[i]; sc.classList.remove('zoom'); cnt.textContent = (i + 1) + ' / ' + urls.length; };
  img.onclick = () => sc.classList.toggle('zoom');
  const ov = h('div', { class: 'lb' },
    h('div', { class: 'lb-bar' },
      h('button', { type: 'button', onclick: () => ov.remove() }, 'סגור'), cnt,
      urls.length > 1 && h('button', { type: 'button', onclick: () => { i = (i - 1 + urls.length) % urls.length; show(); } }, 'הקודמת'),
      urls.length > 1 && h('button', { type: 'button', onclick: () => { i = (i + 1) % urls.length; show(); } }, 'הבאה')),
    sc, h('div', { class: 'lb-hint' }, 'הקש על התמונה כדי להגדיל · אפשר גם לצבוט עם שתי אצבעות'));
  document.body.append(ov); show();
}
function photoGrid(urls, onDelete) {
  return h('div', { class: 'thumbs' }, urls.map((u, i) => h('div', { class: 'thumb', role: 'button', onclick: () => openLightbox(urls, i) },
    h('img', { src: u, alt: 'תמונה ' + (i + 1), loading: 'lazy' }),
    onDelete && h('button', { class: 'x', type: 'button', 'aria-label': 'מחק תמונה', onclick: e => { e.stopPropagation(); onDelete(i); } }, ic('x')))));
}

/* Recorder: keeps the original audio AND a Hebrew transcript per recording */
function Recorder() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const list = []; let st = null, timer = null;
  const btn = h('button', { type: 'button', class: 'mic-btn' });
  const timerEl = h('span', {}, '0:00');
  const liveText = h('div', { class: 'live-text' });
  const live = h('div', { class: 'live', hidden: true }, h('div', { class: 'live-head' }, h('span', { class: 'dot' }), 'מקליט… ', timerEl), liveText);
  const listEl = h('div');
  const audioIn = h('input', { type: 'file', accept: 'audio/*', hidden: true });
  const srOn = () => SR && local.get('liveTranscribe', '1') === '1';
  const hint = h('p', { class: 'hint' }, srOn()
    ? 'לחץ "התחל הקלטה", דבר בעברית, ולחץ "סיים הקלטה". הקול נשמר והדיבור נכתב אוטומטית – אפשר לתקן את הכתוב.'
    : 'ההקלטה תישמר. תמלול חי לא זמין בדפדפן הזה – אפשר להקליד את התמלול, או להשתמש במיקרופון של המקלדת.');
  const el = h('div', { class: 'rec-zone' }, btn, live, listEl,
    h('div', { class: 'attach-audio' }, h('button', { type: 'button', class: 'btn sm', onclick: () => audioIn.click() }, ic('file'), 'צרף הקלטה קיימת (מתזכירים קוליים)')), hint);
  const setBtn = () => {
    fill(btn, );
    if (st) { btn.classList.add('on'); btn.append(ic('stop'), h('span', {}, 'סיים הקלטה')); }
    else { btn.classList.remove('on'); btn.append(ic('mic'), h('span', {}, list.length ? 'הקלטה נוספת' : 'התחל הקלטה')); }
  };
  const join = (a, b) => [a, b].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      alert('הדפדפן לא מאפשר הקלטה כאן.\nפתח את הקישור ישירות ב-Safari (לא בתוך אפליקציה אחרת) ואשר גישה למיקרופון.\nבינתיים אפשר לצרף הקלטה קיימת.');
      return;
    }
    const s = st = { base: '', session: '', chunks: [], t0: Date.now(), stopping: false };
    if (srOn()) {
      try {
        const r = new SR(); r.lang = 'he-IL'; r.continuous = true; r.interimResults = true;
        r.onresult = e => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
          s.session = t.replace(/\s+/g, ' ').trim(); liveText.textContent = join(s.base, s.session); };
        r.onerror = e => { s.srError = e.error; };
        r.onend = () => {
          s.base = join(s.base, s.session); s.session = '';
          const fatal = ['not-allowed', 'service-not-allowed', 'audio-capture'].includes(s.srError);
          if (st === s && !s.stopping && !fatal) { try { r.start(); } catch { } }
          else if (s.srDone) s.srDone();
        };
        r.start(); s.sr = r;
      } catch { s.sr = null; }
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      if (st !== s) { stream.getTracks().forEach(t => t.stop()); return; }
      s.stream = stream;
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); s.mr = mr;
      mr.ondataavailable = e => { if (e.data && e.data.size) s.chunks.push(e.data); };
      mr.start(1000);
    }).catch(err => {
      if (st === s) cancel();
      alert('אין גישה למיקרופון.\nבאייפון: הגדרות ← Safari ← מיקרופון ← "אפשר", ואז לרענן את הדף.\n(' + (err && err.name || err) + ')');
    });
    live.hidden = false; liveText.textContent = '';
    timer = setInterval(() => { timerEl.textContent = fmtDur((Date.now() - s.t0) / 1000); }, 500);
    timerEl.textContent = '0:00'; setBtn();
  }
  function cancel() {
    const s = st; if (!s) return; s.stopping = true; st = null; clearInterval(timer);
    try { s.sr && s.sr.abort(); } catch { }
    try { s.mr && s.mr.state !== 'inactive' && s.mr.stop(); } catch { }
    s.stream && s.stream.getTracks().forEach(t => t.stop());
    live.hidden = true; setBtn();
  }
  async function stop() {
    const s = st; if (!s) return; s.stopping = true; btn.disabled = true; clearInterval(timer);
    const dur = (Date.now() - s.t0) / 1000;
    const blobP = new Promise(res => {
      if (!s.mr || s.mr.state === 'inactive') return res(null);
      s.mr.onstop = () => res(new Blob(s.chunks, { type: s.mr.mimeType || 'audio/mp4' }));
      try { s.mr.stop(); } catch { res(null); }
    });
    const srP = new Promise(res => { if (!s.sr) return res(); s.srDone = res; try { s.sr.stop(); } catch { res(); } setTimeout(res, 1800); });
    const [blob] = await Promise.all([blobP, srP]);
    s.stream && s.stream.getTracks().forEach(t => t.stop());
    st = null; live.hidden = true; btn.disabled = false;
    if (!blob || blob.size < 300) { setBtn(); toast('ההקלטה ריקה – נסה שוב', 'bad'); return; }
    addRec(blob, dur, join(s.base, s.session));
  }
  function addRec(blob, dur, transcript) {
    const rec = { id: uid(), blob, url: URL.createObjectURL(blob), mime: blob.type, duration: dur, transcript: transcript || '' };
    list.push(rec); render(); setBtn();
    if (!rec.transcript && local.get('openaiKey')) runCloud(rec);
  }
  async function runCloud(rec) {
    rec.busy = true; render();
    try { rec.transcript = await cloudTranscribe(rec.blob); toast('התמלול מוכן', 'ok'); }
    catch (e) { toast('תמלול בענן נכשל – אפשר להקליד ידנית', 'bad'); }
    rec.busy = false; render();
  }
  function render() {
    fill(listEl, ...list.map((rec, i) => {
      const ta = h('textarea', { class: 'input', rows: 3, placeholder: 'כאן יופיע מה שנאמר. אפשר להקליד או לתקן.', value: rec.transcript });
      ta.addEventListener('input', () => { rec.transcript = ta.value; });
      return h('div', { class: 'rec-card' },
        h('div', { class: 'rec-head' }, ic('mic'), h('span', { class: 'grow' }, 'הקלטה ' + (i + 1) + (rec.duration ? ' · ' + fmtDur(rec.duration) : '')),
          h('button', { type: 'button', class: 'btn sm danger', onclick: () => {
            if (!confirm('למחוק את הקלטה ' + (i + 1) + '?')) return;
            URL.revokeObjectURL(rec.url); list.splice(i, 1); render(); setBtn();
          } }, ic('trash'), 'מחק')),
        h('audio', { controls: true, preload: 'metadata', src: rec.url }),
        h('div', { class: 'tr-lbl' }, rec.busy ? h('span', {}, h('span', { class: 'spin' }), ' מתמלל…') : 'מה נאמר בהקלטה (תמלול – אפשר לתקן):'),
        ta,
        local.get('openaiKey') && !rec.busy && h('button', { type: 'button', class: 'btn sm', style: 'margin-top:8px', onclick: () => runCloud(rec) }, 'תמלל מחדש מההקלטה'));
    }));
  }
  btn.onclick = () => (st ? stop() : start());
  audioIn.onchange = async () => {
    for (const f of audioIn.files) {
      const dur = await new Promise(r => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => r(isFinite(a.duration) ? a.duration : 0); a.onerror = () => r(0); a.src = URL.createObjectURL(f); });
      addRec(f, dur, '');
    }
    audioIn.value = '';
  };
  setBtn();
  return { el, list, isRecording: () => !!st, cleanup() { cancel(); } };
}

function Photos() {
  const list = [];
  const box = h('div');
  const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const gal = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  const status = h('p', { class: 'hint', hidden: true });
  async function add(files) {
    if (!files.length) return;
    status.hidden = false; fill(status, h('span', { class: 'spin' }), ' מעבד תמונות…');
    for (const f of files) { const b = await compressImage(f); list.push({ blob: b, url: URL.createObjectURL(b) }); }
    status.hidden = true; render();
  }
  cam.onchange = () => { add([...cam.files]); cam.value = ''; };
  gal.onchange = () => { add([...gal.files]); gal.value = ''; };
  function render() {
    fill(box, list.length ? photoGrid(list.map(p => p.url), i => { if (confirm('למחוק את התמונה?')) { list.splice(i, 1); render(); } }) : h('p', { class: 'hint', style: 'margin:0 0 4px' }, 'למשל: התקלה, החלק השבור, החלק החדש, אחרי התיקון.'));
  }
  render();
  const el = h('div', {}, box, status, cam, gal,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => cam.click() }, ic('camera'), 'צלם תמונה'),
      h('button', { type: 'button', class: 'btn', onclick: () => gal.click() }, ic('image'), 'מהגלריה')));
  return { el, list };
}

/* text + recordings + photos – used for new reports and for additions */
function Composer(title = 'מה העבודה שבוצעה') {
  const ta = h('textarea', { class: 'input', rows: 4, placeholder: 'כתוב כאן מה בוצע… (אפשר גם רק להקליט)' });
  const rec = Recorder(); const ph = Photos();
  const el = h('div', {},
    h('div', { class: 'card' }, h('h3', {}, title),
      h('label', { class: 'lbl' }, 'דיווח בדיבור (מומלץ)'), rec.el,
      h('label', { class: 'lbl' }, 'או כתיבה ידנית'), ta),
    h('div', { class: 'card' }, h('h3', {}, 'תמונות'), ph.el));
  return {
    el, rec, ph,
    text: () => ta.value.trim(),
    has: () => !!(ta.value.trim() || rec.list.length || ph.list.length),
    dirty: () => !!(ta.value.trim() || rec.list.length || ph.list.length),
    cleanup: () => rec.cleanup(),
  };
}
async function buildEntry(comp, worker, kind, at) {
  const recordings = [];
  for (const r of comp.rec.list) recordings.push({ id: uid(), blobId: await saveBlob(r.blob), mime: r.mime, duration: r.duration, transcript: (r.transcript || '').trim() });
  const photos = [];
  for (const p of comp.ph.list) photos.push(await saveBlob(p.blob));
  return { id: uid(), at, kind, workerId: worker.id, workerName: worker.name, text: comp.text(), recordings, photos };
}

async function WorkerPicker(label = 'שם העובד') {
  let emps = await employees(); let sel = null;
  const last = local.get('lastWorker'); if (last && emps.some(e => e.id === last)) sel = last;
  const wrap = h('div', { class: 'chips workers' });
  const render = () => {
    fill(wrap, ...emps.map(e => h('button', { type: 'button', class: 'chip' + (e.id === sel ? ' on' : ''), onclick: () => { sel = e.id; render(); } }, e.name)),
      h('button', { type: 'button', class: 'chip', onclick: async () => {
        const n = (prompt('שם העובד החדש:') || '').trim(); if (!n) return;
        const e = { id: uid(), name: n, active: true, createdAt: Date.now() }; await DB.put('employees', e);
        emps = await employees(); sel = e.id; render();
      } }, '+ עובד חדש'));
  };
  render();
  return {
    el: h('div', { class: 'card' }, h('label', { class: 'lbl' }, label, ' ', h('span', { class: 'req' }, '*')),
      emps.length ? null : h('p', { class: 'hint', style: 'margin:0 0 6px' }, 'עדיין אין עובדים ברשימה – לחץ "+ עובד חדש".'), wrap),
    get: () => { const e = emps.find(x => x.id === sel); if (e) local.set('lastWorker', e.id); return e || null; },
  };
}

function reportItem(r, onClick) {
  const first = r.entries[0] || {}; const allRec = r.entries.reduce((n, e) => n + e.recordings.length, 0);
  const allPh = r.entries.reduce((n, e) => n + e.photos.length, 0);
  const text = r.entries.map(e => e.text || e.recordings.map(x => x.transcript).join(' ')).filter(Boolean).join(' · ');
  return h('button', { class: 'item', type: 'button', onclick: onClick || (() => go('#/report/' + r.id)) },
    h('div', { class: 'item-top' }, plateBadge(r.plate), typeTag(r.type), h('span', { class: 'grow' }), h('b', { style: 'font-size:15px' }, fmtDate(r.createdAt))),
    h('div', { class: 'meta' }, h('span', {}, r.customer || 'ללא שם לקוח'), h('span', {}, fmtTime(r.createdAt)), h('span', {}, first.workerName || '')),
    text && h('div', { class: 'snip' }, text),
    h('div', { class: 'counts' },
      r.entries.length > 1 && h('span', {}, ic('plus'), (r.entries.length - 1) + ' תוספות'),
      allRec > 0 && h('span', {}, ic('mic'), allRec), allPh > 0 && h('span', {}, ic('image'), allPh),
      r.log.some(l => l.action === 'edit') && h('span', {}, ic('edit'), 'נערך')));
}

/* full report body (used in page + in sheet) */
async function reportBody(r) {
  const el = h('div');
  const plateImg = await blobURL(r.plateImage);
  el.append(h('div', { class: 'card' },
    h('div', { class: 'item-top' }, plateBadge(r.plate, true), typeTag(r.type)),
    h('dl', { class: 'kv' },
      h('dt', {}, 'לקוח'), h('dd', {}, r.customer || '—'),
      r.type === 'truck' && [h('dt', {}, 'דגם'), h('dd', {}, r.model || '—'), h('dt', {}, 'קילומטרים'), h('dd', {}, r.km ? fmtNum(r.km) : '—')],
      h('dt', {}, 'תאריך'), h('dd', {}, fmtDate(r.createdAt)),
      h('dt', {}, 'שעה'), h('dd', {}, fmtTime(r.createdAt)),
      h('dt', {}, 'נפתח ע״י'), h('dd', {}, r.createdByName || '—')),
    plateImg && h('div', { style: 'margin-top:12px' }, h('div', { class: 'sec-title', style: 'margin-top:0' }, 'צילום לוחית הרישוי'), photoGrid([plateImg]))));
  for (let i = 0; i < r.entries.length; i++) {
    const e = r.entries[i];
    const label = e.kind === 'note' ? 'הערה' : i === 0 ? 'העבודה שבוצעה' : 'עבודה נוספת';
    const card = h('div', { class: 'card entry' + (e.kind === 'note' ? ' note' : '') },
      h('div', { class: 'entry-head' }, h('b', {}, label), h('span', { class: 'tag' }, ic('clock'), fmtDT(e.at)), h('span', { class: 'tag' }, ic('user'), e.workerName)));
    if (e.text) card.append(h('div', { class: 'sec-title', style: 'margin-top:0' }, 'טקסט שהוקלד'), h('div', { class: 'entry-text' }, e.text));
    if (e.versions && e.versions.length) card.append(versionsEl(e.versions));
    for (let j = 0; j < e.recordings.length; j++) {
      const rc = e.recordings[j]; const u = await blobURL(rc.blobId);
      card.append(h('div', { class: 'rec-card' },
        h('div', { class: 'rec-head' }, ic('mic'), h('span', { class: 'grow' }, 'הקלטה ' + (j + 1) + (rc.duration ? ' · ' + fmtDur(rc.duration) : ''))),
        u ? h('audio', { controls: true, preload: 'metadata', src: u }) : h('p', { class: 'hint' }, 'קובץ ההקלטה לא נמצא במכשיר הזה'),
        h('div', { class: 'tr-lbl' }, 'תמלול:'), h('div', { class: 'tr-text' }, rc.transcript || '(אין תמלול)'),
        rc.versions && rc.versions.length ? versionsEl(rc.versions) : null));
    }
    if (e.photos.length) {
      const urls = (await Promise.all(e.photos.map(blobURL))).filter(Boolean);
      card.append(h('div', { class: 'sec-title' }, 'תמונות (' + urls.length + ')'), photoGrid(urls));
    }
    el.append(card);
  }
  el.append(h('div', { class: 'card' }, h('h3', {}, 'היסטוריית שינויים'),
    h('ul', { class: 'log' }, r.log.slice().reverse().map(logLine))));
  return el;
}
function versionsEl(vs) {
  return h('details', { class: 'versions' }, h('summary', {}, 'נערך ' + vs.length + ' פעמים – הצג גרסאות קודמות'),
    vs.slice().reverse().map(v => h('div', { class: 'v' }, h('b', {}, 'לפני העריכה של ' + v.by + ' ב-' + fmtDT(v.at) + ':'), '\n', v.text || '(ריק)')));
}
function logLine(l) {
  const what = l.action === 'create' ? 'יצר/ה את הדיווח' : l.action === 'add' ? (l.kind === 'note' ? 'הוסיף/ה הערה' : 'הוסיף/ה עבודה') : 'תיקן/ה את הדיווח';
  return h('li', {}, h('b', {}, fmtDT(l.at)), ' · ', l.workerName, ' · ', what,
    l.changes && l.changes.length ? h('div', { class: 'chg' }, l.changes.map(c => h('div', {}, c.field + ': "' + (c.from || '—') + '" ← "' + (c.to || '—') + '"'))) : null);
}

/* ---------- router ---------- */
const view = $('#view');
let cleanup = null, dirtyCheck = null, ignoreHash = false, lastHash = location.hash;
function go(hash) { location.hash = hash; }
function setHeader(tab, subTitle, backTo) {
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  const sub = $('#sub'); sub.hidden = !subTitle; $('#subTitle').textContent = subTitle || '';
  $('#backBtn').onclick = () => (backTo ? go(backTo) : history.length > 1 ? history.back() : go('#/'));
  document.title = (subTitle ? subTitle + ' – ' : '') + 'מוסך טארק ת.ד בע״מ';
}
async function route() {
  if (ignoreHash) { ignoreHash = false; return; }
  if (dirtyCheck && dirtyCheck() && !confirm('יש פרטים שלא נשמרו. לצאת בלי לשמור?')) { ignoreHash = true; location.hash = lastHash; return; }
  lastHash = location.hash; dirtyCheck = null;
  if (cleanup) { try { cleanup(); } catch { } cleanup = null; }
  document.querySelectorAll('.sheet-ov,.lb').forEach(x => x.remove()); document.body.style.overflow = '';
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const p = path.split('/').filter(Boolean); const q = new URLSearchParams(qs || '');
  fill(view, h('div', { class: 'empty' }, h('span', { class: 'spin' })));
  try {
    if (!p.length) await viewHome();
    else if (p[0] === 'new' && (p[1] === 'truck' || p[1] === 'trailer')) await viewNew(p[1], q.get('plate'));
    else if (p[0] === 'new') await viewPick();
    else if (p[0] === 'history') await viewHistory(q.get('q') || '');
    else if (p[0] === 'vehicle') await viewVehicle(decodeURIComponent(p[1] || ''));
    else if (p[0] === 'report' && p[2] === 'add') await viewAdd(p[1]);
    else if (p[0] === 'report' && p[2] === 'edit') await viewEdit(p[1]);
    else if (p[0] === 'report') await viewReport(p[1]);
    else if (p[0] === 'admin') await viewAdmin(p[1] || 'works');
    else await viewHome();
  } catch (err) {
    console.error(err);
    fill(view, h('div', { class: 'card' }, h('h3', {}, 'אירעה שגיאה'), h('p', {}, String(err && err.message || err)), h('a', { class: 'btn', href: '#/' }, 'למסך הראשי')));
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', e => { if (dirtyCheck && dirtyCheck()) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- vehicle pictures ---------- */
const TRUCK_SVG = `<svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="משאית">
<ellipse cx="165" cy="172" rx="150" ry="7" fill="#0b2f5e" opacity=".12"/>
<rect x="34" y="120" width="236" height="13" rx="3" fill="#2f3742"/>
<rect x="52" y="111" width="66" height="9" rx="2" fill="#262c34"/>
<path d="M60 126 q0-24 26-24 h48 q26 0 26 24" fill="#e9edf2" stroke="#8e99a6" stroke-width="2"/>
<rect x="146" y="114" width="40" height="19" rx="9" fill="#d3d9e0" stroke="#8e99a6" stroke-width="2"/>
<path d="M190 44 Q190 32 202 30 L262 26 Q281 25 284 42 L295 116 Q297 131 282 131 L190 131 Z" fill="#fff" stroke="#8e99a6" stroke-width="2.5"/>
<path d="M196 30 Q200 8 232 6 L262 6 Q280 7 281 26 L262 26 L202 30 Z" fill="#f4f6f9" stroke="#8e99a6" stroke-width="2"/>
<path d="M238 40 L276 37 Q282 37 283 44 L287 74 L238 76 Z" fill="#26384d"/>
<path d="M243 43 L270 41 L250 72 L242 72 Z" fill="#fff" opacity=".22"/>
<rect x="198" y="40" width="34" height="30" rx="5" fill="#26384d" opacity=".85"/>
<rect x="234" y="80" width="54" height="2.5" fill="#c9d0d8"/><rect x="234" y="80" width="2.5" height="44" fill="#c9d0d8"/>
<rect x="244" y="86" width="12" height="4" rx="2" fill="#8e99a6"/>
<path d="M288 44 L303 46" stroke="#5c6672" stroke-width="3"/><rect x="301" y="38" width="7" height="24" rx="3" fill="#3a4450"/>
<rect x="276" y="118" width="24" height="15" rx="4" fill="#5c6672"/><rect x="284" y="108" width="12" height="7" rx="2" fill="#ffd34d"/>
<rect x="222" y="117" width="14" height="4" fill="#8e99a6"/><rect x="222" y="125" width="14" height="4" fill="#8e99a6"/>
<g fill="#1d232b"><circle cx="262" cy="146" r="21"/><circle cx="82" cy="146" r="21"/><circle cx="130" cy="146" r="21"/></g>
<g fill="#aab4bf"><circle cx="262" cy="146" r="10"/><circle cx="82" cy="146" r="10"/><circle cx="130" cy="146" r="10"/></g>
<g fill="#5c6672"><circle cx="262" cy="146" r="3.5"/><circle cx="82" cy="146" r="3.5"/><circle cx="130" cy="146" r="3.5"/></g>
<path d="M238 131 q0-28 24-28 q24 0 24 28" fill="none" stroke="#2f3742" stroke-width="5"/>
</svg>`;
const TRAILER_SVG = `<svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="נגרר">
<ellipse cx="160" cy="172" rx="152" ry="7" fill="#0b2f5e" opacity=".12"/>
<rect x="10" y="26" width="300" height="96" rx="4" fill="#fff" stroke="#8e99a6" stroke-width="2.5"/>
<g stroke="#e1e6ec" stroke-width="2"><line x1="10" y1="50" x2="310" y2="50"/><line x1="10" y1="74" x2="310" y2="74"/><line x1="10" y1="98" x2="310" y2="98"/></g>
<line x1="24" y1="26" x2="24" y2="122" stroke="#c9d0d8" stroke-width="2"/>
<rect x="14" y="122" width="292" height="9" fill="#2f3742"/>
<g fill="#f59e0b"><circle cx="70" cy="117" r="2.6"/><circle cx="160" cy="117" r="2.6"/><circle cx="250" cy="117" r="2.6"/></g>
<rect x="226" y="131" width="6" height="26" fill="#5c6672"/><rect x="220" y="156" width="18" height="4" rx="2" fill="#3a4450"/>
<rect x="286" y="131" width="8" height="8" fill="#3a4450"/>
<path d="M18 131 q0-22 24-22 h108 q24 0 24 22" fill="#e9edf2" stroke="#8e99a6" stroke-width="2"/>
<g fill="#1d232b"><circle cx="50" cy="146" r="18"/><circle cx="96" cy="146" r="18"/><circle cx="142" cy="146" r="18"/></g>
<g fill="#aab4bf"><circle cx="50" cy="146" r="8.5"/><circle cx="96" cy="146" r="8.5"/><circle cx="142" cy="146" r="8.5"/></g>
<g fill="#5c6672"><circle cx="50" cy="146" r="3"/><circle cx="96" cy="146" r="3"/><circle cx="142" cy="146" r="3"/></g>
</svg>`;
async function vehicleButtons() {
  const [ti, ri] = await Promise.all([DB.setting('truckImg'), DB.setting('trailerImg')]);
  const pic = async (id, svg) => { const u = id && await blobURL(id); return u ? h('div', { class: 'pic' }, h('img', { src: u, alt: '' })) : h('div', { class: 'pic', html: svg }); };
  return h('div', { class: 'vehicles' },
    h('button', { class: 'vbtn', type: 'button', onclick: () => go('#/new/truck') }, await pic(ti, TRUCK_SVG), h('span', {}, 'משאית')),
    h('button', { class: 'vbtn', type: 'button', onclick: () => go('#/new/trailer') }, await pic(ri, TRAILER_SVG), h('span', {}, 'נגרר')));
}
function demoNote() {
  return h('div', { class: 'demo-pill' }, ic('doc'), h('span', {}, 'גרסת ניסיון: העבודות נשמרות בטלפון הזה בלבד. בשלב הבא נחבר שמירה משותפת בענן לכל העובדים.'));
}

/* ---------- views ---------- */
async function viewHome() {
  setHeader('home');
  const recent = (await reportsSorted()).slice(0, 5);
  fill(view, 
    h('div', { class: 'card' }, h('h2', { class: 'pick-title' }, 'בחר סוג רכב'), await vehicleButtons()),
    h('a', { class: 'btn big dark', href: '#/history', style: 'margin-bottom:14px' }, ic('search'), 'חיפוש היסטוריית טיפולים'),
    demoNote(),
    h('h3', { style: 'margin:6px 2px 10px' }, 'עבודות אחרונות'),
    recent.length ? recent.map(r => reportItem(r)) : h('div', { class: 'empty' }, 'עדיין אין עבודות. לחץ "משאית" או "נגרר" כדי לדווח.'),
    h('div', { style: 'text-align:center;margin-top:18px' }, h('a', { class: 'btn sm', href: '#/admin' }, ic('gear'), 'מסך מנהל')));
}
async function viewPick() {
  setHeader('new');
  fill(view, h('div', { class: 'card' }, h('h2', { class: 'pick-title' }, 'דיווח עבודה חדשה – בחר סוג רכב'), await vehicleButtons()));
}

function PlateField(onChange, opts = {}) {
  const input = h('input', { class: 'input plate-in', inputmode: 'numeric', autocomplete: 'off', placeholder: 'הקלד מספר רכב', value: opts.value ? fmtPlate(opts.value) : '' });
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const status = h('div', { class: 'ocr-status', hidden: true });
  const preview = h('img', { class: 'plate-photo', hidden: true, alt: 'צילום לוחית' });
  const state = { image: null };
  let t = null;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => onChange(normPlate(input.value)), 350); });
  input.addEventListener('blur', () => { if (normPlate(input.value)) input.value = fmtPlate(input.value); });
  file.onchange = async () => {
    const f = file.files[0]; file.value = ''; if (!f) return;
    const blob = await compressImage(f, 2000, 0.9); state.image = blob;
    preview.src = URL.createObjectURL(blob); preview.hidden = !opts.keepPhoto;
    status.hidden = false; status.className = 'ocr-status'; fill(status, h('span', { class: 'spin' }), ' מזהה את מספר הרישוי…');
    try {
      const r = await OCR.readPlate(blob);
      if (r.plate) {
        input.value = fmtPlate(r.plate); onChange(r.plate);
        status.className = 'ocr-status ok'; status.textContent = '✓ זוהה: ' + fmtPlate(r.plate) + ' – בדוק שהמספר נכון. אם לא, תקן בשדה.';
      } else {
        status.className = 'ocr-status bad'; status.textContent = 'לא הצלחתי לקרוא את המספר. צלם שוב קרוב יותר וישר, או הקלד ידנית.';
      }
    } catch (e) {
      console.warn(e);
      status.className = 'ocr-status bad'; status.textContent = 'הזיהוי האוטומטי לא זמין כרגע (נדרש אינטרנט בפעם הראשונה). הקלד את המספר ידנית.';
    }
  };
  const el = h('div', {}, input, file,
    h('button', { type: 'button', class: 'btn wide', style: 'margin-top:10px', onclick: () => file.click() }, ic('camera'), 'צלם מספר רישוי'),
    status, preview);
  return { el, input, state, value: () => normPlate(input.value) };
}

async function viewNew(type, prePlate) {
  const isTruck = type === 'truck';
  setHeader('new', 'דיווח עבודה חדשה – ' + typeName(type), '#/new');
  const vehicles = await DB.all('vehicles');
  const custList = h('datalist', { id: 'custs' }, [...new Set(vehicles.map(v => v.customer).filter(Boolean))].map(c => h('option', { value: c })));
  const customer = h('input', { class: 'input', list: 'custs', placeholder: 'חברה או שם בעל הרכב', autocomplete: 'off' });
  const model = h('input', { class: 'input', placeholder: 'לדוגמה DAF XF', autocomplete: 'off' });
  const km = h('input', { class: 'input', inputmode: 'numeric', placeholder: 'קילומטרים במשאית', autocomplete: 'off' });
  km.addEventListener('input', () => { const d = km.value.replace(/\D/g, ''); km.value = d ? fmtNum(+d) : ''; });
  const kmHint = h('p', { class: 'hint', hidden: true });
  const known = h('div', { class: 'known', hidden: true });
  const plate = PlateField(lookup, { value: prePlate, keepPhoto: true });

  async function lookup(p) {
    known.hidden = true; kmHint.hidden = true;
    if (p.length < 5) return;
    const v = await DB.get('vehicles', p); if (!v) return;
    if (!customer.value && v.customer) customer.value = v.customer;
    if (isTruck && !model.value && v.model) model.value = v.model;
    if (isTruck && v.lastKm) { kmHint.hidden = false; kmHint.textContent = 'קילומטרים בטיפול הקודם: ' + fmtNum(v.lastKm); }
    const reps = (await DB.byPlate(p)).sort((a, b) => b.createdAt - a.createdAt);
    const today = reps.find(r => sameDay(r.createdAt, Date.now()));
    known.hidden = false;
    fill(known, 
      h('div', {}, h('b', {}, '✓ רכב מוכר במוסך'), ' – ', reps.length + ' טיפולים קודמים', reps[0] ? ' · אחרון: ' + fmtDate(reps[0].createdAt) : ''),
      v.type !== type ? h('div', { class: 'hint' }, 'שים לב: הרכב רשום אצלנו כ' + typeName(v.type) + '.') : null,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => showVehicleSheet(p) }, ic('clock'), 'טיפולים קודמים'),
        today && h('button', { type: 'button', class: 'btn sm ok', onclick: () => go('#/report/' + today.id + '/add') }, ic('plus'), 'המשך את הדיווח מהיום')));
  }
  const comp = Composer();
  const worker = await WorkerPicker('שם העובד שביצע את העבודה');
  const when = h('div', { class: 'when' }, ic('clock'));
  const tick = () => { when.lastChild.nodeType === 3 && when.lastChild.remove(); when.append('התאריך והשעה יישמרו אוטומטית: ' + fmtDT(Date.now())); };
  tick(); const iv = setInterval(tick, 20000);
  const saveBtn = h('button', { type: 'button', class: 'btn big ok' }, ic('check'), 'שמור עבודה');

  const vcard = h('div', { class: 'card' },
    h('label', { class: 'lbl' }, 'מספר רישוי ', h('span', { class: 'req' }, '*')), plate.el, known,
    h('label', { class: 'lbl' }, 'שם הלקוח'), customer, custList,
    isTruck && [h('label', { class: 'lbl' }, 'דגם המשאית'), model,
      h('div', { class: 'chips' }, ['DAF', 'Volvo', 'Scania', 'Mercedes', 'MAN', 'Renault', 'Iveco'].map(m => h('button', { type: 'button', class: 'chip', onclick: () => { model.value = m; } }, m))),
      h('label', { class: 'lbl' }, 'קילומטרים'), km, kmHint]);
  fill(view, vcard, comp.el, worker.el, when, saveBtn);
  if (prePlate) lookup(normPlate(prePlate));

  dirtyCheck = () => !!(plate.value() || customer.value || comp.dirty());
  cleanup = () => { clearInterval(iv); comp.cleanup(); };

  saveBtn.onclick = async () => {
    const p = plate.value();
    if (p.length < 5) { alert('הכנס מספר רישוי (או צלם את הלוחית).'); plate.input.focus(); return; }
    if (comp.rec.isRecording()) { alert('יש הקלטה פעילה – לחץ קודם "סיים הקלטה".'); return; }
    if (!comp.has()) { alert('תאר את העבודה: הקלטה, כתיבה או תמונה.'); return; }
    const w = worker.get(); if (!w) { alert('בחר את השם שלך מרשימת העובדים.'); return; }
    const kmVal = +km.value.replace(/\D/g, '') || null;
    if (isTruck && !kmVal && !confirm('לא הוזנו קילומטרים. לשמור בכל זאת?')) return;
    saveBtn.disabled = true; fill(saveBtn, h('span', { class: 'spin' }), ' שומר…');
    try {
      const now = Date.now();
      const r = {
        id: uid(), type, plate: p, customer: customer.value.trim(), model: isTruck ? model.value.trim() : '', km: isTruck ? kmVal : null,
        createdAt: now, updatedAt: now, createdBy: w.id, createdByName: w.name,
        plateImage: plate.state.image ? await saveBlob(plate.state.image) : null,
        entries: [await buildEntry(comp, w, 'work', now)],
        log: [{ at: now, workerId: w.id, workerName: w.name, action: 'create' }],
      };
      await DB.put('reports', r); await upsertVehicle(r);
      dirtyCheck = null; toast('העבודה נשמרה ✓', 'ok'); go('#/report/' + r.id);
    } catch (e) {
      console.error(e); alert('השמירה נכשלה: ' + (e && e.message || e));
      saveBtn.disabled = false; fill(saveBtn, ic('check'), 'שמור עבודה');
    }
  };
}

async function showVehicleSheet(plate) {
  const reps = (await DB.byPlate(plate)).sort((a, b) => b.createdAt - a.createdAt);
  const s = openSheet('טיפולים קודמים – ' + fmtPlate(plate), h('div'));
  const list = () => fill(s.body, ...reps.map(r => reportItem(r, async () => {
    fill(s.body, h('button', { class: 'btn sm', type: 'button', style: 'margin-bottom:12px', onclick: list }, 'חזרה לרשימה'), await reportBody(r));
    s.body.parentElement.scrollTop = 0;
  })));
  list();
}

async function viewHistory(q0) {
  setHeader('history');
  const input = h('input', { class: 'input', placeholder: 'מספר רישוי או שם לקוח', value: q0, autocomplete: 'off', enterkeyhint: 'search' });
  const results = h('div');
  const plate = PlateField(p => { input.value = fmtPlate(p); run(true); });
  plate.input.hidden = true;
  async function run(fromUser) {
    const q = input.value.trim(); const qd = normPlate(q);
    history.replaceState(null, '', '#/history' + (q ? '?q=' + encodeURIComponent(q) : '')); lastHash = location.hash;
    const vs = (await DB.all('vehicles')).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    let hits;
    if (!q) hits = vs.slice(0, 30);
    else if (qd.length >= 2 && qd.length === q.replace(/[\s-]/g, '').length) hits = vs.filter(v => v.plate.includes(qd));
    else hits = vs.filter(v => (v.customer || '').includes(q));
    if (fromUser === true && hits.length === 1 && q && qd && hits[0].plate === qd) { go('#/vehicle/' + qd); return; }
    fill(results, 
      h('h3', { style: 'margin:6px 2px 10px' }, q ? 'נמצאו ' + hits.length + ' רכבים' : 'רכבים אחרונים במוסך'),
      hits.length ? hits.map(v => h('button', { class: 'item', type: 'button', onclick: () => go('#/vehicle/' + v.plate) },
        h('div', { class: 'item-top' }, plateBadge(v.plate), typeTag(v.type), h('span', { class: 'grow' })),
        h('div', { class: 'meta' }, h('span', {}, v.customer || 'ללא שם לקוח'), v.model && h('span', {}, v.model), v.lastSeen && h('span', {}, 'ביקור אחרון: ' + fmtDate(v.lastSeen)))))
        : h('div', { class: 'empty' }, q ? 'לא נמצא רכב. בדוק את המספר.' : 'עדיין אין רכבים במערכת.'));
  }
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { input.blur(); run(true); } });
  let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 300); });
  fill(view, h('div', { class: 'card' }, h('h3', {}, 'חיפוש היסטוריית טיפולים'), input,
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn primary', onclick: () => run(true) }, ic('search'), 'חפש')),
    plate.el), results);
  run();
}

async function viewVehicle(p) {
  const v = await DB.get('vehicles', p);
  const reps = (await DB.byPlate(p)).sort((a, b) => b.createdAt - a.createdAt);
  setHeader('history', 'היסטוריה – ' + fmtPlate(p), '#/history');
  if (!v && !reps.length) { fill(view, h('div', { class: 'empty' }, 'הרכב לא נמצא')); return; }
  const type = (v && v.type) || reps[0].type;
  fill(view, 
    h('div', { class: 'card' }, h('div', { class: 'item-top' }, plateBadge(p, true), typeTag(type)),
      h('dl', { class: 'kv' }, h('dt', {}, 'לקוח'), h('dd', {}, (v && v.customer) || '—'),
        type === 'truck' && [h('dt', {}, 'דגם'), h('dd', {}, (v && v.model) || '—'), h('dt', {}, 'ק״מ אחרון'), h('dd', {}, v && v.lastKm ? fmtNum(v.lastKm) : '—')],
        h('dt', {}, 'ביקורים'), h('dd', {}, reps.length)),
      h('a', { class: 'btn big ok', style: 'margin-top:14px', href: '#/new/' + type + '?plate=' + p }, ic('plus'), 'דיווח עבודה חדש לרכב זה')),
    h('h3', { style: 'margin:6px 2px 10px' }, 'כל הטיפולים (החדש ביותר ראשון)'),
    reps.map(r => reportItem(r)));
}

async function viewReport(id) {
  const r = await DB.get('reports', id);
  if (!r) { setHeader('', 'דיווח'); fill(view, h('div', { class: 'empty' }, 'הדיווח לא נמצא')); return; }
  setHeader('', typeName(r.type) + ' ' + fmtPlate(r.plate));
  fill(view, 
    h('a', { class: 'btn big primary', href: '#/report/' + id + '/add', style: 'margin-bottom:10px' }, ic('plus'), 'הוסף עבודה / הקלטה / תמונות'),
    h('a', { class: 'btn wide', href: '#/report/' + id + '/edit', style: 'margin-bottom:14px' }, ic('edit'), 'תקן טעות בדיווח'),
    await reportBody(r),
    h('a', { class: 'btn wide', href: '#/vehicle/' + r.plate }, ic('clock'), 'כל הטיפולים של הרכב הזה'));
}

async function viewAdd(id) {
  const r = await DB.get('reports', id); if (!r) return viewReport(id);
  setHeader('', 'הוספה לדיווח ' + fmtPlate(r.plate), '#/report/' + id);
  let kind = 'work';
  const kinds = h('div', { class: 'chips' });
  const renderKinds = () => fill(kinds, ...[['work', 'עבודה נוספת'], ['note', 'הערה']].map(([k, l]) => h('button', { type: 'button', class: 'chip' + (kind === k ? ' on' : ''), onclick: () => { kind = k; renderKinds(); } }, l)));
  renderKinds();
  const comp = Composer('מה נוסף');
  const worker = await WorkerPicker('מי מוסיף');
  const saveBtn = h('button', { type: 'button', class: 'btn big ok' }, ic('check'), 'שמור תוספת');
  fill(view, 
    h('div', { class: 'card' }, h('div', { class: 'item-top' }, plateBadge(r.plate), typeTag(r.type), h('span', {}, r.customer || '')),
      h('p', { class: 'hint' }, 'הדיווח נפתח ב-' + fmtDT(r.createdAt) + '. מה שנרשם קודם נשאר כמו שהוא – התוספת תישמר בנפרד עם השם והשעה.'),
      h('label', { class: 'lbl', style: 'margin-top:12px' }, 'סוג התוספת'), kinds),
    comp.el, worker.el, saveBtn);
  dirtyCheck = () => comp.dirty(); cleanup = () => comp.cleanup();
  saveBtn.onclick = async () => {
    if (comp.rec.isRecording()) { alert('יש הקלטה פעילה – לחץ קודם "סיים הקלטה".'); return; }
    if (!comp.has()) { alert('אין מה לשמור – הקלט, כתוב או צלם.'); return; }
    const w = worker.get(); if (!w) { alert('בחר את השם שלך.'); return; }
    saveBtn.disabled = true; fill(saveBtn, h('span', { class: 'spin' }), ' שומר…');
    const now = Date.now();
    const fresh = await DB.get('reports', id);
    fresh.entries.push(await buildEntry(comp, w, kind, now));
    fresh.log.push({ at: now, workerId: w.id, workerName: w.name, action: 'add', kind });
    fresh.updatedAt = now; await DB.put('reports', fresh); await upsertVehicle(fresh);
    dirtyCheck = null; toast('התוספת נשמרה ✓', 'ok'); go('#/report/' + id);
  };
}

async function viewEdit(id) {
  const r = await DB.get('reports', id); if (!r) return viewReport(id);
  setHeader('', 'תיקון דיווח ' + fmtPlate(r.plate), '#/report/' + id);
  const isTruck = r.type === 'truck';
  const f = {
    plate: h('input', { class: 'input plate-in', inputmode: 'numeric', value: fmtPlate(r.plate) }),
    customer: h('input', { class: 'input', value: r.customer || '' }),
    model: h('input', { class: 'input', value: r.model || '' }),
    km: h('input', { class: 'input', inputmode: 'numeric', value: r.km ? String(r.km) : '' }),
  };
  const entryFields = r.entries.map((e, i) => ({
    e, ta: h('textarea', { class: 'input', rows: 3, value: e.text || '' }),
    recs: e.recordings.map(rc => ({ rc, ta: h('textarea', { class: 'input', rows: 2, value: rc.transcript || '' }) })),
    label: e.kind === 'note' ? 'הערה' : i === 0 ? 'העבודה שבוצעה' : 'עבודה נוספת ' + i,
  }));
  const worker = await WorkerPicker('מי מתקן');
  const saveBtn = h('button', { type: 'button', class: 'btn big ok' }, ic('check'), 'שמור תיקון');
  fill(view, 
    h('div', { class: 'demo-pill' }, ic('edit'), h('span', {}, 'כל תיקון נרשם בהיסטוריית השינויים עם שם המתקן והשעה, והנוסח הקודם נשמר.')),
    h('div', { class: 'card' }, h('h3', {}, 'פרטי הרכב'),
      h('label', { class: 'lbl' }, 'מספר רישוי'), f.plate, h('label', { class: 'lbl' }, 'שם הלקוח'), f.customer,
      isTruck && [h('label', { class: 'lbl' }, 'דגם'), f.model, h('label', { class: 'lbl' }, 'קילומטרים'), f.km]),
    entryFields.map(x => h('div', { class: 'card' }, h('h3', {}, x.label + ' · ' + fmtDT(x.e.at) + ' · ' + x.e.workerName),
      h('label', { class: 'lbl' }, 'טקסט'), x.ta,
      x.recs.map((y, j) => [h('label', { class: 'lbl' }, 'תמלול הקלטה ' + (j + 1)), y.ta]))),
    worker.el, saveBtn);
  const dirty = () => normPlate(f.plate.value) !== r.plate || f.customer.value.trim() !== (r.customer || '') ||
    (isTruck && (f.model.value.trim() !== (r.model || '') || (+normPlate(f.km.value) || null) !== (r.km || null))) ||
    entryFields.some(x => x.ta.value.trim() !== (x.e.text || '') || x.recs.some(y => y.ta.value.trim() !== (y.rc.transcript || '')));
  dirtyCheck = dirty;
  saveBtn.onclick = async () => {
    if (!dirty()) { toast('לא בוצעו שינויים'); return; }
    const w = worker.get(); if (!w) { alert('בחר את השם של מי שמתקן.'); return; }
    const np = normPlate(f.plate.value); if (np.length < 5) { alert('מספר רישוי לא תקין'); return; }
    const now = Date.now(), changes = [];
    const fresh = await DB.get('reports', id);
    const setF = (key, label, val, show = v => v) => { const old = fresh[key] == null ? '' : fresh[key]; if ((val == null ? '' : val) !== old) { changes.push({ field: label, from: show(old), to: show(val) }); fresh[key] = val; } };
    setF('plate', 'מספר רישוי', np, fmtPlate);
    setF('customer', 'לקוח', f.customer.value.trim());
    if (isTruck) { setF('model', 'דגם', f.model.value.trim()); setF('km', 'קילומטרים', +normPlate(f.km.value) || null, v => v ? fmtNum(v) : ''); }
    entryFields.forEach((x, i) => {
      const e = fresh.entries[i]; const nv = x.ta.value.trim();
      if (nv !== (e.text || '')) { (e.versions = e.versions || []).push({ text: e.text || '', at: now, by: w.name }); changes.push({ field: 'טקסט – ' + x.label, from: e.text, to: nv }); e.text = nv; }
      x.recs.forEach((y, j) => { const rc = e.recordings[j]; const tv = y.ta.value.trim();
        if (tv !== (rc.transcript || '')) { (rc.versions = rc.versions || []).push({ text: rc.transcript || '', at: now, by: w.name }); changes.push({ field: 'תמלול הקלטה ' + (j + 1) + ' – ' + x.label, from: rc.transcript, to: tv }); rc.transcript = tv; } });
    });
    fresh.log.push({ at: now, workerId: w.id, workerName: w.name, action: 'edit', changes });
    fresh.updatedAt = now; await DB.put('reports', fresh); await upsertVehicle(fresh);
    dirtyCheck = null; toast('התיקון נשמר ✓', 'ok'); go('#/report/' + id);
  };
}

/* ---------- admin ---------- */
async function viewAdmin(tab) {
  const pin = await DB.setting('adminPin');
  let unlocked = false; try { unlocked = sessionStorage.getItem('tg_admin') === '1'; } catch { }
  if (pin && !unlocked) {
    const v = prompt('קוד מנהל:');
    if (v !== pin) { if (v != null) alert('קוד שגוי'); go('#/'); return; }
    try { sessionStorage.setItem('tg_admin', '1'); } catch { }
  }
  setHeader('', 'מסך מנהל', '#/');
  const tabs = h('div', { class: 'subtabs' }, [['works', 'כל העבודות'], ['workers', 'עובדים'], ['changes', 'מי ערך מה'], ['settings', 'הגדרות וגיבוי']]
    .map(([k, l]) => h('a', { href: '#/admin/' + k, class: tab === k ? 'on' : '' }, l)));
  const body = h('div');
  fill(view, tabs, body);
  if (tab === 'workers') return adminWorkers(body);
  if (tab === 'changes') return adminChanges(body);
  if (tab === 'settings') return adminSettings(body);
  return adminWorks(body);
}
async function adminWorks(body) {
  const reps = await reportsSorted(); const emps = await employees(true);
  const now = Date.now();
  const f = {
    plate: h('input', { class: 'input', inputmode: 'numeric', placeholder: 'מספר רישוי' }),
    cust: h('input', { class: 'input', placeholder: 'שם לקוח' }),
    worker: h('select', { class: 'input' }, h('option', { value: '' }, 'כל העובדים'), emps.map(e => h('option', { value: e.id }, e.name))),
    type: h('select', { class: 'input' }, h('option', { value: '' }, 'משאיות ונגררים'), h('option', { value: 'truck' }, 'משאיות'), h('option', { value: 'trailer' }, 'נגררים')),
    from: h('input', { class: 'input', type: 'date' }), to: h('input', { class: 'input', type: 'date' }),
  };
  const out = h('div');
  const run = () => {
    const pd = normPlate(f.plate.value), c = f.cust.value.trim(), w = f.worker.value, t = f.type.value;
    const from = f.from.value ? new Date(f.from.value + 'T00:00').getTime() : 0;
    const to = f.to.value ? new Date(f.to.value + 'T23:59:59').getTime() : Infinity;
    const res = reps.filter(r => (!pd || r.plate.includes(pd)) && (!c || (r.customer || '').includes(c)) && (!t || r.type === t) &&
      (!w || r.entries.some(e => e.workerId === w)) && r.entries.some(e => e.at >= from && e.at <= to));
    fill(out, h('h3', { style: 'margin:6px 2px 10px' }, 'נמצאו ' + res.length + ' עבודות'), res.length ? res.map(r => reportItem(r)) : h('div', { class: 'empty' }, 'אין תוצאות'));
  };
  Object.values(f).forEach(x => x.addEventListener('input', run));
  const today = reps.filter(r => sameDay(r.createdAt, now)).length;
  const week = reps.filter(r => now - r.createdAt < 7 * 864e5).length;
  body.append(
    h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('b', {}, today), h('span', {}, 'היום')), h('div', { class: 'stat' }, h('b', {}, week), h('span', {}, '7 ימים')), h('div', { class: 'stat' }, h('b', {}, reps.length), h('span', {}, 'סה״כ'))),
    h('div', { class: 'card' }, h('h3', {}, 'חיפוש עבודות'),
      h('div', { class: 'grid2' }, f.plate, f.cust, f.worker, f.type),
      h('div', { class: 'grid2', style: 'margin-top:12px' }, h('div', {}, h('label', { class: 'lbl' }, 'מתאריך'), f.from), h('div', {}, h('label', { class: 'lbl' }, 'עד תאריך'), f.to)),
      h('button', { type: 'button', class: 'btn sm', style: 'margin-top:12px', onclick: () => { Object.values(f).forEach(x => { x.value = ''; }); run(); } }, 'נקה סינון')),
    out);
  run();
}
async function adminWorkers(body) {
  const emps = await employees(true); const reps = await DB.all('reports');
  const count = id => reps.filter(r => r.entries.some(e => e.workerId === id)).length;
  const name = h('input', { class: 'input', placeholder: 'שם עובד חדש' });
  const add = async () => { const n = name.value.trim(); if (!n) return; await DB.put('employees', { id: uid(), name: n, active: true, createdAt: Date.now() }); route(); };
  name.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  body.append(
    h('div', { class: 'card' }, h('h3', {}, 'הוספת עובד'), name, h('button', { type: 'button', class: 'btn primary wide', style: 'margin-top:10px', onclick: add }, ic('plus'), 'הוסף עובד')),
    h('div', { class: 'card' }, h('h3', {}, 'רשימת העובדים (' + emps.length + ')'),
      emps.length ? emps.map(e => h('div', { class: 'emp' + (e.active === false ? ' off' : '') },
        h('div', { class: 'grow' }, h('div', { class: 'name', style: 'font-weight:700' }, e.name), h('div', { class: 'hint', style: 'margin:0' }, count(e.id) + ' עבודות' + (e.code ? ' · יש קוד אישי' : '') + (e.active === false ? ' · לא פעיל' : ''))),
        h('button', { type: 'button', class: 'btn sm', onclick: async () => { const n = (prompt('שם חדש:', e.name) || '').trim(); if (n && n !== e.name) { e.name = n; await DB.put('employees', e); route(); } } }, 'שנה שם'),
        h('button', { type: 'button', class: 'btn sm', onclick: async () => { const c = prompt('קוד אישי (4 ספרות) – ישמש בשלב הבא לכניסה. השאר ריק כדי למחוק:', e.code || ''); if (c == null) return; e.code = c.trim() || null; await DB.put('employees', e); route(); } }, 'קוד'),
        h('button', { type: 'button', class: 'btn sm ' + (e.active === false ? '' : 'danger'), onclick: async () => { e.active = e.active === false; await DB.put('employees', e); route(); } }, e.active === false ? 'החזר' : 'השבת')))
        : h('p', { class: 'hint' }, 'אין עובדים עדיין.'),
      h('p', { class: 'hint' }, 'עובד מושבת לא מופיע ברשימת הבחירה, אבל העבודות שלו נשמרות.')));
}
async function adminChanges(body) {
  const reps = await DB.all('reports');
  const rows = [];
  for (const r of reps) for (const l of r.log) rows.push({ r, l });
  rows.sort((a, b) => b.l.at - a.l.at);
  const only = h('select', { class: 'input' }, h('option', { value: '' }, 'כל הפעולות'), h('option', { value: 'edit' }, 'רק תיקונים'), h('option', { value: 'add' }, 'רק תוספות'), h('option', { value: 'create' }, 'רק דיווחים חדשים'));
  const out = h('div');
  const run = () => {
    const v = only.value; const res = rows.filter(x => !v || x.l.action === v).slice(0, 300);
    fill(out, ...(res.length ? res.map(({ r, l }) => h('button', { class: 'item', type: 'button', onclick: () => go('#/report/' + r.id) },
      h('div', { class: 'item-top' }, plateBadge(r.plate), h('span', { class: 'grow' }), h('span', { class: 'tag' }, ic('user'), l.workerName)), h('ul', { class: 'log', style: 'margin-top:8px' }, logLine(l))))
      : [h('div', { class: 'empty' }, 'אין פעולות')]));
  };
  only.onchange = run;
  body.append(h('div', { class: 'card' }, h('h3', {}, 'מי יצר, הוסיף או תיקן דיווחים'), only), out);
  run();
}
async function adminSettings(body) {
  const imgRow = (key, label) => {
    const inp = h('input', { type: 'file', accept: 'image/*', hidden: true });
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const b = await compressImage(f, 900, 0.85); await DB.setSetting(key, await saveBlob(b)); toast('התמונה עודכנה', 'ok'); };
    return h('div', { class: 'row', style: 'margin-bottom:8px' }, inp,
      h('button', { type: 'button', class: 'btn', onclick: () => inp.click() }, ic('image'), 'תמונה לכפתור ' + label),
      h('button', { type: 'button', class: 'btn sm', onclick: async () => { await DB.setSetting(key, null); toast('הוחזר הציור המקורי'); } }, 'ברירת מחדל'));
  };
  const live = h('input', { type: 'checkbox', style: 'width:24px;height:24px' }); live.checked = local.get('liveTranscribe', '1') === '1';
  live.onchange = () => local.set('liveTranscribe', live.checked ? '1' : '0');
  const key = h('input', { class: 'input', placeholder: 'sk-...', value: local.get('openaiKey', ''), autocomplete: 'off', dir: 'ltr' });
  const pin = h('input', { class: 'input', inputmode: 'numeric', placeholder: 'ללא קוד', value: (await DB.setting('adminPin')) || '' });
  const imp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  imp.onchange = async () => { const f = imp.files[0]; if (!f) return; try { await importBackup(f); toast('הגיבוי שוחזר ✓', 'ok'); route(); } catch (e) { alert('קובץ גיבוי לא תקין: ' + e.message); } };
  let est = '';
  try { const e = await navigator.storage.estimate(); est = 'בשימוש: ' + (e.usage / 1048576).toFixed(1) + ' MB'; } catch { }
  const SRok = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  body.append(
    h('div', { class: 'card' }, h('h3', {}, 'הקלטה ותמלול'),
      h('label', { style: 'display:flex;gap:10px;align-items:center;font-weight:700' }, live, 'תמלול חי לעברית בזמן ההקלטה'),
      h('p', { class: 'hint' }, SRok ? 'הדפדפן הזה תומך בתמלול חי.' : 'הדפדפן הזה לא תומך בתמלול חי – ההקלטה עדיין נשמרת.'),
      h('label', { class: 'lbl' }, 'תמלול מדויק בענן (לא חובה) – מפתח OpenAI'),
      key, h('p', { class: 'hint' }, 'אם מוזן מפתח, הקלטות בלי תמלול יתומללו אוטומטית מהקובץ המקורי. המפתח נשמר רק בטלפון הזה.'),
      h('button', { type: 'button', class: 'btn sm', onclick: () => { local.set('openaiKey', key.value.trim() || null); toast('נשמר', 'ok'); } }, 'שמור מפתח')),
    h('div', { class: 'card' }, h('h3', {}, 'תמונות בכפתורים במסך הראשי'), imgRow('truckImg', 'משאית'), imgRow('trailerImg', 'נגרר')),
    h('div', { class: 'card' }, h('h3', {}, 'קוד למסך מנהל (לא חובה)'), pin,
      h('button', { type: 'button', class: 'btn sm', style: 'margin-top:10px', onclick: async () => { await DB.setSetting('adminPin', pin.value.trim() || null); toast('נשמר', 'ok'); } }, 'שמור קוד')),
    h('div', { class: 'card' }, h('h3', {}, 'גיבוי ושחזור'),
      h('p', { class: 'hint', style: 'margin-top:0' }, 'בגרסת הניסיון הנתונים נמצאים רק בטלפון הזה. מומלץ לגבות מדי פעם. ' + est),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: exportBackup }, ic('down'), 'הורד גיבוי'), h('button', { type: 'button', class: 'btn', onclick: () => imp.click() }, ic('up'), 'שחזר מגיבוי')), imp),
    h('div', { class: 'card' }, h('h3', {}, 'נתוני דוגמה (להצגה)'),
      h('p', { class: 'hint', style: 'margin-top:0' }, 'מוסיף כמה רכבים ועבודות לדוגמה כדי לראות איך נראית ההיסטוריה. אפשר למחוק אותם אחר כך.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: async () => { await loadDemo(); toast('נוספו נתוני דוגמה', 'ok'); go('#/'); } }, 'טען נתוני דוגמה'),
        h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (confirm('למחוק את נתוני הדוגמה?')) { await deleteDemo(); toast('נמחקו'); route(); } } }, 'מחק נתוני דוגמה'))));
}

/* ---------- backup ---------- */
const toDataURL = (data, type) => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(new Blob([data], { type })); });
async function exportBackup() {
  toast('מכין גיבוי…');
  const blobs = await DB.all('blobs');
  const data = {
    app: 'tarek-garage', v: 1, exportedAt: Date.now(),
    reports: await DB.all('reports'), vehicles: await DB.all('vehicles'), employees: await DB.all('employees'),
    settings: await DB.all('settings'),
    blobs: await Promise.all(blobs.map(async b => ({ id: b.id, type: b.type, at: b.at, data: await toDataURL(b.data, b.type) }))),
  };
  const name = 'גיבוי-מוסך-טארק-' + new Date().toISOString().slice(0, 10) + '.json';
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = h('a', { href: URL.createObjectURL(file), download: name }); document.body.append(a); a.click(); a.remove();
}
async function importBackup(f) {
  const d = JSON.parse(await f.text()); if (d.app !== 'tarek-garage') throw new Error('לא קובץ של האפליקציה');
  for (const b of d.blobs || []) { const buf = await (await fetch(b.data)).arrayBuffer(); await DB.put('blobs', { id: b.id, type: b.type, at: b.at, data: buf, size: buf.byteLength }); }
  for (const s of ['reports', 'vehicles', 'employees', 'settings']) for (const x of d[s] || []) await DB.put(s, x);
}

/* ---------- demo data ---------- */
function demoPhoto(text, color) {
  const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 800, 600); g.addColorStop(0, color); g.addColorStop(1, '#1d232b'); x.fillStyle = g; x.fillRect(0, 0, 800, 600);
  x.fillStyle = '#fff'; x.font = 'bold 54px Arial'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText(text, 400, 300); x.font = '28px Arial'; x.fillText('תמונה לדוגמה', 400, 360);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
}
function demoTone(sec = 2) {
  const sr = 8000, n = sr * sec, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / sr * 2 * Math.PI * 440) * 6000 * Math.min(1, i / 800, (n - i) / 800), true);
  return new Blob([buf], { type: 'audio/wav' });
}
async function loadDemo() {
  const now = Date.now(), day = 864e5;
  const e1 = { id: 'demo-w1', name: 'עובד לדוגמה א', active: true, demo: true, createdAt: now };
  const e2 = { id: 'demo-w2', name: 'עובד לדוגמה ב', active: true, demo: true, createdAt: now };
  await DB.put('employees', e1); await DB.put('employees', e2);
  const ent = async (w, at, text, tr, photo, kind = 'work') => ({
    id: uid(), at, kind, workerId: w.id, workerName: w.name, text,
    recordings: tr ? [{ id: uid(), blobId: await saveBlob(demoTone()), mime: 'audio/wav', duration: 2, transcript: tr }] : [],
    photos: photo ? [await saveBlob(await demoPhoto(photo[0], photo[1]))] : [],
  });
  const mk = async (o) => { const r = { demo: true, updatedAt: o.createdAt, log: [{ at: o.createdAt, workerId: o.entries[0].workerId, workerName: o.entries[0].workerName, action: 'create' }], plateImage: null, ...o };
    for (const e of r.entries.slice(1)) { r.log.push({ at: e.at, workerId: e.workerId, workerName: e.workerName, action: 'add', kind: e.kind }); r.updatedAt = e.at; }
    await DB.put('reports', r); await upsertVehicle(r); };
  const t1 = now - 32 * day;
  await mk({ id: 'demo-r1', type: 'truck', plate: '1234567', customer: 'הובלות לדוגמה בע״מ', model: 'DAF XF', km: 482300, createdAt: t1, createdBy: e1.id, createdByName: e1.name,
    entries: [await ent(e1, t1, '', 'בדקתי את המשאית, מצאתי נזילת אוויר, החלפתי צינור אוויר ותיקנתי את התקלה.', ['צינור אוויר שהוחלף', '#14529e'])] });
  const t2 = now - 3 * 3600e3;
  await mk({ id: 'demo-r2', type: 'truck', plate: '1234567', customer: 'הובלות לדוגמה בע״מ', model: 'DAF XF', km: 491050, createdAt: t2, createdBy: e2.id, createdByName: e2.name,
    entries: [await ent(e2, t2, 'טיפול תקופתי: החלפת שמן מנוע ומסננים.', null, ['מסנן שמן', '#0f7a55']),
      await ent(e1, t2 + 2.5 * 3600e3, '', 'המשכתי אחר הצהריים: החלפתי רפידות בלם קדמיות ובדקתי את מערכת הבלמים.', null)] });
  const t3 = now - 9 * day;
  await mk({ id: 'demo-r3', type: 'trailer', plate: '34567891', customer: 'לוגיסטיקה לדוגמה', model: '', km: null, createdAt: t3, createdBy: e1.id, createdByName: e1.name,
    entries: [await ent(e1, t3, '', 'החלפתי שתי כריות אוויר בנגרר, תיקנתי נזילת אוויר ובדקתי שהכול תקין.', ['כרית אוויר', '#5a3ea8'])] });
}
async function deleteDemo() {
  for (const r of await DB.all('reports')) if (r.demo) {
    for (const e of r.entries) { for (const x of e.recordings) await DB.del('blobs', x.blobId); for (const p of e.photos) await DB.del('blobs', p); }
    await DB.del('reports', r.id);
  }
  for (const v of await DB.all('vehicles')) if (v.demo) await DB.del('vehicles', v.plate);
  for (const e of await DB.all('employees')) if (e.demo) await DB.del('employees', e.id);
}

/* ---------- start ---------- */
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
route();
