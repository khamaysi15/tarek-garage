// מוסך טארק – server function: Hebrew transcription, plate reading, user management.
// Secrets (set with `supabase secrets set`): GROQ_API_KEY (fast, tried first), GEMINI_API_KEY (backup), optional GEMINI_MODEL / GROQ_VISION_MODEL / GROQ_STT_MODEL.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/* ---------- Gemini (free tier) ----------
   Free-tier models are sometimes "busy" (503/429). We keep a list of good models,
   skip any model that was busy in the last few minutes, and move on immediately. */
let modelList: string[] | null = null;
const busyUntil = new Map<string, number>();
async function models(key: string): Promise<string[]> {
  if (modelList) return modelList;
  const forced = (Deno.env.get('GEMINI_MODEL') || '').split(',').map(x => x.trim()).filter(Boolean);
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
  const names: string[] = r.ok ? ((await r.json()).models || [])
    .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m: any) => String(m.name).replace('models/', '')) : [];
  const ver = (n: string) => parseFloat((n.match(/gemini-([\d.]+)/) || [])[1] || '0');
  const flash = names.filter(n => /^gemini-[\d.]+-flash$/.test(n)).sort((a, b) => ver(b) - ver(a));
  const lite = names.filter(n => /^gemini-([\d.]+-flash-lite|flash-lite-latest)$/.test(n)).sort((a, b) => ver(b) - ver(a));
  modelList = [...new Set([...forced, ...flash.slice(0, 4), ...lite.slice(0, 2)])];
  if (!modelList.length) modelList = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];
  return modelList;
}
async function gemini(parts: unknown[], wantJson = false): Promise<{ text: string; model: string }> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0, ...(wantJson ? { responseMimeType: 'application/json' } : {}) },
  });
  let last = '';
  const deadline = Date.now() + 35000;
  for (let round = 0; round < 2; round++) {
    const list = await models(key);
    const ready = list.filter(m => (busyUntil.get(m) || 0) < Date.now());
    for (const model of (ready.length ? ready : list)) {
      if (Date.now() > deadline - 3000) break;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body,
        signal: AbortSignal.timeout(Math.min(10000, Math.max(3000, deadline - Date.now()))),
      }).catch(e => ({ ok: false, status: 504, text: async () => String(e) } as any));
      if (r.ok) {
        const d = await r.json();
        return { text: (d.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim(), model };
      }
      last = 'gemini ' + model + ' ' + r.status + ' ' + (await r.text()).slice(0, 160);
      if (r.status === 404) { busyUntil.set(model, Date.now() + 24 * 3600e3); continue; }   // retired
      if ([429, 500, 502, 503, 504].includes(r.status)) { busyUntil.set(model, Date.now() + 3 * 60e3); continue; } // busy or too slow: skip for 3 min
      throw new Error(last);
    }
    if (Date.now() > deadline - 5000) break;
    await new Promise(res => setTimeout(res, 1000));  // everything busy: short pause, one more round
    busyUntil.clear();
  }
  throw new Error(last || 'gemini unavailable');
}

