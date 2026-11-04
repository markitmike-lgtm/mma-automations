// Automated cold outreach sequence with warm lead alerts.
//
// Enroll a prospect: create or update the HubSpot contact with Lead Status = In Progress and add a
// note that starts with "MMA SEQUENCE v1", followed by lines "SUBJECT: ..." and "BODY:" then the
// personalized first email. Every 10 minutes the worker:
//   1. picks up new enrollments (contact In Progress plus that note)
//   2. stops anyone who replied, booked a Crown Fitting, bounced or unsubscribed, and alerts the owner on replies and bookings
//   3. sends the next due step, weekdays inside a morning send window, capped per day
// Step 1 is the personalized note. Steps 2 and 3 are short follow ups. Every send logs to HubSpot.
// State lives in one KV key (seq:state) so each run stays well inside Worker subrequest limits.

export const SEQ_MARK = 'MMA SEQUENCE v1';
const ADDRESS = 'Markit Mike Agency, 161 Reed Ln, La Habra, CA 90631';
const DAILY_CAP = 12;
const PER_RUN = 2;
const GAPS = [0, 3, 5]; // business days to wait before step 1, 2, 3
const SEND_HOURS_UTC = [14, 19]; // 9am to 2pm Eastern, 6am to 11am Pacific
const STATE_KEY = 'seq:state';
const HS_CONTACT = (id) => `https://app-na2.hubspot.com/contacts/246716405/record/0-1/${id}`;

const isTest = (email) => /\+seqtest@gmail\.com$/i.test(email || '');
const today = (d = new Date()) => d.toISOString().slice(0, 10);

export function addBusinessDays(from, n) {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d.getTime();
}

export function inWindow(d = new Date()) {
  const w = d.getUTCDay(), h = d.getUTCHours();
  return w >= 1 && w <= 5 && h >= SEND_HOURS_UTC[0] && h < SEND_HOURS_UTC[1];
}

// pulls SUBJECT and BODY out of a HubSpot note body (which may come back as HTML)
export function parseNote(raw) {
  const text = String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\r/g, '');
  if (!text.includes(SEQ_MARK)) return null;
  const brand = (text.match(/^BRAND:\s*(.+)$/m) || [])[1];
  const subject = (text.match(/^SUBJECT:\s*(.+)$/m) || [])[1];
  const bodyIdx = text.search(/^BODY:\s*$/m);
  if (!subject || bodyIdx < 0) return null;
  const body = text.slice(bodyIdx).replace(/^BODY:\s*\n/, '').replace(/\n{3,}/g, '\n\n').trim();
  return { brand: (brand || '').trim(), subject: subject.trim(), body };
}

export function stepEmail(step, st, unsubUrl, siteUrl) {
  const first = st.first || 'there';
  const brand = st.brand || 'your brand';
  let subject, body;
  if (step === 1) {
    subject = st.subject;
    body = st.body;
  } else if (step === 2) {
    subject = `Re: ${st.subject}`;
    body = `Hi ${first},\n\nBumping this up in case it got buried. If it would help, I'm happy to walk you through two quick wins I spotted for ${brand} in a free 30 minute Crown Fitting: markitmike.com/crownfitting\n\nYou can also see some of our team's work here: ${siteUrl}\n\nMarkit Mike\nMarkit Mike Agency | (714) 919 9469`;
  } else {
    subject = `Re: ${st.subject}`;
    body = `Hi ${first},\n\nI'll close the loop here so I'm not crowding your inbox. If ${brand} ever needs an extra senior hand on grand openings, loyalty or local store marketing, just reply to this email and our team will pick it right back up.\n\nWishing you a strong holiday season,\nMarkit Mike\nMarkit Mike Agency | (714) 919 9469`;
  }
  const footer = `\n\n${ADDRESS}\nNot a fit? Reply "no thanks" or unsubscribe here: ${unsubUrl}`;
  const text = body + footer;
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222;">${esc(body).replace(/\n/g, '<br>')}<p style="margin-top:24px;font-size:12px;color:#777;">${esc(ADDRESS)}<br>Not a fit? Reply "no thanks" or <a href="${unsubUrl}" style="color:#777;">unsubscribe</a>.</p></div>`;
  return { subject, text, html };
}

