// Crown Fitting Notes: a private form Markit Mike fills in during the call.
//   GET  /fitting/<token>  the form (token is created when the Crown Fitting is booked)
//   POST /fitting/<token>  save: formatted note on the deal and contact, deal to Crown Fitting Held,
//                          thank you email, "Review and send Snapshot" task, answers kept for the Snapshot and ClickUp
// Also here: the link and prep task at booking, "did they show?" tasks, the no show rebooking email,
// and the day 3 and day 7 nudges for website leads who have not booked.
import { fittingThanksEmail, noShowEmail, leadNudgeEmail } from './emails.js';

const WORKER = 'https://mma-automations.markitmike.workers.dev';
const HELD = 'decisionmakerboughtin';
const BOOKED = 'presentationscheduled';
const PROSPECT = 'appointmentscheduled';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const FIT_SECTIONS = [
  { t: 'The business', f: [
    ['locations', 'Locations today', 'text', 'Number of locations and where'],
    ['ownership', 'Ownership model', 'chips', ['Company owned', 'Franchised', 'Mixed', 'Single location']],
    ['growth', 'Growth plans, next 12 months', 'area', 'New units, new markets, remodels, new concepts'],
  ] },
  { t: 'Goals', f: [
    ['win90', 'What does a win look like in 90 days?', 'area', 'In their words'],
    ['pri1', 'Priority 1', 'text'], ['pri2', 'Priority 2', 'text'], ['pri3', 'Priority 3', 'text'],
  ] },
  { t: 'Current marketing', f: [
    ['who', 'Who handles marketing today', 'multi', ['In house team', 'Agency', 'Freelancers', 'Owner or founder', 'Nobody']],
    ['budget', 'Monthly marketing budget', 'chips', ['Under $2K', '$2K to $5K', '$5K to $10K', '$10K to $25K', '$25K plus', 'Not sure']],
    ['working', 'What is working', 'area'],
    ['notworking', 'What is not working', 'area'],
  ] },
  { t: 'Customer experience', f: [
    ['loyalty', 'Loyalty program', 'chips', ['App based', 'POS or punch card', 'None', 'Not sure']],
    ['rating', 'Average review rating', 'text', 'For example 4.3 on Google'],
    ['ordering', 'Online ordering or app', 'chips', ['Own app', 'Third party only', 'Both', 'None']],
    ['webnotes', 'Website and Google profile notes', 'area'],
  ] },
  { t: 'Pain point', f: [
    ['pain', 'The thing keeping them up at night', 'area', 'Capture it in their words'],
  ] },
  { t: 'Quick scores', note: '1 is weak, 5 is strong. These feed the Brand Experience Snapshot.', f: [
    ['s_brand', 'Brand', 'score'], ['s_digital', 'Digital presence', 'score'], ['s_loyalty', 'Loyalty and retention', 'score'],
    ['s_lsm', 'Local store marketing', 'score'], ['s_reviews', 'Reviews and reputation', 'score'],
  ] },
  { t: 'Decision and timing', f: [
    ['decider', 'Who decides', 'text', 'Names and roles'],
    ['comfort', 'Budget comfort', 'chips', ['Ready now', 'Needs approval', 'Tight']],
    ['timeline', 'Timeline', 'chips', ['This month', '30 to 60 days', '60 to 90 days', 'Later']],
    ['competing', 'Other options they are considering', 'text'],
  ] },
  { t: 'Recommendation', f: [
    ['offer', 'Recommended next step', 'chips', ['Brand Checkup', 'Glow Up', 'Gold Starter', 'Platinum Accelerator', 'Crown Jewel', 'Not a fit']],
    ['next', 'Next steps you agreed on', 'area'],
    ['notes', 'Anything else', 'area'],
  ] },
];

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