/* ---------- Groq (fast; tried first when GROQ_API_KEY is set, Gemini is the backup) ---------- */
const groqKey = () => Deno.env.get('GROQ_API_KEY') || '';
let groqBusyUntil = 0;
async function groqVision(prompt: string, b64: string, mime: string): Promise<{ text: string; model: string }> {
  const model = Deno.env.get('GROQ_VISION_MODEL') || 'qwen/qwen3.8-27b';
  const req = (extra: Record<string, unknown>) => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + groqKey() },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      model, temperature: 0, max_completion_tokens: 300, response_format: { type: 'json_object' }, ...extra,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }] }],
    }),
  });
  let r = await req({ reasoning_effort: 'none' });
  if (r.status === 400) r = await req({});          // model without a reasoning switch
  if (!r.ok) throw new Error('groq ' + model + ' ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const d = await r.json();
  const text = String(d.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return { text, model: 'groq ' + model };
}
const STT_VOCAB = 'מוסך משאיות ונגררים. כרית אוויר, צינור אוויר, מדחס, רפידות בלם, דיסק, תוף בלם, מסנן שמן, מסנן סולר, גיר, דיפרנציאל, מצמד, מתנע, אלטרנטור, מצבר, צמיג, סרן, מסבים, קפיץ, בולם, טכוגרף, ברקס, DAF, Volvo, Scania, Mercedes, MAN, Renault, Iveco, Wabco, Knorr.';
async function groqStt(b64: string, mime: string): Promise<{ text: string; model: string }> {
  const model = Deno.env.get('GROQ_STT_MODEL') || 'whisper-large-v3';
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const ext = /wav/.test(mime) ? 'wav' : /webm/.test(mime) ? 'webm' : /ogg/.test(mime) ? 'ogg' : /mpeg|mp3/.test(mime) ? 'mp3' : 'm4a';
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: mime }), 'audio.' + ext);
  fd.append('model', model); fd.append('language', 'he'); fd.append('temperature', '0');
  fd.append('response_format', 'json'); fd.append('prompt', STT_VOCAB);
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + groqKey() }, body: fd, signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('groq ' + model + ' ' + r.status + ' ' + (await r.text()).slice(0, 160));
  let text = String((await r.json()).text || '').trim();
  if (/^(תודה( רבה)?|תודה שצפיתם|כתוביות.*)[.!]?$/.test(text)) text = '';   // Whisper's typical "silence" hallucinations
  return { text, model: 'groq ' + model };
}
// try Groq first (seconds), fall back to Gemini (slow free tier) if Groq is missing, busy or fails
async function fast<T>(viaGroq: () => Promise<T>, viaGemini: () => Promise<T>, note: (e: string) => void): Promise<T> {
  if (groqKey() && Date.now() > groqBusyUntil) {
    try { return await viaGroq(); }
    catch (e) {
      const m = String((e as Error).message || e); note(m);
      if (/ 429 | 5\d\d |Timeout/.test(m)) groqBusyUntil = Date.now() + 60e3;
    }
  }
  return viaGemini();
}

const TRANSCRIBE_PROMPT = `תמלל את ההקלטה המצורפת לעברית, מילה במילה.
ההקלטה היא של עובד במוסך משאיות ונגררים שמתאר עבודה שביצע.
מונחים נפוצים: כרית אוויר, צינור אוויר, נזילת אוויר, מדחס, רפידות בלם, דיסק, תוף בלם, מסנן שמן, מסנן אוויר, מסנן סולר, שמן מנוע, גיר, דיפרנציאל, מצמד, מתנע, אלטרנטור, מצבר, פנס, צמיג, ג'נט, סרן, מסבים, קפיץ, בולם, הגה, טכוגרף, ברקס, וואבקו, קילומטרים.
שמות יצרנים ודגמים (DAF, Volvo, Scania, Mercedes, MAN, Renault, Iveco, Wabco, Knorr) כתוב באותיות לטיניות. מספרים כתוב בספרות.
החזר רק את הטקסט המתומלל, בלי הקדמה, בלי הסברים ובלי מירכאות. אם אין דיבור, החזר מחרוזת ריקה.`;

const SHORT_PROMPT = `תמלל את ההקלטה הקצרה המצורפת. זו מילה או כמה מילים בודדות: שם של לקוח, שם של חברה, דגם של משאית, כתובת או מספר.
כתוב שמות של חברות ודגמים לועזיים (DAF, Volvo, Scania, Mercedes, MAN) באותיות לטיניות, ומספרים בספרות.
החזר רק את הטקסט עצמו, בלי נקודה בסוף, בלי מירכאות ובלי הסברים. אם אין דיבור, החזר מחרוזת ריקה.`;

