/* מוסך טארק ת.ד בע״מ – דיווח עבודות
   גרסת ניסיון: כל הנתונים נשמרים במכשיר (IndexedDB). שכבת הנתונים מרוכזת ב-DB כדי לחבר ענן בשלב הבא. */
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
function addTo(el, ...kids) { el.append(...kids.flat(Infinity).filter(k => k != null && k !== false)); }
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
const ago = t => {
  if (!t) return 'עוד לא';
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60e3);
  if (m < 2) return 'עכשיו';
  if (m < 60) return 'לפני ' + m + ' דקות';
  if (sameDay(t, Date.now())) return 'היום ' + fmtTime(t);
  if (sameDay(t, Date.now() - 864e5)) return 'אתמול ' + fmtTime(t);
  return fmtDate(t) + ' ' + fmtTime(t);
};
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

/* ---------- cloud config (Supabase) ---------- */
const CLOUD = { url: 'https://yopertfgqpdxxufdaomr.supabase.co', key: 'sb_publishable_RXi0Ty121HdhWB1-Lhg5-g_SMUrIG_i' };   // public browser key – data is protected by login + row-level security
let sb = null;
let me = null;   // signed-in person's profile: { user_id, name, email, role: 'admin'|'worker', employee_id, active }
const isAdmin = () => !sb || !!(me && me.role === 'admin');
const myEid = () => (me ? me.employee_id || 'u-' + me.user_id : null);
const actor = () => (me ? { byId: myEid(), byName: me.name } : {});   // the person actually signed in
const workTime = x => x.workAt || x.at || x.createdAt;              // when the work was done (old records: when entered)
const pad2 = n => String(n).padStart(2, '0');
const toLocalInput = t => { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
function WorkDate(label = 'מתי בוצעה העבודה', value = Date.now(), disabled = false) {
  const input = h('input', { class: 'input', type: 'datetime-local', value: toLocalInput(value), max: toLocalInput(Date.now() + 864e5), disabled });
  const el = h('div', {}, h('label', { class: 'lbl' }, label), input,
    !disabled && h('div', { class: 'chips' },
      h('button', { type: 'button', class: 'chip', onclick: () => { input.value = toLocalInput(Date.now()); } }, 'עכשיו'),
      h('button', { type: 'button', class: 'chip', onclick: () => { input.value = toLocalInput(Date.now() - 864e5); } }, 'אתמול'),
      h('button', { type: 'button', class: 'chip', onclick: () => { input.value = toLocalInput(Date.now() - 2 * 864e5); } }, 'לפני יומיים')));
  return { el, input, get: () => { const t = new Date(input.value).getTime(); return isFinite(t) ? t : Date.now(); } };
}
const canEditDetails = r => isAdmin() || r.createdBy === myEid();
const canEditEntry = e => isAdmin() || e.workerId === myEid();
const USER_DOMAIN = '@users.invalid';   // usernames are stored as <name>@users.invalid – never shown, never mailed
const loginToEmail = v => { v = String(v || '').trim().toLowerCase(); return v.includes('@') ? v : v + USER_DOMAIN; };
const showLogin = e => String(e || '').replace(USER_DOMAIN, '');
async function loadMe() {
  const { data: { session } } = await sb.auth.getSession(); if (!session) return null;
  const { data, error } = await sb.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
  if (error) throw error; return data;
}
async function cloudInit() {
  if (!CLOUD.url || !CLOUD.key) return null;
  if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js');
  sb = window.supabase.createClient(CLOUD.url, CLOUD.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tg-auth' } });
  return sb;
}
const RULE_ERR = {
  not_your_work: 'אפשר לשנות רק עבודה שאתה רשמת. עבודה של עובד אחר משנה רק מנהל.',
  not_your_report: 'את פרטי הרכב בדיווח הזה יכול לשנות רק מי שפתח אותו, או מנהל.',
  cannot_delete_work: 'רק מנהל יכול למחוק עבודה.',
  cannot_change_history: 'אי אפשר לשנות את היסטוריית השינויים.',
};
function niceErr(e) {
  const raw = (e && (e.message || e.error)) || String(e);
  for (const k in RULE_ERR) if (raw.includes(k)) return RULE_ERR[k];
  if (!navigator.onLine) return 'אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב – מה שמילאת לא נמחק.';
  const m = (e && (e.message || e.error_description || e.error)) || String(e);
  if (/fetch|network|Failed to/i.test(m)) return 'בעיית תקשורת עם השרת. נסה שוב בעוד רגע – מה שמילאת לא נמחק.';
  if (/JWT|auth|permission|policy|row-level/i.test(m)) return 'אין הרשאה – צריך להיכנס מחדש עם פרטי המוסך.';
  return m;
}

/* ---------- local storage on this device (IndexedDB) – used before cloud / for moving old jobs ---------- */
const LocalDB = {
  _p: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const r = indexedDB.open('tarek-garage', 3);
      r.onupgradeneeded = () => {
        const d = r.result, has = n => d.objectStoreNames.contains(n);
        if (!has('reports')) d.createObjectStore('reports', { keyPath: 'id' }).createIndex('plate', 'plate');
        if (!has('vehicles')) d.createObjectStore('vehicles', { keyPath: 'plate' });
        if (!has('employees')) d.createObjectStore('employees', { keyPath: 'id' });
        if (!has('blobs')) d.createObjectStore('blobs', { keyPath: 'id' });
        if (!has('settings')) d.createObjectStore('settings', { keyPath: 'key' });
        if (!has('orders')) d.createObjectStore('orders', { keyPath: 'id' });
        if (!has('meals')) d.createObjectStore('meals', { keyPath: 'id' });
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
};

/* ---------- shared cloud tables: each row = { k, data(jsonb), plate } ---------- */
const KEYS = { reports: 'id', vehicles: 'plate', employees: 'id', settings: 'key', orders: 'id', meals: 'id' };
const Remote = {
  async get(s, k) {
    const { data, error } = await sb.from(s).select('data').eq('k', String(k)).maybeSingle();
    if (error) throw error; return data ? data.data : undefined;
  },
  async all(s) {
    const out = []; let from = 0;
    for (;;) {
      const { data, error } = await sb.from(s).select('data').range(from, from + 999);
      if (error) throw error; out.push(...data.map(r => r.data));
      if (data.length < 1000) break; from += 1000;
    }
    return out;
  },
  async put(s, v) {
    const row = { k: String(v[KEYS[s]]), data: v, updated_at: new Date().toISOString() };
    if (s === 'reports' || s === 'orders') row.plate = v.plate || null;
    const up = await sb.from(s).update(row).eq('k', row.k).select('k');
    if (up.error) throw up.error;
    if (up.data && up.data.length) return;
    const ins = await sb.from(s).insert(row);
    if (ins.error && /duplicate key/i.test(ins.error.message)) throw new Error('not_your_work');
    if (ins.error) throw ins.error;
  },
  async del(s, k) { const { error } = await sb.from(s).delete().eq('k', String(k)); if (error) throw error; },
  async byPlate(p) {
    const { data, error } = await sb.from('reports').select('data').eq('plate', p);
    if (error) throw error; return data.map(r => r.data);
  },
};
const DB = {
  get(s, k) { return sb ? Remote.get(s, k) : LocalDB.get(s, k); },
  all(s) { return sb ? Remote.all(s) : LocalDB.all(s); },
  put(s, v) { return sb ? Remote.put(s, v) : LocalDB.put(s, v); },
  del(s, k) { return sb ? Remote.del(s, k) : LocalDB.del(s, k); },
  byPlate(p) { return sb ? Remote.byPlate(p) : LocalDB.byPlate(p); },
  async setting(k, d = null) { const r = await this.get('settings', k); return r ? r.value : d; },
  setSetting(k, v) { return this.put('settings', { key: k, value: v }); },
};

/* ---------- files: recordings, photos (cloud bucket "media") ---------- */
const urlCache = new Map();
const Blobs = {
  async save(blob, id = uid()) {
    if (sb) {
      const { error } = await sb.storage.from('media').upload(id, blob, { contentType: blob.type || 'application/octet-stream', upsert: true });
      if (error) throw error;
    } else {
      const data = await new Response(blob).arrayBuffer();
      await LocalDB.put('blobs', { id, type: blob.type || 'application/octet-stream', data, size: blob.size, at: Date.now() });
    }
    return id;
  },
  async url(id) {
    if (!id) return null;
    const c = urlCache.get(id); if (c && c.exp > Date.now()) return c.u;
    let u = null;
    if (sb) {
      const { data, error } = await sb.storage.from('media').createSignedUrl(id, 6 * 3600);
      if (error || !data) return null; u = data.signedUrl;
    } else {
      const b = await LocalDB.get('blobs', id); if (!b) return null;
      u = URL.createObjectURL(new Blob([b.data], { type: b.type }));
    }
    urlCache.set(id, { u, exp: Date.now() + 5 * 3600e3 }); return u;
  },
  async get(id) {
    if (sb) { const { data, error } = await sb.storage.from('media').download(id); if (error) throw error; return data; }
    const b = await LocalDB.get('blobs', id); return b ? new Blob([b.data], { type: b.type }) : null;
  },
  async del(id) {
    if (!id) return;
    if (sb) await sb.storage.from('media').remove([id]); else await LocalDB.del('blobs', id);
  },
};
const saveBlob = b => Blobs.save(b);
const blobURL = id => Blobs.url(id);
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

/* ---------- AI on the garage server (Gemini via Supabase function "garage") ---------- */
const toB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(blob); });
async function garageCall(body) {
  const { data, error } = await sb.functions.invoke('garage', { body });
  if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch { } throw new Error(m); }
  if (data && data.error) throw new Error(data.error);
  return data;
}
const aiOn = () => !!sb && local.get('aiOff') !== '1';
// iPhone records AAC/MP4; convert to small 16 kHz mono WAV so the AI accepts any phone's format
async function toWav16k(blob) {
  const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
  const ab = await new Response(blob).arrayBuffer();
  const buf = await new Promise((res, rej) => ac.decodeAudioData(ab, res, rej));
  try { ac.close(); } catch { }
  const rate = 16000, len = Math.max(1, Math.ceil(buf.duration * rate));
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(1, len, rate); const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start(0);
  const out = await off.startRendering(); const d = out.getChannelData(0);
  const wav = new ArrayBuffer(44 + d.length * 2), v = new DataView(wav);
  const w = (o, t) => { for (let k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, d.length * 2, true);
  for (let k = 0; k < d.length; k++) { const x = Math.max(-1, Math.min(1, d[k])); v.setInt16(44 + k * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([wav], { type: 'audio/wav' });
}
async function aiTranscribe(blob, short) {
  let a = blob; try { a = await toWav16k(blob); } catch (e) { console.warn('wav convert failed, sending original', e); }
  const r = await garageCall({ action: 'transcribe', short: !!short, audio: await toB64(a), mime: (a.type || 'audio/mp4').split(';')[0] });
  return (r.text || '').trim();
}
async function aiSku(blob) {
  const small = await compressImage(blob, 1600, 0.85);
  return garageCall({ action: 'sku', image: await toB64(small), mime: 'image/jpeg' });
}
/* small 🎤 button next to a text field: speak instead of typing (for workers who don't write) */
function micFor(input, opts = {}) {
  if (!sb) return input;
  const btn = h('button', { type: 'button', class: 'btn dict', 'aria-label': 'אמור במקום להקליד' }, ic('mic'));
  let st = null;
  const reset = () => { st = null; btn.disabled = false; btn.classList.remove('on'); fill(btn, ic('mic')); };
  btn.onclick = async () => {
    if (st) {
      const s = st; st = null; btn.disabled = true; btn.classList.remove('on'); fill(btn, h('span', { class: 'spin' }));
      const blob = await new Promise(res => { s.mr.onstop = () => res(new Blob(s.chunks, { type: s.mr.mimeType || 'audio/mp4' })); try { s.mr.stop(); } catch { res(null); } });
      s.stream.getTracks().forEach(t => t.stop());
      try {
        if (opts.onAudio && blob && blob.size > 300) opts.onAudio(blob);
        let text = blob && blob.size > 300 ? await aiTranscribe(blob, true) : '';
        if (opts.numeric) text = (text.replace(/[,\s]/g, '').match(/\d+/) || [''])[0];
        if (text) { input.value = opts.append && input.value.trim() ? input.value.trim() + ' ' + text : text; input.dispatchEvent(new Event('input', { bubbles: true })); }
        else toast('לא נשמע דיבור – נסה שוב', 'bad');
      } catch (e) { console.warn(e); toast('לא הצלחתי לתמלל – נסה שוב או הקלד', 'bad'); }
      reset(); return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { alert('הדפדפן לא מאפשר הקלטה כאן. פתח ב-Safari.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.start(500); st = { stream, mr, chunks };
      btn.classList.add('on'); fill(btn, ic('stop'), ' סיים');
    } catch (e) { alert('אין גישה למיקרופון. באייפון: הגדרות ← Safari ← מיקרופון ← "אפשר".'); reset(); }
  };
  return h('div', { class: 'with-mic' }, input, btn);
}
async function aiPlate(blob) {
  const small = await compressImage(blob, 1600, 0.85);
  const r = await garageCall({ action: 'plate', image: await toB64(small), mime: 'image/jpeg' });
  return r.plate || null;
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
  const hint = h('p', { class: 'hint' }, sb && local.get('aiOff') !== '1'
    ? 'לחץ "התחל הקלטה", דבר בעברית, ולחץ "סיים הקלטה". הקול נשמר, והטקסט נכתב ומשופר אוטומטית מההקלטה – אפשר לתקן אותו.'
    : srOn()
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
    if (aiOn()) runCloud(rec);
  }
  async function runCloud(rec, manual) {
    rec.busy = true; render();
    try {
      const text = await aiTranscribe(rec.blob);
      if (text && (!rec.edited || manual)) { rec.transcript = text; rec.edited = false; rec.suggest = null; }
      else if (text && text !== rec.transcript) rec.suggest = text;
      if (!text && !rec.transcript) toast('לא זוהה דיבור בהקלטה', 'bad');
    } catch (e) {
      console.warn(e);
      if (!rec.transcript) toast('שיפור התמלול לא הצליח – אפשר להקליד ידנית', 'bad');
    }
    rec.busy = false; render();
  }
  function render() {
    fill(listEl, ...list.map((rec, i) => {
      const ta = h('textarea', { class: 'input', rows: 3, placeholder: 'כאן יופיע מה שנאמר. אפשר להקליד או לתקן.', value: rec.transcript });
      ta.addEventListener('input', () => { rec.transcript = ta.value; rec.edited = true; });
      return h('div', { class: 'rec-card' },
        h('div', { class: 'rec-head' }, ic('mic'), h('span', { class: 'grow' }, 'הקלטה ' + (i + 1) + (rec.duration ? ' · ' + fmtDur(rec.duration) : '')),
          h('button', { type: 'button', class: 'btn sm danger', onclick: () => {
            if (!confirm('למחוק את הקלטה ' + (i + 1) + '?')) return;
            URL.revokeObjectURL(rec.url); list.splice(i, 1); render(); setBtn();
          } }, ic('trash'), 'מחק')),
        h('audio', { controls: true, preload: 'metadata', src: rec.url }),
        h('div', { class: 'tr-lbl' }, rec.busy ? h('span', {}, h('span', { class: 'spin' }), ' משפר את התמלול מההקלטה…') : 'מה נאמר בהקלטה (תמלול – אפשר לתקן):'),
        ta,
        rec.suggest && h('div', { class: 'ocr-status ok', style: 'margin-top:8px' }, h('div', {}, 'תמלול משופר: ', rec.suggest),
          h('button', { type: 'button', class: 'btn sm ok', style: 'margin-top:6px', onclick: () => { rec.transcript = rec.suggest; rec.suggest = null; rec.edited = false; render(); } }, 'השתמש בתמלול המשופר')),
        aiOn() && !rec.busy && h('button', { type: 'button', class: 'btn sm', style: 'margin-top:8px', onclick: () => runCloud(rec, true) }, 'תמלל שוב מההקלטה'));
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
  return { el, list, isRecording: () => !!st, busy: () => list.some(r => r.busy), cleanup() { cancel(); } };
}

function Photos(onAdd) {
  const list = [];
  const box = h('div');
  const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const gal = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  const status = h('p', { class: 'hint', hidden: true });
  async function add(files) {
    if (!files.length) return;
    status.hidden = false; fill(status, h('span', { class: 'spin' }), ' מעבד תמונות…');
    const added = [];
    for (const f of files) { const b = await compressImage(f); list.push({ blob: b, url: URL.createObjectURL(b) }); added.push(b); }
    status.hidden = true; render();
    if (onAdd && added.length) onAdd(added[0]);
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
function Composer(title = 'מה העבודה שבוצעה', opts = {}) {
  const ta = h('textarea', { class: 'input', rows: 4, placeholder: 'כתוב כאן מה בוצע… (אפשר גם רק להקליט)' });
  const rec = Recorder(); const ph = Photos(opts.onPhoto);
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
async function waitTranscripts(comp, btn) {
  if (!comp.rec.busy()) return;
  if (btn) fill(btn, h('span', { class: 'spin' }), ' מסיים תמלול…');
  for (let i = 0; i < 120 && comp.rec.busy(); i++) await sleep(250);
}
async function buildEntry(comp, worker, kind, at, workAt) {
  const recordings = [];
  for (const r of comp.rec.list) recordings.push({ id: uid(), blobId: await saveBlob(r.blob), mime: r.mime, duration: r.duration, transcript: (r.transcript || '').trim() });
  const photos = [];
  for (const p of comp.ph.list) photos.push(await saveBlob(p.blob));
  return { id: uid(), at, workAt: workAt || at, kind, workerId: worker.id, workerName: worker.name, ...actor(), text: comp.text(), recordings, photos };
}

async function WorkerPicker(label = 'שם העובד') {
  if (sb && me && me.role !== 'admin') {
    const w = { id: me.employee_id || 'u-' + me.user_id, name: me.name };
    return { el: h('div', { class: 'card' }, h('label', { class: 'lbl' }, label), h('div', { class: 'chips workers' }, h('span', { class: 'chip on' }, ic('user'), ' ', w.name)),
      h('p', { class: 'hint' }, 'העבודה נרשמת על שמך לפי הכניסה למערכת.')), get: () => w };
  }
  let emps = await employees(); let sel = null;
  if (sb && me && emps.some(e => e.id === me.employee_id)) sel = me.employee_id;
  const last = local.get('lastWorker'); if (last && emps.some(e => e.id === last)) sel = last;
  const wrap = h('div', { class: 'chips workers' });
  const render = () => {
    fill(wrap, ...emps.map(e => h('button', { type: 'button', class: 'chip' + (e.id === sel ? ' on' : ''), onclick: () => { sel = e.id; render(); } }, e.name)),
      !sb && h('button', { type: 'button', class: 'chip', onclick: async () => {
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
    h('div', { class: 'item-top' }, plateBadge(r.plate), typeTag(r.type), r.service === 'rescue' && h('span', { class: 'tag rescue' }, 'חילוץ דרך'), h('span', { class: 'grow' }), h('b', { style: 'font-size:15px' }, fmtDate(workTime(r)))),
    h('div', { class: 'meta' }, h('span', {}, r.customer || 'ללא שם לקוח'), h('span', {}, fmtTime(workTime(r))), h('span', {}, first.workerName || '')),
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
    h('div', { class: 'item-top' }, plateBadge(r.plate, true), typeTag(r.type), r.service === 'rescue' && h('span', { class: 'tag rescue' }, 'חילוץ דרך')),
    h('dl', { class: 'kv' },
      r.service === 'rescue' && [h('dt', {}, 'מיקום החילוץ'), h('dd', {}, locLink(r.location) || '—')],
      h('dt', {}, 'לקוח'), h('dd', {}, r.customer || '—'),
      r.type === 'truck' && [h('dt', {}, 'דגם'), h('dd', {}, r.model || '—'), h('dt', {}, 'קילומטרים'), h('dd', {}, r.km ? fmtNum(r.km) : '—')],
      h('dt', {}, 'תאריך העבודה'), h('dd', {}, fmtDT(workTime(r))),
      Math.abs(workTime(r) - r.createdAt) > 30 * 60e3 && [h('dt', {}, 'נרשם במערכת'), h('dd', {}, fmtDT(r.createdAt))],
      r.updatedAt && r.updatedAt - r.createdAt > 60e3 && [h('dt', {}, 'עדכון אחרון'), h('dd', {}, fmtDT(r.updatedAt))],
      h('dt', {}, 'נפתח ע״י'), h('dd', {}, r.createdByName || '—')),
    plateImg && h('div', { style: 'margin-top:12px' }, h('div', { class: 'sec-title', style: 'margin-top:0' }, 'צילום לוחית הרישוי'), photoGrid([plateImg]))));
  for (let i = 0; i < r.entries.length; i++) {
    const e = r.entries[i];
    const label = e.kind === 'note' ? 'הערה' : i === 0 ? 'העבודה שבוצעה' : 'עבודה נוספת';
    const card = h('div', { class: 'card entry' + (e.kind === 'note' ? ' note' : '') },
      h('div', { class: 'entry-head' }, h('b', {}, label),
        h('span', { class: 'tag' }, ic('clock'), 'בוצע ' + fmtDT(workTime(e))),
        h('span', { class: 'tag' }, ic('user'), e.workerName + byNote(e))),
      Math.abs(workTime(e) - e.at) > 30 * 60e3 && h('p', { class: 'hint', style: 'margin:-4px 0 10px' }, 'נרשם במערכת: ' + fmtDT(e.at)));
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
const byNote = x => (x.byName && x.byName !== x.workerName ? ' (הוזן ע״י ' + x.byName + ')' : '');
function logLine(l) {
  const what = l.action === 'create' ? 'יצר/ה את הדיווח' : l.action === 'add' ? (l.kind === 'note' ? 'הוסיף/ה הערה' : 'הוסיף/ה עבודה') : 'תיקן/ה את הדיווח';
  return h('li', {}, h('b', {}, fmtDT(l.at)), ' · ', l.workerName, byNote(l), ' · ', what,
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
  document.body.classList.remove('locked');
  try {
    if (sb) {
      const { data } = await sb.auth.getSession();
      if (!data.session) { me = null; await viewLogin(); return; }
      if (!me || me.user_id !== data.session.user.id) me = await loadMe();
      if (!me || !me.active) { viewNoAccess(); return; }
      if (Date.now() - (+local.get('seenAt', 0)) > 5 * 60e3) { local.set('seenAt', String(Date.now())); sb.rpc('touch_seen').then(() => { }, () => { }); }
    }
    if (!p.length) await viewHome();
    else if (p[0] === 'new' && (p[1] === 'truck' || p[1] === 'trailer')) await viewNew(p[1], q.get('plate'), q.get('rescue') === '1');
    else if (p[0] === 'new' && p[1] === 'rescue') await viewPick(true);
    else if (p[0] === 'new') await viewPick();
    else if (p[0] === 'food' && p[1] === 'new') await viewFoodForm(q.get('place'), q.get('who'));
    else if (p[0] === 'food') await viewFood(q.get('d'));
    else if (p[0] === 'orders' && p[1] === 'new') await viewOrderForm(null, q.get('plate'));
    else if (p[0] === 'orders' && p[1] && p[2] === 'edit') await viewOrderForm(p[1]);
    else if (p[0] === 'orders' && p[1]) await viewOrder(p[1]);
    else if (p[0] === 'orders') await viewOrders(q.get('s') || 'open');
    else if (p[0] === 'history') await viewHistory(q.get('q') || '');
    else if (p[0] === 'vehicle') await viewVehicle(decodeURIComponent(p[1] || ''));
    else if (p[0] === 'report' && p[2] === 'add') await viewAdd(p[1]);
    else if (p[0] === 'report' && p[2] === 'edit') await viewEdit(p[1]);
    else if (p[0] === 'report') await viewReport(p[1]);
    else if (p[0] === 'admin') await viewAdmin(p[1] || 'works');
    else await viewHome();
  } catch (err) {
    console.error(err);
    fill(view, h('div', { class: 'card' }, h('h3', {}, 'לא הצלחתי לטעון'), h('p', {}, niceErr(err)),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => route() }, 'נסה שוב'), h('a', { class: 'btn', href: '#/' }, 'למסך הראשי'))));
  }
  window.scrollTo(0, 0);
}
// when the app comes back to the screen, refresh lists so jobs from other phones show up
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !sb || (dirtyCheck && dirtyCheck())) return;
  const p = (location.hash.slice(1) || '/').split('?')[0];
  if (p === '/' || p === '' || p.startsWith('/history') || p.startsWith('/vehicle') || p === '/admin' || p.startsWith('/admin/works')) route();
});

/* ---------- login (one garage account per phone, stays signed in) ---------- */
function viewNoAccess() {
  setHeader('', 'אין הרשאה');
  document.body.classList.add('locked');
  fill(view, h('div', { class: 'card' }, h('h3', {}, 'למשתמש הזה אין גישה למערכת'),
    h('p', {}, 'ייתכן שהמשתמש הושבת או עדיין לא הוגדר. פנה למנהל המוסך.'),
    h('button', { type: 'button', class: 'btn', onclick: async () => { await sb.auth.signOut(); me = null; route(); } }, 'התנתק')));
}
async function viewLogin() {
  setHeader('', 'כניסה למערכת המוסך');
  document.body.classList.add('locked');
  const email = h('input', { class: 'input', type: 'text', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', dir: 'ltr', placeholder: 'username' });
  const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', dir: 'ltr', placeholder: 'password' });
  const msg = h('p', { class: 'hint', hidden: true, style: 'color:var(--danger);font-weight:700' });
  const btn = h('button', { type: 'submit', class: 'btn big primary' }, 'כניסה');
  const form = h('form', { class: 'card' },
    h('h3', {}, 'כניסה עם פרטי המוסך'),
    h('p', { class: 'hint', style: 'margin-top:0' }, 'נכנסים פעם אחת בכל טלפון, והטלפון נשאר מחובר. את שם המשתמש והסיסמה מקבלים מהמנהל. (אפשר להיכנס גם עם אימייל.)'),
    h('label', { class: 'lbl' }, 'שם משתמש'), email,
    h('label', { class: 'lbl' }, 'סיסמה'), pass, msg, h('div', { style: 'margin-top:16px' }, btn));
  form.addEventListener('submit', async e => {
    e.preventDefault(); msg.hidden = true; btn.disabled = true; fill(btn, h('span', { class: 'spin' }), ' נכנס…');
    const { error } = await sb.auth.signInWithPassword({ email: loginToEmail(email.value), password: pass.value });
    btn.disabled = false; fill(btn, 'כניסה');
    if (error) { msg.hidden = false; msg.textContent = /invalid/i.test(error.message) ? 'שם משתמש או סיסמה לא נכונים.' : niceErr(error); return; }
    me = null; toast('נכנסת בהצלחה ✓', 'ok'); route();
  });
  fill(view, form);
}

/* ---------- move jobs saved on this phone (old version) into the shared cloud ---------- */
async function localJobsCount() {
  if (!sb || !isAdmin() || local.get('movedLocal') === '1') return 0;
  try { return (await LocalDB.all('reports')).filter(r => !r.demo).length; } catch { return 0; }
}
async function moveLocalToCloud(statusEl) {
  const say = t => { if (statusEl) fill(statusEl, h('span', { class: 'spin' }), ' ' + t); };
  const reports = (await LocalDB.all('reports')).filter(r => !r.demo);
  const emps = (await LocalDB.all('employees')).filter(e => !e.demo);
  if (isAdmin()) for (const e of emps) if (!(await Remote.get('employees', e.id))) await Remote.put('employees', e);
  let i = 0;
  for (const r of reports) {
    say('מעביר עבודה ' + (++i) + ' מתוך ' + reports.length + '…');
    if (await Remote.get('reports', r.id)) continue;
    const ids = [r.plateImage, ...r.entries.flatMap(e => [...e.photos, ...e.recordings.map(x => x.blobId)])].filter(Boolean);
    for (const id of ids) { const b = await LocalDB.get('blobs', id); if (b) await Blobs.save(new Blob([b.data], { type: b.type }), id); }
    await Remote.put('reports', r); await upsertVehicle(r);
  }
  local.set('movedLocal', '1');
  return reports.length;
}
function moveLocalCard(n) {
  const status = h('p', { class: 'hint' });
  const btn = h('button', { type: 'button', class: 'btn ok wide' }, ic('up'), 'העבר את העבודות לענן');
  btn.onclick = async () => {
    btn.disabled = true;
    try { const c = await moveLocalToCloud(status); toast(c + ' עבודות הועברו לענן ✓', 'ok'); route(); }
    catch (e) { console.error(e); btn.disabled = false; status.textContent = 'ההעברה נעצרה: ' + niceErr(e) + ' אפשר ללחוץ שוב – מה שכבר עבר לא יוכפל.'; }
  };
  return h('div', { class: 'card', style: 'border:2px solid var(--ok)' },
    h('h3', {}, 'יש ' + n + ' עבודות ששמורות רק בטלפון הזה'),
    h('p', { class: 'hint', style: 'margin-top:0' }, 'הן נרשמו בגרסה הקודמת. לחץ כדי להעביר אותן (כולל הקלטות ותמונות) לשמירה המשותפת, כדי שכולם יראו אותן.'),
    btn, status);
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
async function vehicleButtons(rescue) {
  const [ti, ri] = await Promise.all([DB.setting('truckImg'), DB.setting('trailerImg')]);
  const pic = async (id, svg) => { const u = id && await blobURL(id); return u ? h('div', { class: 'pic' }, h('img', { src: u, alt: '' })) : h('div', { class: 'pic', html: svg }); };
  const q = rescue ? '?rescue=1' : '';
  return h('div', { class: 'vehicles' },
    h('button', { class: 'vbtn', type: 'button', onclick: () => go('#/new/truck' + q) }, await pic(ti, TRUCK_SVG), h('span', {}, 'משאית')),
    h('button', { class: 'vbtn', type: 'button', onclick: () => go('#/new/trailer' + q) }, await pic(ri, TRAILER_SVG), h('span', {}, 'נגרר')));
}
async function homeExtras() {
  let open = 0; try { open = (await DB.all('orders')).filter(o => o.status === 'open').length; } catch { }
  return h('div', { class: 'grid2', style: 'margin-bottom:14px' },
    h('a', { class: 'btn big', href: '#/new/rescue', style: 'background:var(--danger-soft);color:var(--danger);min-height:76px' }, ic('truck'), 'חילוץ דרך'),
    h('a', { class: 'btn big', href: '#/orders', style: 'background:#fff3d6;color:#7a5200;min-height:76px;position:relative' }, ic('doc'), 'הזמנת חלקים',
      open > 0 && h('span', { class: 'badge' }, open)));
}
function demoNote() {
  if (sb) return h('div', { class: 'demo-pill', style: 'background:var(--ok-soft);color:var(--ok)' }, ic('check'), h('span', {}, 'שמירה משותפת בענן – כל העובדים רואים את אותן עבודות.'));
  return h('div', { class: 'demo-pill' }, ic('doc'), h('span', {}, 'גרסת ניסיון: העבודות נשמרות בטלפון הזה בלבד.'));
}

/* ---------- views ---------- */
async function viewHome() {
  setHeader('home');
  const recent = (await reportsSorted()).slice(0, 5);
  const nLocal = await localJobsCount();
  fill(view,
    nLocal > 0 && moveLocalCard(nLocal),
    h('div', { class: 'card' }, h('h2', { class: 'pick-title' }, 'בחר סוג רכב'), await vehicleButtons()),
    await homeExtras(),
    h('a', { class: 'btn big dark', href: '#/history', style: 'margin-bottom:14px' }, ic('search'), 'חיפוש היסטוריית טיפולים'),
    await foodCard(),
    demoNote(),
    h('h3', { style: 'margin:6px 2px 10px' }, 'עבודות אחרונות'),
    recent.length ? recent.map(r => reportItem(r)) : h('div', { class: 'empty' }, 'עדיין אין עבודות. לחץ "משאית" או "נגרר" כדי לדווח.'),
    h('div', { style: 'text-align:center;margin-top:18px' },
      isAdmin() && h('a', { class: 'btn sm', href: '#/admin' }, ic('gear'), 'מסך מנהל'),
      sb && me && h('p', { class: 'hint' }, 'מחובר: ', h('b', {}, me.name), me.role === 'admin' ? ' (מנהל)' : '', ' · ',
        h('a', { href: '#', onclick: async e => { e.preventDefault(); if (!confirm('להתנתק מהטלפון הזה?')) return; await sb.auth.signOut(); me = null; route(); } }, 'התנתקות'))));
}
async function viewPick(rescue) {
  setHeader('new', rescue ? 'חילוץ דרך' : '', rescue ? '#/' : undefined);
  fill(view, h('div', { class: 'card' }, h('h2', { class: 'pick-title' }, rescue ? 'חילוץ דרך – מה חולץ?' : 'דיווח עבודה חדשה – בחר סוג רכב'), await vehicleButtons(rescue)));
}

function PlateField(onChange, opts = {}) {
  const input = h('input', { class: 'input plate-in', inputmode: 'numeric', autocomplete: 'off', placeholder: 'הקלד מספר רכב', value: opts.value ? fmtPlate(opts.value) : '' });
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const gallery = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const status = h('div', { class: 'ocr-status', hidden: true });
  const preview = h('img', { class: 'plate-photo', hidden: true, alt: 'צילום לוחית' });
  const state = { image: null };
  let t = null;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => onChange(normPlate(input.value)), 350); });
  input.addEventListener('blur', () => { if (normPlate(input.value)) input.value = fmtPlate(input.value); });
  async function recognize(blob, fromPhotos) {
    if (fromPhotos && normPlate(input.value)) return;
    if (!fromPhotos || !state.image) { state.image = blob; preview.src = URL.createObjectURL(blob); preview.hidden = !opts.keepPhoto; }
    status.hidden = false; status.className = 'ocr-status'; fill(status, h('span', { class: 'spin' }), fromPhotos ? ' מחפש את מספר הרישוי בתמונה…' : ' מזהה את מספר הרישוי…');
    let plate = null, failed = false, why = '';
    if (aiOn()) {
      for (let attempt = 0; attempt < 2 && !plate; attempt++) {
        try { plate = await aiPlate(blob); failed = false; break; }
        catch (e) { console.warn('AI plate failed', e); failed = true; why = String(e && e.message || e); if (attempt === 0) await sleep(2500); }
      }
    }
    if (!plate && (!aiOn() || failed)) { try { plate = (await OCR.readPlate(blob)).plate; } catch (e) { console.warn(e); } }
    if (fromPhotos && normPlate(input.value)) { status.hidden = true; return; } // the worker typed meanwhile
    if (plate) {
      input.value = fmtPlate(plate); onChange(plate);
      status.className = 'ocr-status ok'; status.textContent = '✓ זוהה: ' + fmtPlate(plate) + ' – בדוק שהמספר נכון. אם לא, תקן בשדה.';
    } else if (fromPhotos) {
      status.hidden = true;
    } else {
      status.className = 'ocr-status bad';
      status.textContent = failed
        ? 'הזיהוי בענן לא זמין כרגע (' + (/gemini (429|503)|busy|unavailable/i.test(why) ? 'השרת של Google עמוס' : why.slice(0, 80)) + '). הקלד את המספר ידנית או נסה שוב בעוד דקה.'
        : 'לא הצלחתי לקרוא את המספר. צלם שוב כך שהלוחית תיראה, או הקלד ידנית.';
    }
  }
  for (const inp of [file, gallery]) inp.onchange = async () => {
    const f = inp.files[0]; inp.value = ''; if (!f) return;
    recognize(await compressImage(f, 2000, 0.9));
  };
  const el = h('div', {}, input, file, gallery,
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, ic('camera'), 'צלם את הרכב או הלוחית'),
      h('button', { type: 'button', class: 'btn', onclick: () => gallery.click() }, ic('image'), 'תמונה מהגלריה')),
    status, preview);
  return { el, input, state, recognize, value: () => normPlate(input.value) };
}

async function viewNew(type, prePlate, rescue) {
  const isTruck = type === 'truck';
  setHeader('new', (rescue ? 'חילוץ דרך – ' : 'דיווח עבודה חדשה – ') + typeName(type), rescue ? '#/new/rescue' : '#/new');
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
    const reps = (await DB.byPlate(p)).sort((a, b) => workTime(b) - workTime(a));
    const today = reps.find(r => sameDay(r.createdAt, Date.now()));
    known.hidden = false;
    fill(known,
      h('div', {}, h('b', {}, '✓ רכב מוכר במוסך'), ' – ', reps.length + ' טיפולים קודמים', reps[0] ? ' · אחרון: ' + fmtDate(workTime(reps[0])) : ''),
      v.type !== type ? h('div', { class: 'hint' }, 'שים לב: הרכב רשום אצלנו כ' + typeName(v.type) + '.') : null,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => showVehicleSheet(p) }, ic('clock'), 'טיפולים קודמים'),
        today && h('button', { type: 'button', class: 'btn sm ok', onclick: () => go('#/report/' + today.id + '/add') }, ic('plus'), 'המשך את הדיווח מהיום')));
  }
  const comp = Composer(rescue ? 'מה בוצע בחילוץ' : undefined, { onPhoto: b => { if (!plate.value()) plate.recognize(b, true); } });
  const worker = await WorkerPicker(rescue ? 'מי ביצע את החילוץ' : 'שם העובד שביצע את העבודה');
  const loc = rescue ? LocationField() : null;
  const wd = WorkDate();
  const when = h('div', { class: 'card' }, wd.el, h('p', { class: 'hint' }, 'אם העבודה נעשתה היום – אין צורך לשנות. זמן ההזנה למערכת נשמר בנפרד אוטומטית.'));
  const iv = 0;
  const saveBtn = h('button', { type: 'button', class: 'btn big ok' }, ic('check'), 'שמור עבודה');

  const vcard = h('div', { class: 'card' },
    h('label', { class: 'lbl' }, 'מספר רישוי ', h('span', { class: 'req' }, '*')), plate.el, known,
    h('label', { class: 'lbl' }, 'שם הלקוח'), micFor(customer), custList,
    isTruck && [h('label', { class: 'lbl' }, 'דגם המשאית'), micFor(model),
      h('div', { class: 'chips' }, ['DAF', 'Volvo', 'Scania', 'Mercedes', 'MAN', 'Renault', 'Iveco'].map(m => h('button', { type: 'button', class: 'chip', onclick: () => { model.value = m; } }, m))),
      h('label', { class: 'lbl' }, 'קילומטרים'), micFor(km, { numeric: true }), kmHint]);
  fill(view, rescue && h('div', { class: 'demo-pill', style: 'background:var(--danger-soft);color:var(--danger)' }, ic('truck'), h('span', {}, 'דיווח חילוץ דרך')),
    vcard, loc && loc.el, comp.el, worker.el, when, saveBtn);
  if (prePlate) lookup(normPlate(prePlate));

  dirtyCheck = () => !!(plate.value() || customer.value || comp.dirty());
  cleanup = () => { clearInterval(iv); comp.cleanup(); };

  saveBtn.onclick = async () => {
    const p = plate.value();
    if (p.length < 5) { alert('הכנס מספר רישוי (או צלם את הלוחית).'); plate.input.focus(); return; }
    if (comp.rec.isRecording()) { alert('יש הקלטה פעילה – לחץ קודם "סיים הקלטה".'); return; }
    if (!comp.has()) { alert('תאר את העבודה: הקלטה, כתיבה או תמונה.'); return; }
    if (comp.rec.busy()) { saveBtn.disabled = true; await waitTranscripts(comp, saveBtn); saveBtn.disabled = false; fill(saveBtn, ic('check'), 'שמור עבודה'); }
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
        workAt: wd.get(),
        ...(rescue ? { service: 'rescue', location: loc.get() } : {}),
        entries: [await buildEntry(comp, w, 'work', now, wd.get())],
        log: [{ at: now, workerId: w.id, workerName: w.name, ...actor(), action: 'create' }],
      };
      await DB.put('reports', r); await upsertVehicle(r);
      dirtyCheck = null; toast(rescue ? 'החילוץ נשמר ✓' : 'העבודה נשמרה ✓', 'ok'); go('#/report/' + r.id);
    } catch (e) {
      console.error(e); alert('השמירה נכשלה: ' + niceErr(e));
      saveBtn.disabled = false; fill(saveBtn, ic('check'), 'שמור עבודה');
    }
  };
}

function LocationField(init = {}) {
  const text = h('input', { class: 'input', placeholder: 'כביש, צומת, עיר או כתובת', value: init.text || '' });
  let lat = init.lat || null, lng = init.lng || null;
  const status = h('p', { class: 'hint' });
  const show = () => fill(status, lat ? h('a', { href: 'https://maps.google.com/?q=' + lat + ',' + lng, target: '_blank' }, '📍 מיקום GPS נשמר – פתח במפה') : '');
  const gps = h('button', { type: 'button', class: 'btn', style: 'margin-top:10px' }, '📍 המיקום שלי עכשיו');
  gps.onclick = () => {
    if (!navigator.geolocation) { alert('הטלפון לא מאפשר מיקום כאן.'); return; }
    fill(status, h('span', { class: 'spin' }), ' מאתר מיקום…');
    navigator.geolocation.getCurrentPosition(p => { lat = +p.coords.latitude.toFixed(6); lng = +p.coords.longitude.toFixed(6); show(); },
      () => { fill(status, 'לא הצלחתי לקבל מיקום. באייפון: הגדרות ← פרטיות ← שירותי מיקום ← Safari. אפשר לכתוב את המקום.'); },
      { enableHighAccuracy: true, timeout: 15000 });
  };
  show();
  return { el: h('div', { class: 'card' }, h('h3', {}, 'מיקום החילוץ'), micFor(text), gps, status),
    get: () => ({ text: text.value.trim(), lat, lng }) };
}
const locLink = l => l && (l.lat ? h('a', { href: 'https://maps.google.com/?q=' + l.lat + ',' + l.lng, target: '_blank' }, (l.text || 'פתח במפה') + ' 📍') : (l.text || null));
/* ---------- daily food order (until 12:00 Israel time) + phone reminders ---------- */
const VAPID_PUBLIC = 'BNJoFKgbeccHxDkdjSBgdxjtmCl1EfBW8OZUVKx7A8eDS6PPFpXq_gwwfny_md1A4ZiTdNFui7vF4KnTr34rqOA';   // public key – safe to publish; the private half is a Supabase secret
const ilParts = () => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
const ilToday = () => { const p = ilParts(); return p.year + '-' + p.month + '-' + p.day; };
const foodOpen = () => { const p = ilParts(); return (p.hour === '24' ? '00' : p.hour) + ':' + p.minute < '12:00'; };
const fmtDay = d => { const [y, m, dd] = d.split('-'); return dd + '.' + m + '.' + y; };
async function foodPlaces() { return (await DB.setting('foodPlaces')) || ['סאמי', 'גאקי', 'חומוס']; }
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC;
function b64ToBytes(b) { const p = '='.repeat((4 - b.length % 4) % 4), r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); }
async function enablePush() {
  if (!pushSupported()) {
    alert(/iPhone|iPad/.test(navigator.userAgent)
      ? 'באייפון התראות עובדות רק כשהאפליקציה נשמרה במסך הבית:\nשיתוף ← "הוסף למסך הבית", ואז לפתוח מהאייקון וללחוץ שוב על הכפתור.'
      : 'הדפדפן הזה לא תומך בהתראות. נסה ב-Chrome.');
    return;
  }
  if (await Notification.requestPermission() !== 'granted') { alert('לא אושרו התראות. אפשר לאשר בהגדרות הטלפון ← התראות.'); return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
    const { error } = await sb.from('push_subs').upsert({ endpoint: sub.endpoint, user_id: me.user_id, sub: sub.toJSON() });
    if (error) throw error;
    local.set('pushOn', '1'); toast('🔔 תקבל תזכורת לבחור אוכל', 'ok'); route();
  } catch (e) { console.error(e); alert('לא הצלחתי להפעיל התראות: ' + niceErr(e)); }
}
async function foodCard() {
  if (!sb || !me) return null;
  const today = ilToday(), open = foodOpen();
  let mine = null; try { mine = await DB.get('meals', today + '_' + myEid()); } catch { return null; }
  const places = await foodPlaces();
  const pushBtn = VAPID_PUBLIC && (pushSupported() && Notification.permission !== 'granted' || (/iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone && local.get('pushOn') !== '1'))
    ? h('button', { type: 'button', class: 'btn sm', style: 'margin-top:10px', onclick: enablePush }, '🔔 קבל תזכורת לטלפון') : null;
  return h('div', { class: 'card', style: 'border:2px solid #f5b400' },
    h('div', { class: 'item-top' }, h('h3', { style: 'margin:0', class: 'grow' }, '🍽️ אוכל היום'), h('span', { class: 'tag ' + (open ? 'st-open' : 'st-cancelled') }, open ? 'פתוח עד 12:00' : 'נסגר ב-12:00')),
    mine
      ? h('div', { style: 'margin-top:10px' }, h('div', { style: 'font-size:18px' }, '✓ הזמנת: ', h('b', {}, mine.place)), mine.text && h('div', { class: 'hint', style: 'margin-top:4px' }, mine.text),
          open && h('a', { class: 'btn sm', href: '#/food/new?place=' + encodeURIComponent(mine.place), style: 'margin-top:8px' }, ic('edit'), 'שנה'))
      : open
        ? h('div', { class: 'grid2', style: 'margin-top:12px;grid-template-columns:repeat(' + Math.min(3, places.length) + ',1fr)' },
            places.map(pl => h('a', { class: 'btn', href: '#/food/new?place=' + encodeURIComponent(pl), style: 'min-height:62px;font-size:19px' }, pl)))
        : h('p', { class: 'hint' }, 'לא הזמנת היום. ההזמנות נסגרו ב-12:00.'),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('a', { class: 'btn sm', href: '#/food' }, 'מה כולם הזמינו'), pushBtn));
}
async function viewFoodForm(place, who) {
  const today = ilToday();
  const forOther = isAdmin() && who;
  if (!foodOpen() && !isAdmin()) { toast('ההזמנות להיום נסגרו ב-12:00', 'bad'); go('#/'); return; }
  setHeader('', '🍽️ הזמנת אוכל להיום', '#/');
  const places = await foodPlaces();
  const worker = forOther ? { id: who, name: ((await employees(true)).find(e => e.id === who) || {}).name || '' } : { id: myEid(), name: me.name };
  const k = today + '_' + worker.id;
  const old = await DB.get('meals', k);
  let pick = place || (old && old.place) || places[0], audio = null;
  const chips = h('div', { class: 'chips' });
  const render = () => fill(chips, ...places.map(pl => h('button', { type: 'button', class: 'chip' + (pl === pick ? ' on' : ''), style: 'min-height:54px;font-size:19px;padding:0 22px', onclick: () => { pick = pl; render(); } }, pl)));
  render();
  const text = h('textarea', { class: 'input', rows: 3, placeholder: 'מה להזמין? למשל: שווארמה בלאפה בלי חריף, קולה', value: old ? old.text || '' : '' });
  const saveBtn = h('button', { type: 'button', class: 'btn big ok' }, ic('check'), old ? 'עדכן הזמנה' : 'הזמן');
  fill(view,
    h('div', { class: 'card' }, h('h3', {}, (forOther ? worker.name + ' – ' : '') + 'מאיפה?'), chips),
    h('div', { class: 'card' }, h('h3', {}, 'מה תרצה?'),
      h('p', { class: 'hint', style: 'margin-top:0' }, 'אפשר לכתוב, או ללחוץ על 🎤 ולהגיד.'),
      micFor(text, { append: true, onAudio: b => { audio = b; } })),
    h('p', { class: 'hint' }, 'ההזמנה נסגרת ב-12:00. עד אז אפשר לשנות.'),
    saveBtn,
    old && h('button', { type: 'button', class: 'btn wide danger', style: 'margin-top:10px', onclick: async () => {
      if (!confirm('לבטל את ההזמנה?')) return;
      try { await DB.del('meals', k); toast('ההזמנה בוטלה', 'ok'); go('#/'); } catch (e) { alert(foodErr(e)); }
    } }, 'בטל הזמנה'));
  saveBtn.onclick = async () => {
    if (!text.value.trim() && !audio) { alert('כתוב או הקלט מה להזמין.'); return; }
    saveBtn.disabled = true; fill(saveBtn, h('span', { class: 'spin' }), ' שומר…');
    try {
      const now = Date.now();
      const m = { ...(old || {}), id: k, date: today, workerId: worker.id, workerName: worker.name, ...actor(), place: pick, text: text.value.trim(), updatedAt: now, at: old ? old.at : now };
      if (audio) m.audio = await saveBlob(audio);
      await DB.put('meals', m);
      toast('🍽️ הוזמן: ' + pick, 'ok'); go(forOther ? '#/food' : '#/');
    } catch (e) { alert(foodErr(e)); saveBtn.disabled = false; fill(saveBtn, ic('check'), old ? 'עדכן הזמנה' : 'הזמן'); }
  };
}
const foodErr = e => (/row-level|policy|not_your/i.test(String(e && e.message || e)) ? 'ההזמנות להיום נסגרו ב-12:00 – אי אפשר לשנות יותר.' : niceErr(e));
async function viewFood(day) {
  setHeader('', '🍽️ הזמנות אוכל', '#/');
  day = day || ilToday();
  const meals = (await DB.all('meals')).filter(m => m.date === day).sort((a, b) => a.workerName.localeCompare(b.workerName, 'he'));
  const places = await foodPlaces();
  const by = {}; meals.forEach(m => { (by[m.place] = by[m.place] || []).push(m); });
  const dateIn = h('input', { class: 'input', type: 'date', value: day, onchange: e => go('#/food?d=' + e.target.value) });
  const audioUrls = await Promise.all(meals.map(m => (m.audio ? blobURL(m.audio) : null)));
  const urlOf = m => audioUrls[meals.indexOf(m)];
  let missing = [];
  if (isAdmin()) { const emps = await employees(); missing = emps.filter(e => !meals.some(m => m.workerId === e.id)); }
  const copyText = () => Object.keys(by).map(pl => pl + ' (' + by[pl].length + '):\n' + by[pl].map(m => '• ' + m.workerName + (m.text ? ' – ' + m.text : '')).join('\n')).join('\n\n');
  fill(view,
    h('div', { class: 'card' }, h('div', { class: 'grid2' }, h('div', {}, h('label', { class: 'lbl' }, 'יום'), dateIn),
      h('div', {}, h('label', { class: 'lbl' }, 'סה״כ'), h('div', { style: 'font-size:28px;font-weight:800' }, meals.length))),
      meals.length > 0 && h('button', { type: 'button', class: 'btn sm', style: 'margin-top:10px', onclick: async () => {
        try { await navigator.clipboard.writeText('הזמנת אוכל ' + fmtDay(day) + '\n\n' + copyText()); toast('הרשימה הועתקה – אפשר להדביק בוואטסאפ', 'ok'); } catch { alert(copyText()); }
      } }, '📋 העתק רשימה לשליחה')),
    places.concat(Object.keys(by).filter(pl => !places.includes(pl))).map(pl => h('div', { class: 'card' },
      h('h3', {}, pl + ' (' + (by[pl] || []).length + ')'),
      (by[pl] || []).length ? by[pl].map(m => h('div', { class: 'emp' },
        h('div', { class: 'grow' }, h('b', {}, m.workerName), m.byName && m.byName !== m.workerName ? h('span', { class: 'hint' }, ' (הוזן ע״י ' + m.byName + ')') : null,
          m.text && h('div', {}, m.text), urlOf(m) && h('audio', { controls: true, preload: 'none', src: urlOf(m), style: 'margin-top:6px' })),
        isAdmin() && h('a', { class: 'btn sm', href: '#/food/new?who=' + encodeURIComponent(m.workerId) + '&place=' + encodeURIComponent(m.place) }, 'ערוך')))
        : h('p', { class: 'hint' }, 'אף אחד עוד לא הזמין מכאן.'))),
    isAdmin() && day === ilToday() && h('div', { class: 'card' }, h('h3', {}, 'עוד לא הזמינו (' + missing.length + ')'),
      h('p', {}, missing.map(e => e.name).join(' · ') || 'כולם הזמינו ✓'),
      h('div', { class: 'row' },
        missing.length > 0 && h('button', { type: 'button', class: 'btn primary', onclick: async () => {
          try { const r = await garageCall({ action: 'remindNow' }); toast('נשלחה תזכורת ל-' + r.people + ' עובדים', 'ok'); }
          catch (e) { alert(/push_not_set_up/.test(e.message) ? 'ההתראות עוד לא הופעלו בשרת.' : niceErr(e)); }
        } }, '🔔 שלח תזכורת עכשיו'),
        h('span', { class: 'hint' }, 'תזכורת אוטומטית נשלחת בשעות שבחרת (א׳–ו׳) למי שעוד לא הזמין ושאישר התראות.'))),
    isAdmin() && await reminderTimesCard());
}
async function reminderTimesCard() {
  const cur = (await DB.setting('foodReminders')) || ['10:30', '11:30'];
  const t1 = h('input', { class: 'input', type: 'time', step: 900, value: cur[0] || '' });
  const t2 = h('input', { class: 'input', type: 'time', step: 900, value: cur[1] || '' });
  return h('div', { class: 'card' }, h('h3', {}, '⏰ שעות התזכורת'),
    h('p', { class: 'hint', style: 'margin-top:0' }, 'עד שתי תזכורות ביום, בין 06:00 ל-11:45 (ההזמנה נסגרת ב-12:00). אפשר להשאיר שדה ריק לתזכורת אחת בלבד. התזכורת נשלחת בדיוק של רבע שעה.'),
    h('div', { class: 'grid2' }, h('div', {}, h('label', { class: 'lbl' }, 'תזכורת ראשונה'), t1), h('div', {}, h('label', { class: 'lbl' }, 'תזכורת שנייה'), t2)),
    h('button', { type: 'button', class: 'btn primary', style: 'margin-top:12px', onclick: async () => {
      const list = [t1.value, t2.value].filter(Boolean).map(x => x.slice(0, 5));
      if (list.some(x => x < '06:00' || x >= '12:00')) { alert('בחר שעה בין 06:00 ל-11:45.'); return; }
      try { await DB.setSetting('foodReminders', [...new Set(list)].sort()); toast('שעות התזכורת נשמרו', 'ok'); } catch (e) { alert(niceErr(e)); }
    } }, 'שמור שעות'));
}
/* ---------- parts orders ---------- */
const ORDER_STATUS = { open: 'ממתינה להזמנה', ordered: 'הוזמנה', received: 'התקבלה', cancelled: 'בוטלה' };
const statusTag = st => h('span', { class: 'tag st-' + st }, ORDER_STATUS[st] || st);
const canEditOrder = o => isAdmin() || (o.workerId === myEid() && o.status === 'open');
function orderItem(o, thumb) {
  return h('button', { class: 'item', type: 'button', onclick: () => go('#/orders/' + o.id) },
    h('div', { class: 'item-top' },
      thumb ? h('img', { src: thumb, alt: '', style: 'width:54px;height:54px;object-fit:cover;border-radius:10px' }) : null,
      h('div', { class: 'grow' }, h('b', { dir: 'ltr', style: 'font-size:17px' }, o.sku || '(ללא מק״ט)'), ' ', h('span', {}, o.partName || '')),
      h('b', { style: 'font-size:20px' }, '×' + (o.qty || 1))),
    h('div', { class: 'meta' }, statusTag(o.status), o.urgent && h('span', { class: 'tag rescue' }, 'דחוף'),
      o.plate && plateBadge(o.plate), h('span', {}, o.workerName || ''), h('span', {}, fmtDT(o.createdAt))),
    o.note && h('div', { class: 'snip' }, o.note));
}
async function viewOrders(filter) {
  setHeader('', 'הזמנת חלקים', '#/');
  const all = (await DB.all('orders')).sort((a, b) => (b.urgent - a.urgent) || b.createdAt - a.createdAt);
  const list = filter === 'all' ? all : all.filter(o => o.status === filter);
  const thumbs = await Promise.all(list.map(o => (o.photos && o.photos[0] ? blobURL(o.photos[0]) : null)));
  const tabs = [['open', 'ממתינות'], ['ordered', 'הוזמנו'], ['received', 'התקבלו'], ['all', 'הכול']];
  fill(view,
    h('a', { class: 'btn big ok', href: '#/orders/new', style: 'margin-bottom:14px' }, ic('plus'), 'הזמנה חדשה'),
    h('div', { class: 'subtabs' }, tabs.map(([k, l]) => h('a', { href: '#/orders?s=' + k, class: filter === k ? 'on' : '' }, l + ' (' + (k === 'all' ? all.length : all.filter(o => o.status === k).length) + ')'))),
    list.length ? list.map((o, i) => orderItem(o, thumbs[i])) : h('div', { class: 'empty' }, 'אין הזמנות כאן.'));
}
async function viewOrderForm(id, prePlate) {
  const old = id ? await DB.get('orders', id) : null;
  if (id && !old) { fill(view, h('div', { class: 'empty' }, 'ההזמנה לא נמצאה')); return; }
  if (old && !canEditOrder(old)) { toast('אפשר לשנות רק הזמנה שלך שעוד לא הוזמנה', 'bad'); go('#/orders/' + id); return; }
  setHeader('', old ? 'עריכת הזמנה' : 'הזמנת חלק חדשה', old ? '#/orders/' + id : '#/orders');
  const sku = h('input', { class: 'input', dir: 'ltr', placeholder: 'מק״ט / מספר חלק', value: old ? old.sku : '', autocomplete: 'off', autocapitalize: 'characters' });
  const partName = h('input', { class: 'input', placeholder: 'מה החלק? למשל: כרית אוויר אחורית', value: old ? old.partName : '' });
  const qty = h('input', { class: 'input', inputmode: 'numeric', value: old ? String(old.qty) : '1', style: 'text-align:center;font-size:24px;font-weight:800' });
  const step = d => { qty.value = String(Math.max(1, (parseInt(qty.value, 10) || 1) + d)); };
  const note = h('textarea', { class: 'input', rows: 3, placeholder: 'הערות: ספק, צבע, מידה, למי…', value: old ? old.note : '' });
  const urgent = h('input', { type: 'checkbox', style: 'width:24px;height:24px' }); urgent.checked = !!(old && old.urgent);
  const skuStatus = h('div', { class: 'ocr-status', hidden: true });
  const readSku = async blob => {
    if (!aiOn()) return;
    skuStatus.hidden = false; skuStatus.className = 'ocr-status'; fill(skuStatus, h('span', { class: 'spin' }), ' קורא את המק״ט מהתמונה…');
    try {
      const r = await aiSku(blob);
      if (r.sku && !sku.value.trim()) sku.value = r.sku;
      if (r.name && !partName.value.trim()) partName.value = r.name + (r.brand ? ' (' + r.brand + ')' : '');
      skuStatus.className = r.sku ? 'ocr-status ok' : 'ocr-status bad';
      skuStatus.textContent = r.sku ? '✓ זוהה מק״ט: ' + r.sku + ' – בדוק שהוא נכון.' : 'לא מצאתי מק״ט בתמונה. אפשר להקליד, או לצלם את התווית מקרוב.';
    } catch (e) { skuStatus.className = 'ocr-status bad'; skuStatus.textContent = 'קריאת המק״ט לא זמינה כרגע – הקלד ידנית.'; }
  };
  const ph = Photos(b => readSku(b));
  const oldPhotos = old ? (await Promise.all((old.photos || []).map(blobURL))).filter(Boolean) : [];
  const worker = await WorkerPicker('מי מזמין');
  const saveBtn = h('button', { type: 'button', class: 'btn big ok' }, ic('check'), old ? 'שמור שינויים' : 'שלח הזמנה');
  fill(view,
    h('div', { class: 'card' }, h('h3', {}, 'תמונה של החלק או של המק״ט'),
      h('p', { class: 'hint', style: 'margin-top:0' }, 'צלם את התווית עם המספר – המק״ט ייקרא אוטומטית.'),
      oldPhotos.length ? photoGrid(oldPhotos) : null, ph.el, skuStatus),
    h('div', { class: 'card' },
      h('label', { class: 'lbl' }, 'מק״ט'), sku,
      h('label', { class: 'lbl' }, 'שם החלק'), micFor(partName),
      h('label', { class: 'lbl' }, 'כמות להזמין'),
      h('div', { class: 'with-mic' }, h('button', { type: 'button', class: 'btn', style: 'min-width:56px;font-size:26px', onclick: () => step(-1) }, '−'), qty,
        h('button', { type: 'button', class: 'btn', style: 'min-width:56px;font-size:26px', onclick: () => step(1) }, '+')),
      sb && h('div', { style: 'margin-top:8px' }, micFor(h('input', { class: 'input', placeholder: 'או אמור את הכמות', oninput: e => { const n = parseInt(e.target.value, 10); if (n > 0) qty.value = String(n); } }), { numeric: true })),
      h('label', { class: 'lbl' }, 'הערות'), micFor(note, { append: true }),
      h('label', { style: 'display:flex;gap:10px;align-items:center;font-weight:700;margin-top:14px' }, urgent, 'דחוף')),
    worker.el, saveBtn);
  dirtyCheck = () => !old && !!(sku.value.trim() || partName.value.trim() || ph.list.length || note.value.trim());
  saveBtn.onclick = async () => {
    if (!sku.value.trim() && !partName.value.trim() && !ph.list.length && !(old && old.photos && old.photos.length)) { alert('צלם את החלק, או כתוב מק״ט או שם חלק.'); return; }
    const n = parseInt(qty.value, 10); if (!(n > 0)) { alert('הכנס כמות.'); return; }
    const w = worker.get(); if (!w) { alert('בחר את השם שלך.'); return; }
    saveBtn.disabled = true; fill(saveBtn, h('span', { class: 'spin' }), ' שומר…');
    try {
      const now = Date.now(), photos = [];
      for (const p of ph.list) photos.push(await saveBlob(p.blob));
      const o = old ? { ...old } : { id: uid(), createdAt: now, status: 'open', workerId: w.id, workerName: w.name, ...actor(), photos: [], statusLog: [{ at: now, status: 'open', byName: (me && me.name) || w.name }] };
      Object.assign(o, { sku: sku.value.trim(), partName: partName.value.trim(), qty: n, note: note.value.trim(), urgent: urgent.checked, updatedAt: now });
      o.photos = [...(o.photos || []), ...photos];
      await DB.put('orders', o);
      dirtyCheck = null; toast(old ? 'ההזמנה עודכנה ✓' : 'ההזמנה נשלחה ✓', 'ok'); go('#/orders/' + o.id);
    } catch (e) { alert('השמירה נכשלה: ' + niceErr(e)); saveBtn.disabled = false; fill(saveBtn, ic('check'), old ? 'שמור שינויים' : 'שלח הזמנה'); }
  };
}
async function viewOrder(id) {
  const o = await DB.get('orders', id);
  if (!o) { setHeader('', 'הזמנה', '#/orders'); fill(view, h('div', { class: 'empty' }, 'ההזמנה לא נמצאה')); return; }
  setHeader('', 'הזמנה ' + (o.sku || ''), '#/orders');
  const urls = (await Promise.all((o.photos || []).map(blobURL))).filter(Boolean);
  const setStatus = async st => {
    try {
      const f = await DB.get('orders', id);
      f.status = st; f.updatedAt = Date.now();
      f.statusLog = [...(f.statusLog || []), { at: Date.now(), status: st, byName: (me && me.name) || '' }];
      await DB.put('orders', f); toast('עודכן: ' + ORDER_STATUS[st], 'ok'); route();
    } catch (e) { alert(niceErr(e)); }
  };
  fill(view,
    h('div', { class: 'card' },
      h('div', { class: 'item-top' }, h('b', { dir: 'ltr', style: 'font-size:22px' }, o.sku || '(ללא מק״ט)'), h('span', { class: 'grow' }), statusTag(o.status), o.urgent && h('span', { class: 'tag rescue' }, 'דחוף')),
      h('dl', { class: 'kv' },
        h('dt', {}, 'חלק'), h('dd', {}, o.partName || '—'),
        h('dt', {}, 'כמות'), h('dd', { style: 'font-size:20px' }, '×' + o.qty),
        o.plate && [h('dt', {}, 'רכב'), h('dd', {}, h('a', { href: '#/vehicle/' + o.plate }, plateBadge(o.plate)))],
        h('dt', {}, 'הוזמן ע״י'), h('dd', {}, (o.workerName || '') + byNote(o)),
        h('dt', {}, 'נפתח'), h('dd', {}, fmtDT(o.createdAt))),
      o.note && h('p', { class: 'entry-text' }, o.note),
      urls.length ? h('div', { style: 'margin-top:10px' }, photoGrid(urls)) : null),
    isAdmin() && h('div', { class: 'card' }, h('h3', {}, 'עדכון סטטוס (מנהל)'),
      h('div', { class: 'row' },
        o.status !== 'ordered' && h('button', { type: 'button', class: 'btn primary', onclick: () => setStatus('ordered') }, 'סמן: הוזמנה'),
        o.status !== 'received' && h('button', { type: 'button', class: 'btn ok', onclick: () => setStatus('received') }, 'סמן: התקבלה'),
        o.status !== 'open' && h('button', { type: 'button', class: 'btn', onclick: () => setStatus('open') }, 'החזר לממתינה'),
        o.status !== 'cancelled' && h('button', { type: 'button', class: 'btn danger', onclick: () => setStatus('cancelled') }, 'בטל'))),
    canEditOrder(o) && h('div', { class: 'row', style: 'margin-bottom:14px' },
      h('a', { class: 'btn', href: '#/orders/' + id + '/edit' }, ic('edit'), 'ערוך הזמנה'),
      !isAdmin() && h('button', { type: 'button', class: 'btn danger', onclick: () => { if (confirm('לבטל את ההזמנה?')) setStatus('cancelled'); } }, 'בטל הזמנה')),
    h('div', { class: 'card' }, h('h3', {}, 'היסטוריה'), h('ul', { class: 'log' }, (o.statusLog || []).slice().reverse().map(l => h('li', {}, h('b', {}, fmtDT(l.at)), ' · ', ORDER_STATUS[l.status] || l.status, l.byName ? ' · ' + l.byName : '')))),
    isAdmin() && sb && h('button', { type: 'button', class: 'btn wide danger', onclick: async () => {
      if (!confirm('למחוק את ההזמנה לגמרי?')) return;
      try { await DB.del('orders', id); for (const b of o.photos || []) { try { await Blobs.del(b); } catch { } } toast('נמחקה', 'ok'); go('#/orders'); } catch (e) { alert(niceErr(e)); }
    } }, ic('trash'), 'מחק הזמנה (מנהל)'));
}
async function showVehicleSheet(plate) {
  const reps = (await DB.byPlate(plate)).sort((a, b) => workTime(b) - workTime(a));
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
  const reps = (await DB.byPlate(p)).sort((a, b) => workTime(b) - workTime(a));
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
    (canEditDetails(r) || r.entries.some(canEditEntry))
      ? h('a', { class: 'btn wide', href: '#/report/' + id + '/edit', style: 'margin-bottom:14px' }, ic('edit'), isAdmin() ? 'תקן או מחק בדיווח' : 'תקן טעות בעבודה שלי')
      : h('p', { class: 'hint', style: 'margin:0 0 14px' }, 'אפשר להוסיף עבודה לדיווח הזה. תיקון של עבודה שרשם עובד אחר – רק מנהל.'),
    await reportBody(r),
    h('a', { class: 'btn wide', href: '#/vehicle/' + r.plate }, ic('clock'), 'כל הטיפולים של הרכב הזה'),
    isAdmin() && sb && h('button', { type: 'button', class: 'btn wide danger', style: 'margin-top:10px', onclick: async () => {
      if (!confirm('למחוק את כל הדיווח של ' + fmtPlate(r.plate) + ' מ-' + fmtDate(r.createdAt) + '?\nכולל ההקלטות והתמונות. אי אפשר לבטל.')) return;
      try {
        const ids = [r.plateImage, ...r.entries.flatMap(e => [...e.photos, ...e.recordings.map(x => x.blobId)])].filter(Boolean);
        await DB.del('reports', r.id);
        for (const b of ids) { try { await Blobs.del(b); } catch { } }
        toast('הדיווח נמחק', 'ok'); go('#/vehicle/' + r.plate);
      } catch (e) { alert('המחיקה נכשלה: ' + niceErr(e)); }
    } }, ic('trash'), 'מחק את כל הדיווח (מנהל)'));
}

async function viewAdd(id) {
  const r = await DB.get('reports', id); if (!r) return viewReport(id);
  setHeader('', 'הוספה לדיווח ' + fmtPlate(r.plate), '#/report/' + id);
  let kind = 'work';
  const kinds = h('div', { class: 'chips' });
  const renderKinds = () => fill(kinds, ...[['work', 'עבודה נוספת'], ['note', 'הערה']].map(([k, l]) => h('button', { type: 'button', class: 'chip' + (kind === k ? ' on' : ''), onclick: () => { kind = k; renderKinds(); } }, l)));
  renderKinds();
  const comp = Composer('מה נוסף');
  const worker = await WorkerPicker('מי ביצע את העבודה');
  const wd = WorkDate();
  const saveBtn = h('button', { type: 'button', class: 'btn big ok' }, ic('check'), 'שמור תוספת');
  fill(view,
    h('div', { class: 'card' }, h('div', { class: 'item-top' }, plateBadge(r.plate), typeTag(r.type), h('span', {}, r.customer || '')),
      h('p', { class: 'hint' }, 'הדיווח נפתח ב-' + fmtDT(r.createdAt) + '. מה שנרשם קודם נשאר כמו שהוא – התוספת תישמר בנפרד עם השם והשעה.'),
      h('label', { class: 'lbl', style: 'margin-top:12px' }, 'סוג התוספת'), kinds),
    comp.el, worker.el, h('div', { class: 'card' }, wd.el), saveBtn);
  dirtyCheck = () => comp.dirty(); cleanup = () => comp.cleanup();
  saveBtn.onclick = async () => {
    if (comp.rec.isRecording()) { alert('יש הקלטה פעילה – לחץ קודם "סיים הקלטה".'); return; }
    if (!comp.has()) { alert('אין מה לשמור – הקלט, כתוב או צלם.'); return; }
    if (comp.rec.busy()) { saveBtn.disabled = true; await waitTranscripts(comp, saveBtn); saveBtn.disabled = false; fill(saveBtn, ic('check'), 'שמור תוספת'); }
    const w = worker.get(); if (!w) { alert('בחר את השם שלך.'); return; }
    saveBtn.disabled = true; fill(saveBtn, h('span', { class: 'spin' }), ' שומר…');
    try {
      const now = Date.now();
      const entry = await buildEntry(comp, w, kind, now, wd.get());
      const fresh = await DB.get('reports', id);
      fresh.entries.push(entry);
      fresh.log.push({ at: now, workerId: w.id, workerName: w.name, ...actor(), action: 'add', kind });
      fresh.updatedAt = now; await DB.put('reports', fresh); await upsertVehicle(fresh);
      dirtyCheck = null; toast('התוספת נשמרה ✓', 'ok'); go('#/report/' + id);
    } catch (e) {
      console.error(e); alert('השמירה נכשלה: ' + niceErr(e));
      saveBtn.disabled = false; fill(saveBtn, ic('check'), 'שמור תוספת');
    }
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
  const headOk = canEditDetails(r);
  if (!headOk) Object.values(f).forEach(x => { x.disabled = true; });
  const deleted = new Set();
  const entryFields = r.entries.map((e, i) => {
    const ok = canEditEntry(e);
    const ta = h('textarea', { class: 'input', rows: 3, value: e.text || '', disabled: !ok });
    const wd = WorkDate('מתי בוצעה העבודה', workTime(e), !ok);
    return { e, ok, ta, wd,
      recs: e.recordings.map(rc => ({ rc, ta: h('textarea', { class: 'input', rows: 2, value: rc.transcript || '', disabled: !ok }) })),
      label: e.kind === 'note' ? 'הערה' : i === 0 ? 'העבודה שבוצעה' : 'עבודה נוספת ' + i };
  });
  // with logins the person fixing is whoever is signed in; without cloud, pick a name
  const worker = sb && me ? { el: null, get: () => ({ id: myEid(), name: me.name }) } : await WorkerPicker('מי מתקן');
  const saveBtn = h('button', { type: 'button', class: 'btn big ok' }, ic('check'), 'שמור תיקון');
  fill(view,
    h('div', { class: 'demo-pill' }, ic('edit'), h('span', {}, 'כל תיקון נרשם בהיסטוריית השינויים עם שם המתקן והשעה, והנוסח הקודם נשמר.')),
    !isAdmin() && h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'אפשר לתקן רק את מה שאתה רשמת. החלקים האפורים נרשמו ע״י אחרים – תיקון שלהם רק אצל מנהל.'),
    h('div', { class: 'card' }, h('h3', {}, 'פרטי הרכב'),
      !headOk && h('p', { class: 'hint', style: 'margin-top:0' }, 'נפתח ע״י ' + (r.createdByName || 'עובד אחר') + ' – רק הוא או מנהל יכולים לשנות.'),
      h('label', { class: 'lbl' }, 'מספר רישוי'), f.plate, h('label', { class: 'lbl' }, 'שם הלקוח'), headOk ? micFor(f.customer) : f.customer,
      isTruck && [h('label', { class: 'lbl' }, 'דגם'), f.model, h('label', { class: 'lbl' }, 'קילומטרים'), f.km]),
    entryFields.map((x, i) => {
      const card = h('div', { class: 'card', style: x.ok ? '' : 'opacity:.6' }, h('h3', {}, x.label + ' · ' + fmtDT(x.e.at) + ' · ' + x.e.workerName),
        h('label', { class: 'lbl' }, 'טקסט'), x.ta,
        x.wd.el,
        x.recs.map((y, j) => [h('label', { class: 'lbl' }, 'תמלול הקלטה ' + (j + 1)), y.ta]),
        isAdmin() && sb && r.entries.length > 1 && h('button', { type: 'button', class: 'btn sm danger', style: 'margin-top:12px', onclick: () => {
          if (deleted.has(i)) { deleted.delete(i); card.style.outline = ''; return; }
          if (!confirm('למחוק את הקטע "' + x.label + '" (כולל ההקלטות והתמונות שלו)? המחיקה תתבצע בשמירה.')) return;
          deleted.add(i); card.style.outline = '3px solid var(--danger)';
        } }, ic('trash'), 'מחק קטע זה (מנהל)'));
      return card;
    }),
    worker.el, saveBtn);
  const dirty = () => normPlate(f.plate.value) !== r.plate || f.customer.value.trim() !== (r.customer || '') ||
    (isTruck && (f.model.value.trim() !== (r.model || '') || (+normPlate(f.km.value) || null) !== (r.km || null))) ||
    entryFields.some(x => x.ta.value.trim() !== (x.e.text || '') || Math.abs(x.wd.get() - workTime(x.e)) >= 60e3 || x.recs.some(y => y.ta.value.trim() !== (y.rc.transcript || ''))) || deleted.size > 0;
  dirtyCheck = dirty;
  saveBtn.onclick = async () => {
    if (!dirty()) { toast('לא בוצעו שינויים'); return; }
    const w = worker.get(); if (!w) { alert('בחר את השם של מי שמתקן.'); return; }
    const np = normPlate(f.plate.value); if (np.length < 5) { alert('מספר רישוי לא תקין'); return; }
    const now = Date.now(), changes = [];
    let fresh; try { fresh = await DB.get('reports', id); } catch (e) { alert('השמירה נכשלה: ' + niceErr(e)); return; }
    const setF = (key, label, val, show = v => v) => { const old = fresh[key] == null ? '' : fresh[key]; if ((val == null ? '' : val) !== old) { changes.push({ field: label, from: show(old), to: show(val) }); fresh[key] = val; } };
    if (headOk) {
      setF('plate', 'מספר רישוי', np, fmtPlate);
      setF('customer', 'לקוח', f.customer.value.trim());
      if (isTruck) { setF('model', 'דגם', f.model.value.trim()); setF('km', 'קילומטרים', +normPlate(f.km.value) || null, v => v ? fmtNum(v) : ''); }
    }
    entryFields.forEach((x, i) => {
      if (!x.ok) return;
      const e = fresh.entries.find(z => z.id === x.e.id); if (!e) return; const nv = x.ta.value.trim();
      const nw = x.wd.get();
      if (Math.abs(nw - workTime(e)) >= 60e3) {
        changes.push({ field: 'תאריך העבודה – ' + x.label, from: fmtDT(workTime(e)), to: fmtDT(nw) });
        e.workAt = nw;
        if (i === 0 && headOk) fresh.workAt = nw;
      }
      if (nv !== (e.text || '')) { (e.versions = e.versions || []).push({ text: e.text || '', at: now, by: w.name }); changes.push({ field: 'טקסט – ' + x.label, from: e.text, to: nv }); e.text = nv; }
      x.recs.forEach((y, j) => { const rc = e.recordings[j]; const tv = y.ta.value.trim();
        if (tv !== (rc.transcript || '')) { (rc.versions = rc.versions || []).push({ text: rc.transcript || '', at: now, by: w.name }); changes.push({ field: 'תמלול הקלטה ' + (j + 1) + ' – ' + x.label, from: rc.transcript, to: tv }); rc.transcript = tv; } });
    });
    const gone = [];
    if (deleted.size) {
      const ids = new Set([...deleted].map(i => entryFields[i].e.id));
      fresh.entries = fresh.entries.filter(e => { if (ids.has(e.id)) { gone.push(e); return false; } return true; });
      gone.forEach(e => changes.push({ field: 'נמחק קטע של ' + e.workerName + ' מ-' + fmtDT(e.at), from: e.text || e.recordings.map(x => x.transcript).join(' '), to: '' }));
    }
    fresh.log.push({ at: now, workerId: w.id, workerName: w.name, ...actor(), action: 'edit', changes });
    fresh.updatedAt = now;
    try { await DB.put('reports', fresh); await upsertVehicle(fresh); } catch (e) { alert('השמירה נכשלה: ' + niceErr(e)); return; }
    for (const e of gone) for (const b of [...e.photos, ...e.recordings.map(x => x.blobId)]) { try { await Blobs.del(b); } catch { } }
    dirtyCheck = null; toast('התיקון נשמר ✓', 'ok'); go('#/report/' + id);
  };
}

/* ---------- admin ---------- */
async function viewAdmin(tab) {
  if (!isAdmin()) { toast('מסך המנהל פתוח רק למנהלים', 'bad'); go('#/'); return; }
  const pin = sb ? null : await DB.setting('adminPin');
  let unlocked = false; try { unlocked = sessionStorage.getItem('tg_admin') === '1'; } catch { }
  if (pin && !unlocked) {
    const v = prompt('קוד מנהל:');
    if (v !== pin) { if (v != null) alert('קוד שגוי'); go('#/'); return; }
    try { sessionStorage.setItem('tg_admin', '1'); } catch { }
  }
  setHeader('', 'מסך מנהל', '#/');
  const tabs = h('div', { class: 'subtabs' }, [['works', 'כל העבודות'], ['workers', sb ? 'משתמשים' : 'עובדים'], ['changes', 'מי ערך מה'], ['settings', 'הגדרות וגיבוי']]
    .map(([k, l]) => h('a', { href: '#/admin/' + k, class: tab === k ? 'on' : '' }, l)));
  const body = h('div');
  fill(view, tabs, body);
  if (tab === 'workers') return sb ? adminUsers(body) : adminWorkers(body);
  if (tab === 'changes') return adminChanges(body);
  if (tab === 'settings') return adminSettings(body);
  return adminWorks(body);
}
/* ---------- admin export: ZIP with Excel + photos + recordings + offline page ---------- */
function exportCard() {
  const d = new Date();
  const from = h('input', { class: 'input', type: 'date', value: d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-01' });
  const to = h('input', { class: 'input', type: 'date', value: d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) });
  const status = h('p', { class: 'hint', hidden: true });
  const btn = h('button', { type: 'button', class: 'btn primary wide', style: 'margin-top:12px' }, ic('down'), 'הורד הכול לקובץ');
  btn.onclick = async () => {
    if (!from.value || !to.value) { alert('בחר מתאריך ועד תאריך.'); return; }
    btn.disabled = true; status.hidden = false;
    try { await exportRange(new Date(from.value + 'T00:00').getTime(), new Date(to.value + 'T23:59:59').getTime(), from.value, to.value, status); }
    catch (e) { console.error(e); fill(status, 'ההורדה נכשלה: ' + niceErr(e)); }
    btn.disabled = false;
  };
  return h('div', { class: 'card', style: 'border:2px solid var(--brand2)' },
    h('h3', {}, 'הורדת עבודות למחשב'),
    h('p', { class: 'hint', style: 'margin-top:0' }, 'קובץ ZIP אחד: טבלת Excel של כל העבודות, תיקייה לכל דיווח עם התמונות וההקלטות, ודף "פתח-אותי" לצפייה בהכול גם בלי אינטרנט.'),
    h('div', { class: 'grid2' }, h('div', {}, h('label', { class: 'lbl' }, 'מתאריך'), from), h('div', {}, h('label', { class: 'lbl' }, 'עד תאריך'), to)),
    btn, status);
}
const extOf = t => (/jpe?g/.test(t) ? 'jpg' : /png/.test(t) ? 'png' : /heic/.test(t) ? 'heic' : /mp4|m4a|aac/.test(t) ? 'm4a' : /wav/.test(t) ? 'wav' : /webm/.test(t) ? 'webm' : /ogg/.test(t) ? 'ogg' : /mpeg|mp3/.test(t) ? 'mp3' : 'bin');
const ymd = t => { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function exportRange(from, to, fromTxt, toTxt, status) {
  const say = t => fill(status, h('span', { class: 'spin' }), ' ' + t);
  say('טוען נתונים…');
  if (!window.JSZip) await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  if (!window.XLSX) await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  const reports = (await DB.all('reports'))
    .map(r => ({ r, entries: r.entries.filter(e => workTime(e) >= from && workTime(e) <= to) }))
    .filter(x => x.entries.length)
    .sort((a, b) => workTime(a.entries[0]) - workTime(b.entries[0]));
  let orders = [];
  try { orders = (await DB.all('orders')).filter(o => o.createdAt >= from && o.createdAt <= to).sort((a, b) => a.createdAt - b.createdAt); } catch { }
  if (!reports.length && !orders.length) { fill(status, 'אין עבודות או הזמנות בין התאריכים האלה.'); return; }
  const files = [];   // { path, id }
  const rows = [], viewer = [];
  for (const { r, entries } of reports) {
    const folder = 'jobs/' + ymd(workTime(entries[0])) + '_' + r.plate + '_' + r.id.slice(0, 6) + '/';
    const vjob = { rescue: r.service === 'rescue', where: r.location ? r.location.text || '' : '', plate: fmtPlate(r.plate), type: typeName(r.type), customer: r.customer || '', model: r.model || '', km: r.km || '', folder, entries: [], platePhoto: null };
    if (r.plateImage) { vjob.platePhoto = folder + 'plate.jpg'; files.push({ path: vjob.platePhoto, id: r.plateImage }); }
    entries.forEach((e, n) => {
      const i = r.entries.indexOf(e);
      const kind = e.kind === 'note' ? 'הערה' : i === 0 ? 'עבודה' : 'עבודה נוספת';
      const tag = 'part' + (i + 1);
      const photos = e.photos.map((id, k) => { const path = folder + tag + '-photo-' + (k + 1) + '.jpg'; files.push({ path, id }); return path; });
      const recs = e.recordings.map((rc, k) => { const path = folder + tag + '-recording-' + (k + 1) + '.' + extOf(rc.mime || ''); files.push({ path, id: rc.blobId }); return { path, transcript: rc.transcript || '' }; });
      rows.push({
        'תאריך העבודה': ymd(workTime(e)), 'שעה': fmtTime(workTime(e)), 'נרשם במערכת': fmtDT(e.at),
        'שירות': r.service === 'rescue' ? 'חילוץ דרך' : 'עבודה במוסך', 'מיקום': r.service === 'rescue' && r.location ? [r.location.text, r.location.lat ? 'https://maps.google.com/?q=' + r.location.lat + ',' + r.location.lng : ''].filter(Boolean).join(' ') : '',
        'מספר רישוי': fmtPlate(r.plate), 'סוג': typeName(r.type), 'לקוח': r.customer || '', 'דגם': r.model || '', 'ק״מ': r.km || '',
        'עובד': e.workerName || '', 'הוזן ע״י': e.byName && e.byName !== e.workerName ? e.byName : '', 'סוג קטע': kind,
        'מה בוצע (טקסט)': e.text || '', 'תמלול הקלטות': recs.map(x => x.transcript).filter(Boolean).join(' | '),
        'תמונות': photos.length, 'הקלטות': recs.length, 'תיקייה': folder,
      });
      vjob.entries.push({ kind, date: fmtDT(workTime(e)), entered: fmtDT(e.at), worker: e.workerName || '', by: e.byName && e.byName !== e.workerName ? e.byName : '', text: e.text || '', photos, recs });
    });
    viewer.push(vjob);
  }
  const orderRows = orders.map(o => {
    const photos = (o.photos || []).map((id, k) => { const path = 'orders/' + ymd(o.createdAt) + '_' + (o.sku || 'part').replace(/[^\w.-]+/g, '_').slice(0, 30) + '_' + o.id.slice(0, 6) + '-' + (k + 1) + '.jpg'; files.push({ path, id }); return path; });
    o._photos = photos;
    return { 'תאריך': fmtDT(o.createdAt), 'מק״ט': o.sku || '', 'חלק': o.partName || '', 'כמות': o.qty || 1, 'דחוף': o.urgent ? 'כן' : '',
      'רכב': o.plate ? fmtPlate(o.plate) : '', 'הוזמן ע״י': o.workerName || '', 'סטטוס': ORDER_STATUS[o.status] || o.status,
      'עדכון סטטוס': (o.statusLog || []).map(l => fmtDT(l.at) + ' ' + (ORDER_STATUS[l.status] || l.status) + (l.byName ? ' (' + l.byName + ')' : '')).join(' | '),
      'הערות': o.note || '', 'תמונות': photos.join(' ') };
  });
  if (files.length > 400 && !confirm('יש ' + files.length + ' קבצים (תמונות והקלטות). ההורדה עלולה לקחת כמה דקות. להמשיך?')) { fill(status, 'בוטל.'); return; }
  const zip = new JSZip();
  // photos and recordings (already compressed → stored as-is)
  let done = 0, missing = 0;
  const queue = files.slice();
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      try { const b = await Blobs.get(f.id); if (b) zip.file(f.path, b, { binary: true, compression: 'STORE' }); else missing++; } catch { missing++; }
      say('מוריד תמונות והקלטות ' + (++done) + ' / ' + files.length + '…');
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  // Excel
  say('בונה קובץ Excel…');
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'תאריך העבודה': '', 'מה בוצע (טקסט)': 'אין עבודות בתקופה' }]);
  ws['!cols'] = [12, 7, 16, 12, 24, 12, 8, 18, 12, 9, 14, 14, 11, 50, 50, 7, 7, 34].map(w => ({ wch: w }));
  rows.forEach((row, i) => { const c = XLSX.utils.encode_cell({ r: i + 1, c: 17 }); if (ws[c]) ws[c].l = { Target: row['תיקייה'], Tooltip: 'פתח תיקייה' }; });
  XLSX.utils.book_append_sheet(wb, ws, 'עבודות');
  const plates = [...new Set(reports.map(x => x.r.plate))];
  const vehicles = (await DB.all('vehicles')).filter(v => plates.includes(v.plate)).map(v => ({
    'מספר רישוי': fmtPlate(v.plate), 'סוג': typeName(v.type), 'לקוח': v.customer || '', 'דגם': v.model || '', 'ק״מ אחרון': v.lastKm || '',
    'עבודות בתקופה': reports.filter(x => x.r.plate === v.plate).reduce((n, x) => n + x.entries.length, 0) }));
  const wv = XLSX.utils.json_to_sheet(vehicles); wv['!cols'] = [12, 8, 22, 14, 10, 12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wv, 'רכבים');
  const changes = [];
  for (const { r } of reports) for (const l of r.log || []) if (l.at >= from && l.at <= to) changes.push({
    'מתי': fmtDT(l.at), 'מספר רישוי': fmtPlate(r.plate), 'מי': l.workerName || '', 'הוזן ע״י': l.byName && l.byName !== l.workerName ? l.byName : '',
    'פעולה': l.action === 'create' ? 'פתח דיווח' : l.action === 'add' ? 'הוסיף' : 'תיקן',
    'פרטים': (l.changes || []).map(c => c.field + ': "' + (c.from || '') + '" ← "' + (c.to || '') + '"').join(' | ') });
  const wc = XLSX.utils.json_to_sheet(changes.length ? changes : [{ 'מתי': '', 'פרטים': 'אין שינויים בתקופה' }]); wc['!cols'] = [16, 12, 14, 14, 10, 80].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wc, 'שינויים');
  let meals = [];
  try { meals = (await DB.all('meals')).filter(m => m.date >= fromTxt && m.date <= toTxt).sort((a, b) => a.date.localeCompare(b.date) || a.place.localeCompare(b.place, 'he')); } catch { }
  const wf = XLSX.utils.json_to_sheet(meals.length ? meals.map(m => ({ 'יום': fmtDay(m.date), 'עובד': m.workerName, 'מקום': m.place, 'מה הזמין': m.text || '', 'הוזן ע״י': m.byName && m.byName !== m.workerName ? m.byName : '', 'שעת הזמנה': fmtTime(m.at || m.updatedAt) }))
    : [{ 'יום': '', 'מה הזמין': 'אין הזמנות אוכל בתקופה' }]);
  wf['!cols'] = [12, 16, 12, 50, 14, 10].map(w => ({ wch: w }));
  const wo = XLSX.utils.json_to_sheet(orderRows.length ? orderRows : [{ 'תאריך': '', 'הערות': 'אין הזמנות בתקופה' }]);
  wo['!cols'] = [16, 18, 26, 6, 6, 12, 14, 14, 60, 40, 40].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wo, 'הזמנות חלקים');
  XLSX.utils.book_append_sheet(wb, wf, 'אוכל');
  zip.file('עבודות.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
  // offline viewer page
  zip.file('פתח-אותי.html', offlinePage(viewer, fromTxt, toTxt, orders));
  say('אורז קובץ ZIP…');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, m => say('אורז ' + Math.round(m.percent) + '%…'));
  const name = 'מוסך-טארק_' + fromTxt + '_עד_' + toTxt + '.zip';
  const file = new File([blob], name, { type: 'application/zip' });
  fill(status, '✓ מוכן: ' + rows.length + ' עבודות, ' + orders.length + ' הזמנות, ' + (files.length - missing) + ' קבצים' + (missing ? ' (' + missing + ' קבצים לא נמצאו)' : '') + ' · ' + (blob.size / 1048576).toFixed(1) + ' MB');
  const a = h('a', { href: URL.createObjectURL(file), download: name }); document.body.append(a); a.click(); a.remove();
  if (/iPhone|iPad/.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); } catch { }
  }
}
function offlinePage(jobs, fromTxt, toTxt, orders = []) {
  const card = j => `<section class="job" data-s="${esc((j.plate + ' ' + j.customer + ' ' + j.model + ' ' + j.entries.map(e => e.worker + ' ' + e.text + ' ' + e.recs.map(r => r.transcript).join(' ')).join(' ')).toLowerCase())}">
  <h2>${j.rescue ? '<span class="res">חילוץ דרך</span> ' : ''}<span class="plate">${esc(j.plate)}</span> ${esc(j.type)} · ${esc(j.customer || 'ללא שם לקוח')}${j.model ? ' · ' + esc(j.model) : ''}${j.km ? ' · ' + esc(j.km) + ' ק״מ' : ''}</h2>
  ${j.rescue && j.where ? `<div class="m">מיקום: ${esc(j.where)}</div>` : ''}
  ${j.platePhoto ? `<a href="${esc(j.platePhoto)}"><img class="pp" src="${esc(j.platePhoto)}" alt=""></a>` : ''}
  ${j.entries.map(e => `<div class="e"><b>${esc(e.kind)}</b> · בוצע ${esc(e.date)} · ${esc(e.worker)}${e.by ? ' (הוזן ע״י ' + esc(e.by) + ')' : ''} <span class="m">נרשם ${esc(e.entered)}</span>
    ${e.text ? `<p>${esc(e.text)}</p>` : ''}
    ${e.recs.map((r, i) => `<div class="r"><audio controls preload="none" src="${esc(r.path)}"></audio> <a href="${esc(r.path)}">הקלטה ${i + 1}</a>${r.transcript ? `<p>${esc(r.transcript)}</p>` : ''}</div>`).join('')}
    ${e.photos.length ? `<div class="ph">${e.photos.map(p => `<a href="${esc(p)}" target="_blank"><img src="${esc(p)}" loading="lazy" alt=""></a>`).join('')}</div>` : ''}
  </div>`).join('')}
  <div class="m">תיקייה: ${esc(j.folder)}</div></section>`;
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>מוסך טארק – עבודות ${esc(fromTxt)} עד ${esc(toTxt)}</title><style>
body{font-family:-apple-system,"Segoe UI",Arial,sans-serif;background:#eef2f7;color:#0f1b2d;margin:0;padding:16px;max-width:900px;margin:auto}
h1{font-size:22px;margin:4px 0}.top{position:sticky;top:0;background:#eef2f7;padding:8px 0}
input{width:100%;font-size:17px;padding:10px;border:2px solid #cfd8e3;border-radius:10px;box-sizing:border-box}
.job{background:#fff;border-radius:14px;padding:14px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h2{font-size:18px;margin:0 0 8px}.plate{background:#ffcd00;border:2px solid #111;border-radius:5px;padding:1px 8px;direction:ltr;display:inline-block;font-weight:800}
.e{border-right:4px solid #14529e;padding:6px 10px;margin:10px 0}.m{color:#5b6b80;font-size:13px}
p{white-space:pre-wrap;margin:6px 0}.r{background:#f4f7fb;border-radius:8px;padding:6px 8px;margin:6px 0}audio{width:100%;max-width:420px}
.res{background:#fdecea;color:#c62f22;border-radius:6px;padding:1px 8px;font-size:14px}.ord{border-right:4px solid #f5b400}
.ph{display:flex;flex-wrap:wrap;gap:6px}.ph img{width:120px;height:120px;object-fit:cover;border-radius:8px}.pp{height:70px;border-radius:6px}
</style></head><body><div class="top"><h1>מוסך טארק ת.ד בע״מ – עבודות ${esc(fromTxt)} עד ${esc(toTxt)}</h1>
<div class="m">${jobs.length} דיווחים · נוצר ${esc(fmtDT(Date.now()))} · עובד גם בלי אינטרנט</div>
<input id="q" placeholder="חיפוש: מספר רישוי, לקוח, עובד, מילה מהעבודה"></div>
${jobs.map(card).join('\n')}
${orders.length ? `<h1 style="margin-top:24px">הזמנות חלקים (${orders.length})</h1>` + orders.map(o => `<section class="job ord" data-s="${esc(((o.sku || '') + ' ' + (o.partName || '') + ' ' + (o.plate || '') + ' ' + (o.workerName || '') + ' ' + (o.note || '')).toLowerCase())}">
  <h2 dir="auto">${esc(o.sku || '(ללא מק״ט)')} · ${esc(o.partName || '')} · ×${esc(o.qty)}</h2>
  <div class="m">${esc(ORDER_STATUS[o.status] || o.status)}${o.urgent ? ' · דחוף' : ''} · ${esc(fmtDT(o.createdAt))} · ${esc(o.workerName || '')}${o.plate ? ' · רכב ' + esc(fmtPlate(o.plate)) : ''}</div>
  ${o.note ? `<p>${esc(o.note)}</p>` : ''}
  ${(o._photos || []).length ? `<div class="ph">${o._photos.map(p => `<a href="${esc(p)}" target="_blank"><img src="${esc(p)}" loading="lazy" alt=""></a>`).join('')}</div>` : ''}
</section>`).join('\n') : ''}
<script>document.getElementById('q').oninput=function(){var v=this.value.trim().toLowerCase().replace(/-/g,'');document.querySelectorAll('.job').forEach(function(s){s.style.display=!v||s.dataset.s.replace(/-/g,'').indexOf(v)>=0?'':'none'})}</script>
</body></html>`;
}
async function adminWorks(body) {
  const reps = await reportsSorted(); const emps = await employees(true);
  const now = Date.now();
  const f = {
    plate: h('input', { class: 'input', inputmode: 'numeric', placeholder: 'מספר רישוי' }),
    cust: h('input', { class: 'input', placeholder: 'שם לקוח' }),
    worker: h('select', { class: 'input' }, h('option', { value: '' }, 'כל העובדים'), emps.map(e => h('option', { value: e.id }, e.name))),
    type: h('select', { class: 'input' }, h('option', { value: '' }, 'משאיות ונגררים'), h('option', { value: 'truck' }, 'משאיות'), h('option', { value: 'trailer' }, 'נגררים')),
    service: h('select', { class: 'input' }, h('option', { value: '' }, 'עבודות וחילוצים'), h('option', { value: 'work' }, 'עבודות מוסך'), h('option', { value: 'rescue' }, 'חילוצי דרך')),
    from: h('input', { class: 'input', type: 'date' }), to: h('input', { class: 'input', type: 'date' }),
  };
  const out = h('div');
  const run = () => {
    const pd = normPlate(f.plate.value), c = f.cust.value.trim(), w = f.worker.value, t = f.type.value, sv = f.service.value;
    const from = f.from.value ? new Date(f.from.value + 'T00:00').getTime() : 0;
    const to = f.to.value ? new Date(f.to.value + 'T23:59:59').getTime() : Infinity;
    const res = reps.filter(r => (!pd || r.plate.includes(pd)) && (!c || (r.customer || '').includes(c)) && (!t || r.type === t) &&
      (!sv || (sv === 'rescue') === (r.service === 'rescue')) &&
      (!w || r.entries.some(e => e.workerId === w)) && r.entries.some(e => workTime(e) >= from && workTime(e) <= to));
    fill(out, h('h3', { style: 'margin:6px 2px 10px' }, 'נמצאו ' + res.length + ' עבודות'), res.length ? res.map(r => reportItem(r)) : h('div', { class: 'empty' }, 'אין תוצאות'));
  };
  Object.values(f).forEach(x => x.addEventListener('input', run));
  const today = reps.filter(r => sameDay(r.createdAt, now)).length;
  const week = reps.filter(r => now - r.createdAt < 7 * 864e5).length;
  addTo(body,
    exportCard(),
    h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('b', {}, today), h('span', {}, 'היום')), h('div', { class: 'stat' }, h('b', {}, week), h('span', {}, '7 ימים')), h('div', { class: 'stat' }, h('b', {}, reps.length), h('span', {}, 'סה״כ'))),
    h('div', { class: 'card' }, h('h3', {}, 'חיפוש עבודות'),
      h('div', { class: 'grid2' }, f.plate, f.cust, f.worker, f.type, f.service),
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
  addTo(body,
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
const USER_ERR = {
  bad_input: 'מלא שם, שם משתמש וסיסמה (לפחות 6 תווים).',
  bad_username: 'שם משתמש: אותיות באנגלית ומספרים בלבד (אפשר גם . _ -), בלי רווחים. למשל khaled או ahmad2.',
  bad_password: 'הסיסמה צריכה להיות לפחות 6 תווים.',
  cannot_lock_yourself_out: 'אי אפשר להשבית את עצמך או להוריד את עצמך מניהול.',
  admins_only: 'רק מנהל יכול לנהל משתמשים.',
};
const userErr = e => { const m = String(e && e.message || e); return USER_ERR[m] || (/already been registered|already exists/i.test(m) ? 'כבר קיים משתמש עם שם המשתמש הזה.' : niceErr(e)); };
async function adminUsers(body) {
  let users;
  try { users = ((await garageCall({ action: 'listUsers' })).users || []).sort((a, b) => (Date.parse(b.last_seen || 0) || 0) - (Date.parse(a.last_seen || 0) || 0)); }
  catch (e) { addTo(body, h('div', { class: 'card' }, h('h3', {}, 'לא הצלחתי לטעון משתמשים'), h('p', {}, userErr(e)))); return; }
  const call = async (payload, okMsg) => { try { await garageCall(payload); toast(okMsg, 'ok'); me = null; route(); } catch (e) { alert(userErr(e)); } };
  const f = {
    name: h('input', { class: 'input', placeholder: 'שם מלא (יופיע על העבודות)', autocomplete: 'off' }),
    email: h('input', { class: 'input', type: 'text', dir: 'ltr', placeholder: 'למשל: khaled', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' }),
    pass: h('input', { class: 'input', type: 'text', dir: 'ltr', placeholder: 'סיסמה – לפחות 6 תווים', autocomplete: 'new-password' }),
    role: h('select', { class: 'input' }, h('option', { value: 'worker' }, 'עובד – מדווח עבודות'), h('option', { value: 'admin' }, 'מנהל – גם מסך מנהל וניהול משתמשים')),
  };
  const addBtn = h('button', { type: 'button', class: 'btn primary wide', style: 'margin-top:12px' }, ic('plus'), 'צור משתמש');
  addBtn.onclick = async () => {
    addBtn.disabled = true;
    const login = f.email.value.trim().toLowerCase(), pw = f.pass.value, nm = f.name.value.trim();
    try { await garageCall({ action: 'createUser', name: nm, login, password: pw, role: f.role.value }); }
    catch (e) { alert(userErr(e)); addBtn.disabled = false; return; }
    const msg = 'פרטי כניסה לאפליקציית מוסך טארק\n' + nm + '\nשם משתמש: ' + login + '\nסיסמה: ' + pw + '\n' + location.origin + location.pathname;
    try { await navigator.clipboard.writeText(msg); } catch { }
    alert('המשתמש נוצר ✓\n\nשם משתמש: ' + login + '\nסיסמה: ' + pw + '\n\nהפרטים הועתקו – אפשר להדביק ולשלוח לעובד.\nשמור את הסיסמה: אחרי שתסגור את החלון אי אפשר לראות אותה שוב (אפשר רק לקבוע חדשה).');
    me = null; route();
    addBtn.disabled = false;
  };
  const row = u => {
    const self = me && u.user_id === me.user_id;
    return h('div', { class: 'emp' + (u.active ? '' : ' off') },
      h('div', { class: 'grow' },
        h('div', { class: 'name', style: 'font-weight:700' }, u.name || '—', self ? ' (אתה)' : ''),
        h('div', { class: 'hint', style: 'margin:0' }, 'כניסה: ', h('b', { dir: 'ltr' }, showLogin(u.email))),
        h('div', { class: 'hint', style: 'margin:0' }, (u.role === 'admin' ? 'מנהל' : 'עובד') + (u.active ? '' : ' · מושבת')),
        h('div', { class: 'hint', style: 'margin:0' }, 'השתמש לאחרונה: ', h('b', {}, ago(u.last_seen)), ' · התחבר לאחרונה: ', ago(u.last_sign_in_at))),
      h('div', { class: 'row', style: 'gap:6px;justify-content:flex-end' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => { const n = (prompt('שם חדש:', u.name) || '').trim(); if (n && n !== u.name) call({ action: 'updateUser', user_id: u.user_id, name: n }, 'השם עודכן'); } }, 'שם'),
        h('button', { type: 'button', class: 'btn sm', onclick: async () => {
          const pw = prompt('סיסמה חדשה עבור ' + u.name + ' (לפחות 6 תווים):'); if (!pw) return;
          try { await garageCall({ action: 'updateUser', user_id: u.user_id, password: pw }); } catch (e) { alert(userErr(e)); return; }
          const msg = 'מוסך טארק – ' + u.name + '\nשם משתמש: ' + showLogin(u.email) + '\nסיסמה חדשה: ' + pw;
          try { await navigator.clipboard.writeText(msg); } catch { }
          alert('הסיסמה עודכנה ✓\n\nשם משתמש: ' + showLogin(u.email) + '\nסיסמה: ' + pw + '\n\nהפרטים הועתקו – אפשר לשלוח לעובד.');
        } }, 'סיסמה'),
        !self && h('button', { type: 'button', class: 'btn sm', onclick: () => call({ action: 'updateUser', user_id: u.user_id, role: u.role === 'admin' ? 'worker' : 'admin' }, 'התפקיד עודכן') }, u.role === 'admin' ? 'הפוך לעובד' : 'הפוך למנהל'),
        !self && h('button', { type: 'button', class: 'btn sm danger', onclick: () => { if (confirm('למחוק לגמרי את המשתמש ' + u.name + '? הוא לא יוכל להיכנס. העבודות שרשם נשארות עם השם שלו.')) call({ action: 'deleteUser', user_id: u.user_id }, 'המשתמש נמחק'); } }, 'מחק'),
        !self && h('button', { type: 'button', class: 'btn sm ' + (u.active ? 'danger' : ''), onclick: () => { if (!u.active || confirm('להשבית את ' + u.name + '? הוא לא יוכל להיכנס, והעבודות שלו נשמרות.')) call({ action: 'updateUser', user_id: u.user_id, active: !u.active }, u.active ? 'המשתמש הושבת' : 'המשתמש הופעל'); } }, u.active ? 'השבת' : 'הפעל')));
  };
  addTo(body,
    h('div', { class: 'card' }, h('h3', {}, 'משתמש חדש'),
      h('p', { class: 'hint', style: 'margin-top:0' }, 'לכל עובד כניסה משלו. העבודות שהוא מדווח נרשמות על שמו אוטומטית. את שם המשתמש והסיסמה מוסרים לו, והוא נכנס פעם אחת בטלפון.'),
      h('label', { class: 'lbl' }, 'שם (יופיע על העבודות)'), f.name,
      h('label', { class: 'lbl' }, 'שם משתמש לכניסה'), f.email,
      h('p', { class: 'hint', style: 'margin:4px 0 0' }, 'אותיות באנגלית ומספרים, בלי רווחים. אפשר גם אימייל.'),
      h('label', { class: 'lbl' }, 'סיסמה'), f.pass, h('label', { class: 'lbl' }, 'תפקיד'), f.role, addBtn),
    h('div', { class: 'card' }, h('h3', {}, 'משתמשים (' + users.length + ')'), h('p', { class: 'hint', style: 'margin-top:0' }, 'מסודר לפי מי שהשתמש באפליקציה לאחרונה.'), users.map(row),
      h('p', { class: 'hint' }, 'משתמש מושבת לא יכול להיכנס, אבל כל העבודות שלו נשמרות.')));
  // names in the worker list that have no login (added in the first version, or by hand)
  const loose = (await employees(true)).filter(e => !e.userId && !users.some(u => u.employee_id === e.id));
  if (loose.length) addTo(body, h('div', { class: 'card' }, h('h3', {}, 'שמות עובדים בלי כניסה (' + loose.length + ')'),
    h('p', { class: 'hint', style: 'margin-top:0' }, 'שמות שנוספו לרשימה בלי שם משתמש. מחיקה מוציאה את השם מהרשימה – העבודות שכבר נרשמו נשארות עם השם.'),
    loose.map(e => h('div', { class: 'emp' },
      h('div', { class: 'grow' }, h('div', { class: 'name', style: 'font-weight:700' }, e.name)),
      h('button', { type: 'button', class: 'btn sm', onclick: async () => {
        const n = (prompt('שם חדש:', e.name) || '').trim(); if (!n || n === e.name) return;
        try { await DB.put('employees', { ...e, name: n }); toast('השם עודכן', 'ok'); route(); } catch (err) { alert(niceErr(err)); }
      } }, 'שנה שם'),
      h('button', { type: 'button', class: 'btn sm danger', onclick: async () => {
        if (!confirm('למחוק את השם "' + e.name + '" מרשימת העובדים? העבודות שלו נשארות.')) return;
        try { await DB.del('employees', e.id); toast('השם נמחק', 'ok'); route(); } catch (err) { alert(niceErr(err)); }
      } }, ic('trash'), 'מחק')))));
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
  addTo(body,h('div', { class: 'card' }, h('h3', {}, 'מי יצר, הוסיף או תיקן דיווחים'), only), out);
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
  const ai = h('input', { type: 'checkbox', style: 'width:24px;height:24px' }); ai.checked = local.get('aiOff') !== '1';
  ai.onchange = () => local.set('aiOff', ai.checked ? null : '1');
  const pin = h('input', { class: 'input', inputmode: 'numeric', placeholder: 'ללא קוד', value: (await DB.setting('adminPin')) || '' });
  const imp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  imp.onchange = async () => { const f = imp.files[0]; if (!f) return; try { await importBackup(f); toast('הגיבוי שוחזר ✓', 'ok'); route(); } catch (e) { alert('קובץ גיבוי לא תקין: ' + e.message); } };
  let est = '';
  try { const e = await navigator.storage.estimate(); est = 'בשימוש: ' + (e.usage / 1048576).toFixed(1) + ' MB'; } catch { }
  const SRok = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  let who = '';
  if (sb) { try { const { data } = await sb.auth.getSession(); who = data.session && data.session.user.email || ''; } catch { } }
  const nLocal = await localJobsCount();
  addTo(body,
    sb && h('div', { class: 'card' }, h('h3', {}, 'חשבון המוסך'),
      h('p', { class: 'hint', style: 'margin-top:0' }, 'הטלפון הזה מחובר כ-', h('b', { dir: 'ltr' }, showLogin(who))),
      h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (!confirm('לנתק את הטלפון הזה מהמערכת? אפשר להיכנס שוב עם פרטי המוסך.')) return; await sb.auth.signOut(); me = null; route(); } }, 'התנתק מהטלפון הזה')),
    nLocal > 0 && moveLocalCard(nLocal),
    h('div', { class: 'card' }, h('h3', {}, 'הקלטה ותמלול'),
      h('label', { style: 'display:flex;gap:10px;align-items:center;font-weight:700' }, live, 'תמלול חי לעברית בזמן ההקלטה'),
      h('p', { class: 'hint' }, SRok ? 'הדפדפן הזה תומך בתמלול חי.' : 'הדפדפן הזה לא תומך בתמלול חי – ההקלטה עדיין נשמרת.'),
      sb && h('label', { style: 'display:flex;gap:10px;align-items:center;font-weight:700;margin-top:14px' }, ai, 'שיפור התמלול וזיהוי לוחית בענן (Gemini)'),
      sb && h('p', { class: 'hint' }, 'אחרי כל הקלטה הטקסט משופר מההקלטה המקורית, ומספר הרישוי נקרא גם מתמונה של כל הרכב. ההגדרה חלה על הטלפון הזה.')),
    sb && await (async () => {
      const inp = h('input', { class: 'input', value: (await foodPlaces()).join(', ') });
      return h('div', { class: 'card' }, h('h3', {}, 'מקומות אוכל'), h('p', { class: 'hint', style: 'margin-top:0' }, 'מופרדים בפסיק. מופיעים ככפתורים במסך הראשי.'), inp,
        h('button', { type: 'button', class: 'btn sm', style: 'margin-top:10px', onclick: async () => {
          const list = inp.value.split(/[,،]/).map(x => x.trim()).filter(Boolean);
          if (!list.length) { alert('כתוב לפחות מקום אחד.'); return; }
          try { await DB.setSetting('foodPlaces', list); toast('נשמר', 'ok'); } catch (e) { alert(niceErr(e)); }
        } }, 'שמור'));
    })(),
    h('div', { class: 'card' }, h('h3', {}, 'תמונות בכפתורים במסך הראשי'), imgRow('truckImg', 'משאית'), imgRow('trailerImg', 'נגרר')),
    !sb && h('div', { class: 'card' }, h('h3', {}, 'קוד למסך מנהל (לא חובה)'), pin,
      h('button', { type: 'button', class: 'btn sm', style: 'margin-top:10px', onclick: async () => { await DB.setSetting('adminPin', pin.value.trim() || null); toast('נשמר', 'ok'); } }, 'שמור קוד')),
    h('div', { class: 'card' }, h('h3', {}, 'גיבוי ושחזור'),
      h('p', { class: 'hint', style: 'margin-top:0' }, sb ? 'הנתונים שמורים בענן. אפשר בנוסף להוריד עותק לקובץ.' : 'בגרסת הניסיון הנתונים נמצאים רק בטלפון הזה. מומלץ לגבות מדי פעם. ' + est),
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
  const reports = await DB.all('reports'), settings = await DB.all('settings');
  const ids = new Set();
  for (const r of reports) { if (r.plateImage) ids.add(r.plateImage); for (const e of r.entries) { e.photos.forEach(x => ids.add(x)); e.recordings.forEach(x => ids.add(x.blobId)); } }
  for (const st of settings) if (/Img$/.test(st.key) && st.value) ids.add(st.value);
  const blobs = [];
  for (const id of ids) { try { const b = await Blobs.get(id); if (b) blobs.push({ id, type: b.type, data: b }); } catch { } }
  const data = {
    app: 'tarek-garage', v: 1, exportedAt: Date.now(),
    reports, vehicles: await DB.all('vehicles'), employees: await DB.all('employees'), settings,
    blobs: await Promise.all(blobs.map(async b => ({ id: b.id, type: b.type, data: await toDataURL(b.data, b.type) }))),
  };
  const name = 'גיבוי-מוסך-טארק-' + new Date().toISOString().slice(0, 10) + '.json';
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = h('a', { href: URL.createObjectURL(file), download: name }); document.body.append(a); a.click(); a.remove();
}
async function importBackup(f) {
  const d = JSON.parse(await f.text()); if (d.app !== 'tarek-garage') throw new Error('לא קובץ של האפליקציה');
  for (const b of d.blobs || []) { const blob = await (await fetch(b.data)).blob(); await Blobs.save(new Blob([blob], { type: b.type }), b.id); }
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
    for (const e of r.entries) { for (const x of e.recordings) await Blobs.del(x.blobId); for (const p of e.photos) await Blobs.del(p); }
    await DB.del('reports', r.id);
  }
  for (const v of await DB.all('vehicles')) if (v.demo) await DB.del('vehicles', v.plate);
  for (const e of await DB.all('employees')) if (e.demo) await DB.del('employees', e.id);
}

/* ---------- start ---------- */
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { });
cloudInit().catch(e => { console.error(e); alert('לא הצלחתי להתחבר לשרת המוסך. בדוק את החיבור לאינטרנט ורענן את הדף.'); }).finally(route);