function token() {
  const a = new Uint8Array(9); crypto.getRandomValues(a);
  return [...a].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

async function loadState(env) { return (await env.REPORTS.get(STATE_KEY, 'json')) || { contacts: {}, sent: {}, lastReplyCheck: Date.now() - 36e5 }; }
async function saveState(env, s) { await env.REPORTS.put(STATE_KEY, JSON.stringify(s)); }

async function resend(env, payload) {
  if (env.DRY_RUN === 'true') { console.log('DRY RUN seq email', payload.to, payload.subject); return { id: 'dry' }; }
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
  return r.json();
}

async function alert(env, x, cid, st, kind, detail) {
  const who = [st.first, st.last].filter(Boolean).join(' ') || st.email;
  const title = `Warm lead: ${who}${st.brand ? ', ' + st.brand : ''} ${kind}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#5D0EA6;">WARM LEAD</p><p style="margin:0 0 12px;font-size:20px;font-weight:800;">${who}${st.brand ? ' &middot; ' + st.brand : ''}</p><p style="margin:0 0 12px;font-size:15px;">${kind}. ${detail || ''}</p><p style="margin:0 0 12px;font-size:15px;">Sequence step reached: ${st.step} of 3. Email: ${st.email}</p><p><a href="${HS_CONTACT(cid)}" style="color:#5D0EA6;font-weight:700;">Open in HubSpot</a></p></div>`;
  const jobs = [
    resend(env, { from: env.FROM_EMAIL, to: [env.OWNER_EMAIL], subject: title, html }),
    x.hs(env, 'POST', '/crm/v3/objects/tasks', {
      properties: { hs_timestamp: new Date().toISOString(), hs_task_subject: title, hs_task_body: `${kind}. ${detail || ''} Respond personally today.`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'EMAIL' },
      associations: [{ to: { id: String(cid) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }] }],
    }),
  ];
  (await Promise.allSettled(jobs)).forEach((r) => r.status === 'rejected' && console.error('seq alert', r.reason && r.reason.message));
}

async function stop(env, x, cid, st, status, leadStatus, note) {
  st.status = status; st.stoppedAt = Date.now();
  const steps = [x.hs(env, 'PATCH', `/crm/v3/objects/contacts/${cid}`, { properties: { hs_lead_status: leadStatus } })];
  if (note) steps.push(x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: note }, associations: [{ to: { id: String(cid) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }] }));
  (await Promise.allSettled(steps)).forEach((r) => r.status === 'rejected' && console.error('seq stop', r.reason && r.reason.message));
}

async function enroll(env, x, c, state) {
  const a = await x.hs(env, 'GET', `/crm/v4/objects/contacts/${c.id}/associations/notes`);
  const ids = (a.results || []).map((n) => ({ id: String(n.toObjectId) }));
  if (!ids.length) return null;
  const nb = await x.hs(env, 'POST', '/crm/v3/objects/notes/batch/read', { inputs: ids, properties: ['hs_note_body'] });
  for (const n of nb.results || []) {
    const parsed = parseNote(n.properties.hs_note_body);
    if (!parsed) continue;
    const tok = token();
    const p = c.properties;
    const st = { email: p.email, first: p.firstname || '', last: p.lastname || '', brand: parsed.brand || p.company || '', subject: parsed.subject, body: parsed.body, step: 0, status: 'active', enrolledAt: Date.now(), nextAt: Date.now(), tok };
    await env.REPORTS.put(`seqtok:${tok}`, String(c.id));
    state.contacts[c.id] = st;
    return st;
  }
  return null;
}