function page(title, inner) {
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
.score{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.score .nm{min-width:190px;font-weight:700;font-size:14px}
.bar{position:sticky;bottom:0;background:rgba(244,241,248,.96);backdrop-filter:blur(6px);border-top:1px solid var(--line);padding:12px max(16px,env(safe-area-inset-left)) calc(12px + env(safe-area-inset-bottom))}
.bar .in{max-width:880px;margin:0 auto;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.chk{display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600}.chk input{width:18px;height:18px;accent-color:#5D0EA6}
button{border:0;border-radius:999px;padding:13px 26px;font:900 15px Montserrat,system-ui,sans-serif;color:#2A0E52;background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);cursor:pointer}
button[disabled]{opacity:.6;cursor:wait}.saved{font-size:12px;color:var(--mut)}.err{color:#b42318;font-weight:700;font-size:14px}
.done{text-align:center;padding:40px 24px}.done h2{justify-content:center;font-size:24px}
@media (max-width:640px){.grid{grid-template-columns:1fr}.f.half{grid-column:1/-1}}
</style></head><body>${inner}</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

function field([k, lab, type, extra], i) {
  const id = `f_${k}`;
  if (type === 'text') return `<div class="f ${/^pri/.test(k) ? '' : 'half'}"><label class="l" for="${id}">${esc(lab)}${extra ? ` <span class="help">${esc(extra)}</span>` : ''}</label><input type="text" id="${id}" name="${k}"></div>`;
  if (type === 'area') return `<div class="f"><label class="l" for="${id}">${esc(lab)}${extra ? ` <span class="help">${esc(extra)}</span>` : ''}</label><textarea id="${id}" name="${k}"></textarea></div>`;
  if (type === 'chips' || type === 'multi') {
    const t = type === 'chips' ? 'radio' : 'checkbox';
    return `<div class="f"><label class="l">${esc(lab)}</label><div class="chips">${extra.map((o, j) => `<label><input type="${t}" id="${id}_${j}" name="${k}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div></div>`;
  }
  if (type === 'score') return `<div class="f"><div class="score"><span class="nm">${esc(lab)}</span><div class="chips">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" id="${id}_${n}" name="${k}" value="${n}"><span>${n}</span></label>`).join('')}</div></div></div>`;
  return '';
}

async function lookup(env, tok) {
  if (!env.REPORTS || !/^[a-z0-9]{8,24}$/.test(tok)) return null;
  const raw = await env.REPORTS.get(`fittok:${tok}`);
  return raw ? JSON.parse(raw) : null;
}

export async function fittingRoute(req, env, x) {
  const url = new URL(req.url);
  const tok = url.pathname.split('/')[2] || '';
  const ref = await lookup(env, tok);
  if (!ref) return page('Not found', '<div class="wrap" style="margin-top:60px"><div class="card done"><h2>This link is not valid</h2><p>Open the Crown Fitting Notes link from the deal in HubSpot.</p></div></div>');
  const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${ref.contactId}?properties=email,firstname,lastname,company`);
  const cp = contact.properties || {};
  const who = [cp.firstname, cp.lastname].filter(Boolean).join(' ') || cp.email;

  if (req.method === 'POST') return save(req, env, x, ref, contact, who);

  const done = await env.REPORTS.get(`fitdone:${ref.dealId}`);
  const sections = FIT_SECTIONS.map((s, i) => `<section class="card"><h2><b>${i + 1}</b>${esc(s.t)}</h2>${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}<div class="grid">${s.f.map(field).join('')}</div></section>`).join('');
  const when = ref.start ? new Date(ref.start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' PT' : '';
  return page(`Crown Fitting: ${who}`, `<div class="top"><div class="in"><div class="eb">CROWN FITTING NOTES</div><h1>${esc(who)}${cp.company ? ' · ' + esc(cp.company) : ''}</h1><p class="sub">${when ? esc(when) + '. ' : ''}${done ? '<b>Already submitted.</b> Submitting again adds a new note but does not resend the thank you email.' : 'Answers save in this browser as you type. Click Submit when the call ends.'}</p></div></div>
<form id="fit" class="wrap" novalidate>${sections}</form>
<div class="bar"><div class="in"><label class="chk"><input type="checkbox" id="thanks" ${done ? '' : 'checked'}> Send the thank you email to ${esc(cp.firstname || 'them')}</label><span class="saved" id="saved"></span><span class="err" id="err" hidden></span><button type="button" id="go">Submit Crown Fitting</button></div></div>
<script>
(function(){
var f=document.getElementById('fit'),KEY='mmafit-${tok}',saved=document.getElementById('saved'),err=document.getElementById('err'),go=document.getElementById('go');
function data(){var o={};[].forEach.call(f.elements,function(el){if(!el.name)return;if(el.type==='radio'){if(el.checked)o[el.name]=el.value;}else if(el.type==='checkbox'){if(el.checked)(o[el.name]=o[el.name]||[]).push(el.value);}else if(el.value.trim())o[el.name]=el.value;});return o;}
function fill(o){[].forEach.call(f.elements,function(el){var v=o[el.name];if(v==null)return;if(el.type==='radio')el.checked=el.value===v;else if(el.type==='checkbox')el.checked=[].concat(v).indexOf(el.value)>=0;else el.value=v;});}
try{fill(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){}
var t;f.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){try{localStorage.setItem(KEY,JSON.stringify(data()));saved.textContent='Saved in this browser';}catch(e){}},400);});
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

async function save(req, env, x, ref, contact, who) {
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
  const scores = ['s_brand', 's_digital', 's_loyalty', 's_lsm', 's_reviews'].map((k) => Number(a[k])).filter(Boolean);
  const avg = scores.length ? (scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(1) : null;

  // the note first: it is the record that matters
  await x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Crown Fitting notes</b> (${esc(when)} PT)${avg ? `, average score ${avg} of 5` : ''}${a.offer ? `, recommended: <b>${esc(a.offer)}</b>` : ''}</p>${answersToHtml(a)}` }, associations: assoc(202, 214) });
  await env.REPORTS.put(`fitans:${dealId}`, JSON.stringify({ at: Date.now(), answers: a, who, company: cp.company || '' }));

  const steps = [];
  const deal = await x.hs(env, 'GET', `/crm/v3/objects/deals/${dealId}?properties=dealstage,dealname`).catch(() => null);
  if (deal && x.stageRank(env, deal.properties.dealstage) < x.stageRank(env, HELD)) steps.push(x.setStage(env, dealId, HELD));
  if (!already && body.thanks && cp.email) steps.push(x.sendAndLog(env, { to: cp.email, contact, deal: { id: dealId }, ...fittingThanksEmail({ firstName: cp.firstname }) }));
  if (!already) {
    const due = new Date(Date.now() + 864e5); due.setUTCHours(17, 0, 0, 0);
    const notFit = a.offer === 'Not a fit';
    steps.push(x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: {
      hs_timestamp: due.toISOString(),
      hs_task_subject: notFit ? `Close out or nurture: ${cp.company || who}` : `Review and send Brand Experience Snapshot: ${cp.company || who}`,
      hs_task_body: notFit ? 'Marked Not a fit on the Crown Fitting. Send a kind close out or add them to the newsletter.' : `Crown Fitting notes are on the deal${a.offer ? `. Recommended: ${a.offer}` : ''}. Build the Snapshot, review it, then send it with the Thank You + Snapshot template.`,
      hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'EMAIL' }, associations: assoc(204, 216) }));
  }
  (await Promise.allSettled(steps)).forEach((r) => r.status === 'rejected' && console.error('fitting save', r.reason && r.reason.message));
  await env.REPORTS.put(`fitdone:${dealId}`, String(Date.now()));
  const msg = already ? 'Your updated notes were added to the deal.' : `Notes are on the deal, it moved to Crown Fitting Held${body.thanks && cp.email ? `, ${esc(cp.firstname || 'they')} got the thank you email` : ''}, and your Snapshot task is due tomorrow.`;
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
