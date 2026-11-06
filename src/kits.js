// Meeting kits: one scripted notes form per meeting type, same look as the Crown Fitting Notes.
//   GET  /kit/<token>   the form (token is created when the meeting is booked, see ensureKitLink)
//   POST /kit/<token>   save: note on the deal and contact, answers kept, and the kit's own next steps
//
//   walkthrough  Plan Walkthrough     outcome drives the next step (send agreement, revise, follow up, close out)
//   kickoff      Kickoff Workshop     saves to ClickUp, picks the Builds, logs missing access, starts the timeline
//   monthly      Monthly Review       saves to ClickUp Reporting, turns next month's priorities into tasks
//   checkin      Quick Check In       saves to ClickUp, turns asks into tasks
import { page, field, scriptBox, contextPanel } from './fitting.js';
import { PLANS } from './plans.js';

const WORKER = 'https://mma-automations.markitmike.workers.dev';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const OFFERS = ['Brand Checkup', 'Glow Up', 'Gold Starter', 'Platinum Accelerator', 'Crown Jewel'];

export const KITS = {
  walkthrough: {
    name: 'Plan Walkthrough', eyebrow: 'PLAN WALKTHROUGH NOTES', match: /plan walkthrough/i,
    sections: [
      { t: 'Open and recap', mins: 5,
        say: "Thanks for making time again, {first}. Last time you told us what a win looks like for you. Today I'll walk you through what we saw, the plan we recommend, and what working together looks like. Stop me anytime.",
        ask: ['Has anything changed since we last spoke?', 'Who else is joining today, and what matters most to them?'],
        tip: 'Open their Snapshot on screen before you start. Use their own words from the Crown Fitting when you recap.',
        f: [['changes', 'What changed since the Crown Fitting', 'area'], ['attendees', 'Who joined', 'text', 'Names and roles']] },
      { t: 'Snapshot review', mins: 8,
        say: "Let's start with your Snapshot. I'll take the three observations one at a time.",
        ask: ['Does this match what you see day to day?', 'Which of these feels most urgent to you?'],
        tip: 'Ask, then pause. Their reaction tells you which part of the plan to lead with.',
        f: [['resonated', 'What landed with them', 'area', 'In their words'], ['urgent', 'Most urgent', 'chips', ['Observation 1', 'Observation 2', 'Observation 3', 'All of them']]] },
      { t: 'The plan', mins: 12,
        say: "Here's the plan we recommend, and why it fits what you told us.",
        ask: ['What would you change or add?', 'How does this fit the dates you mentioned?'],
        tip: 'Walk the scope one deliverable at a time and tie each one back to a goal or pain point they named.',
        f: [['offer', 'Plan discussed', 'chips', OFFERS], ['scope', 'Changes they asked for', 'area', 'Anything to add, remove or move']] },
      { t: 'Investment', mins: 6,
        say: 'The investment for this plan is [price]. [Payment terms].',
        ask: ['How does that sit with you?', 'Is there anything that would hold you back from starting?'],
        tip: 'Say the number, then stay quiet. Let them respond first.',
        f: [['reaction', 'Their reaction', 'chips', ['Comfortable', 'Needs approval', 'Concerned about price', 'Wants a smaller start']], ['objections', 'Questions or concerns', 'area']] },
      { t: 'Decision and start', mins: 8,
        say: "If this feels right, the next step is simple. We send the agreement today, you sign online, and your first payment link comes with it. We'd kick off within a week.",
        ask: ['Does it make sense to move forward?', 'Who signs the agreement, and at what email?', 'When would you like to start?'],
        f: [['outcome', 'Outcome', 'chips', ['Ready to sign', 'Needs proposal changes', 'Thinking it over', 'Not moving forward']],
          ['signer', 'Who signs', 'text', 'Full name and title'], ['signer_email', 'Signer email', 'text'], ['start', 'Preferred start', 'text', 'For example the week of Nov 16'],
          ['followup', 'What you agreed on next', 'area']] },
      { t: 'Close', mins: 3,
        say: "Thank you. Here's exactly what happens next: [the next step you just agreed on]. You'll hear from us today.",
        tip: 'If they are ready, send the agreement from SignWell right after the call. Submit this form first: it creates the task with the signer details.',
        f: [['notes', 'Anything else', 'area']] },
    ],
  },
  kickoff: {
    name: 'Kickoff Workshop', eyebrow: 'KICKOFF WORKSHOP NOTES', match: /kickoff/i,
    sections: [
      { t: 'Welcome and roles', mins: 5,
        say: "Welcome to the family, {first}! Today we lock in goals, dates and who does what, pick your first Builds, and leave with a clear first 30 days.",
        ask: ['Who is our main day to day contact?', 'Who approves work before it goes live?', 'How do you like to hear from us: email, text or a quick call?'],
        f: [['contact', 'Main contact', 'text', 'Name, title, best number'], ['approver', 'Who approves work', 'text'], ['channel', 'Preferred channel', 'multi', ['Email', 'Text', 'Phone']]] },
      { t: 'Goals and numbers', mins: 12,
        say: "Let's turn the goals you shared into numbers we can track every month.",
        ask: ['Where are these numbers today?', 'Where do you want them in 90 days?'],
        tip: 'Get a starting number for every goal. If they do not know it, add a task to pull it this week.',
        f: [['win90', 'What a win looks like in 90 days', 'area'],
          ['kpi1', 'Goal 1, start and target', 'text', 'For example Google reviews 212 to 300'], ['kpi2', 'Goal 2, start and target', 'text'], ['kpi3', 'Goal 3, start and target', 'text']] },
      { t: 'Key dates', mins: 6,
        say: "What's on the calendar that we should plan around?",
        ask: ['Any openings, remodels or menu launches coming up?', 'Big seasons, promotions or events?', 'Any blackout dates when your team is stretched?'],
        f: [['dates', 'Key dates', 'area', 'One per line: date, what it is']] },
      { t: 'Brand, assets and access', mins: 10,
        say: "To move fast we need the keys. Let's go down the list together.",
        tip: 'Check only what they already gave us. Everything left unchecked becomes a task in Assets and Access.',
        f: [['have', 'Already received', 'multi', ['Logo files', 'Brand guidelines', 'Photo library', 'Website login', 'Google Business Profile access', 'Yelp access', 'Social logins', 'POS or loyalty reports', 'Review platform access']], ['access_notes', 'Access notes', 'area', 'Who sends what, and by when']] },
      { t: 'First Builds', mins: 12,
        say: "Your plan includes Builds. Let's choose the first ones so we can start right away.",
        ask: ['Which of these would make the biggest difference first?', 'Is there anything time sensitive we should do first?'],
        f: [['build1', 'Build 1', 'text', 'For example new landing page for the grand opening'], ['build2', 'Build 2', 'text'], ['build_notes', 'Build notes', 'area']] },
      { t: 'First 30 days', mins: 10,
        say: "Here's what you'll see from us in the next 30 days, and when we'll meet next.",
        ask: ['Does this order make sense to you?', 'What would make the first month a win?'],
        tip: 'Agree on the date this plan starts. Every due date in ClickUp is set from it.',
        f: [['startdate', 'Plan start date', 'text', 'For example 2026-11-16 (defaults to today)'], ['first30', 'First 30 day priorities', 'area'], ['notes', 'Anything else', 'area']] },
    ],
  },
  monthly: {
    name: 'Monthly Review', eyebrow: 'MONTHLY CROWN REPORT REVIEW', match: /monthly (crown report )?review/i,
    sections: [
      { t: 'Wins', mins: 5, say: "Let's start with the good news from this month.", ask: ['What did you notice from your side?'], f: [['wins', 'Wins this month', 'area']] },
      { t: 'The numbers', mins: 10, say: "Here's where each goal stands against where we started.", ask: ['Does anything here surprise you?'], tip: 'Use the Monthly Crown Report on screen. Note any number the client questions.', f: [['numbers', 'Goal updates', 'area', 'Goal, last month, this month'], ['learned', 'What we learned', 'area']] },
      { t: 'How we are doing', mins: 5, say: 'Honest question: how are we doing for you?', ask: ['What should we keep doing?', 'What should we do differently?'], f: [['csat', 'Their rating of us', 'score'], ['feedback', 'Feedback', 'area', 'In their words']] },
      { t: 'Next month', mins: 8, say: "Here's what we recommend for next month.", ask: ['Anything you want to add or move up?'], tip: 'Every priority becomes a ClickUp task due within the month.', f: [['pri1', 'Priority 1', 'text'], ['pri2', 'Priority 2', 'text'], ['pri3', 'Priority 3', 'text'], ['asks', 'What we need from them', 'area', 'One per line']] },
      { t: 'Close', mins: 2, say: "Thank you, {first}. You'll get a short recap today.", f: [['notes', 'Anything else', 'area']] },
    ],
  },
  checkin: {
    name: 'Quick Check In', eyebrow: 'QUICK CHECK IN', match: /check in/i,
    sections: [
      { t: 'Progress', mins: 5, say: "Hi {first}, quick update from our side, then I'd love to hear yours.", ask: ['How are things going since we last spoke?'], f: [['progress', 'Progress shared', 'area']] },
      { t: 'Blockers and asks', mins: 7, say: 'Is anything in the way, or anything you need from us?', tip: 'Each line in "Their asks" becomes a ClickUp task. Each line in "What we need from them" goes into the recap.', f: [['asks', 'Their asks', 'area', 'One per line'], ['needs', 'What we need from them', 'area', 'One per line']] },
      { t: 'Next step', mins: 3, say: "Great. Here's what happens next.", f: [['next', 'Next step agreed', 'text'], ['notes', 'Anything else', 'area']] },
    ],
  },
};

