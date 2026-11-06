// Crown Fitting Notes: a private form Markit Mike fills in during the call.
//   GET  /fitting/<token>  the form (token is created when the Crown Fitting is booked)
//   POST /fitting/<token>  save: formatted note on the deal and contact, deal to Crown Fitting Held,
//                          thank you email, "Review and send Snapshot" task, answers kept for the Snapshot and ClickUp
// Also here: the link and prep task at booking, "did they show?" tasks, the no show rebooking email,
// and the day 3 and day 7 nudges for website leads who have not booked.
import { CROWN_SCORES } from './crown.js';
import { fittingThanksEmail, noShowEmail, leadNudgeEmail } from './emails.js';
import { buildSnapshot } from './snapshot.js';
import { openTimes, bookDirect, calendarReady } from './schedule.js';

const WORKER = 'https://mma-automations.markitmike.workers.dev';
const HELD = 'decisionmakerboughtin';
const BOOKED = 'presentationscheduled';
const PROSPECT = 'appointmentscheduled';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export { CROWN_SCORES };
export const FIT_SECTIONS = [
  { t: 'Why they reached out', mins: 4,
    say: "Thanks so much for making time today, {first}. Before I tell you how I'd love to use our time, I'm curious: what prompted you to book this call?",
    ask: ['What made now the right time to look at this?', 'What would make the next 30 minutes a win for you?'],
    tip: 'Let them talk. Their reason for reaching out is your roadmap for the rest of the call. Then give the quick agenda, built around what they just said: "Perfect. I\'ll ask a few questions about the business and your goals, and at the end I\'ll share what I\'m seeing and a smart next step."',
    f: [
    ['why', 'What prompted them to reach out', 'area', 'In their words'],
    ['whynow', 'Why now', 'text'],
    ['callwin', 'What would make this call a win', 'text'],
  ] },
  { t: 'The business', mins: 3, say: "Let's start with the big picture so I really understand your world.", ask: ['How many locations are you at today, and where are they?', 'Are they company owned, franchised or a mix?', 'What does growth look like for you over the next 12 months?'], f: [
    ['locations', 'Locations today', 'text', 'Number of locations and where'],
    ['ownership', 'Ownership model', 'chips', ['Company owned', 'Franchised', 'Mixed', 'Single location']],
    ['growth', 'Growth plans, next 12 months', 'area', 'New units, new markets, remodels, new concepts'],
  ] },
  { t: 'Goals', mins: 4, say: 'Now let\'s talk about where you want to go.', ask: ['If we were sitting here 90 days from now celebrating, what would have happened?', 'What are the top three things you want marketing to move for you?'], tip: 'Push gently for numbers: sales, traffic, new locations, loyalty members.', f: [
    ['win90', 'What does a win look like in 90 days?', 'area', 'In their words'],
    ['pri1', 'Priority 1', 'text'], ['pri2', 'Priority 2', 'text'], ['pri3', 'Priority 3', 'text'],
  ] },
  { t: 'Current marketing', mins: 5, say: 'Help me understand how marketing works for you today.', ask: ['Who handles marketing right now?', 'Roughly what do you invest in marketing each month?', 'What has been working well?', 'What have you tried that did not land?'], tip: 'No judgment on budget. If they hesitate, offer the ranges below.', f: [
    ['who', 'Who handles marketing today', 'multi', ['In house team', 'Agency', 'Freelancers', 'Owner or founder', 'Nobody']],
    ['budget', 'Monthly marketing budget', 'chips', ['Under $2K', '$2K to $5K', '$5K to $10K', '$10K to $25K', '$25K plus', 'Not sure']],
    ['working', 'What is working', 'area'],
    ['notworking', 'What is not working', 'area'],
  ] },
  { t: 'Customer experience', mins: 4, say: 'Let\'s look at the experience from your customer\'s side.', ask: ['Do you have a loyalty program today? How is it performing?', 'How do your reviews look, and does anyone respond to them?', 'How are people ordering: online, your own app, third party?'], f: [
    ['loyalty', 'Loyalty program', 'chips', ['App based', 'POS or punch card', 'None', 'Not sure']],
    ['rating', 'Average review rating', 'text', 'For example 4.3 on Google'],
    ['ordering', 'Online ordering or app', 'chips', ['Own app', 'Third party only', 'Both', 'None']],
    ['webnotes', 'Website and Google profile notes', 'area'],
  ] },
  { t: 'Pain point', mins: 3, say: 'Let me ask you the big one.', ask: ['What is the one thing about the business that keeps you up at night?'], tip: 'Pause after you ask and let the silence work. Write down their exact words, they are gold for the Snapshot.', f: [
    ['pain', 'The thing keeping them up at night', 'area', 'Capture it in their words'],
  ] },
  { t: 'Crown scores', note: 'Score each area of the Crown Framework, 1 is weak, 5 is strong. These become the Crown scorecard on the Brand Experience Snapshot and the diagnosis in the plan walkthrough.', tip: 'Score quietly as you listen. No need to say these out loud.', f: CROWN_SCORES.map(([k, lab, hint]) => [k, lab, 'score', hint]) },
  { t: 'Decision and timing', mins: 3, say: 'Just a couple of quick questions about timing.', ask: ['Besides you, who else would weigh in on a decision like this?', 'When would you ideally want to get started?', 'Are you looking at any other options right now?'], tip: 'For budget, try: "Is there a range you had in mind?"', f: [
    ['decider', 'Who decides', 'text', 'Names and roles'],
    ['comfort', 'Budget comfort', 'chips', ['Ready now', 'Needs approval', 'Tight']],
    ['timeline', 'Timeline', 'chips', ['This month', '30 to 60 days', '60 to 90 days', 'Later']],
    ['competing', 'Other options they are considering', 'text'],
  ] },
  { t: 'Recommendation', mins: 4, say: 'Here\'s what I\'m hearing: [recap their 90 day win and their pain point in their words]. Based on that, I\'d recommend [offer], and here\'s why. Next, I\'ll send your Brand Experience Snapshot within one business day with the full picture. Does it make sense to set a time now to walk through it together?', tip: 'Book the walkthrough before you hang up. Then click Submit below.', f: [
    ['offer', 'Recommended next step', 'chips', ['Brand Checkup', 'Glow Up', 'Gold Starter', 'Platinum Accelerator', 'Crown Jewel', 'Not a fit']],
    ['next', 'Next steps you agreed on', 'area'],
    ['notes', 'Anything else', 'area'],
  ] },
];


