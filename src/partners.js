// Crown Partners: people who sell local marketing (former Money Mailer franchisees first) refer clients
// or resell Quick Wins. POST /partner from markitmike.com/partners:
//   creates or updates the HubSpot contact, gives them a personal link (markitmike.com/partners?ref=<code>),
//   logs a note, makes a call task, emails them their private Sales Kit (the share link lives there with its context) and alerts the owner.
// Referral credit: site.js keeps ?ref=<code> with the visitor's first touch, so any later form shows "partner ref=<code>".

import { upsertPartner, shareLink, kitLink } from './partnerkit.js';
import { partnerWelcomeEmail } from './emails.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SITE_ORIGIN = /^https:\/\/(www\.)?markitmike\.com$/;

async function uniqueCode(env, first, last, contactId) {
  const mine = await env.REPORTS.get(`partnerof:${contactId}`);
  if (mine) return mine;
  const base = `${first}${last}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '').slice(0, 20) || 'partner';
  for (let i = 0; i < 50; i++) {
    const code = i ? `${base}${i + 1}` : base;
    const taken = await env.REPORTS.get(`partner:${code}`);
    if (!taken || taken === String(contactId)) return code;
  }
  return `${base}${Date.now().toString(36).slice(-4)}`;
}

export async function partnerJoin(req, env, x) {
  const origin = req.headers.get('Origin') || '';
  const h = SITE_ORIGIN.test(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : null;
  const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...(h || {}), 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: h ? 204 : 403, headers: h || {} });
  if (req.method !== 'POST' || !h) return out({ error: 'forbidden' }, 403);
  let f; try { f = await req.json(); } catch { return out({ error: 'bad request' }, 400); }
  const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
  const name = clean(f.name, 120), email = clean(f.email, 160).toLowerCase(), phone = clean(f.phone, 40), company = clean(f.company, 160), sells = clean(f.sells, 120);
  if (f.website || (Number(f.elapsed) > 0 && Number(f.elapsed) < 2500)) return out({ ok: true }); // spam traps
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out({ error: 'Please add your name and a valid email.' }, 400);
  if (x.tooMany && await x.tooMany(req, 'partner', 5)) return out({ ok: true });
  const [firstname, ...rest] = name.split(/\s+/);
  const lastname = rest.join(' ');

  let contact = await x.contactByEmail(env, email);
  if (!contact) contact = await x.hs(env, 'POST', '/crm/v3/objects/contacts', { properties: { email, firstname, lastname, phone, company, lifecyclestage: 'other' } });
  else {
    const upd = {}; if (phone) upd.phone = phone; if (company && !contact.properties?.company) upd.company = company;
    if (Object.keys(upd).length) await x.hs(env, 'PATCH', `/crm/v3/objects/contacts/${contact.id}`, { properties: upd }).catch(() => {});
  }
  const code = await uniqueCode(env, firstname, lastname, contact.id);
  await env.REPORTS.put(`partner:${code}`, String(contact.id));
  await env.REPORTS.put(`partnerof:${contact.id}`, code);
  const link = shareLink(code); // a 'Recommended by' page with their name; site.js keeps the ref for credit
  const prec = await upsertPartner(env, { code, contactId: String(contact.id), first: firstname, last: lastname, email, phone, company, sells });
  const kit = kitLink(prec.kit);
  const src = (f.src && f.src.utm && f.src.utm.utm_source) ? `${f.src.utm.utm_source}${f.src.utm.utm_medium ? ' / ' + f.src.utm.utm_medium : ''}` : (f.src && f.src.ref) || 'direct';
  const assoc = (t) => [{ to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: t }] }];
  const steps = [
    x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Joined Crown Partners</b></p><p>Partner code: <b>${esc(code)}</b><br>Partner link: <a href="${link}">${link}</a><br>Sales Kit (private): <a href="${kit}">${kit}</a><br>Sells: ${esc(sells || 'not given')}<br>Came from: ${esc(src)}</p><p>Leads with "partner ref=${esc(code)}" in their source are credited to this partner.</p>` }, associations: assoc(202) }),
    x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: new Date(Date.now() + 24 * 3600e3).toISOString(), hs_task_subject: `Call new Crown Partner: ${name}`, hs_task_body: `<p>Welcome them, ask which clients come to mind first, and offer partner pricing if they want to resell.</p><p>Phone: ${esc(phone || 'not given')}<br>Link: <a href="${link}">${link}</a></p>`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'CALL' }, associations: assoc(204) }),
    x.sendAndLog(env, { to: email, contact, ...partnerWelcomeEmail({ firstName: firstname, kit }) }),
    x.sendRaw(env, { to: env.OWNER_EMAIL, reply_to: email, subject: `New Crown Partner: ${name}${company ? ` (${company})` : ''}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#5D0EA6;">NEW CROWN PARTNER</p><p style="margin:0 0 12px;font-size:20px;font-weight:800;">${esc(name)}${company ? ` · ${esc(company)}` : ''}</p><p style="font-size:15px;">Email: ${esc(email)}<br>Phone: ${esc(phone || 'not given')}<br>Sells: ${esc(sells || 'not given')}<br>Came from: ${esc(src)}<br>Partner link: ${link}<br>Their Sales Kit: <a href="${kit}">${kit}</a></p><p><a href="https://app-na2.hubspot.com/contacts/246716405/record/0-1/${contact.id}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#5D0EA6;color:#fff;font-weight:700;text-decoration:none;">Open in HubSpot</a></p></div>` }),
  ];
  if (f.optIn === true && x.recordOptIn) steps.push(x.recordOptIn(env, contact.id, email, 'Crown Partners signup'));
  (await Promise.allSettled(steps)).forEach((r) => r.status === 'rejected' && console.error('partner step failed', r.reason && r.reason.message));
  return out({ ok: true, link, kit });
}

