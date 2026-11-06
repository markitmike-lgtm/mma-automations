// Scheduling without a booking tool: suggested times held on Michael's calendar until the client picks one.
//
//   offerTimes()   picks 3 open times, puts private HOLD blocks on the michael@markitmike.com calendar,
//                  stores the offer under book:<tok> and returns the times plus links for the email
//   GET  /book/<tok>[?s=i]  the client's picker (3 held times first, more open times below). A GET never books,
//                  because email security scanners open every link.
//   POST /book/<tok>        books the chosen time: the hold becomes the real meeting with Google Meet and an invite
//                  from michael@markitmike.com, the other holds are released, HubSpot gets the meeting, the deal
//                  moves, and Michael gets one alert
//   holdSweep()    every run: releases holds nobody picked after 3 business days (with a follow up task) and
//                  any hold whose time has passed
//
// The calendar itself is reached through a tiny Google Apps Script web app (gas/MMA-Calendar.gs) that runs
// under michael@markitmike.com. Its URL and secret live in the worker secrets GCAL_URL and GCAL_SECRET.

const WORKER = 'https://mma-automations.markitmike.workers.dev';
const TZ = 'America/Los_Angeles';
const LOGO = 'https://markitmike.com/wp-content/uploads/2026/11/mma-logo-reverse-tight.png';

export const MEETINGS = {
  walkthrough: {
    title: 'Plan Walkthrough', mins: 45, label: 'plan walkthrough',
    about: 'We walk through your Brand Experience Snapshot and the plan we recommend, step by step, and answer every question. Bring anyone who should weigh in.',
    stage: 'contractsent', daysOut: [2, 8],
  },
  kickoff: {
    title: 'Kickoff Workshop', mins: 60, label: 'kickoff workshop',
    about: 'We confirm goals, dates and who does what, choose your first Builds, and set the 90 day roadmap together.',
    daysOut: [2, 8],
  },
  monthly: {
    title: 'Monthly Crown Report Review', mins: 30, label: 'monthly review',
    about: 'We review your Monthly Crown Report together: what moved, what we learned, and what we do next month.',
    daysOut: [1, 8],
  },
  checkin: {
    title: 'Quick Check In', mins: 15, label: 'quick check in',
    about: 'A short check in on progress, open questions and anything you need from our team.',
    daysOut: [1, 6],
  },
};

const HOURS = [9, 10, 11, 13, 14]; // Pacific start times we offer (noon to 5pm Eastern)
const HOLIDAYS = ['2026-11-26', '2026-11-27', '2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-07-05', '2027-09-06', '2027-11-25', '2027-11-26', '2027-12-24'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const token = (n = 16) => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map((v) => a[v % a.length]).join(''); };

export function calendarReady(env) { return Boolean(env.GCAL_URL && env.GCAL_SECRET); }

async function gcal(env, action, body = {}) {
  const r = await fetch(env.GCAL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, action, secret: env.GCAL_SECRET }), redirect: 'follow' });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { throw new Error(`calendar helper returned ${r.status}: ${t.slice(0, 160)}`); }
  if (d.error) throw new Error(`calendar helper: ${d.error}`);
  return d;
}