export function kitForTitle(title) {
  const t = String(title || '');
  if (/crown fitting/i.test(t)) return null;
  for (const [k, kit] of Object.entries(KITS)) if (kit.match.test(t)) return k;
  return null;
}

function token() {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  return [...a].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

// called from meetingSync for every booked meeting whose title matches a kit
export async function ensureKitLink(env, x, { kit, dealId, contact, meeting }) {
  if (!env.REPORTS || !KITS[kit]) return null;
  const key = `kitmeet:${meeting?.id || `${kit}:${dealId}`}`;
  const existing = await env.REPORTS.get(key);
  if (existing) return `${WORKER}/kit/${existing}`;
  const tok = token();
  await env.REPORTS.put(`kittok:${tok}`, JSON.stringify({ kit, dealId: dealId ? String(dealId) : null, contactId: String(contact.id), meetingId: meeting?.id || null, start: meeting?.properties?.hs_meeting_start_time || null }));
  await env.REPORTS.put(key, tok);
  const url = `${WORKER}/kit/${tok}`;
  const p = contact.properties || {};
  const who = [p.firstname, p.lastname].filter(Boolean).join(' ') || p.email;
  const assoc = (c, d) => [{ to: { id: String(contact.id) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: c }] }, ...(dealId ? [{ to: { id: String(dealId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: d }] }] : [])];
  const name = KITS[kit].name;
  (await Promise.allSettled([
    x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>${esc(name)} notes form</b> for this meeting:</p><p><a href="${url}">${url}</a></p><p>Open it during the call and click Submit when you wrap up.</p>` }, associations: assoc(202, 214) }),
    x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: meeting?.properties?.hs_meeting_start_time || new Date().toISOString(), hs_task_subject: `${name} with ${who}: open the notes form`, hs_task_body: `Notes form: ${url}\nSubmit it when the call ends.`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'CALL' }, associations: assoc(204, 216) }),
  ])).forEach((r) => r.status === 'rejected' && console.error('kit link', r.reason && r.reason.message));
  return url;
}

export function kitToMarkdown(kit, a) {
  const out = [];
  for (const s of KITS[kit].sections) {
    const items = s.f.map(([k, lab]) => { const v = a[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) return ''; return `- **${lab}:** ${Array.isArray(v) ? v.join(', ') : String(v).replace(/\n+/g, '; ')}`; }).filter(Boolean);
    if (items.length) out.push(`### ${s.t}\n${items.join('\n')}`);
  }
  return out.join('\n\n');
}
function kitToHtml(kit, a) {
  return KITS[kit].sections.map((s) => {
    const items = s.f.map(([k, lab]) => { const v = a[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) return ''; return `<li><b>${esc(lab)}:</b> ${esc(Array.isArray(v) ? v.join(', ') : v).replace(/\n/g, '<br>')}</li>`; }).filter(Boolean);
    return items.length ? `<p><b>${esc(s.t)}</b></p><ul>${items.join('')}</ul>` : '';
  }).join('');
}
const lines = (t) => String(t || '').split('\n').map((l) => l.replace(/^[\s*•]+/, '').trim()).filter(Boolean);

export async function kitRoute(req, env, x, ctx) {
  const url = new URL(req.url);
  const tok = (url.pathname.split('/')[2] || '').replace(/[^a-z0-9]/g, '');
  const ref = tok && (await env.REPORTS.get(`kittok:${tok}`, 'json'));
  if (!ref || !KITS[ref.kit]) return page('Not found', '<div class="wrap" style="margin-top:60px"><div class="card done"><h2>This link is not valid</h2><p>Open the notes link from the deal in HubSpot.</p></div></div>');
  const kit = KITS[ref.kit];
  const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${ref.contactId}?properties=email,firstname,lastname,company`);
  const cp = contact.properties || {};
  const who = [cp.firstname, cp.lastname].filter(Boolean).join(' ') || cp.email;
  if (req.method === 'POST') return saveKit(req, env, x, ref, tok, contact, who, ctx);

  const done = await env.REPORTS.get(`kitdone:${tok}`);
  const known = ref.kit === 'walkthrough' ? await walkthroughContext(env, x, ref, cp) : await contextPanel(env, x, ref, cp);
  const mins = (m) => (m ? `<span class="mins">${m} min</span>` : '');
  const sections = known + kit.sections.map((s, i) => `<section class="card"><h2><b>${i + 1}</b>${esc(s.t)}${mins(s.mins)}</h2>${scriptBox(s, cp.firstname)}${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}<div class="grid">${s.f.map(field).join('')}</div></section>`).join('');
  const when = ref.start ? new Date(ref.start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' PT' : '';
  return page(`${kit.name}: ${who}`, `<div class="top"><div class="in"><div class="eb">${esc(kit.eyebrow)}</div><h1>${esc(who)}${cp.company ? ' · ' + esc(cp.company) : ''}</h1><p class="sub">${when ? esc(when) + '. ' : ''}${done ? '<b>Already submitted.</b> Submitting again adds a new note.' : 'Answers save in this browser as you type. Click Submit when the call ends.'}</p><button type="button" class="tog" id="tog">Hide script</button></div></div>
<form id="fit" class="wrap" novalidate>${sections}</form>
<div class="bar"><div class="in"><span class="saved" id="saved"></span><span class="err" id="err" hidden></span><button type="button" id="go">Submit ${esc(kit.name)}</button></div></div>
<script>
(function(){
var f=document.getElementById('fit'),KEY='mmakit-${tok}',saved=document.getElementById('saved'),err=document.getElementById('err'),go=document.getElementById('go'),label=go.textContent;
function data(){var o={};[].forEach.call(f.elements,function(el){if(!el.name)return;if(el.type==='radio'){if(el.checked)o[el.name]=el.value;}else if(el.type==='checkbox'){if(el.checked)(o[el.name]=o[el.name]||[]).push(el.value);}else if(el.value.trim())o[el.name]=el.value;});return o;}
function fill(o){[].forEach.call(f.elements,function(el){var v=o[el.name];if(v==null)return;if(el.type==='radio')el.checked=el.value===v;else if(el.type==='checkbox')el.checked=[].concat(v).indexOf(el.value)>=0;else el.value=v;});}
try{fill(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){}
var tog=document.getElementById('tog');function setS(h){document.body.classList.toggle('noscript',h);tog.textContent=h?'Show script':'Hide script';}
try{setS(localStorage.getItem('mmafit-noscript')==='1');}catch(e){}
tog.addEventListener('click',function(){var h=!document.body.classList.contains('noscript');setS(h);try{localStorage.setItem('mmafit-noscript',h?'1':'0');}catch(e){}});
var t;f.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){try{localStorage.setItem(KEY,JSON.stringify(data()));saved.textContent='Saved in this browser';}catch(e){}},400);});
go.addEventListener('click',function(){err.hidden=true;go.disabled=true;go.textContent='Submitting...';
fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers:data()})})
.then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Something went wrong');return d;});})
.then(function(d){try{localStorage.removeItem(KEY);}catch(e){}document.body.innerHTML='<div class="wrap" style="margin-top:60px"><div class="card done"><h2>${esc(kit.name)} saved</h2><p>'+d.message+'</p><p><a href="'+d.hubspot+'" style="color:#5D0EA6;font-weight:800">Open in HubSpot</a></p></div></div>';window.scrollTo(0,0);})
.catch(function(e){go.disabled=false;go.textContent=label;err.textContent=e.message+'. Your answers are still saved here, try again.';err.hidden=false;});});
})();
</script>`);
}

// the walkthrough opens with the Crown Fitting highlights and the Snapshot link
async function walkthroughContext(env, x, ref, cp) {
  const items = [];
  if (cp.company) items.push(['Company', cp.company]);
  const fit = ref.dealId && (await env.REPORTS.get(`fitans:${ref.dealId}`, 'json'));
  if (fit?.answers) {
    const a = fit.answers;
    if (a.win90) items.push(['Their 90 day win', a.win90]);
    if (a.pain) items.push(['What keeps them up at night', a.pain]);
    if (a.offer) items.push(['Recommended at the Crown Fitting', a.offer]);
    if (a.decider) items.push(['Who decides', a.decider]);
  }
  const stok = ref.dealId && (await env.REPORTS.get(`snapdeal:${ref.dealId}`));
  const snap = stok && (await env.REPORTS.get(`snap:${stok}`, 'json'));
  const links = snap ? `<p style="margin:14px 0 0"><a href="${WORKER}/s/${snap.pub}" target="_blank" rel="noopener" style="color:#5D0EA6;font-weight:800">Open their Snapshot</a>${snap.openedAt ? ` <span class="help">They first opened it ${esc(new Date(snap.openedAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }))}.</span>` : ' <span class="help">They have not opened it yet.</span>'}</p>` : '';
  const plan = fit?.answers?.offer && PLANS.find((p) => p.match.test(fit.answers.offer));
  if (plan) items.push(['Investment and terms', plan.terms]);
  if (!items.length) items.push(['Before the call', 'No Crown Fitting notes on file for this deal.']);
  return `<section class="card known"><h2><b>&#9733;</b>What we already know</h2><dl>${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${links}</section>`;
}

