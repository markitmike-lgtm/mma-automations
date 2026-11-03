// Markit Mike Agency client journey automations.
//   POST /signwell  SignWell webhook: document_sent, document_completed
//   POST /stripe    Stripe webhook: checkout.session.completed
//   GET  /health    simple check that the worker is up
//   POST /chamberlain, GET /chamberlain.js   Chamberlain, the site assistant
import { findPlan, ONBOARDING_TASKS, CLIENT_LISTS } from './plans.js';
import { paymentEmail, welcomeEmail, agreementEmail, leadReplyEmail, ownerLeadEmail } from './emails.js';
import { chamberlainRoute } from './chamberlain.js';
import { intake, intakeScript, scheduled as runScheduled, alertOwner } from './ops.js';

const trimEnv = (rawEnv) => Object.fromEntries(Object.entries(rawEnv).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
// shared helpers handed to ops.js
const X = () => ({ hs, cu, contactByEmail, dealForEmail, sendAndLog, setStage, stageRank, planForDeal, tooMany });

export default {
  async scheduled(event, rawEnv, ctx) {
    await runScheduled(event, trimEnv(rawEnv), X());
  },
  async fetch(req, rawEnv, ctx) {
    // trim stray spaces or line breaks that can ride along when a key is pasted
    const env = trimEnv(rawEnv);
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/health') return json({ ok: true });
      if (req.method === 'POST' && url.pathname === '/signwell') return await signwell(req, env);
      if (req.method === 'GET' && url.pathname === '/setup/signwell') return await signwellSetup(url, env);
      if (req.method === 'GET' && url.pathname === '/check') return await check(env);
      if (req.method === 'POST' && url.pathname === '/stripe') return await stripe(req, env);
      if (url.pathname === '/lead') return await lead(req, env);
      if (req.method === 'GET' && url.pathname === '/intake.js') return intakeScript(url);
      if (url.pathname === '/intake') return await intake(req, env, null, X());
      if (url.pathname.startsWith('/chamberlain')) { const r = await chamberlainRoute(req, env); if (r) return r; }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error('handler error', e && e.stack ? e.stack : e);
      if (!(e && e.status && e.status < 500)) await alertOwner(env, url.pathname, String(e && e.stack ? e.stack : e));
      // 500 makes SignWell and Stripe retry later, which is what we want on a real failure
      return json({ error: String(e && e.message ? e.message : e) }, (e && e.status) || 500);
    }
  },
};

/* ---------------- SignWell ---------------- */
async function signwell(req, env) {
  const raw = await req.text();
  const evt = JSON.parse(raw);
  const type = evt?.event?.type;
  if (env.SIGNWELL_WEBHOOK_ID) {
    const expect = await hmacHex(env.SIGNWELL_WEBHOOK_ID, `${type}@${evt?.event?.time}`);
    if (!safeEq(expect, evt?.event?.hash || '')) return json({ error: 'bad signature' }, 401);
  }
  if (!['document_sent', 'document_completed'].includes(type)) return json({ skipped: `ignored ${type}` });
  // Never trust the payload alone: re-read the document from SignWell with our own key.
  const docId = evt?.data?.object?.id;
  if (!docId) return json({ skipped: 'no document id' });
  const doc = await signwellGet(env, `/documents/${docId}/`);
  if (type === 'document_completed' && !/completed/i.test(doc.status || '')) return json({ skipped: `document status is ${doc.status}` });
  const owner = env.OWNER_EMAIL.toLowerCase();
  const client = (doc.recipients || []).find((r) => r.email && r.email.toLowerCase() !== owner);
  if (!client) return json({ skipped: 'no client recipient' });

  const ctx = await dealForEmail(env, client.email);
  if (!ctx) return json({ skipped: `no open deal for ${client.email}` });
  const { contact, deal } = ctx;
  const first = contact.properties.firstname || (client.name || '').split(' ')[0];

  if (type === 'document_sent') {
    if (stageRank(env, deal.properties.dealstage) >= stageRank(env, env.STAGE_AGREEMENT_SENT)) return json({ skipped: 'already past Agreement Sent' });
    // email first, stage last: the stage is the "already done" marker, so a failed email gets retried
    if (env.SEND_AGREEMENT_EMAIL === 'true') await sendAndLog(env, { to: client.email, contact, deal, ...agreementEmail({ firstName: first }) });
    await setStage(env, deal.id, env.STAGE_AGREEMENT_SENT);
    return json({ ok: 'agreement sent handled', deal: deal.id });
  }

  if (type === 'document_completed') {
    if (stageRank(env, deal.properties.dealstage) >= stageRank(env, env.STAGE_SIGNED)) return json({ skipped: 'already past Signed' });
    const plan = await planForDeal(env, deal);
    if (!plan || plan.payLink.startsWith('TODO')) throw new Error(`no payment link for deal ${deal.id}`);
    const company = await companyName(env, deal, contact);
    await sendAndLog(env, { to: client.email, contact, deal, ...paymentEmail({ firstName: first, company, plan }) });
    await setStage(env, deal.id, env.STAGE_SIGNED);
    await closeTasks(env, deal.id, [/not signed yet/i, /send the payment link/i]);
    return json({ ok: 'completed handled', deal: deal.id, plan: plan.key });
  }
  return json({ skipped: `ignored ${type}` });
}