export async function sequenceRun(env, x) {
  if (!env.REPORTS) return;
  const state = await loadState(env);
  let dirty = false;

  // 1. new enrollments: contacts marked In Progress that we have not seen yet
  const r = await x.hs(env, 'POST', '/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'hs_lead_status', operator: 'EQ', value: 'IN_PROGRESS' }] }],
    properties: ['email', 'firstname', 'lastname', 'company'], limit: 100,
  });
  let newOnes = 0;
  for (const c of r.results || []) {
    if (state.contacts[c.id] || newOnes >= 3 || !c.properties.email) continue;
    if (state.skip && state.skip[c.id] && Date.now() - state.skip[c.id] < 30 * 60e3) continue; // no sequence note yet, look again in 30 minutes
    const st = await enroll(env, x, c, state);
    newOnes++;
    if (st) dirty = true; else { state.skip = state.skip || {}; state.skip[c.id] = Date.now(); dirty = true; }
  }
  const active = Object.entries(state.contacts).filter(([, s]) => s.status === 'active');

  // 2a. replies: any incoming email since the last check from an active contact stops their sequence
  let repliesOk = true;
  if (active.length) try {
    const since = state.lastReplyCheck || Date.now() - 36e5;
    const er = await x.hs(env, 'POST', '/crm/v3/objects/emails/search', {
      filterGroups: [{ filters: [{ propertyName: 'hs_email_direction', operator: 'EQ', value: 'INCOMING_EMAIL' }, { propertyName: 'hs_createdate', operator: 'GTE', value: String(since - 5 * 60e3) }] }],
      properties: ['hs_email_subject', 'hs_email_text'], limit: 100,
    });
    state.lastReplyCheck = Date.now(); dirty = true;
    const emails = er.results || [];
    if (emails.length) {
      const ar = await x.hs(env, 'POST', '/crm/v4/associations/emails/contacts/batch/read', { inputs: emails.map((e) => ({ id: e.id })) });
      for (const row of ar.results || []) {
        for (const to of row.to || []) {
          const cid = String(to.toObjectId), st = state.contacts[cid];
          if (!st || st.status !== 'active') continue;
          const em = emails.find((e) => e.id === String(row.from.id));
          const said = String(em?.properties?.hs_email_text || '').trim().slice(0, 300);
          const negative = /\b(no thanks|not interested|unsubscribe|remove me|stop)\b/i.test(said);
          if (negative) await stop(env, x, cid, st, 'declined', 'UNQUALIFIED', `Cold sequence stopped: replied not interested. "${said.replace(/[<>&]/g, '')}"`);
          else { await stop(env, x, cid, st, 'replied', 'CONNECTED', 'Cold sequence stopped: they replied.'); await alert(env, x, cid, st, 'replied to your email', said ? `They wrote: "${said.replace(/[<>&]/g, '')}"` : ''); }
        }
      }
    }
  } catch (err) {
    // without reply checks we never send a follow up, so nobody who already replied gets nudged
    repliesOk = false;
    console.error('seq reply check', err.message);
    if (!state.replyErrAt || Date.now() - state.replyErrAt > 24 * 36e5) { state.replyErrAt = Date.now(); await saveState(env, state); throw err; }
  }

  // 2b. Crown Fitting bookings by anyone in the sequence
  if (active.length) {
    const mr = await x.hs(env, 'POST', '/crm/v3/objects/meetings/search', {
      filterGroups: [{ filters: [{ propertyName: 'hs_createdate', operator: 'GTE', value: String(Date.now() - 40 * 60e3) }] }], properties: ['hs_meeting_title', 'hs_meeting_start_time'], limit: 20,
    });
    const meetings = mr.results || [];
    if (meetings.length) {
      const ar = await x.hs(env, 'POST', '/crm/v4/associations/meetings/contacts/batch/read', { inputs: meetings.map((m) => ({ id: m.id })) });
      for (const row of ar.results || []) for (const to of row.to || []) {
        const cid = String(to.toObjectId), st = state.contacts[cid];
        if (!st || st.status !== 'active') continue;
        const m = meetings.find((mm) => mm.id === String(row.from.id));
        await stop(env, x, cid, st, 'booked', 'CONNECTED', 'Cold sequence stopped: booked a Crown Fitting.');
        await alert(env, x, cid, st, 'booked a Crown Fitting', m ? `Meeting: ${m.properties.hs_meeting_title} on ${m.properties.hs_meeting_start_time}` : '');
        dirty = true;
      }
    }
  }

  // 2c. bounces on recent sends (a few per run)
  let checks = 0;
  for (const [cid, st] of active) {
    if (st.status !== 'active' || !st.lastId || st.lastId === 'dry' || st.lastChecked || checks >= 4) continue;
    if (Date.now() - st.lastSentAt < 10 * 60e3) continue;
    checks++;
    try {
      const g = await fetch(`https://api.resend.com/emails/${st.lastId}`, { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
      const info = g.ok ? await g.json() : null;
      if (info && /bounced|complained/.test(info.last_event || '')) await stop(env, x, cid, st, 'bounced', 'UNQUALIFIED', `Cold sequence stopped: email to ${st.email} ${info.last_event}. Find a working address before trying again.`);
      st.lastChecked = true; dirty = true;
    } catch (e) { console.error('seq bounce check', e.message); }
  }

  // 3. send due steps, inside the window and under the daily cap
  const day = today();
  let sentRun = 0;
  for (const [cid, st] of Object.entries(state.contacts)) {
    if (st.status !== 'active' || sentRun >= PER_RUN) continue;
    const test = isTest(st.email);
    if (!test && !inWindow()) continue;
    if (!test && (state.sent[day] || 0) >= DAILY_CAP) break;
    if (Date.now() < st.nextAt) continue;
    const step = st.step + 1;
    if (step > 1 && !repliesOk) continue;
    if (step > 3) { await stop(env, x, cid, st, 'done', 'ATTEMPTED_TO_CONTACT', 'Cold sequence finished: 3 emails, no reply.'); dirty = true; continue; }
    const unsub = `https://mma-automations.markitmike.workers.dev/u/${st.tok}`;
    const site = `markitmike.com/portfolio/?mmc=${st.tok}`;
    const e = stepEmail(step, st, unsub, site);
    try {
      const res = await resend(env, { from: 'Markit Mike <team@markitmike.com>', to: [st.email], reply_to: env.REPLY_TO || env.OWNER_EMAIL, subject: e.subject, text: e.text, html: e.html, headers: { 'List-Unsubscribe': `<${unsub}>` } });
      await x.hs(env, 'POST', '/crm/v3/objects/emails', {
        properties: { hs_timestamp: new Date().toISOString(), hs_email_direction: 'EMAIL', hs_email_status: 'SENT', hs_email_subject: e.subject, hs_email_text: e.text, hs_email_html: e.html, hs_email_headers: JSON.stringify({ from: { email: 'team@markitmike.com' }, to: [{ email: st.email }] }) },
        associations: [{ to: { id: String(cid) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }] }],
      }).catch((err) => console.error('seq log', err.message));
      st.step = step; st.lastId = res.id; st.lastSentAt = Date.now(); st.lastChecked = false;
      st.nextAt = step < 3 ? (test ? Date.now() + 5 * 60e3 : addBusinessDays(Date.now(), GAPS[step])) : (test ? Date.now() + 5 * 60e3 : addBusinessDays(Date.now(), 4));
      state.sent[day] = (state.sent[day] || 0) + 1;
      sentRun++; dirty = true;
    } catch (err) { console.error('seq send', st.email, err.message); }
  }
  // keep the per day counter small
  for (const k of Object.keys(state.sent)) if (k < today(new Date(Date.now() - 7 * 864e5))) delete state.sent[k];
  if (dirty) await saveState(env, state);
}

