// Intake processing, scheduled jobs (meeting sync, intake reminders, Daily Crown Brief) and failure alerts.
import { sequenceRun } from './sequence.js';
import { ensureFittingLink, fittingFollowups, leadNudges } from './fitting.js';
import { SECTIONS, OFFER_NAMES, NEXT_LINE, sectionsFor } from './intake-form.js';
import { INTAKE_JS } from './intake-widget.js';
import { intakeDoneEmail, intakeReminderEmail, briefEmail, alertEmail } from './emails.js';

const e = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function intakeScript(url) {
  return new Response(
    INTAKE_JS.replace('__SECTIONS__', JSON.stringify(SECTIONS)).replace('__NAMES__', JSON.stringify(OFFER_NAMES))
      .replace('__NEXT__', JSON.stringify(NEXT_LINE)).replace('__ENDPOINT__', `${url.origin}/intake`),
    { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' } },
  );
}

// answers as readable HTML and plain text, grouped by section, only what this offer was asked
export function formatAnswers(offer, answers) {
  const html = [], text = [];
  for (const s of sectionsFor(offer)) {
    const rows = s.q.map((q) => {
      const v = answers[q.id];
      const val = Array.isArray(v) ? v.join(', ') : String(v ?? '').trim();
      return [q.label, val || 'Not answered'];
    });
    html.push(`<p style="margin:18px 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#5D0EA6;">${e(s.title)}</p>` +
      rows.map(([k, v]) => `<p style="margin:0 0 10px;"><b>${e(k)}</b><br>${e(v).replace(/\n/g, '<br>')}</p>`).join(''));
    text.push(`**${s.title}**\n` + rows.map(([k, v]) => `- ${k}: ${v}`).join('\n'));
  }
  return { html: html.join(''), text: text.join('\n\n') };
}

export async function intake(req, env, h, x) {
  const origin = req.headers.get('Origin') || '';
  const okOrigin = /^https:\/\/(www\.)?markitmike\.com$/.test(origin);
  const cors = okOrigin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
  const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
  if (req.method !== 'POST' || !okOrigin) return out({ error: 'forbidden' }, 403);
  let b; try { b = await req.json(); } catch { return out({ error: 'bad request' }, 400); }
  const offer = String(b.offer || '');
  if (!OFFER_NAMES[offer]) return out({ error: 'Please use the link in your welcome email.' }, 400);
  if (b.website || (Number(b.elapsed) > 0 && Number(b.elapsed) < 5000)) return out({ ok: true });
  if (await x.tooMany(req, 'intake', 5)) return out({ ok: true });
  const answers = {};
  for (const s of sectionsFor(offer)) for (const q of s.q) {
    const v = b.answers?.[q.id];
    answers[q.id] = Array.isArray(v) ? v.slice(0, 20).map((y) => String(y).slice(0, 200)) : String(v ?? '').slice(0, 4000);
  }
  const email = String(answers.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out({ error: 'Please add a valid email.' }, 400);

  const { html, text } = formatAnswers(offer, answers);
  const name = `${answers.first || ''} ${answers.last || ''}`.trim();
  const company = answers.business || name;

  // contact: find or create, then fill standard fields that are blank
  let contact = await x.contactByEmail(env, email);
  const std = { firstname: answers.first, lastname: answers.last, jobtitle: answers.title, mobilephone: answers.mobile, company: answers.business, website: answers.website, city: answers.area };
  Object.keys(std).forEach((k) => !std[k] && delete std[k]);
  if (!contact) contact = await x.hs(env, 'POST', '/crm/v3/objects/contacts', { properties: { email, ...std } });
  else await x.hs(env, 'PATCH', `/crm/v3/objects/contacts/${contact.id}`, { properties: std }).catch((err) => console.error('contact update', err.message));
  const deal = (await x.dealForEmail(env, email, true))?.deal || null;
  const optIn = b.optIn === true;

  const steps = [];
  steps.push(x.hs(env, 'POST', '/crm/v3/objects/notes', {
    properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Intake received</b> (${e(OFFER_NAMES[offer])})</p><p>Email marketing: ${optIn ? 'opted in' : 'not opted in'}</p>${html}` },
    associations: [
      { to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
      ...(deal ? [{ to: { id: deal.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }] : []),
    ],
  }));
  if (optIn) steps.push(x.recordOptIn(env, contact.id, email, `Intake (${OFFER_NAMES[offer]})`));
  steps.push(x.sendAndLog(env, { to: email, contact, deal, ...intakeDoneEmail({ firstName: answers.first, offerName: OFFER_NAMES[offer], next: NEXT_LINE[offer], answersHtml: html }) }));
  steps.push(clickupReviewTask(env, x, company, OFFER_NAMES[offer], text));
  const r = await Promise.allSettled(steps);
  const failed = r.filter((y) => y.status === 'rejected').map((y) => y.reason?.message || String(y.reason));
  if (failed.length) await alertOwner(env, 'intake', `Intake from ${name} (${email}) saved, but some steps failed:\n${failed.join('\n')}`);
  return out({ ok: true });
}

async function clickupReviewTask(env, x, company, offerName, text) {
  const due = nextBusinessDay();
  const body = { name: `Review intake answers: ${company}`, markdown_description: `Intake for **${offerName}** came in ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT.\n\n${text}`, due_date: due, priority: 2 };
  const folders = await x.cu(env, 'GET', `/space/${env.CLICKUP_SPACE_ID}/folder?archived=false`);
  const want = `mma | ${company}`.toLowerCase();
  const folder = (folders.folders || []).find((f) => f.name.toLowerCase() === want) || (folders.folders || []).find((f) => f.name.toLowerCase().includes(String(company).toLowerCase()));
  let listId = null;
  if (folder) {
    const lists = folder.lists?.length ? folder.lists : (await x.cu(env, 'GET', `/folder/${folder.id}/list`)).lists || [];
    listId = (lists.find((l) => /onboarding/i.test(l.name)) || lists[0])?.id;
  }
  if (!listId) {
    // no client folder yet (a Quick Win, or a name mismatch): use the space's first folderless list
    const fl = await x.cu(env, 'GET', `/space/${env.CLICKUP_SPACE_ID}/list?archived=false`);
    listId = fl.lists?.[0]?.id;
    body.name += ' (no client folder found)';
  }
  if (!listId) throw new Error('clickup: no list to put the intake review task in');
  await x.cu(env, 'POST', `/list/${listId}/task`, body);
}

function nextBusinessDay() {
  const d = new Date(Date.now() + 24 * 3600e3);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(17, 0, 0, 0); // 9am Pacific in winter, 10am in summer
  return d.getTime();
}

/* ---------------- failure alerts ---------------- */
export async function alertOwner(env, where, detail) {
  try {
    const key = new Request(`https://alert.mma/${encodeURIComponent(where)}/${Math.floor(Date.now() / 3600000)}`);
    if (await caches.default.match(key)) return; // one alert per area per hour
    await caches.default.put(key, new Response('1', { headers: { 'Cache-Control': 'max-age=3600' } }));
  } catch { /* no cache in tests */ }
  if (!env.RESEND_API_KEY || env.DRY_RUN === 'true') { console.log('ALERT', where, detail); return; }
  const m = alertEmail({ where, detail });
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [env.OWNER_EMAIL], subject: m.subject, html: m.html }),
  }).catch((err) => console.error('alert send failed', err.message));
}