async function signwellGet(env, path, init = {}) {
  if (!env.SIGNWELL_API_KEY) throw new Error('SIGNWELL_API_KEY missing');
  const r = await fetch('https://www.signwell.com/api/v1' + path, {
    ...init,
    headers: { 'X-Api-Key': env.SIGNWELL_API_KEY, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`signwell ${path} ${r.status} ${await r.text()}`);
  return r.status === 204 ? {} : r.json();
}

// One time: registers this worker's /signwell URL as a SignWell webhook (safe to run again).
async function signwellSetup(url, env) {
  const callback = `${url.origin}/signwell`;
  const hooks = await signwellGet(env, '/hooks/');
  const list = Array.isArray(hooks) ? hooks : hooks.hooks || hooks.data || [];
  const existing = list.find((h) => h.callback_url === callback);
  if (existing) return json({ ok: 'already registered', callback });
  await signwellGet(env, '/hooks/', { method: 'POST', body: JSON.stringify({ callback_url: callback }) });
  return json({ ok: 'registered', callback });
}

/* ---------------- Stripe ---------------- */
async function stripe(req, env) {
  const raw = await req.text();
  await verifyStripe(raw, req.headers.get('stripe-signature') || '', env.STRIPE_WEBHOOK_SECRET);
  const evt = JSON.parse(raw);
  if (evt.type !== 'checkout.session.completed') return json({ skipped: `ignored ${evt.type}` });
  const s = evt.data.object;
  if (s.payment_status !== 'paid') return json({ skipped: 'not paid yet' });
  const email = s.customer_details?.email;
  if (!email) return json({ skipped: 'no email' });

  // product name from the session line items (needs a read only restricted key)
  const items = await stripeGet(env, `/v1/checkout/sessions/${s.id}/line_items?expand[]=data.price.product`);
  const productNames = (items.data || []).map((li) => li.price?.product?.name || li.description);
  const plan = findPlan(...productNames);

  const ctx = await dealForEmail(env, email, true);
  const contact = ctx?.contact || (await contactByEmail(env, email));
  const deal = ctx?.deal;
  const first = contact?.properties?.firstname || (s.customer_details?.name || '').split(' ')[0];
  const company = s.custom_fields?.find((f) => /business|company/i.test(f.key))?.text?.value
    || (deal ? await companyName(env, deal, contact) : '') || contact?.properties?.company || s.customer_details?.name || 'New client';

  if (deal && deal.properties.dealstage === env.STAGE_WON) return json({ skipped: 'already Client Won' });
  if (plan) {
    await sendAndLog(env, { to: email, contact, deal, ...welcomeEmail({ firstName: first, company, plan }) });
    await clickupClient(env, company, plan);
  }
  // stage last: it marks the payment as handled, so a failure above gets retried by Stripe
  if (deal) await setStage(env, deal.id, env.STAGE_WON);
  return json({ ok: 'payment handled', deal: deal?.id || null, plan: plan?.key || null });
}

async function verifyStripe(raw, header, secret) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing');
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const sigs = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  const expect = await hmacHex(secret, `${parts.t}.${raw}`);
  if (!sigs.some((s) => safeEq(s, expect))) throw Object.assign(new Error('bad stripe signature'), { status: 400 });
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) throw new Error('stale stripe event');
}