const SKU_PROMPT = `This photo shows a truck/trailer spare part, its box, or its label.
Read the part number (catalog number / SKU / OE number / מק"ט) printed on it. Prefer the manufacturer part number; if several numbers appear, choose the one most likely to be the part number (not a barcode digit string, date, or batch number).
Also give a short Hebrew name of the part if you can tell what it is, and the brand if printed.
Answer as JSON: {"sku": "<part number exactly as printed, empty if none>", "name": "<short Hebrew part name or empty>", "brand": "<brand or empty>"}`;

const PLATE_PROMPT = `In this photo there is a vehicle (truck, tractor unit or trailer) in Israel, or a close-up of its license plate.
Find the vehicle's Israeli license plate and read its number.
Israeli plates: yellow background, black digits, usually 7 digits (NN-NNN-NN) or 8 digits (NNN-NN-NNN); old or trailer plates may have 5-6 digits.
Ignore every other number in the photo (phone numbers, fleet numbers, company signs, dates).
Answer as JSON: {"plate": "<digits only, empty if no plate is readable>", "confidence": "high" | "medium" | "low"}`;

/* ---------- food reminders (Web Push) ---------- */
const ilDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const ilClock = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const ilWeekday = () => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short' }).format(new Date());
async function sendFoodReminders(db: any, onlyMissing = true) {
  vapid();
  const today = ilDate();
  const { data: profs } = await db.from('profiles').select('user_id, employee_id, active');
  const { data: meals } = await db.from('meals').select('data').like('k', today + '_%');
  const ordered = new Set((meals || []).map((m: any) => m.data.workerId));
  const targets = (profs || []).filter((p: any) => p.active && (!onlyMissing || !ordered.has(p.employee_id))).map((p: any) => p.user_id);
  if (!targets.length) return { sent: 0, people: 0 };
  const { data: subs } = await db.from('push_subs').select('*').in('user_id', targets);
  const payload = JSON.stringify({ title: '🍽️ הזמנת אוכל', body: 'עוד לא בחרת אוכל להיום – ההזמנה נסגרת ב-12:00', url: './#/', tag: 'food-' + today });
  return await pushTo(db, subs || [], payload);
}
function vapid() {
  const pub = Deno.env.get('VAPID_PUBLIC'), priv = Deno.env.get('VAPID_PRIVATE');
  if (!pub || !priv) throw new Error('push_not_set_up');
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'https://khamaysi15.github.io/tarek-garage/', pub, priv);
}
async function pushTo(db: any, subs: any[], payload: string) {
  vapid();
  let sent = 0; const errors: string[] = [];
  for (const s of subs) {
    const t0 = Date.now();
    try {
      const r: any = await webpush.sendNotification(s.sub, payload, { TTL: 6 * 3600, urgency: 'high' });
      sent++;
      await db.from('ai_log').insert({ action: 'push', ok: true, model: new URL(s.endpoint).host, ms: Date.now() - t0, error: 'status ' + (r && r.statusCode) });
    } catch (e: any) {
      const msg = 'push ' + (e?.statusCode || '') + ' ' + String(e?.body || e?.message || e).slice(0, 300);
      errors.push(msg);
      await db.from('ai_log').insert({ action: 'push', ok: false, model: (() => { try { return new URL(s.endpoint).host; } catch { return null; } })(), ms: Date.now() - t0, error: msg });
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.from('push_subs').delete().eq('endpoint', s.endpoint);
    }
  }
  return { sent, failed: errors.length, people: new Set(subs.map((s: any) => s.user_id)).size, error: errors[0] || null };
}