/* ---------------- scheduled jobs ---------------- */
export async function scheduled(event, env, x) {
  const jobs = event.cron === env.BRIEF_CRON ? [['intake reminders', intakeReminders], ['lead nudges', leadNudges], ['daily brief', dailyBrief], ['meeting sync', meetingSync]] : [['meeting sync', meetingSync], ['cold sequence', sequenceRun], ['crown fitting follow ups', fittingFollowups]];
  for (const [name, fn] of jobs) {
    try { await fn(env, x); } catch (err) { console.error(name, err.stack || err); await alertOwner(env, name, String(err.message || err)); }
  }
}

// HubSpot Meetings bookings: make sure the booker has a deal at Crown Fitting Booked or later
async function meetingSync(env, x) {
  const since = Date.now() - 40 * 60 * 1000;
  const r = await x.hs(env, 'POST', '/crm/v3/objects/meetings/search', {
    filterGroups: [{ filters: [{ propertyName: 'hs_createdate', operator: 'GTE', value: String(since) }] }],
    properties: ['hs_meeting_title', 'hs_meeting_start_time', 'hs_meeting_outcome'], limit: 50,
  });
  for (const m of r.results || []) {
    if (!/crown fitting/i.test(m.properties.hs_meeting_title || '')) continue;
    const a = await x.hs(env, 'GET', `/crm/v4/objects/meetings/${m.id}/associations/contacts`);
    for (const c of a.results || []) {
      const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${c.toObjectId}?properties=email,firstname,lastname,company`);
      const email = contact.properties?.email;
      if (!email || email === env.OWNER_EMAIL) continue;
      const found = await x.dealForEmail(env, email);
      let dealId = found?.deal?.id;
      if (found) {
        if (x.stageRank(env, found.deal.properties.dealstage) < x.stageRank(env, 'presentationscheduled')) await x.setStage(env, found.deal.id, 'presentationscheduled');
      } else {
        const p = contact.properties;
        const created = await x.hs(env, 'POST', '/crm/v3/objects/deals', {
          properties: { dealname: `${p.company || [p.firstname, p.lastname].filter(Boolean).join(' ') || email} | Crown Fitting`, pipeline: 'default', dealstage: 'presentationscheduled' },
          associations: [
            { to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] },
          ],
        });
        dealId = created?.id;
      }
      try { await ensureFittingLink(env, x, { dealId, contact, meeting: m }); } catch (e) { console.error('fitting link', e.message); }
    }
  }
}

// deals won 2 or 5 days ago with no intake note get a reminder; day 5 also gets a call task
async function intakeReminders(env, x) {
  const r = await x.hs(env, 'POST', '/crm/v3/objects/deals/search', {
    filterGroups: [{ filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: env.STAGE_WON },
      { propertyName: 'closedate', operator: 'GTE', value: String(Date.now() - 6.5 * 864e5) },
    ] }],
    properties: ['dealname', 'closedate', 'dealstage'], limit: 50,
  });
  for (const deal of r.results || []) {
    const days = Math.floor((Date.now() - new Date(deal.properties.closedate).getTime()) / 864e5);
    if (days !== 2 && days !== 5) continue;
    const notes = await x.hs(env, 'GET', `/crm/v4/objects/deals/${deal.id}/associations/notes`);
    const ids = (notes.results || []).map((n) => ({ id: String(n.toObjectId) }));
    if (ids.length) {
      const nb = await x.hs(env, 'POST', '/crm/v3/objects/notes/batch/read', { inputs: ids, properties: ['hs_note_body'] });
      if ((nb.results || []).some((n) => /Intake received/i.test(n.properties.hs_note_body || ''))) continue;
    }
    const ca = await x.hs(env, 'GET', `/crm/v4/objects/deals/${deal.id}/associations/contacts`);
    const cid = ca.results?.[0]?.toObjectId;
    if (!cid) continue;
    const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${cid}?properties=email,firstname`);
    const plan = await x.planForDeal(env, deal);
    if (!plan || !contact.properties?.email) continue;
    await x.sendAndLog(env, { to: contact.properties.email, contact, deal, ...intakeReminderEmail({ firstName: contact.properties.firstname, plan, second: days === 5 }) });
    if (days === 5) {
      await x.hs(env, 'POST', '/crm/v3/objects/tasks', {
        properties: { hs_timestamp: new Date().toISOString(), hs_task_subject: `Call ${contact.properties.firstname || 'client'}: intake still not in (day 5)`, hs_task_body: 'Two reminder emails have gone out. A quick friendly call usually does it.', hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'CALL' },
        associations: [
          { to: { id: String(cid) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }] },
          { to: { id: deal.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }] },
        ],
      });
    }
  }
}

