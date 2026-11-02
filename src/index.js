// Markit Mike Agency client journey automations.
//   POST /signwell  SignWell webhook: document_sent, document_completed
//   POST /stripe    Stripe webhook: checkout.session.completed
//   GET  /health    simple check that the worker is up
import { findPlan, ONBOARDING_TASKS, CLIENT_LISTS } from './plans.js';
import { paymentEmail, welcomeEmail, agreementEmail } from './emails.js';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/health') return json({ ok: true });
      if (req.method === 'POST' && url.pathname === '/signwell') return await signwell(req, env);
      if (req.method === 'GET' && url.pathname === '/setup/signwell') return await signwellSetup(url, env);
      if (req.method === 'POST' && url.pathname === '/stripe') return await stripe(req, env);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error('handler error', e && e.stack ? e.stack : e);
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
    await setStage(env, deal.id, env.STAGE_AGREEMENT_SENT);
    if (env.SEND_AGREEMENT_EMAIL === 'true') await sendAndLog(env, { to: client.email, contact, deal, ...agreementEmail({ firstName: first }) });
    return json({ ok: 'agreement sent handled', deal: deal.id });
  }

  if (type === 'document_completed') {
    if (stageRank(env, deal.properties.dealstage) >= stageRank(env, env.STAGE_SIGNED)) return json({ skipped: 'already past Signed' });
    const plan = await planForDeal(env, deal);
    if (!plan || plan.payLink.startsWith('TODO')) throw new Error(`no payment link for deal ${deal.id}`);
    await setStage(env, deal.id, env.STAGE_SIGNED);
    const company = await companyName(env, deal, contact);
    await sendAndLog(env, { to: client.email, contact, deal, ...paymentEmail({ firstName: first, company, plan }) });
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

  if (deal) {
    if (deal.properties.dealstage === env.STAGE_WON) return json({ skipped: 'already Client Won' });
    await setStage(env, deal.id, env.STAGE_WON);
  }
  if (plan) {
    await sendAndLog(env, { to: email, contact, deal, ...welcomeEmail({ firstName: first, company, plan }) });
    await clickupClient(env, company, plan);
  }
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
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], reply_to: env.OWNER_EMAIL, bcc: [env.OWNER_EMAIL], subject, html }),
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

/* ---------------- ClickUp ---------------- */
async function cu(env, method, path, body) {
  if (env.DRY_RUN === 'true') { console.log('DRY RUN clickup', method, path, JSON.stringify(body)); return { id: 'dry' }; }
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