export function scriptBox(sec, first) {
  const fill = (t) => esc(t).replace(/\{first\}/g, esc(first || 'there'));
  const parts = [];
  if (sec.say) parts.push(`<p class="say"><span>Say</span>${fill(sec.say)}</p>`);
  if (sec.ask && sec.ask.length) parts.push(`<div class="ask"><span>Ask</span><ol>${sec.ask.map((q) => `<li>${fill(q)}</li>`).join('')}</ol></div>`);
  if (sec.tip) parts.push(`<p class="tip"><span>Tip</span>${fill(sec.tip)}</p>`);
  return parts.length ? `<div class="script">${parts.join('')}</div>` : '';
}

export function friendlySource(src) {
  const get = (k) => (src.match(new RegExp(k + '=([^,|]+)')) || [])[1]?.trim();
  const cap = (t) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/Linkedin/, 'LinkedIn');
  const parts = [];
  const source = get('utm_source'), medium = get('utm_medium'), campaign = get('utm_campaign');
  if (source) parts.push(`${cap(source)}${medium ? ` (${medium.replace(/_/g, ' ')})` : ''}${campaign ? `, campaign ${campaign.replace(/_/g, ' ')}` : ''}`);
  else if (/Google Ads click/.test(src)) parts.push('A Google ad');
  else if (/Meta ad click/.test(src)) parts.push('A Facebook or Instagram ad');
  else { const ref = (src.match(/referrer:\s*([^|]+)/) || [])[1]?.trim(); if (ref) parts.push(ref === 'direct' ? 'Typed in your address or a saved link' : `A link on ${ref.replace(/^https?:\/\//, '').split('/')[0]}`); }
  const landing = (src.match(/landing page:\s*([^|]+)/) || [])[1]?.trim();
  if (landing && landing !== '?') parts.push(`first visited ${landing === '/' ? 'your home page' : landing}`);
  const conv = (src.match(/converted on:\s*([^|]+)/) || [])[1]?.trim();
  if (conv && conv !== landing) parts.push(`reached out from ${conv}`);
  return parts.join(', ') || src;
}