const STAGE_LABEL = {
  appointmentscheduled: 'Prospect', qualifiedtobuy: 'Outreach Active', presentationscheduled: 'Crown Fitting Booked',
  decisionmakerboughtin: 'Crown Fitting Held', contractsent: 'Proposal Walkthrough', '4534780662': 'Agreement Sent', '4534780663': 'Signed, Awaiting Payment',
};

async function dailyBrief(env, x) {
  const now = Date.now();
  const tz = 'America/Los_Angeles';
  const endOfToday = (() => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: tz })); d.setHours(23, 59, 59, 999); return now + (d.getTime() - new Date(new Date().toLocaleString('en-US', { timeZone: tz })).getTime()); })();
  const sec = {};

  // HubSpot tasks due today or overdue
  const t = await x.hs(env, 'POST', '/crm/v3/objects/tasks/search', {
    filterGroups: [{ filters: [
      { propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' },
      { propertyName: 'hs_timestamp', operator: 'LTE', value: String(endOfToday) },
    ] }],
    properties: ['hs_task_subject', 'hs_timestamp', 'hs_task_priority'], sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }], limit: 50,
  }).catch((err) => ({ error: err.message }));
  sec.tasks = t.error ? [`Could not read HubSpot tasks: ${t.error}`] : (t.results || []).map((y) => {
    const late = new Date(y.properties.hs_timestamp).getTime() < now - 864e5;
    return `${late ? '<b style="color:#b42318;">Overdue</b> ' : ''}${e(y.properties.hs_task_subject)}`;
  });

  // today's meetings
  const startToday = endOfToday - 864e5 + 1;
  const m = await x.hs(env, 'POST', '/crm/v3/objects/meetings/search', {
    filterGroups: [{ filters: [{ propertyName: 'hs_meeting_start_time', operator: 'BETWEEN', value: String(startToday), highValue: String(endOfToday) }] }],
    properties: ['hs_meeting_title', 'hs_meeting_start_time'], sorts: [{ propertyName: 'hs_meeting_start_time', direction: 'ASCENDING' }], limit: 20,
  }).catch(() => ({ results: [] }));
  sec.meetings = (m.results || []).map((y) => `${new Date(y.properties.hs_meeting_start_time).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })} &middot; ${e(y.properties.hs_meeting_title)}`);

  // open pipeline, and deals that have gone quiet for 7+ days
  const d = await x.hs(env, 'POST', '/crm/v3/objects/deals/search', {
    filterGroups: [{ filters: [{ propertyName: 'dealstage', operator: 'NOT_IN', values: [env.STAGE_WON, 'closedlost'] }] }],
    properties: ['dealname', 'dealstage', 'amount', 'hs_lastmodifieddate'], limit: 100,
  });
  const open = d.results || [];
  const byStage = {};
  open.forEach((y) => { const k = STAGE_LABEL[y.properties.dealstage] || y.properties.dealstage; byStage[k] = (byStage[k] || 0) + 1; });
  sec.pipeline = Object.entries(byStage).map(([k, v]) => `${e(k)}: <b>${v}</b>`);
  sec.quiet = open.filter((y) => now - new Date(y.properties.hs_lastmodifieddate).getTime() > 7 * 864e5)
    .map((y) => `${e(y.properties.dealname)} <span style="color:#7a7392;">(${e(STAGE_LABEL[y.properties.dealstage] || y.properties.dealstage)}, quiet ${Math.floor((now - new Date(y.properties.hs_lastmodifieddate).getTime()) / 864e5)} days)</span>`);
  sec.unpaid = open.filter((y) => y.properties.dealstage === env.STAGE_SIGNED && now - new Date(y.properties.hs_lastmodifieddate).getTime() > 2 * 864e5)
    .map((y) => `${e(y.properties.dealname)}: signed but not paid for 2+ days. Send a friendly nudge.`);

  // ClickUp: client work due today or overdue
  try {
    const teams = await x.cu(env, 'GET', '/team');
    const team = teams.teams?.[0]?.id;
    const c = await x.cu(env, 'GET', `/team/${team}/task?space_ids[]=${env.CLICKUP_SPACE_ID}&due_date_lt=${endOfToday}&include_closed=false&subtasks=true&order_by=due_date`);
    sec.clickup = (c.tasks || []).slice(0, 30).map((y) => `${Number(y.due_date) < now - 864e5 ? '<b style="color:#b42318;">Overdue</b> ' : ''}${e(y.name)} <span style="color:#7a7392;">(${e(y.folder?.name && y.folder.name !== 'hidden' ? y.folder.name : y.list?.name || '')})</span>`);
  } catch (err) { sec.clickup = [`Could not read ClickUp: ${e(err.message)}`]; }

  const brief = briefEmail({ date: new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }), sec });
  if (env.DRY_RUN === 'true') { console.log('DRY RUN brief', brief.subject); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [env.OWNER_EMAIL], subject: brief.subject, html: brief.html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
}
