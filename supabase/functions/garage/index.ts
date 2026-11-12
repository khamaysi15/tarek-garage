// מוסך טארק – server function: Hebrew transcription, plate reading, user management.
// Secrets (set with `supabase secrets set`): GEMINI_API_KEY, optional GEMINI_MODEL.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

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
  for (let round = 0; round < 2; round++) {
    const list = await models(key);
    const ready = list.filter(m => (busyUntil.get(m) || 0) < Date.now());
    for (const model of (ready.length ? ready : list)) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body,
        signal: AbortSignal.timeout(25000),
      }).catch(e => ({ ok: false, status: 504, text: async () => String(e) } as any));
      if (r.ok) {
        const d = await r.json();
        return { text: (d.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim(), model };
      }
      last = 'gemini ' + model + ' ' + r.status + ' ' + (await r.text()).slice(0, 160);
      if (r.status === 404) { busyUntil.set(model, Date.now() + 24 * 3600e3); continue; }   // retired
      if ([429, 500, 502, 503, 504].includes(r.status)) { busyUntil.set(model, Date.now() + 3 * 60e3); continue; } // busy: skip for 3 min
      throw new Error(last);
    }
    await new Promise(res => setTimeout(res, 1500));  // everything busy: short pause, one more round
    busyUntil.clear();
  }
  throw new Error(last || 'gemini unavailable');
}

const TRANSCRIBE_PROMPT = `תמלל את ההקלטה המצורפת לעברית, מילה במילה.
ההקלטה היא של עובד במוסך משאיות ונגררים שמתאר עבודה שביצע.
מונחים נפוצים: כרית אוויר, צינור אוויר, נזילת אוויר, מדחס, רפידות בלם, דיסק, תוף בלם, מסנן שמן, מסנן אוויר, מסנן סולר, שמן מנוע, גיר, דיפרנציאל, מצמד, מתנע, אלטרנטור, מצבר, פנס, צמיג, ג'נט, סרן, מסבים, קפיץ, בולם, הגה, טכוגרף, ברקס, וואבקו, קילומטרים.
שמות יצרנים ודגמים (DAF, Volvo, Scania, Mercedes, MAN, Renault, Iveco, Wabco, Knorr) כתוב באותיות לטיניות. מספרים כתוב בספרות.
החזר רק את הטקסט המתומלל, בלי הקדמה, בלי הסברים ובלי מירכאות. אם אין דיבור, החזר מחרוזת ריקה.`;

const PLATE_PROMPT = `In this photo there is a vehicle (truck, tractor unit or trailer) in Israel, or a close-up of its license plate.
Find the vehicle's Israeli license plate and read its number.
Israeli plates: yellow background, black digits, usually 7 digits (NN-NNN-NN) or 8 digits (NNN-NN-NNN); old or trailer plates may have 5-6 digits.
Ignore every other number in the photo (phone numbers, fleet numbers, company signs, dates).
Answer as JSON: {"plate": "<digits only, empty if no plate is readable>", "confidence": "high" | "medium" | "low"}`;

/* ---------- request handling ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

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
          const { text, model } = await gemini([{ text: TRANSCRIBE_PROMPT }, { inline_data: { mime_type: body.mime || 'audio/mp4', data: body.audio } }]);
          await log('transcribe', true, model, t0, null);
          return json({ text, model });
        } catch (e) { await log('transcribe', false, null, t0, String((e as Error).message || e)); throw e; }
      }
      case 'plate': {
        if (!body.image) return json({ error: 'no_image' }, 400);
        const t0 = Date.now();
        let out = '', model = '';
        try {
          ({ text: out, model } = await gemini([{ text: PLATE_PROMPT }, { inline_data: { mime_type: body.mime || 'image/jpeg', data: body.image } }], true));
          await log('plate', true, model, t0, 'answer: ' + out.slice(0, 120));
        } catch (e) { await log('plate', false, null, t0, String((e as Error).message || e)); throw e; }
        let p: any = {};
        try { p = JSON.parse(out); } catch { p = { plate: (out.match(/\d{5,8}/) || [''])[0] }; }
        const plate = String(p.plate || '').replace(/\D/g, '');
        return json({ plate: plate.length >= 5 && plate.length <= 8 ? plate : '', confidence: p.confidence || 'low', model });
      }
      case 'whoami':
        return json({ profile: me });
    }

    // ---- everything below is for admins only ----
    if (!isAdmin) return json({ error: 'admins_only' }, 403);
    switch (body.action) {
      case 'listUsers': {
        const { data, error } = await db.from('profiles').select('*').order('name');
        if (error) throw error;
        return json({ users: data });
      }
      case 'createUser': {
        const email = String(body.email || '').trim().toLowerCase();
        const name = String(body.name || '').trim();
        const role = body.role === 'admin' ? 'admin' : 'worker';
        if (!email || !name || String(body.password || '').length < 6) return json({ error: 'bad_input' }, 400);
        const { data: c, error } = await db.auth.admin.createUser({ email, password: String(body.password), email_confirm: true });
        if (error) return json({ error: error.message }, 400);
        const uid = c.user!.id, eid = 'u-' + uid;
        await db.from('profiles').insert({ user_id: uid, email, name, role, employee_id: eid, active: true });
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
    }
    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