// ---------- referral credit and commissions ----------
const CREDIT_DAYS = 90;
const TERM = { platinum: 3, crownjewel: 6 }; // monthly plans: commission on each payment of the first term

// called by every website form: a visitor who arrived on a partner link (?ref=<code>) is credited to that partner
export async function creditPartner(env, x, contactId, src) {
  try {
    const code = String(src?.utm?.ref || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    if (!code || !contactId) return;
    const partnerId = await env.REPORTS.get(`partner:${code}`);
    if (!partnerId || partnerId === String(contactId)) return; // unknown code, or a partner referring themselves
    const prev = await env.REPORTS.get(`pclient:${contactId}`, 'json');
    if (prev && Date.now() - prev.at < CREDIT_DAYS * 864e5) return; // first introduction wins
    await env.REPORTS.put(`pclient:${contactId}`, JSON.stringify({ code, partnerId, at: Date.now() }));
    await x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Crown Partner referral:</b> credited to partner code <b>${esc(code)}</b> for ${CREDIT_DAYS} days (until ${new Date(Date.now() + CREDIT_DAYS * 864e5).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}). A purchase in that window earns the partner a commission.</p>` }, associations: [{ to: { id: String(contactId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }] });
  } catch (e) { console.error('credit partner', e.message); }
}

// called by the Stripe webhook for every paid checkout; never throws
export async function partnerCommission(env, x, { sessionId, contact, amountCents, plan, productNames }) {
  try {
    if (!contact?.id || !amountCents) return;
    if (await env.REPORTS.get(`commission:${sessionId}`)) return; // Stripe retries
    const credit = await env.REPORTS.get(`pclient:${contact.id}`, 'json');
    if (!credit) return;
    // the purchase must start inside the credit window; later payments of the same first plan term still count
    if (Date.now() - credit.at > CREDIT_DAYS * 864e5 && !credit.locked) return;
    credit.locked = true;
    await env.REPORTS.put(`pclient:${contact.id}`, JSON.stringify(credit));
    const months = plan && TERM[plan.key];
    const rate = months ? 0.1 : 0.2;
    const amount = Math.round(amountCents * rate) / 100;
    const due = new Date(Date.now() + 15 * 864e5);
    const dueText = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
    const partner = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${credit.partnerId}?properties=firstname,lastname,email`).catch(() => null);
    const pname = [partner?.properties?.firstname, partner?.properties?.lastname].filter(Boolean).join(' ') || credit.code;
    const client = [contact.properties?.firstname, contact.properties?.lastname].filter(Boolean).join(' ') || contact.properties?.email || 'client';
    const what = (productNames || []).filter(Boolean).join(', ') || plan?.name || 'purchase';
    const money = (n) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
    const later = months ? ` Then ${money(amount)} after each of the next ${months - 1} monthly payments, if they come in (reminders below).` : '';
    const rec = { sessionId, partnerId: credit.partnerId, code: credit.code, clientId: contact.id, amount, rate, what, at: Date.now(), due: due.toISOString(), paid: false };
    await env.REPORTS.put(`commission:${sessionId}`, JSON.stringify(rec));
    const list = (await env.REPORTS.get('commissions', 'json')) || [];
    list.push(sessionId); await env.REPORTS.put('commissions', JSON.stringify(list.slice(-500)));

    const assocP = (t) => [{ to: { id: String(credit.partnerId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: t }] }];
    const steps = [
      x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Commission earned:</b> ${money(amount)} (${rate * 100}% of ${money(amountCents / 100)}) for referring ${esc(client)}, who bought ${esc(what)}. Pay by ${dueText}.${esc(later)}</p>` }, associations: assocP(202) }),
      x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: due.toISOString(), hs_task_subject: `Pay Crown Partner ${pname}: ${money(amount)}`, hs_task_body: `<p>Commission for ${esc(client)} (${esc(what)}). Pay by direct deposit or Zelle and send a one line statement: client, amount paid, commission. Make sure their W-9 is on file first.</p>`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'TODO' }, associations: assocP(204) }),
      x.sendRaw(env, { to: env.OWNER_EMAIL, subject: `Crown Partner commission: pay ${pname} ${money(amount)} by ${dueText}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#9A5B00;">COMMISSION EARNED</p><p style="margin:0 0 12px;font-size:20px;font-weight:800;">${esc(pname)} earned ${money(amount)}</p><p style="font-size:15px;">${esc(client)} bought ${esc(what)} for ${money(amountCents / 100)}. That's ${rate * 100}% to ${esc(pname)}, due by <b>${dueText}</b>.${esc(later)}</p><p style="font-size:15px;">A HubSpot task is waiting on ${esc(pname)}'s record. Check their W-9 is on file before you pay.</p></div>` }),
    ];
    // monthly plans: a reminder for each later payment in the first term
    if (months) for (let m = 1; m < months; m++) {
      const d = new Date(Date.now() + (m * 30 + 15) * 864e5);
      steps.push(x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: d.toISOString(), hs_task_subject: `Crown Partner ${pname}: commission for payment ${m + 1} of ${months} (${money(amount)})`, hs_task_body: `<p>Only if ${esc(client)}'s payment ${m + 1} of ${months} came in. Pay ${money(amount)} (10% of that payment) to ${esc(pname)}. If the plan was cancelled, close this task.</p>`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'MEDIUM', hs_task_type: 'TODO' }, associations: assocP(204) }));
    }
    (await Promise.allSettled(steps)).forEach((r) => r.status === 'rejected' && console.error('commission step failed', r.reason && r.reason.message));
  } catch (e) { console.error('partner commission', e.message); }
}