async function saveKit(req, env, x, ref, tok, contact, who, ctx) {
  const kit = KITS[ref.kit];
  let body = {};
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const a = {};
  const keys = new Set(kit.sections.flatMap((s) => s.f.map((f) => f[0])));
  for (const [k, v] of Object.entries(body.answers || {})) if (keys.has(k)) a[k] = Array.isArray(v) ? v.slice(0, 12).map((s) => String(s).slice(0, 200)) : String(v).slice(0, 4000);
  if (!Object.keys(a).length) return json({ error: 'Add at least a few notes first' }, 400);
  const cp = contact.properties || {};
  const dealId = ref.dealId;
  const company = cp.company || who;
  const assoc = (c, d) => [{ to: { id: String(contact.id) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: c }] }, ...(dealId ? [{ to: { id: String(dealId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: d }] }] : [])];
  const when = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  await x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>${esc(kit.name)} notes</b> (${esc(when)} PT)${a.outcome ? `, outcome: <b>${esc(a.outcome)}</b>` : ''}</p>${kitToHtml(ref.kit, a)}` }, associations: assoc(202, 214) });
  await env.REPORTS.put(`kitans:${ref.kit}:${dealId || ref.contactId}`, JSON.stringify({ at: Date.now(), answers: a, who, company }));
  const task = (subject, text, days = 0, type = 'TODO') => { const due = new Date(Date.now() + days * 864e5); due.setUTCHours(17, 0, 0, 0); return x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: due.toISOString(), hs_task_subject: subject, hs_task_body: text, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: type }, associations: assoc(204, 216) }); };
  const steps = []; let msg = 'Notes are on the deal.';
  const lists = dealId ? await env.REPORTS.get(`cu:${dealId}`, 'json') : null;
  const cuTask = (listKey, name, md, extra = {}) => lists?.[listKey]?.id ? x.cu(env, 'POST', `/list/${lists[listKey].id}/task`, { name, markdown_description: md, ...extra }) : Promise.resolve(null);
  const dateLabel = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' });

  if (ref.kit === 'walkthrough') {
    const o = a.outcome || '';
    if (o === 'Ready to sign') {
      steps.push(task(`Send the agreement in SignWell: ${company}`, `Plan: ${a.offer || 'see notes'}\nSigner: ${a.signer || who}\nSigner email: ${a.signer_email || cp.email || ''}\nPreferred start: ${a.start || 'not set'}\n${a.scope ? `Scope changes: ${a.scope}\n` : ''}When SignWell sends it, the deal moves to Agreement Sent and the branded email goes out on its own.`, 0, 'EMAIL'));
      msg = 'Notes are on the deal, and a task with the signer details is waiting for you. Send the agreement from SignWell next.';
    } else if (o === 'Needs proposal changes') {
      steps.push(task(`Revise the proposal: ${company}`, `Changes they asked for:\n${a.scope || a.objections || 'see notes'}`, 1, 'EMAIL'));
      msg = 'Notes are on the deal, and a task to revise the proposal is due tomorrow.';
    } else if (o === 'Thinking it over') {
      steps.push(task(`Follow up on the plan: ${company}`, `They are thinking it over.\nConcerns: ${a.objections || 'none noted'}\nAgreed next: ${a.followup || 'not noted'}`, 2, 'CALL'));
      msg = 'Notes are on the deal, and a follow up call task is set for 2 days from now.';
    } else if (o === 'Not moving forward') {
      steps.push(task(`Close out kindly: ${company}`, 'They are not moving forward. Send a thank you, invite them to the Crown Blog, then mark the deal Closed Lost.', 1, 'EMAIL'));
      msg = 'Notes are on the deal, and a close out task is set for tomorrow.';
    }
  }

  if (ref.kit === 'kickoff') {
    const missing = ['Logo files', 'Brand guidelines', 'Photo library', 'Website login', 'Google Business Profile access', 'Yelp access', 'Social logins', 'POS or loyalty reports', 'Review platform access'].filter((i) => !(a.have || []).includes(i));
    steps.push(cuTask('Onboarding', `Kickoff notes: ${company} (${dateLabel})`, kitToMarkdown('kickoff', a)));
    for (const m of missing) steps.push(cuTask('Assets and Access', `Get from client: ${m}`, `Still needed after kickoff on ${dateLabel}.${a.access_notes ? `\n\n${a.access_notes}` : ''}`, { due_date: Date.now() + 5 * 864e5 }));
    if (lists?.Deliverables?.id) steps.push(renameBuilds(env, x, lists.Deliverables.id, [a.build1, a.build2]));
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(a.startdate || '').trim()) ? String(a.startdate).trim() : new Date().toISOString().slice(0, 10);
    if (dealId) await env.REPORTS.put(`start:${dealId}`, start);
    if (x.scheduleTimeline && dealId) steps.push(x.scheduleTimeline(env, x, dealId, start).catch((e) => console.error('timeline', e.message)));
    msg = `Kickoff notes are in ClickUp, ${missing.length} missing access item${missing.length === 1 ? '' : 's'} became tasks, and every due date now counts from ${start}.`;
    if (!lists) msg = 'Notes are on the deal. No ClickUp folder is linked to this deal yet, so nothing was added there.';
  }

  if (ref.kit === 'monthly') {
    steps.push(cuTask('Reporting and KPIs', `Monthly review notes: ${dateLabel}`, kitToMarkdown('monthly', a)));
    const due = Date.now() + 28 * 864e5;
    for (const p of [a.pri1, a.pri2, a.pri3].filter(Boolean)) steps.push(cuTask('Deliverables', `Next month: ${p}`, `Agreed at the monthly review on ${dateLabel}.`, { due_date: due }));
    for (const n of lines(a.asks)) steps.push(cuTask('Assets and Access', `Need from client: ${n}`, `Asked at the monthly review on ${dateLabel}.`, { due_date: Date.now() + 7 * 864e5 }));
    if (Number(a.csat) && Number(a.csat) <= 3) steps.push(task(`Client rated us ${a.csat} of 5: ${company}`, `Feedback: ${a.feedback || 'none written'}\nCall them this week.`, 1, 'CALL'));
    msg = lists ? 'Notes are in ClickUp Reporting, and next month\'s priorities are tasks with due dates.' : 'Notes are on the deal.';
  }

  if (ref.kit === 'checkin') {
    steps.push(cuTask('Deliverables', `Check in notes: ${dateLabel}`, kitToMarkdown('checkin', a)));
    for (const n of lines(a.asks)) steps.push(cuTask('Deliverables', `Client ask: ${n}`, `From the check in on ${dateLabel}.`, { due_date: Date.now() + 5 * 864e5 }));
    msg = lists ? 'Notes are in ClickUp, and each client ask is a task due in 5 days.' : 'Notes are on the deal.';
  }

  (await Promise.allSettled(steps)).forEach((r) => r.status === 'rejected' && console.error('kit save', r.reason && r.reason.message));
  await env.REPORTS.put(`kitdone:${tok}`, String(Date.now()));
  const hub = dealId ? `https://app-na2.hubspot.com/contacts/246716405/record/0-3/${dealId}` : `https://app-na2.hubspot.com/contacts/246716405/record/0-1/${ref.contactId}`;
  return json({ ok: true, message: msg, hubspot: hub });
}

async function renameBuilds(env, x, listId, names) {
  const r = await x.cu(env, 'GET', `/list/${listId}/task?archived=false&subtasks=false`);
  const builds = (r.tasks || []).filter((t) => /^Build \d/.test(t.name)).sort((p, q) => p.name.localeCompare(q.name));
  for (let i = 0; i < names.length && i < builds.length; i++) if (names[i]) await x.cu(env, 'PUT', `/task/${builds[i].id}`, { name: `${builds[i].name.replace(/\s*\(.*\)$/, '')}: ${names[i]}` });
}

function json(o, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }); }