// what we already know before the call: their website message, how they found us, outreach brand and hook
export async function contextPanel(env, x, ref, cp) {
  const items = [];
  try {
    const a = await x.hs(env, 'GET', `/crm/v4/objects/contacts/${ref.contactId}/associations/notes`);
    const ids = (a.results || []).slice(-20).map((n) => ({ id: String(n.toObjectId) }));
    if (ids.length) {
      const nb = await x.hs(env, 'POST', '/crm/v3/objects/notes/batch/read', { inputs: ids, properties: ['hs_note_body', 'hs_timestamp'] });
      const plain = (h) => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
      for (const n of (nb.results || []).sort((m, k) => String(m.properties.hs_timestamp).localeCompare(String(k.properties.hs_timestamp)))) {
        const t = plain(n.properties.hs_note_body);
        if (/^Website form/i.test(t)) {
          const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
          const src = (lines.find((l) => /^Source:/i.test(l)) || '').replace(/^Source:\s*/i, '');
          const msg = lines.filter((l) => !/^(Website form|Email marketing:|Source:)/i.test(l)).join(' ');
          if (msg) items.push(['They wrote on the website', msg]);
          if (src && src !== 'unknown') items.push(['How they found us', friendlySource(src)]);
        } else if (/^MMA SEQUENCE v1/.test(t)) {
          const brand = (t.match(/BRAND:\s*(.+)/) || [])[1];
          const subj = (t.match(/SUBJECT:\s*(.+)/) || [])[1];
          items.push(['Came from our outreach', `${brand || 'Cold sequence'}${subj ? `, subject "${subj}"` : ''}`]);
        }
      }
    }
  } catch (e) { console.error('fitting context', e.message); }
  if (cp.company) items.unshift(['Company', cp.company]);
  if (!items.length) items.push(['Before the call', 'Nothing on file yet beyond their name and email. Look up their website and Google profile for two minutes before you start.']);
  return `<section class="card known"><h2><b>&#9733;</b>What we already know</h2><dl>${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`;
}