async function stripeGet(env, path) {
  const r = await fetch('https://api.stripe.com' + path, { headers: { Authorization: `Bearer ${env.STRIPE_API_KEY}` } });
  if (!r.ok) throw new Error(`stripe ${path} ${r.status} ${await r.text()}`);
  return r.json();
}

/* ---------------- HubSpot ---------------- */
async function hs(env, method, path, body) {
  const isRead = method === 'GET' || path.includes('/search') || path.includes('/batch/read');
  if (env.DRY_RUN === 'true' && !isRead) {
    console.log('DRY RUN', method, path, JSON.stringify(body));
    return {};
  }
  const r = await fetch('https://api.hubapi.com' + path, {
    method,
    headers: { Authorization: `Bearer ${env.HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`hubspot ${method} ${path} ${r.status} ${await r.text()}`);
  return r.status === 204 ? {} : r.json();
}

async function contactByEmail(env, email) {
  const r = await hs(env, 'POST', '/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: ['firstname', 'lastname', 'email', 'company'],
    limit: 1,
  });
  return r.results?.[0] || null;
}

// newest deal on the contact; open deals only unless includeWon is set
async function dealForEmail(env, email, includeWon = false) {
  const contact = await contactByEmail(env, email);
  if (!contact) return null;
  const a = await hs(env, 'GET', `/crm/v4/objects/contacts/${contact.id}/associations/deals`);
  const ids = (a.results || []).map((x) => String(x.toObjectId));
  if (!ids.length) return null;
  const d = await hs(env, 'POST', '/crm/v3/objects/deals/batch/read', {
    inputs: ids.map((id) => ({ id })),
    properties: ['dealname', 'dealstage', 'amount', 'hs_lastmodifieddate'],
  });
  const deals = (d.results || [])
    .filter((x) => x.properties.dealstage !== 'closedlost' && (includeWon || x.properties.dealstage !== env.STAGE_WON))
    .sort((x, y) => new Date(y.properties.hs_lastmodifieddate) - new Date(x.properties.hs_lastmodifieddate));
  return deals.length ? { contact, deal: deals[0] } : null;
}

const ORDER = (env) => ['appointmentscheduled', 'qualifiedtobuy', 'presentationscheduled', 'decisionmakerboughtin', 'contractsent', env.STAGE_AGREEMENT_SENT, env.STAGE_SIGNED, env.STAGE_WON];
const stageRank = (env, s) => ORDER(env).indexOf(s);

const setStage = (env, dealId, stage) => hs(env, 'PATCH', `/crm/v3/objects/deals/${dealId}`, { properties: { dealstage: stage } });

async function planForDeal(env, deal) {
  const a = await hs(env, 'GET', `/crm/v4/objects/deals/${deal.id}/associations/line_items`);
  const ids = (a.results || []).map((x) => ({ id: String(x.toObjectId) }));
  let names = [];
  if (ids.length) {
    const li = await hs(env, 'POST', '/crm/v3/objects/line_items/batch/read', { inputs: ids, properties: ['name'] });
    names = (li.results || []).map((x) => x.properties.name);
  }
  return findPlan(...names, deal.properties.dealname);
}

async function companyName(env, deal, contact) {
  const a = await hs(env, 'GET', `/crm/v4/objects/deals/${deal.id}/associations/companies`);
  const id = a.results?.[0]?.toObjectId;
  if (id) {
    const c = await hs(env, 'GET', `/crm/v3/objects/companies/${id}?properties=name`);
    if (c.properties?.name) return c.properties.name;
  }
  return contact?.properties?.company || deal.properties.dealname;
}

async function closeTasks(env, dealId, patterns) {
  const a = await hs(env, 'GET', `/crm/v4/objects/deals/${dealId}/associations/tasks`);
  const ids = (a.results || []).map((x) => ({ id: String(x.toObjectId) }));
  if (!ids.length) return;
  const t = await hs(env, 'POST', '/crm/v3/objects/tasks/batch/read', { inputs: ids, properties: ['hs_task_subject', 'hs_task_status'] });
  const open = (t.results || []).filter((x) => x.properties.hs_task_status !== 'COMPLETED' && patterns.some((re) => re.test(x.properties.hs_task_subject || '')));
  if (open.length) await hs(env, 'POST', '/crm/v3/objects/tasks/batch/update', { inputs: open.map((x) => ({ id: x.id, properties: { hs_task_status: 'COMPLETED' } })) });
}

// send through Resend, then log the email on the HubSpot contact and deal timeline
async function sendAndLog(env, { to, contact, deal, subject, html }) {
  if (env.DRY_RUN === 'true') { console.log('DRY RUN email', to, subject); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], reply_to: env.REPLY_TO || env.OWNER_EMAIL, bcc: [env.OWNER_EMAIL], subject, html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
  const associations = [];
  if (contact) associations.push({ to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }] });
  if (deal) associations.push({ to: { id: deal.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 210 }] });
  await hs(env, 'POST', '/crm/v3/objects/emails', {
    properties: {
      hs_timestamp: new Date().toISOString(),
      hs_email_direction: 'EMAIL',
      hs_email_status: 'SENT',
      hs_email_subject: subject,
      hs_email_html: html,
      hs_email_headers: JSON.stringify({ from: { email: env.OWNER_EMAIL }, to: [{ email: to }] }),
    },
    associations,
  });
}

/* ---------------- Website lead form ---------------- */
const SITE_ORIGIN = /^https:\/\/(www\.)?markitmike\.com$/;
async function lead(req, env) {
  const origin = req.headers.get('Origin') || '';
  const h = SITE_ORIGIN.test(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : null;
  const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...(h || {}), 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: h ? 204 : 403, headers: h || {} });
  if (req.method !== 'POST' || !h) return out({ error: 'forbidden' }, 403);

  let f;
  try { f = await req.json(); } catch { return out({ error: 'bad request' }, 400); }
  const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, (c) => (c === '\n' ? '\n' : ' ')).trim().slice(0, n);
  const name = clean(f.name, 120), email = clean(f.email, 160).toLowerCase(), company = clean(f.company, 160);
  const phone = clean(f.phone, 40), message = clean(f.message, 5000), page = clean(f.page, 200);
  // spam traps: hidden field filled in, or submitted faster than a person can type
  if (f.website || (Number(f.elapsed) > 0 && Number(f.elapsed) < 2500)) return out({ ok: true });
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out({ error: 'Please add your name and a valid email.' }, 400);
  if (await tooMany(req, 'lead', 6)) return out({ ok: true });

  const [firstname, ...rest] = name.split(/\s+/);
  const lastname = rest.join(' ');
  let contact = await contactByEmail(env, email);
  if (!contact) {
    contact = await hs(env, 'POST', '/crm/v3/objects/contacts', { properties: { email, firstname, lastname, phone, company, hs_lead_status: 'NEW' } });
  } else {
    const upd = {};
    if (phone) upd.phone = phone;
    if (company && !contact.properties.company) upd.company = company;
    if (Object.keys(upd).length) await hs(env, 'PATCH', `/crm/v3/objects/contacts/${contact.id}`, { properties: upd }).catch(() => {});
  }

  let deal = (await dealForEmail(env, email))?.deal || null;
  const dealCreated = !deal;
  if (!deal) {
    deal = await hs(env, 'POST', '/crm/v3/objects/deals', {
      properties: { dealname: `${company || name} | Website lead`, pipeline: 'default', dealstage: 'appointmentscheduled', description: message.slice(0, 1000) },
      associations: [{ to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] }],
    });
  }
  const assoc = (contactType, dealType) => [
    { to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: contactType }] },
    ...(deal?.id ? [{ to: { id: deal.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: dealType }] }] : []),
  ];
  const tasks = [];
  tasks.push(hs(env, 'POST', '/crm/v3/objects/notes', {
    properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Website form</b> (${page || 'Contact'})</p><p>${message.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>')}</p>` },
    associations: assoc(202, 214),
  }));
  tasks.push(hs(env, 'POST', '/crm/v3/objects/tasks', {
    properties: { hs_timestamp: new Date(Date.now() + 24 * 3600e3).toISOString(), hs_task_subject: `Reply personally to website lead: ${name}`, hs_task_body: `They got the instant reply with the Crown Fitting link. Read their note, then reply within 24 hours. Phone: ${phone || 'not given'}`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'EMAIL' },
    associations: assoc(204, 216),
  }));
  tasks.push(sendAndLog(env, { to: email, contact, deal, ...leadReplyEmail({ firstName: firstname }) }));
  const owner = ownerLeadEmail({ name, email, phone, company, message, page, dealCreated });
  tasks.push(sendRaw(env, { to: env.OWNER_EMAIL, reply_to: email, ...owner }));
  const results = await Promise.allSettled(tasks);
  results.forEach((r) => r.status === 'rejected' && console.error('lead step failed', r.reason && r.reason.message));
  return out({ ok: true });
}