/* ---------- Pacific time helpers ---------- */
function ptParts(d) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute, wd: o.weekday };
}
function ptToDate(y, m, d, h, min = 0) {
  let guess = Date.UTC(y, m - 1, d, h + 8, min); // PST first guess, then correct for daylight time
  for (let i = 0; i < 2; i++) { const p = ptParts(new Date(guess)); guess += ((h - p.h) * 60 + (min - p.min)) * 60e3 + (p.d !== d ? (d > p.d ? 1 : -1) * 864e5 : 0); }
  return new Date(guess);
}
const ymd = (p) => `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
function businessDays(fromDays, toDays) {
  const out = []; const now = ptParts(new Date());
  let day = ptToDate(now.y, now.m, now.d, 12); let count = 0;
  for (let i = 0; i < 30 && count < toDays; i++) {
    day = new Date(day.getTime() + 864e5);
    const p = ptParts(day);
    if (p.wd === 'Sat' || p.wd === 'Sun' || HOLIDAYS.includes(ymd(p))) continue;
    count++;
    if (count >= fromDays) out.push(p);
  }
  return out;
}
export function whenText(iso, { eastern = true } = {}) {
  const d = new Date(iso);
  const pt = d.toLocaleString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const et = d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  return eastern ? `${pt.replace(' at ', ' at ')} Pacific (${et} Eastern)` : `${pt} Pacific`;
}
export function shortWhen(iso) {
  const d = new Date(iso);
  return { day: d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' }), time: `${d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })} PT`, et: `${d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET` };
}

/* ---------- finding open times ---------- */
async function openSlots(env, type, { limit = 40 } = {}) {
  const m = MEETINGS[type];
  const days = businessDays(m.daysOut[0], m.daysOut[1] + 5);
  if (!days.length) return [];
  const from = ptToDate(days[0].y, days[0].m, days[0].d, 0).toISOString();
  const last = days[days.length - 1];
  const to = ptToDate(last.y, last.m, last.d, 23, 59).toISOString();
  const { busy } = await gcal(env, 'busy', { from, to });
  const blocks = (busy || []).map((b) => [new Date(b.start).getTime() - 15 * 60e3, new Date(b.end).getTime() + 15 * 60e3]);
  const out = [];
  for (const p of days) for (const h of HOURS) {
    const s = ptToDate(p.y, p.m, p.d, h); const e = new Date(s.getTime() + m.mins * 60e3);
    if (s.getTime() < Date.now() + 18 * 36e5) continue;
    if (blocks.some(([a, b]) => s.getTime() < b && e.getTime() > a)) continue;
    out.push({ start: s.toISOString(), end: e.toISOString(), day: ymd(p), h });
    if (out.length >= limit) return out;
  }
  return out;
}
// three suggestions on three different days, mixing morning, late morning and early afternoon
function pickThree(slots, type) {
  const m = MEETINGS[type];
  const inWindow = slots.filter((s) => { const n = businessDays(1, m.daysOut[1]).map(ymd); return n.includes(s.day); });
  const pool = inWindow.length >= 3 ? inWindow : slots;
  const prefs = [[10, 9, 11], [13, 14, 11], [11, 10, 13]];
  const chosen = []; const usedDays = new Set();
  for (const pref of prefs) {
    let hit = null;
    for (const h of pref) { hit = pool.find((s) => s.h === h && !usedDays.has(s.day)); if (hit) break; }
    if (!hit) hit = pool.find((s) => !usedDays.has(s.day));
    if (hit) { chosen.push(hit); usedDays.add(hit.day); }
  }
  for (const s of pool) { if (chosen.length >= 3) break; if (!chosen.includes(s)) chosen.push(s); }
  return chosen.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
}

/* ---------- offers ---------- */
// who: { dealId, contactId, company, firstName, name, email }
export async function offerTimes(env, x, type, who) {
  const m = MEETINGS[type];
  const tok = token();
  const rec = { tok, type, ...who, dealId: String(who.dealId || ''), contactId: String(who.contactId || ''), slots: [], status: 'offered', offeredAt: Date.now() };
  if (calendarReady(env)) {
    const picks = pickThree(await openSlots(env, type), type);
    for (const s of picks) {
      const { id } = await gcal(env, 'hold', { title: `HOLD: ${m.title}, ${who.company || who.name || ''}`.trim(), description: `Held for ${who.name || ''} (${who.company || ''}) until they pick a time.\nAutomatically released if they pick another time, or after 3 business days.\n${WORKER}/book/${tok}`, start: s.start, end: s.end });
      rec.slots.push({ start: s.start, end: s.end, holdId: id });
    }
  }
  await env.REPORTS.put(`book:${tok}`, JSON.stringify(rec));
  const open = (await env.REPORTS.get('book:open', 'json')) || [];
  open.push(tok); await env.REPORTS.put('book:open', JSON.stringify(open.slice(-300)));
  return { tok, url: `${WORKER}/book/${tok}`, slots: rec.slots.map((s, i) => ({ ...s, url: `${WORKER}/book/${tok}?s=${i}`, ...shortWhen(s.start) })) };
}

async function releaseHolds(env, rec, keepId) {
  const ids = rec.slots.map((s) => s.holdId).filter((id) => id && id !== keepId);
  if (ids.length && calendarReady(env)) await gcal(env, 'release', { ids }).catch((e) => console.error('release holds', e.message));
}

export async function holdSweep(env, x) {
  if (!env.REPORTS) return;
  const open = (await env.REPORTS.get('book:open', 'json')) || [];
  if (!open.length) return;
  const keep = [];
  for (const tok of open) {
    const rec = await env.REPORTS.get(`book:${tok}`, 'json');
    if (!rec || rec.status !== 'offered') continue;
    const ageBiz = bizDaysSince(rec.offeredAt);
    const allPast = rec.slots.length && rec.slots.every((s) => new Date(s.start).getTime() < Date.now() + 2 * 36e5);
    if (ageBiz >= 3 || allPast) {
      await releaseHolds(env, rec);
      rec.status = 'expired'; rec.expiredAt = Date.now();
      await env.REPORTS.put(`book:${tok}`, JSON.stringify(rec));
      const m = MEETINGS[rec.type];
      if (rec.contactId) await x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: new Date().toISOString(), hs_task_subject: `${rec.name || rec.company} has not picked a ${m.label} time`, hs_task_body: `The 3 held times were released from your calendar. Their link still works and now shows open times: ${WORKER}/book/${tok}\nA quick call or a short reply usually gets it booked.`, hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'CALL' }, associations: [{ to: { id: rec.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }] }, ...(rec.dealId ? [{ to: { id: rec.dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }] }] : [])] }).catch((e) => console.error('hold task', e.message));
      continue;
    }
    keep.push(tok);
  }
  if (keep.length !== open.length) await env.REPORTS.put('book:open', JSON.stringify(keep));
}
function bizDaysSince(ts) {
  let n = 0; let t = ts;
  while ((t += 864e5) <= Date.now()) { const p = ptParts(new Date(t)); if (p.wd !== 'Sat' && p.wd !== 'Sun' && !HOLIDAYS.includes(ymd(p))) n++; }
  return n;
}

/* ---------- the client's picker ---------- */
function page(title, inner) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;background:#EFEAF6;font-family:Inter,Arial,sans-serif;color:#1B1030;font-size:16px;line-height:1.5}
.wrap{max-width:640px;margin:0 auto;padding:0 16px 60px}
.hdr{background:linear-gradient(160deg,#036684 0%,#0B3354 52%,#1D0A40 100%);color:#fff;padding:22px 26px 40px;border-radius:0 0 22px 22px;margin:0 -16px 24px}
.hdr img{height:34px;display:block;margin-bottom:22px}.hdr p{margin:0;color:#FBE7C6;font:800 12px Montserrat,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
h1{font:900 clamp(26px,6vw,34px)/1.1 Montserrat,Arial,sans-serif;margin:6px 0 8px}.hdr .sub{color:#D9E8F2;font:400 15px Inter,Arial,sans-serif;letter-spacing:0;text-transform:none;margin-top:8px}
.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 10px 30px rgba(43,15,99,.10);margin-bottom:16px}
.k{font:800 12px Montserrat,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#5D0EA6;margin:0 0 10px}
.slots{display:grid;gap:10px}
.slot{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;border:2px solid #E7E0F0;background:#fff;border-radius:12px;padding:14px 16px;font:inherit;color:inherit;cursor:pointer}
.slot:hover,.slot:focus-visible{border-color:#5D0EA6;outline:none}.slot b{display:block;font:800 16px Montserrat,Arial,sans-serif}.slot small{color:#6B6280}
.slot.pick{border-color:#E79A27;background:#FFF8EC}.slot .go{font:800 14px Montserrat,Arial,sans-serif;color:#5D0EA6;white-space:nowrap}
.cta{display:inline-block;border:0;border-radius:999px;padding:15px 30px;font:900 16px Montserrat,Arial,sans-serif;color:#2A0E52;background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);cursor:pointer;text-decoration:none}
.more summary{cursor:pointer;font-weight:600;color:#108193;list-style:none}.more summary::-webkit-details-marker{display:none}
.day{font:800 13px Montserrat,Arial,sans-serif;margin:16px 0 8px;color:#3A3646}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1.5px solid #E7E0F0;background:#fff;border-radius:999px;padding:8px 14px;font:600 14px Inter,Arial,sans-serif;cursor:pointer;color:#1B1030}.chip:hover{border-color:#5D0EA6}
.sig{display:flex;gap:12px;align-items:center;margin-top:20px;color:#6B6280;font-size:14px}.sig img{width:46px;height:46px;border-radius:50%;object-fit:cover}
.local{color:#6B6280;font-size:13px}
</style></head><body><div class="wrap">${inner}</div>
<script>try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz&&tz!=='America/Los_Angeles'){document.querySelectorAll('[data-iso]').forEach(function(el){var d=new Date(el.getAttribute('data-iso'));el.textContent='Your time: '+d.toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'});});}}catch(e){}</script>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } });
}
const header = (m, sub) => `<div class="hdr"><img src="${LOGO}" alt="Markit Mike Agency"><p>Markit Mike Agency</p><h1>Pick your ${esc(m.label)} time</h1><p class="sub">${esc(sub)}</p></div>`;
const sig = `<div class="sig"><img src="https://markitmike.com/wp-content/uploads/2026/10/mm-vp-me.png" alt="Markit Mike"><div>Questions? Reply to any of our emails or call (714) 919 9469.</div></div>`;

export async function bookRoute(req, env, x) {
  const url = new URL(req.url);
  const tok = (url.pathname.split('/')[2] || '').replace(/[^a-z0-9]/g, '').slice(0, 24);
  const rec = tok && (await env.REPORTS.get(`book:${tok}`, 'json'));
  if (!rec) return page('Not found', `<div class="card" style="margin-top:40px"><h1>This link is not available.</h1><p>Reply to our email and we will find a time together.</p></div>`);
  const m = MEETINGS[rec.type];

  if (rec.status === 'booked') {
    return page(`${m.title} confirmed`, header(m, `${m.mins} minutes on Google Meet`) + `<div class="card"><p class="k">You are booked</p><h1 style="font-size:24px">${esc(whenText(rec.booked.start))}</h1><p class="local" data-iso="${esc(rec.booked.start)}"></p><p>Your calendar invite with the Google Meet link comes from michael@markitmike.com. Need a different time? Just reply to the invite or any of our emails.</p></div>${sig}`);
  }

  if (req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    const start = String(form?.get('start') || '');
    if (!/^\d{4}-\d{2}-\d{2}T/.test(start)) return Response.redirect(`${WORKER}/book/${tok}`, 303);
    const held = rec.slots.find((s) => s.start === start);
    let slot = held;
    if (!slot) {
      const open = calendarReady(env) ? await openSlots(env, rec.type, { limit: 80 }) : [];
      slot = open.find((s) => s.start === start);
      if (!slot) return page('Time taken', header(m, 'That time was just taken.') + `<div class="card"><p>Sorry, that time is no longer open. <a href="${WORKER}/book/${tok}">Pick another time</a>.</p></div>`);
    }
    await confirmBooking(env, x, rec, slot, held ? held.holdId : null);
    return Response.redirect(`${WORKER}/book/${tok}`, 303);
  }

  const pre = Number(url.searchParams.get('s'));
  const live = rec.status === 'offered' ? rec.slots.filter((s) => new Date(s.start).getTime() > Date.now() + 2 * 36e5) : [];
  const slotBtn = (s, picked) => { const w = shortWhen(s.start); return `<form method="post"><input type="hidden" name="start" value="${esc(s.start)}"><button class="slot${picked ? ' pick' : ''}" type="submit"><span><b>${esc(w.day)}</b><small>${esc(w.time)} &middot; ${esc(w.et)}</small><br><small class="local" data-iso="${esc(s.start)}"></small></span><span class="go">${picked ? 'Confirm this time' : 'Choose'} &#10140;</span></button></form>`; };
  let picked = '';
  if (Number.isInteger(pre) && live.includes(rec.slots[pre])) {
    picked = `<div class="card"><p class="k">You picked</p>${slotBtn(rec.slots[pre], true)}<p class="local" style="margin:10px 0 0">One click confirms it and sends your calendar invite.</p></div>`;
  }
  const held = live.length ? `<div class="card"><p class="k">${picked ? 'Or choose another suggested time' : 'Suggested times, saved for you'}</p><div class="slots">${live.filter((s) => !picked || s !== rec.slots[pre]).map((s) => slotBtn(s, false)).join('')}</div></div>` : '';
  let more = '';
  if (calendarReady(env)) {
    try {
      const heldStarts = new Set(live.map((s) => s.start));
      const open = (await openSlots(env, rec.type, { limit: 60 })).filter((s) => !heldStarts.has(s.start));
      const byDay = {};
      for (const s of open) (byDay[s.day] = byDay[s.day] || []).push(s);
      const body = Object.values(byDay).slice(0, 7).map((list) => `<p class="day">${esc(shortWhen(list[0].start).day)}</p><div class="chips">${list.map((s) => `<form method="post" style="display:inline"><input type="hidden" name="start" value="${esc(s.start)}"><button class="chip" type="submit">${esc(shortWhen(s.start).time)}</button></form>`).join('')}</div>`).join('');
      if (body) more = live.length ? `<div class="card"><details class="more"><summary>None of these work? See more open times &#9662;</summary>${body}</details></div>` : `<div class="card"><p class="k">Open times</p>${body}</div>`;
    } catch (e) { console.error('open slots', e.message); }
  }
  if (!held && !more) more = `<div class="card"><p>Reply to our email with two or three times that work for you, and we will send the invite.</p></div>`;
  return page(`Pick your ${m.label} time`, header(m, `${m.mins} minutes on Google Meet. ${m.about}`) + picked + held + more + sig);
}