/* ---------- "something new was opened" → every admin's phone ---------- */
const fmtPlate = (p: string) => !p ? '' : p.length === 7 ? p.slice(0, 2) + '-' + p.slice(2, 5) + '-' + p.slice(5) : p.length === 8 ? p.slice(0, 3) + '-' + p.slice(3, 5) + '-' + p.slice(5) : p;
const cut = (t: string, n = 120) => { t = (t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
async function notifyNew(db: any, kind: string, id: string, senderId: string) {
  const table = kind === 'order' ? 'orders' : 'reports';
  const { data: row } = await db.from(table).select('data').eq('k', id).maybeSingle();
  const d = row?.data;
  if (!d) return { error: 'not_found' };
  if (Date.now() - (d.createdAt || 0) > 30 * 60 * 1000) return { skipped: 'old' };   // only brand-new items
  const { error: dup } = await db.from('notify_sent').insert({ k: table + ':' + id });
  if (dup) return { already: true };                                                    // each item notifies once
  let title: string, body: string, url: string;
  if (kind === 'order') {
    title = (d.urgent ? '❗ דחוף – ' : '') + '📦 הזמנת חלק חדשה';
    body = [d.partName, d.sku && 'מק״ט ' + d.sku, '×' + (d.qty || 1), d.workerName && '· ' + d.workerName, d.note && '· ' + cut(d.note, 60)].filter(Boolean).join(' ');
    url = './#/orders/' + id;
  } else {
    const e = (d.entries || [])[0] || {};
    const what = cut(e.text || (e.recordings || []).map((r: any) => r.transcript).filter(Boolean).join(' ') || ((e.recordings || []).length ? '🎤 הקלטה קולית' : (e.photos || []).length ? '📷 תמונות' : ''), 90);
    title = (d.service === 'rescue' ? '🛟 חילוץ דרך חדש' : '🔧 עבודה חדשה') + ' – ' + (d.type === 'trailer' ? 'נגרר' : 'משאית') + ' ' + fmtPlate(d.plate);
    body = [d.createdByName, d.customer && '· ' + d.customer, d.service === 'rescue' && d.location?.text && '· 📍 ' + d.location.text, what && '· ' + what].filter(Boolean).join(' ');
    if (d.card) {
      title = '🗂️ כרטיס חדש – ' + (d.type === 'trailer' ? 'נגרר' : 'משאית') + ' ' + fmtPlate(d.plate);
      body = [d.customer, d.card.driver && '· נהג: ' + d.card.driver, (d.card.complaints || []).length && '· ' + cut(d.card.complaints.join(', '), 90)].filter(Boolean).join(' ') || (d.createdByName || '');
    }
    url = './#/report/' + id;
  }
  const { data: admins } = await db.from('profiles').select('user_id').eq('role', 'admin').eq('active', true);
  const targets = (admins || []).map((a: any) => a.user_id).filter((u: string) => u !== senderId);
  if (!targets.length) return { sent: 0, people: 0 };
  const { data: subs } = await db.from('push_subs').select('*').in('user_id', targets);
  return await pushTo(db, subs || [], JSON.stringify({ title, body, url, tag: table + '-' + id }));
}

/* ---------- request handling ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    // scheduled run (every 15 min in the morning): sends at most once at ~10:30 and once at ~11:30 Israel time, Sunday–Friday
    if (new URL(req.url).searchParams.get('cron') === 'food') {
      // reminder times are set by the admin in the app (settings → foodReminders); default 10:30 and 11:30
      const { data: st } = await db.from('settings').select('data').eq('k', 'foodReminders').maybeSingle();
      const times: string[] = (st?.data?.value && Array.isArray(st.data.value) ? st.data.value : ['10:30', '11:30']).filter((x: string) => /^\d\d:\d\d$/.test(x));
      const t = ilClock();
      const plus15 = (x: string) => { const [hh, mm] = x.split(':').map(Number), m = hh * 60 + mm + 15; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
      const slot = times.find(x => t >= x && t < plus15(x)) || null;
      if (!slot || ilWeekday() === 'Sat') return json({ skipped: t, times });
      const { error: dup } = await db.from('reminder_runs').insert({ day: ilDate(), slot });
      if (dup) return json({ already: slot });
      const r = await sendFoodReminders(db);
      await db.from('reminder_runs').update({ sent: r.sent }).eq('day', ilDate()).eq('slot', slot);
      return json(r);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await db.auth.getUser(token);
    const user = auth?.user;
    if (!user) return json({ error: 'not_signed_in' }, 401);
    const { data: me } = await db.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (!me || !me.active) return json({ error: 'no_access' }, 403);

    const body = await req.json();
    const isAdmin = me.role === 'admin';
    const log = (action: string, ok: boolean, model: string | null, t0: number, error: string | null) =>
      db.from('ai_log').insert({ action, ok, model, ms: Date.now() - t0, error: error && error.slice(0, 500), user_email: user.email }).then(() => {}, () => {});

    switch (body.action) {
      case 'transcribe': {
        if (!body.audio) return json({ error: 'no_audio' }, 400);
        const t0 = Date.now();
        try {
          const { text, model } = await fast(() => groqStt(body.audio, body.mime || 'audio/mp4'),
            () => gemini([{ text: body.short ? SHORT_PROMPT : TRANSCRIBE_PROMPT }, { inline_data: { mime_type: body.mime || 'audio/mp4', data: body.audio } }]),
            e => log('transcribe', false, 'groq', t0, e));
          await log('transcribe', true, model, t0, null);
          return json({ text, model });
        } catch (e) { await log('transcribe', false, null, t0, String((e as Error).message || e)); throw e; }
      }
      case 'plate': {
        if (!body.image) return json({ error: 'no_image' }, 400);
        const t0 = Date.now();
        let out = '', model = '';
        try {
          ({ text: out, model } = await fast(() => groqVision(PLATE_PROMPT, body.image, body.mime || 'image/jpeg'),
            () => gemini([{ text: PLATE_PROMPT }, { inline_data: { mime_type: body.mime || 'image/jpeg', data: body.image } }], true),
            e => log('plate', false, 'groq', t0, e)));
          await log('plate', true, model, t0, 'answer: ' + out.slice(0, 120));
        } catch (e) { await log('plate', false, null, t0, String((e as Error).message || e)); throw e; }
        let p: any = {};
        try { p = JSON.parse(out); } catch { p = { plate: (out.match(/\d{5,8}/) || [''])[0] }; }
        const plate = String(p.plate || '').replace(/\D/g, '');
        return json({ plate: plate.length >= 5 && plate.length <= 8 ? plate : '', confidence: p.confidence || 'low', model });
      }
      case 'sku': {
        if (!body.image) return json({ error: 'no_image' }, 400);
        const t0 = Date.now();
        try {
          const { text: out, model } = await fast(() => groqVision(SKU_PROMPT, body.image, body.mime || 'image/jpeg'),
            () => gemini([{ text: SKU_PROMPT }, { inline_data: { mime_type: body.mime || 'image/jpeg', data: body.image } }], true),
            e => log('sku', false, 'groq', t0, e));
          await log('sku', true, model, t0, 'answer: ' + out.slice(0, 120));
          let p: any = {}; try { p = JSON.parse(out); } catch { }
          return json({ sku: String(p.sku || '').trim(), name: String(p.name || '').trim(), brand: String(p.brand || '').trim(), model });
        } catch (e) { await log('sku', false, null, t0, String((e as Error).message || e)); throw e; }
      }
      case 'whoami':
        return json({ profile: me });
      // any active worker: a new job / rescue / parts order → every admin's phone
      case 'notifyNew': {
        if (!['report', 'order'].includes(body.kind) || !body.id) return json({ error: 'bad_request' }, 400);
        return json(await notifyNew(db, body.kind, String(body.id), user.id));
      }
    }

    // ---- everything below is for admins only ----
    if (!isAdmin) return json({ error: 'admins_only' }, 403);
    switch (body.action) {
      case 'listUsers': {
        const { data, error } = await db.from('profiles').select('*').order('name');
        if (error) throw error;
        // add each login's last sign-in time from the auth system
        const signIns: Record<string, string | null> = {};
        for (let page = 1; page < 20; page++) {
          const { data: u } = await db.auth.admin.listUsers({ page, perPage: 200 });
          (u?.users || []).forEach((x: any) => { signIns[x.id] = x.last_sign_in_at || null; });
          if (!u || u.users.length < 200) break;
        }
        return json({ users: (data || []).map((p: any) => ({ ...p, last_sign_in_at: signIns[p.user_id] || null })) });
      }
      case 'createUser': {
        // a plain username (e.g. "khaled") becomes an internal address nobody sees; a real email also works
        const login = String(body.login || body.email || '').trim().toLowerCase();
        let email = login;
        if (!login.includes('@')) {
          if (!/^[a-z0-9][a-z0-9._-]{1,29}$/.test(login)) return json({ error: 'bad_username' }, 400);
          email = login + '@users.invalid';
        }
        const name = String(body.name || '').trim();
        const role = body.role === 'admin' ? 'admin' : 'worker';
        if (!email || !name || String(body.password || '').length < 6) return json({ error: 'bad_input' }, 400);
        const { data: c, error } = await db.auth.admin.createUser({ email, password: String(body.password), email_confirm: true });
        if (error) return json({ error: error.message }, 400);
        const uid = c.user!.id, eid = 'u-' + uid;
        // a database trigger already created a default worker profile; set the real name and role
        await db.from('profiles').upsert({ user_id: uid, email, name, role, employee_id: eid, active: true });
        await db.from('employees').upsert({ k: eid, data: { id: eid, name, active: true, userId: uid, createdAt: Date.now() } });
        return json({ ok: true, user_id: uid });
      }
      case 'updateUser': {
        const uid = String(body.user_id || '');
        const { data: target } = await db.from('profiles').select('*').eq('user_id', uid).maybeSingle();
        if (!target) return json({ error: 'not_found' }, 404);
        if (uid === user.id && (body.role === 'worker' || body.active === false))
          return json({ error: 'cannot_lock_yourself_out' }, 400);
        const patch: Record<string, unknown> = {};
        if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
        if (body.role === 'admin' || body.role === 'worker') patch.role = body.role;
        if (typeof body.active === 'boolean') patch.active = body.active;
        if (Object.keys(patch).length) await db.from('profiles').update(patch).eq('user_id', uid);
        if (body.password) {
          if (String(body.password).length < 6) return json({ error: 'bad_password' }, 400);
          const { error } = await db.auth.admin.updateUserById(uid, { password: String(body.password) });
          if (error) return json({ error: error.message }, 400);
        }
        const eid = target.employee_id || 'u-' + uid;
        const { data: emp } = await db.from('employees').select('data').eq('k', eid).maybeSingle();
        const ed = { ...(emp?.data || { id: eid, userId: uid }), name: patch.name ?? target.name, active: patch.active ?? target.active };
        await db.from('employees').upsert({ k: eid, data: ed });
        return json({ ok: true });
      }
      case 'remindNow': {
        return json(await sendFoodReminders(db, body.all !== true));
      }
      case 'deleteUser': {
        const uid = String(body.user_id || '');
        if (!uid || uid === user.id) return json({ error: 'cannot_lock_yourself_out' }, 400);
        const { data: target } = await db.from('profiles').select('*').eq('user_id', uid).maybeSingle();
        const { error } = await db.auth.admin.deleteUser(uid);
        if (error) return json({ error: error.message }, 400);
        // keep the worker's name on old jobs; just mark the name inactive
        const eid = target?.employee_id || 'u-' + uid;
        const { data: emp } = await db.from('employees').select('data').eq('k', eid).maybeSingle();
        if (emp) await db.from('employees').upsert({ k: eid, data: { ...emp.data, active: false } });
        return json({ ok: true });
      }
    }
    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