async function sendRaw(env, { to, reply_to, subject, html }) {
  if (env.DRY_RUN === 'true') { console.log('DRY RUN email', to, subject); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], reply_to, subject, html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
}

// best effort per visitor counter in the edge cache
async function tooMany(req, bucket, max) {
  try {
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const key = new Request(`https://limit.mma/${bucket}/${encodeURIComponent(ip)}/${Math.floor(Date.now() / 3600000)}`);
    const hit = await caches.default.match(key);
    const n = hit ? parseInt(await hit.text(), 10) || 0 : 0;
    if (n >= max) return true;
    await caches.default.put(key, new Response(String(n + 1), { headers: { 'Cache-Control': 'max-age=3600' } }));
  } catch (e) { /* never block on counter failure */ }
  return false;
}

/* ---------------- ClickUp ---------------- */
async function cu(env, method, path, body) {
  if (env.DRY_RUN === 'true' && method !== 'GET') { console.log('DRY RUN clickup', method, path, JSON.stringify(body)); return { id: 'dry' }; }
  const r = await fetch('https://api.clickup.com/api/v2' + path, {
    method,
    headers: { Authorization: env.CLICKUP_TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`clickup ${method} ${path} ${r.status} ${await r.text()}`);
  return r.json();
}

async function clickupClient(env, company, plan) {
  const folder = await cu(env, 'POST', `/space/${env.CLICKUP_SPACE_ID}/folder`, { name: `MMA | ${company}` });
  const lists = {};
  for (const name of CLIENT_LISTS) lists[name] = await cu(env, 'POST', `/folder/${folder.id}/list`, { name });
  for (const t of plan.deliverables) await cu(env, 'POST', `/list/${lists['Deliverables'].id}/task`, { name: t, description: `${plan.name}` });
  for (const t of ONBOARDING_TASKS) await cu(env, 'POST', `/list/${lists['Onboarding'].id}/task`, { name: t });
}

/* ---------------- key check (read only, returns pass or fail per service) ---------------- */
async function check(env) {
  const tryIt = async (fn) => { try { await fn(); return 'ok'; } catch (e) { return 'FAIL ' + String(e.message).slice(0, 500); } };
  return json({
    dry_run: env.DRY_RUN,
    hubspot: await tryIt(() => hs(env, 'GET', '/crm/v3/objects/deals?limit=1')),
    stripe: await tryIt(() => stripeGet(env, '/v1/products?limit=1')),
    stripe_webhook_secret: env.STRIPE_WEBHOOK_SECRET ? 'set' : 'MISSING',
    signwell: await tryIt(() => signwellGet(env, '/hooks/')),
    clickup: await tryIt(() => cu(env, 'GET', `/space/${env.CLICKUP_SPACE_ID}`)),
    // a sending only key gets 401 restricted (valid) on this read; a bad key gets 401 invalid
    chamberlain: await tryIt(async () => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json', ...(env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } : {}) },
        body: JSON.stringify({ model: env.CHAMBERLAIN_MODEL || 'claude-sonnet-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 500)}`);
    }),
    resend: await tryIt(async () => {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
      const t = await r.text();
      if (r.ok || /restricted/i.test(t)) return;
      throw new Error(`${r.status} ${t}`);
    }),
  });
}

/* ---------------- helpers ---------------- */
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