function token() {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  return [...a].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

// called from meetingSync for every Crown Fitting booking
export async function ensureFittingLink(env, x, { dealId, contact, meeting }) {
  if (!env.REPORTS || !dealId) return null;
  const existing = await env.REPORTS.get(`fitdeal:${dealId}`);
  if (existing) return `${WORKER}/fitting/${existing}`;
  const tok = token();
  await env.REPORTS.put(`fittok:${tok}`, JSON.stringify({ dealId: String(dealId), contactId: String(contact.id), meetingId: meeting?.id || null, start: meeting?.properties?.hs_meeting_start_time || null }));
  await env.REPORTS.put(`fitdeal:${dealId}`, tok);
  const url = `${WORKER}/fitting/${tok}`;
  const p = contact.properties || {};
  const who = [p.firstname, p.lastname].filter(Boolean).join(' ') || p.email;
  const when = meeting?.properties?.hs_meeting_start_time;
  const assoc = (c, d) => [
    { to: { id: String(contact.id) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: c }] },
    { to: { id: String(dealId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: d }] },
  ];
  const jobs = [
    x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Crown Fitting Notes form</b> for this call:</p><p><a href="${url}">${url}</a></p><p>Open it during the call and click Submit when you wrap up. That sends the thank you email and sets up the Snapshot.</p>` }, associations: assoc(202, 214) }),
    x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: when || new Date().toISOString(), hs_task_subject: `Crown Fitting with ${who}: open the Notes form`, hs_task_body: `Notes form: ${url}\nSubmit it when the call ends.`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'CALL' }, associations: assoc(204, 216) }),
  ];
  (await Promise.allSettled(jobs)).forEach((r) => r.status === 'rejected' && console.error('fitting link', r.reason && r.reason.message));
  return url;
}

export function page(title, inner) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap">
<style>
:root{--g:#E79A27;--t:#108193;--p:#5D0EA6;--ink:#1c1236;--mut:#5a5372;--line:#e6def3;--bg:#f4f1f8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:Montserrat,system-ui,sans-serif;color:var(--ink)}
.top{background:linear-gradient(140deg,#036684 0%,#0b3354 45%,#1d0a40 100%);color:#fff;padding:26px max(16px,env(safe-area-inset-left)) 70px}
.top .in{max-width:880px;margin:0 auto}.eb{font-size:11px;font-weight:800;letter-spacing:3px;color:#ffd27a}
h1{margin:6px 0 4px;font-size:clamp(24px,4vw,34px);font-weight:900}.sub{margin:0;color:rgba(255,255,255,.85);font-size:15px}
.wrap{max-width:880px;margin:-50px auto 60px;padding:0 max(16px,env(safe-area-inset-left))}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px 24px;margin-bottom:14px;box-shadow:0 12px 30px rgba(29,10,64,.08)}
.card h2{display:flex;gap:10px;align-items:center;margin:0 0 12px;font-size:18px;font-weight:900}
.card h2 b{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--p),var(--t));color:#fff;font-size:13px}
.note{margin:-4px 0 12px;color:var(--mut);font-size:13px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.f{grid-column:1/-1;margin-bottom:14px}.f.half{grid-column:auto}
label.l{display:block;margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#2a0d55}
.help{font-size:12px;color:var(--mut);font-weight:500;text-transform:none;letter-spacing:0}
input[type=text],textarea{width:100%;padding:11px 13px;border:1.5px solid var(--line);border-radius:12px;background:#faf8fd;font:500 15px Montserrat,system-ui,sans-serif;color:var(--ink)}
textarea{min-height:76px;resize:vertical}input:focus,textarea:focus{outline:none;border-color:var(--g);background:#fff;box-shadow:0 0 0 3px rgba(231,154,39,.18)}
.chips{display:flex;flex-wrap:wrap;gap:7px}.chips label{position:relative}.chips input{position:absolute;opacity:0}
.chips span{display:inline-block;padding:8px 13px;border:1.5px solid var(--line);border-radius:999px;background:#faf8fd;font-size:13px;font-weight:600;cursor:pointer}
.chips input:checked+span{border-color:var(--p);background:linear-gradient(110deg,var(--p),var(--t));color:#fff}.chips input:focus-visible+span{box-shadow:0 0 0 3px rgba(231,154,39,.35)}
.score{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.score .nm{flex:0 0 290px;max-width:100%;font-weight:700;font-size:14px}
.bar{position:sticky;bottom:0;background:rgba(244,241,248,.96);backdrop-filter:blur(6px);border-top:1px solid var(--line);padding:12px max(16px,env(safe-area-inset-left)) calc(12px + env(safe-area-inset-bottom))}
.bar .in{max-width:880px;margin:0 auto;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.chk{display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600}.chk input{width:18px;height:18px;accent-color:#5D0EA6}
button{border:0;border-radius:999px;padding:13px 26px;font:900 15px Montserrat,system-ui,sans-serif;color:#2A0E52;background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);cursor:pointer}
button[disabled]{opacity:.6;cursor:wait}.saved{font-size:12px;color:var(--mut)}.err{color:#b42318;font-weight:700;font-size:14px}
.script{margin:0 0 16px;padding:14px 16px;border-radius:14px;background:#FDF6EA;border-left:4px solid var(--g);font-size:15px;line-height:1.55}
.script p{margin:0 0 8px}.script p:last-child,.script .ask:last-child{margin-bottom:0}.script ol{margin:4px 0 8px;padding-left:20px}.script li{margin:0 0 4px}
.script span{display:inline-block;min-width:40px;margin-right:8px;font-size:10px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;color:#9A5B00;vertical-align:1px}
.script .say{font-weight:600;color:#2a0d55}.script .tip{color:#5a5372;font-size:14px}
.mins{margin-left:auto;font-size:11px;font-weight:800;letter-spacing:1px;color:var(--mut);background:#f1ecf8;border-radius:999px;padding:4px 10px}
body.noscript .script{display:none}
.tog{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35);padding:8px 14px;font-size:13px;font-weight:800;margin-top:12px}
.known dl{margin:0;display:grid;gap:10px}.known dt{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--t)}.known dd{margin:2px 0 0;font-size:15px;line-height:1.5}
.bookw{margin-top:6px;padding:16px;border:1.5px dashed var(--g);border-radius:14px;background:#FFFBF3}.ghost{background:#fff;border:1.5px solid var(--p);color:var(--p);padding:10px 18px;font-size:14px}.tday{margin:12px 0 6px;font-size:12px;font-weight:800;color:var(--mut)}.tchip{padding:8px 13px;font-size:13px;font-weight:700;background:#faf8fd;border:1.5px solid var(--line);color:var(--ink)}.tchip.arm{background:linear-gradient(110deg,var(--p),var(--t));color:#fff;border-color:var(--p)}
.done{text-align:center;padding:40px 24px}.done h2{justify-content:center;font-size:24px}
@media (max-width:640px){.grid{grid-template-columns:1fr}.f.half{grid-column:1/-1}}
</style></head><body>${inner}</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

export function field([k, lab, type, extra], i) {
  const id = `f_${k}`;
  if (type === 'text') return `<div class="f ${/^pri/.test(k) ? '' : 'half'}"><label class="l" for="${id}">${esc(lab)}${extra ? ` <span class="help">${esc(extra)}</span>` : ''}</label><input type="text" id="${id}" name="${k}"></div>`;
  if (type === 'area') return `<div class="f"><label class="l" for="${id}">${esc(lab)}${extra ? ` <span class="help">${esc(extra)}</span>` : ''}</label><textarea id="${id}" name="${k}"></textarea></div>`;
  if (type === 'chips' || type === 'multi') {
    const t = type === 'chips' ? 'radio' : 'checkbox';
    return `<div class="f"><label class="l">${esc(lab)}</label><div class="chips">${extra.map((o, j) => `<label><input type="${t}" id="${id}_${j}" name="${k}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div></div>`;
  }
  if (type === 'score') return `<div class="f"><div class="score"><span class="nm">${esc(lab)}${extra ? `<small style="display:block;font-weight:500;font-size:12px;color:var(--mut)">${esc(extra)}</small>` : ''}</span><div class="chips">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" id="${id}_${n}" name="${k}" value="${n}"><span>${n}</span></label>`).join('')}</div></div></div>`;
  return '';
}

async function lookup(env, tok) {
  if (!env.REPORTS || !/^[a-z0-9]{8,24}$/.test(tok)) return null;
  const raw = await env.REPORTS.get(`fittok:${tok}`);
  return raw ? JSON.parse(raw) : null;
}

export async function fittingRoute(req, env, x, ctx) {
  const url = new URL(req.url);
  const tok = url.pathname.split('/')[2] || '';
  const ref = await lookup(env, tok);
  if (!ref) return page('Not found', '<div class="wrap" style="margin-top:60px"><div class="card done"><h2>This link is not valid</h2><p>Open the Crown Fitting Notes link from the deal in HubSpot.</p></div></div>');
  const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${ref.contactId}?properties=email,firstname,lastname,company`);
  const cp = contact.properties || {};
  const who = [cp.firstname, cp.lastname].filter(Boolean).join(' ') || cp.email;

  const sub = url.pathname.split('/')[3] || '';
  if (sub === 'times' && req.method === 'GET') {
    try { return new Response(JSON.stringify({ times: await openTimes(env, 'walkthrough') }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
    catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
  }
  if (sub === 'book' && req.method === 'POST') {
    let b = {}; try { b = await req.json(); } catch {}
    try {
      const r = await bookDirect(env, x, 'walkthrough', { dealId: ref.dealId, contactId: contact.id, company: cp.company || '', firstName: cp.firstname, name: who, email: cp.email }, String(b.start || ''));
      return new Response(JSON.stringify({ ok: true, message: `Booked for ${r.text}. ${esc(cp.firstname || 'They')} will get the invite from michael@markitmike.com now, and the Snapshot email will confirm the time instead of offering new ones.` }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
  }
  if (req.method === 'POST') return save(req, env, x, ref, contact, who, ctx);

  const done = await env.REPORTS.get(`fitdone:${ref.dealId}`);
  const known = await contextPanel(env, x, ref, cp);
  const mins = (m) => (m ? `<span class="mins">${m} min</span>` : '');
  const bookBox = calendarReady(env) ? `<div class="bookw" id="bookw"><label class="l">Book the plan walkthrough now <span class="help">45 minutes on Google Meet. The invite goes out the moment you pick.</span></label><button type="button" class="ghost" id="showt">Show open times</button><div id="tlist"></div><p class="saved" id="tmsg"></p></div>` : '';
  const sections = known + FIT_SECTIONS.map((s, i) => `<section class="card"><h2><b>${i + 1}</b>${esc(s.t)}${mins(s.mins)}</h2>${scriptBox(s, cp.firstname)}${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}<div class="grid">${s.f.map(field).join('')}</div>${i === FIT_SECTIONS.length - 1 ? bookBox : ''}</section>`).join('');
  const when = ref.start ? new Date(ref.start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' PT' : '';
  return page(`Crown Fitting: ${who}`, `<div class="top"><div class="in"><div class="eb">CROWN FITTING NOTES</div><h1>${esc(who)}${cp.company ? ' · ' + esc(cp.company) : ''}</h1><p class="sub">${when ? esc(when) + '. ' : ''}${done ? '<b>Already submitted.</b> Submitting again adds a new note but does not resend the thank you email.' : 'Answers save in this browser as you type. Click Submit when the call ends.'}</p><button type="button" class="tog" id="tog">Hide script</button></div></div>
<form id="fit" class="wrap" novalidate>${sections}</form>
<div class="bar"><div class="in"><label class="chk"><input type="checkbox" id="thanks" ${done ? '' : 'checked'}> Send the thank you email to ${esc(cp.firstname || 'them')}</label><span class="saved" id="saved"></span><span class="err" id="err" hidden></span><button type="button" id="go">Submit Crown Fitting</button></div></div>
<script>
(function(){
var f=document.getElementById('fit'),KEY='mmafit-${tok}',saved=document.getElementById('saved'),err=document.getElementById('err'),go=document.getElementById('go');
function data(){var o={};[].forEach.call(f.elements,function(el){if(!el.name)return;if(el.type==='radio'){if(el.checked)o[el.name]=el.value;}else if(el.type==='checkbox'){if(el.checked)(o[el.name]=o[el.name]||[]).push(el.value);}else if(el.value.trim())o[el.name]=el.value;});return o;}
function fill(o){[].forEach.call(f.elements,function(el){var v=o[el.name];if(v==null)return;if(el.type==='radio')el.checked=el.value===v;else if(el.type==='checkbox')el.checked=[].concat(v).indexOf(el.value)>=0;else el.value=v;});}
try{fill(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){}
var tog=document.getElementById('tog');function setS(h){document.body.classList.toggle('noscript',h);tog.textContent=h?'Show script':'Hide script';}
try{setS(localStorage.getItem('mmafit-noscript')==='1');}catch(e){}
tog.addEventListener('click',function(){var h=!document.body.classList.contains('noscript');setS(h);try{localStorage.setItem('mmafit-noscript',h?'1':'0');}catch(e){}});
var t;f.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){try{localStorage.setItem(KEY,JSON.stringify(data()));saved.textContent='Saved in this browser';}catch(e){}},400);});
var st=document.getElementById('showt');if(st){var tl=document.getElementById('tlist'),tm=document.getElementById('tmsg');
st.addEventListener('click',function(){st.disabled=true;st.textContent='Loading times...';fetch(location.pathname+'/times').then(function(r){return r.json();}).then(function(d){st.style.display='none';if(d.error||!d.times||!d.times.length){tm.textContent=d.error||'No open times found in the next two weeks.';return;}
var by={};d.times.forEach(function(t){(by[t.day]=by[t.day]||[]).push(t);});tl.innerHTML=Object.keys(by).slice(0,6).map(function(day){return '<p class="tday">'+day+'</p><div class="chips">'+by[day].map(function(t){return '<button type="button" class="tchip" data-s="'+t.start+'" data-l="'+day+' at '+t.time+'">'+t.time+'</button>';}).join('')+'</div>';}).join('');}).catch(function(){st.disabled=false;st.textContent='Show open times';tm.textContent='Could not load times. Try again.';});});
tl&&tl.addEventListener('click',function(e){var b=e.target.closest('.tchip');if(!b)return;if(b.classList.contains('arm')){tl.querySelectorAll('.tchip').forEach(function(c){c.disabled=true;});tm.textContent='Booking...';
fetch(location.pathname+'/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:b.getAttribute('data-s')})}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error);return d;});}).then(function(d){tl.innerHTML='';tm.innerHTML='<b style="color:#108193">'+d.message+'</b>';}).catch(function(er){tm.textContent=er.message+'. Pick another time.';tl.querySelectorAll('.tchip').forEach(function(c){c.disabled=false;});});return;}
tl.querySelectorAll('.tchip.arm').forEach(function(c){c.classList.remove('arm');c.textContent=c.getAttribute('data-l').split(' at ')[1];});b.classList.add('arm');b.textContent='Click again to book '+b.getAttribute('data-l');tm.textContent='';});}
go.addEventListener('click',function(){err.hidden=true;go.disabled=true;go.textContent='Submitting...';
fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers:data(),thanks:document.getElementById('thanks').checked})})
.then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Something went wrong');return d;});})
.then(function(d){try{localStorage.removeItem(KEY);}catch(e){}document.body.innerHTML='<div class="wrap" style="margin-top:60px"><div class="card done"><h2>Crown Fitting saved</h2><p>'+d.message+'</p><p><a href="'+d.hubspot+'" style="color:#5D0EA6;font-weight:800">Open the deal in HubSpot</a></p></div></div>';window.scrollTo(0,0);})
.catch(function(e){go.disabled=false;go.textContent='Submit Crown Fitting';err.textContent=e.message+'. Your answers are still saved here, try again.';err.hidden=false;});});
})();
</script>`);
}

export function answersToHtml(a) {
  const rows = [];
  for (const s of FIT_SECTIONS) {
    const items = s.f.map(([k, lab]) => {
      const v = a[k];
      if (v == null || (Array.isArray(v) && !v.length) || v === '') return '';
      const val = Array.isArray(v) ? v.join(', ') : String(v);
      return `<li><b>${esc(lab)}:</b> ${esc(val).replace(/\n/g, '<br>')}</li>`;
    }).filter(Boolean);
    if (items.length) rows.push(`<p><b>${esc(s.t)}</b></p><ul>${items.join('')}</ul>`);
  }
  return rows.join('');
}

export function answersToMarkdown(a) {
  const out = [];
  for (const s of FIT_SECTIONS) {
    const items = s.f.map(([k, lab]) => {
      const v = a[k];
      if (v == null || (Array.isArray(v) && !v.length) || v === '') return '';
      return `- **${lab}:** ${Array.isArray(v) ? v.join(', ') : String(v).replace(/\n+/g, ' ')}`;
    }).filter(Boolean);
    if (items.length) out.push(`### ${s.t}\n${items.join('\n')}`);
  }
  return out.join('\n\n');
}

async function save(req, env, x, ref, contact, who, ctx) {
  let body = {};
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 }); }
  const a = {};
  const keys = new Set(FIT_SECTIONS.flatMap((s) => s.f.map((f) => f[0])));
  for (const [k, v] of Object.entries(body.answers || {})) if (keys.has(k)) a[k] = Array.isArray(v) ? v.slice(0, 10).map((s) => String(s).slice(0, 200)) : String(v).slice(0, 4000);
  if (!Object.keys(a).length) return new Response(JSON.stringify({ error: 'Add at least a few notes first' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const cp = contact.properties || {};
  const dealId = ref.dealId;
  const already = await env.REPORTS.get(`fitdone:${dealId}`);
  const assoc = (c, d) => [
    { to: { id: String(contact.id) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: c }] },
    { to: { id: String(dealId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: d }] },
  ];
  const when = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const scores = CROWN_SCORES.map(([k]) => Number(a[k])).filter(Boolean);
  const avg = scores.length ? (scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(1) : null;

  // the note first: it is the record that matters
  await x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Crown Fitting notes</b> (${esc(when)} PT)${avg ? `, average score ${avg} of 5` : ''}${a.offer ? `, recommended: <b>${esc(a.offer)}</b>` : ''}</p>${answersToHtml(a)}` }, associations: assoc(202, 214) });
  await env.REPORTS.put(`fitans:${dealId}`, JSON.stringify({ at: Date.now(), answers: a, who, company: cp.company || '' }));

  const steps = [];
  const deal = await x.hs(env, 'GET', `/crm/v3/objects/deals/${dealId}?properties=dealstage,dealname`).catch(() => null);
  if (deal && x.stageRank(env, deal.properties.dealstage) < x.stageRank(env, HELD)) steps.push(x.setStage(env, dealId, HELD));
  if (!already && body.thanks && cp.email) steps.push(x.sendAndLog(env, { to: cp.email, contact, deal: { id: dealId }, ...fittingThanksEmail({ firstName: cp.firstname }) }));
  const hasSnap = await env.REPORTS.get(`snapdeal:${dealId}`);
  if (!already || !hasSnap) {
    const notFit = a.offer === 'Not a fit';
    const due = new Date(Date.now() + 864e5); due.setUTCHours(17, 0, 0, 0);
    const makeTask = (subject, bodyText) => x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: due.toISOString(), hs_task_subject: subject, hs_task_body: bodyText, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'EMAIL' }, associations: assoc(204, 216) });
    if (notFit) steps.push(makeTask(`Close out or nurture: ${cp.company || who}`, 'Marked Not a fit on the Crown Fitting. Send a kind close out or add them to the newsletter.'));
    else {
      // draft the Snapshot in the background so Submit returns right away
      const job = (async () => {
        const snap = await buildSnapshot(env, x, { dealId, contactId: contact.id, answers: a, who, company: cp.company || '', firstName: cp.firstname });
        const t = await makeTask(`Review and send Brand Experience Snapshot: ${cp.company || who}`, `Your Snapshot draft is ready: ${snap.url}\nClick any text to edit it, then Approve and send.${a.offer ? ` Recommended: ${a.offer}.` : ''}`);
        const tok = await env.REPORTS.get(`snapdeal:${dealId}`);
        const rec = tok && (await env.REPORTS.get(`snap:${tok}`, 'json'));
        if (rec && t?.id) { rec.taskId = t.id; await env.REPORTS.put(`snap:${tok}`, JSON.stringify(rec)); }
      })().catch((e) => console.error('snapshot job', e.message));
      if (ctx && ctx.waitUntil) ctx.waitUntil(job); else steps.push(job);
    }
  }
  (await Promise.allSettled(steps)).forEach((r) => r.status === 'rejected' && console.error('fitting save', r.reason && r.reason.message));
  await env.REPORTS.put(`fitdone:${dealId}`, String(Date.now()));
  const msg = already && hasSnap ? 'Your updated notes were added to the deal.' : `Notes are on the deal, it moved to Crown Fitting Held${body.thanks && cp.email ? `, ${esc(cp.firstname || 'they')} got the thank you email` : ''}, and your Brand Experience Snapshot draft will be ready in HubSpot in about a minute.`;
  return new Response(JSON.stringify({ ok: true, message: msg, hubspot: `https://app-na2.hubspot.com/contacts/246716405/record/0-3/${dealId}` }), { headers: { 'Content-Type': 'application/json' } });
}

// hourly: "did they show?" tasks and no show rebooking emails
export async function fittingFollowups(env, x) {
  if (!env.REPORTS) return;
  const last = Number(await env.REPORTS.get('fit:lastFollowup')) || 0;
  if (Date.now() - last < 55 * 60e3) return;
  await env.REPORTS.put('fit:lastFollowup', String(Date.now()));
  const r = await x.hs(env, 'POST', '/crm/v3/objects/meetings/search', {
    filterGroups: [{ filters: [
      { propertyName: 'hs_meeting_start_time', operator: 'GTE', value: String(Date.now() - 3 * 864e5) },
      { propertyName: 'hs_meeting_start_time', operator: 'LTE', value: String(Date.now() - 2 * 36e5) },
    ] }],
    properties: ['hs_meeting_title', 'hs_meeting_start_time', 'hs_meeting_outcome'], limit: 50,
  });
  for (const m of r.results || []) {
    if (!/crown fitting/i.test(m.properties.hs_meeting_title || '')) continue;
    const outcome = String(m.properties.hs_meeting_outcome || '').toUpperCase();
    if (outcome === 'CANCELED' || outcome === 'RESCHEDULED') continue;
    const a = await x.hs(env, 'GET', `/crm/v4/objects/meetings/${m.id}/associations/contacts`);
    const cid = a.results?.[0]?.toObjectId;
    if (!cid) continue;
    const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${cid}?properties=email,firstname,lastname,company`);
    const email = contact.properties?.email;
    if (!email || email === env.OWNER_EMAIL) continue;
    const found = await x.dealForEmail(env, email);
    const dealId = found?.deal?.id;
    if (outcome === 'NO_SHOW') {
      if (await env.REPORTS.get(`noshow:${m.id}`)) continue;
      await x.sendAndLog(env, { to: email, contact, deal: found?.deal, ...noShowEmail({ firstName: contact.properties.firstname }) });
      await env.REPORTS.put(`noshow:${m.id}`, String(Date.now()));
      continue;
    }
    if (dealId && !(await env.REPORTS.get(`fitdone:${dealId}`)) && !(await env.REPORTS.get(`fitask:${m.id}`))) {
      const who = [contact.properties.firstname, contact.properties.lastname].filter(Boolean).join(' ') || email;
      const link = await ensureFittingLink(env, x, { dealId, contact, meeting: m });
      await x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: new Date().toISOString(), hs_task_subject: `Did ${who} show up for the Crown Fitting?`, hs_task_body: `If yes, submit the Crown Fitting Notes: ${link}\nIf not, open the meeting in HubSpot and set the outcome to No show. The rebooking email goes out automatically.`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'TODO' },
        associations: [{ to: { id: String(cid) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }] }, { to: { id: String(dealId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }] }] });
      await env.REPORTS.put(`fitask:${m.id}`, String(Date.now()));
    }
  }
}

// daily: website leads who have not booked get a nudge on day 3 and day 7
export async function leadNudges(env, x) {
  if (!env.REPORTS) return;
  const r = await x.hs(env, 'POST', '/crm/v3/objects/deals/search', {
    filterGroups: [{ filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: PROSPECT },
      { propertyName: 'dealname', operator: 'CONTAINS_TOKEN', value: 'lead' },
      { propertyName: 'createdate', operator: 'GTE', value: String(Date.now() - 8.5 * 864e5) },
    ] }],
    properties: ['dealname', 'createdate', 'dealstage'], limit: 50,
  });
  for (const deal of r.results || []) {
    if (!/\| Website lead$/.test(deal.properties.dealname || '')) continue;
    const days = Math.floor((Date.now() - new Date(deal.properties.createdate).getTime()) / 864e5);
    if (days !== 3 && days !== 7) continue;
    const key = `nudge:${deal.id}:${days}`;
    if (await env.REPORTS.get(key)) continue;
    const ca = await x.hs(env, 'GET', `/crm/v4/objects/deals/${deal.id}/associations/contacts`);
    const cid = ca.results?.[0]?.toObjectId;
    if (!cid) continue;
    const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${cid}?properties=email,firstname,hs_lead_status,lifecyclestage`);
    const cp = contact.properties || {};
    if (!cp.email || cp.lifecyclestage === 'other' || ['UNQUALIFIED', 'CONNECTED', 'IN_PROGRESS'].includes(cp.hs_lead_status)) { await env.REPORTS.put(key, 'skipped'); continue; }
    // already talking? any email from them since the inquiry means a human conversation is under way
    const em = await x.hs(env, 'POST', '/crm/v3/objects/emails/search', {
      filterGroups: [{ filters: [{ propertyName: 'hs_email_direction', operator: 'EQ', value: 'INCOMING_EMAIL' }, { propertyName: 'hs_email_from_email', operator: 'EQ', value: cp.email }, { propertyName: 'hs_createdate', operator: 'GTE', value: String(new Date(deal.properties.createdate).getTime()) }] }], limit: 1,
    }).catch(() => ({ total: 0 }));
    if (em.total) { await env.REPORTS.put(key, 'talking'); continue; }
    await x.sendAndLog(env, { to: cp.email, contact, deal, ...leadNudgeEmail({ firstName: cp.firstname, second: days === 7 }) });
    await env.REPORTS.put(key, String(Date.now()));
  }
}