async function confirmBooking(env, x, rec, slot, holdId) {
  const m = MEETINGS[rec.type];
  const title = `${m.title} with Markit Mike Agency${rec.company ? ' | ' + rec.company : ''}`;
  const description = `${m.about}\n\nNeed to change the time? Reply to this invite or any of our emails, or call (714) 919 9469.\n\nMarkit Mike Agency | markitmike.com`;
  const res = calendarReady(env) ? await gcal(env, 'confirm', { id: holdId || undefined, title, description, start: slot.start, end: slot.end, email: rec.email, name: rec.name }) : {};
  rec.status = 'booked';
  rec.booked = { start: slot.start, end: slot.end, eventId: res.id || null, meet: res.meet || '', at: Date.now() };
  await env.REPORTS.put(`book:${rec.tok}`, JSON.stringify(rec));
  await releaseHolds(env, rec, holdId);

  // HubSpot: the meeting on the timeline (meetingSync then attaches the right meeting kit), the stage, one alert
  const assoc = [];
  if (rec.contactId) assoc.push({ to: { id: rec.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }] });
  if (rec.dealId) assoc.push({ to: { id: rec.dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 212 }] });
  await x.hs(env, 'POST', '/crm/v3/objects/meetings', { properties: { hs_timestamp: slot.start, hs_meeting_title: `${m.title} • ${m.mins} Min.`, hs_meeting_body: m.about, hs_meeting_start_time: slot.start, hs_meeting_end_time: slot.end, hs_meeting_outcome: 'SCHEDULED', hs_meeting_location: 'Google Meet', ...(res.meet ? { hs_meeting_external_url: res.meet } : {}), hubspot_owner_id: env.OWNER_ID }, associations: assoc }).catch((e) => console.error('hs meeting', e.message));
  if (m.stage && rec.dealId) {
    const deal = await x.hs(env, 'GET', `/crm/v3/objects/deals/${rec.dealId}?properties=dealstage`).catch(() => null);
    if (deal && x.stageRank(env, deal.properties.dealstage) < x.stageRank(env, m.stage)) await x.setStage(env, rec.dealId, m.stage).catch((e) => console.error('stage', e.message));
  }
  const when = whenText(slot.start);
  const dealUrl = rec.dealId ? `https://app-na2.hubspot.com/contacts/246716405/record/0-3/${rec.dealId}` : `https://app-na2.hubspot.com/contacts/246716405/record/0-1/${rec.contactId}`;
  if (x.sendRaw) await x.sendRaw(env, { to: env.OWNER_EMAIL, subject: `Booked: ${m.title} with ${rec.name || rec.company}, ${shortWhen(slot.start).day}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#5D0EA6;">BOOKED</p><p style="margin:0 0 12px;font-size:20px;font-weight:800;">${esc(rec.name || '')}${rec.company ? ' at ' + esc(rec.company) : ''} picked a ${esc(m.label)} time</p><p style="font-size:15px;">${esc(when)}. The invite went out from michael@markitmike.com${holdId ? ' and the other held times were released' : ''}. Your meeting kit link arrives as a HubSpot task.</p><p><a href="${dealUrl}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#5D0EA6;color:#fff;font-weight:700;text-decoration:none;">Open in HubSpot</a></p></div>` }).catch((e) => console.error('booked alert', e.message));
}
