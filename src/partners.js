// Crown Partners: people who sell local marketing (former Money Mailer franchisees first) refer clients
// or resell Quick Wins. POST /partner from markitmike.com/partners:
//   creates or updates the HubSpot contact, gives them a personal link (markitmike.com/partners?ref=<code>),
//   logs a note, makes a call task, emails them their link and alerts the owner.
// Referral credit: site.js keeps ?ref=<code> with the visitor's first touch, so any later form shows "partner ref=<code>".

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SITE_ORIGIN = /^https:\/\/(www\.)?markitmike\.com$/;
const IMG = 'https://markitmike.com/wp-content/uploads/2026/11/';

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

function welcomeHtml({ first, link }) {
  const p = (t) => `<p style="margin:0 0 16px 0;">${t}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Crown Partners</title></head>
<body style="margin:0;padding:0;background:#F4F1F8;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1F8;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0B3354;background-image:linear-gradient(150deg,#036684 0%,#0B3354 50%,#1D0A40 100%);padding:30px 36px;border-bottom:4px solid #E79A27;">
<img src="${IMG}mma-logo-reverse-tight.png" width="170" alt="Markit Mike Agency" style="display:block;width:170px;height:auto;border:0;">
<p style="margin:18px 0 0;font-family:Montserrat,Arial,sans-serif;font-size:12px;font-weight:800;letter-spacing:3px;color:#FFD27A;">CROWN PARTNERS</p>
<p style="margin:6px 0 0;font-family:Montserrat,Arial,sans-serif;font-size:28px;line-height:32px;font-weight:900;color:#FFFFFF;">You're in, ${esc(first) || 'partner'}.</p></td></tr>
<tr><td style="padding:30px 36px 10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#1B1030;">
${p('Thank you for joining Crown Partners. Here is your personal partner link. Share it with any client who needs help with their Google profile, website, reviews or a plan to grow, and every client who comes through it is credited to you.')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F6F2FB;border-radius:12px;border-left:4px solid #E79A27;"><tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;"><b>Your link</b><br><a href="${link}" style="color:#108193;font-weight:700;word-break:break-all;">${link}</a></td></tr></table>
${p('<b>Refer it:</b> earn 20% on Quick Wins and Gold Starter, and 10% of each monthly payment on our plans. Commission is paid within 15 days of each client payment clearing.')}
${p('<b>Resell it:</b> want to sell a Google Profile Glow Up, Brand Checkup or Mail Ready Page under your own name? Reply to this email and we will set you up with partner pricing.')}
${p('Prefer a warm intro? Just email the client and copy michael@markitmike.com. That counts too.')}
${p('Talk soon,<br>Michael<br>Markit Mike Agency<br>(714) 919&#8209;9469')}
</td></tr>
<tr><td style="background:#1D0A40;padding:16px 36px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#BFB3D6;">Markit Mike Agency · 161 Reed Ln, La Habra, CA 90631</td></tr>
</table></td></tr></table></body></html>`;
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
  const link = `https://markitmike.com/?ref=${code}`; // the home page: clients land on the agency, and site.js keeps the ref
  const src = (f.src && f.src.utm && f.src.utm.utm_source) ? `${f.src.utm.utm_source}${f.src.utm.utm_medium ? ' / ' + f.src.utm.utm_medium : ''}` : (f.src && f.src.ref) || 'direct';
  const assoc = (t) => [{ to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: t }] }];
  const steps = [
    x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Joined Crown Partners</b></p><p>Partner code: <b>${esc(code)}</b><br>Partner link: <a href="${link}">${link}</a><br>Sells: ${esc(sells || 'not given')}<br>Came from: ${esc(src)}</p><p>Leads with "partner ref=${esc(code)}" in their source are credited to this partner.</p>` }, associations: assoc(202) }),
    x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: new Date(Date.now() + 24 * 3600e3).toISOString(), hs_task_subject: `Call new Crown Partner: ${name}`, hs_task_body: `<p>Welcome them, ask which clients come to mind first, and offer partner pricing if they want to resell.</p><p>Phone: ${esc(phone || 'not given')}<br>Link: <a href="${link}">${link}</a></p>`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'CALL' }, associations: assoc(204) }),
    x.sendAndLog(env, { to: email, contact, subject: `Welcome to Crown Partners, ${firstname}`, html: welcomeHtml({ first: firstname, link }) }),
    x.sendRaw(env, { to: env.OWNER_EMAIL, reply_to: email, subject: `New Crown Partner: ${name}${company ? ` (${company})` : ''}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#5D0EA6;">NEW CROWN PARTNER</p><p style="margin:0 0 12px;font-size:20px;font-weight:800;">${esc(name)}${company ? ` · ${esc(company)}` : ''}</p><p style="font-size:15px;">Email: ${esc(email)}<br>Phone: ${esc(phone || 'not given')}<br>Sells: ${esc(sells || 'not given')}<br>Came from: ${esc(src)}<br>Partner link: ${link}</p><p><a href="https://app-na2.hubspot.com/contacts/246716405/record/0-1/${contact.id}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#5D0EA6;color:#fff;font-weight:700;text-decoration:none;">Open in HubSpot</a></p></div>` }),
  ];
  if (f.optIn === true && x.recordOptIn) steps.push(x.recordOptIn(env, contact.id, email, 'Crown Partners signup'));
  (await Promise.allSettled(steps)).forEach((r) => r.status === 'rejected' && console.error('partner step failed', r.reason && r.reason.message));
  return out({ ok: true, link });
}