// GET /u/<token>: one click unsubscribe
export async function unsubscribeRoute(url, env, x) {
  const tok = url.pathname.split('/')[2] || '';
  const cid = tok && (await env.REPORTS.get(`seqtok:${tok}`));
  const page = (msg) => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Markit Mike Agency</title><div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#1B1030;"><p style="font-size:12px;font-weight:800;letter-spacing:2px;color:#5D0EA6;">MARKIT MIKE AGENCY</p><h1 style="font-size:24px;">${msg}</h1><p style="color:#555;">You won't receive any more outreach emails from our team.</p></div>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
  if (!cid) return page('You are unsubscribed.');
  const state = await loadState(env);
  const st = state.contacts[cid];
  if (st && st.status === 'active') {
    await stop(env, x, cid, st, 'unsubscribed', 'UNQUALIFIED', 'Unsubscribed from cold outreach.');
    await saveState(env, state);
  }
  return page('You are unsubscribed.');
}

// POST /seen: a sequenced prospect opened markitmike.com from our link
export async function seenRoute(req, env, x) {
  let b = {};
  try { b = JSON.parse(await req.text()); } catch {}
  const tok = String(b.t || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
  const cid = tok && (await env.REPORTS.get(`seqtok:${tok}`));
  if (!cid) return new Response(null, { status: 204 });
  const state = await loadState(env);
  const st = state.contacts[cid];
  if (st && today() !== st.lastSeenDay) {
    st.lastSeenDay = today(); st.visits = (st.visits || 0) + 1;
    await saveState(env, state);
    await alert(env, x, cid, st, 'clicked through to markitmike.com', `Page: ${String(b.page || '').replace(/[<>&"]/g, '').slice(0, 120)}. A great moment for a personal note.`);
  }
  return new Response(null, { status: 204 });
}

// for the daily brief and a quick status check
export async function sequenceSummary(env) {
  if (!env.REPORTS) return null;
  const s = await loadState(env);
  const out = { active: 0, replied: 0, booked: 0, declined: 0, bounced: 0, unsubscribed: 0, done: 0 };
  for (const st of Object.values(s.contacts)) out[st.status] = (out[st.status] || 0) + 1;
  out.sentToday = s.sent[today()] || 0;
  return out;
}
