// Fulfillment: what happens after a client pays, until the work is delivered.
//
//   startClientBuild()   called when a deal is won. Queues the client's deliverables (built in the 10 minute job,
//                        a few at a time, so no single run gets too big) and creates their client portal.
//   fulfillSweep()       10 minute job: builds queued deliverables, re-dates the timeline after kickoff,
//                        and sends approvals and deliveries for tasks moved to "client review".
//   GET/POST /approve/<tok>   the client's Approve or Request changes page (a GET never decides anything)
//   GET/POST /portal/<tok>    the client portal: progress, what needs them, delivered work, meetings, booking
//
// How Michael uses it in ClickUp: do the work, paste the proof or file link in a comment on the task, then move the
// task to "client review". The client gets a branded email with the link and buttons. Their answer moves the task to
// "approved" or "changes requested" and Michael gets one alert. Delivery tasks (reports, plans) go straight to
// "complete" when sent, since there is nothing to approve.
import { approvalEmail, deliveryEmail } from './emails.js';
import { offerTimes, MEETINGS, whenText } from './schedule.js';

const WORKER = 'https://mma-automations.markitmike.workers.dev';
const LOGO = 'https://markitmike.com/wp-content/uploads/2026/11/mma-logo-reverse-tight.png';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const token = (n = 16) => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map((v) => a[v % a.length]).join(''); };

/* ---------- the playbook: steps, due day (days after the plan start) and the client step ---------- */
// mode: 'approve' (client approves before it goes live), 'deliver' (client receives it), null (internal)
const S = {
  assess: ['Website and SEO audit', 'Google profiles and listings audit', 'Reviews and sentiment pull', 'Competitor scan (up to 3)', 'Write findings in plain language', 'Internal quality check'],
  glow: ['Confirm profile access', 'Hours, categories and services cleaned up', 'Business description written', 'Photos selected, optimized and uploaded', 'Review replies written', 'Before and after screenshots saved'],
  listings: ['Claim or confirm access on Yelp, Apple Maps and Bing', 'Match name, address, phone and hours to Google', 'Fix categories and descriptions', 'Upload photos', 'Before and after screenshots saved'],
  reviews: ['Pull the last 90 days of reviews', 'Write reply templates by situation', 'Set who replies and how fast', 'Train the team or set up replies', 'Share the one page guide'],
  build: ['Confirm the brief and goal', 'Draft', 'Internal quality check', 'Send for approval', 'Make revisions', 'Launch and test'],
  campaign: ['Brief: goal, offer, audience, dates', 'Landing page', 'Creative and copy', 'Tracking: links, codes, POS', 'Send for approval', 'Launch', 'Results summary'],
  report: ['Pull the numbers', 'Write what moved and why', 'Recommendations for next month', 'Internal quality check', 'Send the report', 'Book the monthly review'],
  call: ['Agenda sent the day before', 'Call held', 'Notes submitted in the meeting kit'],
  plan: ['Pull findings together', 'Prioritize: first 30, 60 and 90 days', 'Write the plan', 'Design the PDF', 'Internal quality check'],
};
export const PLAYBOOK = {
  platinum: [
    { name: 'Kickoff workshop and 90 day roadmap', day: 7, steps: ['Kickoff booked after intake', 'Run kickoff with the meeting kit', 'Draft the 90 day roadmap', 'Send the roadmap'], mode: 'approve' },
    { name: 'Full brand assessment', day: 14, steps: S.assess, mode: 'deliver' },
    { name: 'Google Profile Glow Up (up to 3 locations)', day: 21, steps: S.glow, mode: 'approve' },
    { name: 'Yelp, Apple Maps and Bing cleanup', day: 28, steps: S.listings, mode: null },
    { name: 'Monthly Crown Report 1', day: 30, steps: S.report, mode: 'deliver' },
    { name: 'Review response system', day: 35, steps: S.reviews, mode: 'approve' },
    { name: 'Build 1 (chosen at kickoff)', day: 45, steps: S.build, mode: 'approve' },
    { name: 'Launch: one campaign, landing page included', day: 60, steps: S.campaign, mode: 'approve' },
    { name: 'Monthly Crown Report 2', day: 60, steps: S.report, mode: 'deliver' },
    { name: 'Build 2 (chosen at kickoff)', day: 70, steps: S.build, mode: 'approve' },
    { name: 'Strategy calls, 45 minutes (6 biweekly)', day: 84, steps: [14, 28, 42, 56, 70, 84].map((d, i) => `Strategy call ${i + 1} (week ${Math.round(d / 7)})`), mode: null },
    { name: 'Monthly Crown Report 3', day: 88, steps: S.report, mode: 'deliver' },
    { name: 'Day 90 review and next 90 day recommendation', day: 90, steps: ['Results against the kickoff goals', 'What we recommend next', 'Proposal for the next 90 days', 'Review meeting held'], mode: 'deliver' },
  ],
  crownjewel: [
    { name: 'Annual marketing plan and budget', day: 14, steps: S.plan, mode: 'approve' },
    { name: 'Full assessment and all foundation fixes', day: 30, steps: [...S.assess, 'Google, Yelp, Apple Maps and Bing fixes', 'Review response system'], mode: 'deliver' },
    ...[1, 2, 3, 4, 5, 6].map((n) => ({ name: `Build ${n} (month ${n})`, day: 30 * n, steps: S.build, mode: 'approve' })),
    ...[1, 2, 3].map((n) => ({ name: `Campaign ${n}`, day: 45 + (n - 1) * 60, steps: S.campaign, mode: 'approve' })),
    { name: 'Paid media and social partner management', day: 30, steps: ['Partner briefed', 'Budgets and goals set', 'Monthly performance check in', 'Results in the Crown Report'], mode: null },
    ...[1, 2, 3, 4, 5, 6].map((n) => ({ name: `Monthly Crown Report ${n}`, day: 30 * n - 2, steps: S.report, mode: 'deliver' })),
    { name: 'Quarterly business review 1', day: 90, steps: ['Results against the plan', 'Budget review', 'Next quarter priorities', 'Review meeting held'], mode: 'deliver' },
    { name: 'Quarterly business review 2', day: 180, steps: ['Results against the plan', 'Budget review', 'Renewal recommendation', 'Review meeting held'], mode: 'deliver' },
    { name: 'Weekly leadership calls (24)', day: 168, steps: Array.from({ length: 24 }, (_, i) => `Week ${i + 1} call`), mode: null },
    { name: 'Monthly leadership or operations meetings (6)', day: 180, steps: [1, 2, 3, 4, 5, 6].map((n) => `Month ${n} meeting`), mode: null },
  ],
  gold: [
    { name: 'Website and SEO review', day: 4, steps: ['Site speed and mobile check', 'SEO basics: titles, pages, local signals', 'Conversion path review', 'Notes for the plan'], mode: null },
    { name: 'Google Business Profile and Yelp audit', day: 4, steps: ['Profile completeness', 'Categories, hours and photos', 'Yelp review', 'Notes for the plan'], mode: null },
    { name: 'Reviews and sentiment analysis', day: 5, steps: ['Pull recent reviews', 'Themes: praise and complaints', 'Reply health', 'Notes for the plan'], mode: null },
    { name: 'Brand positioning and competitor review (up to 3)', day: 6, steps: ['Pick 3 competitors', 'Compare offer, price, voice and visuals', 'Positioning recommendation'], mode: null },
    { name: 'New store opening strategy (if an opening is planned)', day: 7, steps: ['Confirm opening date', 'Pre opening, opening week and first 90 days plan'], mode: null },
    { name: 'Custom 90 day plan (PDF)', day: 9, steps: S.plan, mode: 'deliver' },
    { name: 'Live 60 minute plan walkthrough, recorded', day: 12, steps: ['Walkthrough booked', 'Walkthrough held and recorded', 'Recording sent'], mode: null },
    { name: 'Send $497 Platinum credit code after walkthrough', day: 12, steps: ['Code created in Stripe', 'Code sent with the recording'], mode: null },
  ],
  checkup: [
    { name: 'Website review', day: 2, steps: ['Mobile and speed check', 'First impression notes'], mode: null },
    { name: 'Google profile and reviews review', day: 2, steps: ['Profile completeness', 'Recent review themes'], mode: null },
    { name: 'Social media review (up to 2 channels)', day: 3, steps: ['Posting rhythm and engagement', 'Notes'], mode: null },
    { name: 'Three opportunities plus one quick win', day: 3, steps: ['Pick the three biggest opportunities', 'Pick one quick win they can do this week'], mode: null },
    { name: 'Recorded video walkthrough', day: 4, steps: ['Record', 'Upload and get the share link'], mode: null },
    { name: 'Brand Experience Snapshot (PDF)', day: 4, steps: ['Write', 'Design', 'Internal quality check'], mode: 'deliver' },
    { name: 'Send $197 upgrade credit code with delivery', day: 4, steps: ['Code created in Stripe', 'Code included in the delivery'], mode: null },
  ],
  glowup: [
    { name: 'Hours, categories and services cleaned up', day: 3, steps: ['Confirm access', 'Hours and special hours', 'Categories and services'], mode: null },
    { name: 'Business description written', day: 3, steps: ['Draft', 'Send for approval', 'Publish'], mode: 'approve' },
    { name: 'Up to 15 photos selected, optimized and uploaded', day: 5, steps: ['Select', 'Optimize', 'Upload'], mode: null },
    { name: '5 review replies written', day: 5, steps: ['Draft replies', 'Send for approval', 'Post replies'], mode: 'approve' },
    { name: 'Simple review response plan', day: 6, steps: ['Write the one page plan', 'Before and after screenshots'], mode: 'deliver' },
  ],
};

const md = (item, startLabel) => `**Due:** day ${item.day} of the plan${startLabel ? ` (${startLabel})` : ''}\n**Client step:** ${item.mode === 'approve' ? 'Approval. Paste the proof link in a comment, then move this task to client review.' : item.mode === 'deliver' ? 'Delivery. Paste the file or link in a comment, then move this task to client review to send it.' : 'None. Internal task.'}\n\n### Steps\n${item.steps.map((s) => `- [ ] ${s}`).join('\n')}`;
const dueAt = (start, day) => { const d = new Date(`${start}T17:00:00Z`); d.setUTCDate(d.getUTCDate() + day); return d.getTime(); };

/* ---------- won: queue the build and create the portal ---------- */
export async function startClientBuild(env, x, { dealId, contactId, company, planKey, lists, folderId }) {
  if (!env.REPORTS || !dealId) return null;
  const start = new Date().toISOString().slice(0, 10);
  await env.REPORTS.put(`cujob:${dealId}`, JSON.stringify({ dealId: String(dealId), company, planKey, listId: lists?.Deliverables?.id, start, next: 0, created: [] }));
  await addTo(env, 'cujobs', String(dealId));
  if (folderId) await env.REPORTS.put(`cufolder:${folderId}`, String(dealId));
  let ptok = await env.REPORTS.get(`portaldeal:${dealId}`);
  if (!ptok) {
    ptok = token(18);
    await env.REPORTS.put(`portal:${ptok}`, JSON.stringify({ dealId: String(dealId), contactId: String(contactId || ''), company, planKey, created: Date.now() }));
    await env.REPORTS.put(`portaldeal:${dealId}`, ptok);
  }
  return `${WORKER}/portal/${ptok}`;
}
export async function portalUrl(env, dealId) { const t = dealId && (await env.REPORTS.get(`portaldeal:${dealId}`)); return t ? `${WORKER}/portal/${t}` : ''; }
async function addTo(env, key, v) { const l = (await env.REPORTS.get(key, 'json')) || []; if (!l.includes(v)) { l.push(v); await env.REPORTS.put(key, JSON.stringify(l.slice(-200))); } }
async function dropFrom(env, key, v) { const l = (await env.REPORTS.get(key, 'json')) || []; const n = l.filter((y) => y !== v); if (n.length !== l.length) await env.REPORTS.put(key, JSON.stringify(n)); }

// kickoff picked the real start date: every due date moves to count from it
export async function scheduleTimeline(env, x, dealId, start) {
  await env.REPORTS.put(`retime:${dealId}`, start);
  await addTo(env, 'retimes', String(dealId));
}

/* ---------- the 10 minute job ---------- */
export async function fulfillSweep(env, x) {
  if (!env.REPORTS) return;
  let budget = 30; // ClickUp calls this run, to stay well inside the per run limit
  if (!(await env.REPORTS.get('fix:cu-test-folder'))) { await x.cu(env, 'DELETE', '/folder/1000280000018946').catch((e) => console.error('test folder', e.message)); await env.REPORTS.put('fix:cu-test-folder', '1'); budget--; }
  for (const dealId of (await env.REPORTS.get('cujobs', 'json')) || []) {
    if (budget <= 0) break;
    const job = await env.REPORTS.get(`cujob:${dealId}`, 'json');
    const items = job && PLAYBOOK[job.planKey];
    if (!job || !items || !job.listId) { await dropFrom(env, 'cujobs', dealId); continue; }
    const retime = await env.REPORTS.get(`retime:${dealId}`);
    const start = retime || (await env.REPORTS.get(`start:${dealId}`)) || job.start;
    while (job.next < items.length && budget > 0) {
      const it = items[job.next];
      const t = await x.cu(env, 'POST', `/list/${job.listId}/task`, { name: it.name, markdown_description: md(it, `start ${start}`), due_date: dueAt(start, it.day), due_date_time: false, start_date: dueAt(start, Math.max(0, it.day - 7)), tags: it.mode ? [it.mode === 'approve' ? 'client approval' : 'client delivery'] : [] });
      budget--;
      job.created.push({ id: t.id, day: it.day, mode: it.mode });
      await env.REPORTS.put(`cutask:${t.id}`, JSON.stringify({ dealId, mode: it.mode, name: it.name }));
      job.next++;
      await env.REPORTS.put(`cujob:${dealId}`, JSON.stringify(job));
    }
    if (job.next >= items.length) await dropFrom(env, 'cujobs', dealId);
  }
  for (const dealId of (await env.REPORTS.get('retimes', 'json')) || []) {
    if (budget <= 0) break;
    const job = await env.REPORTS.get(`cujob:${dealId}`, 'json');
    const start = await env.REPORTS.get(`retime:${dealId}`);
    if (!job || !start) { await dropFrom(env, 'retimes', dealId); continue; }
    if (job.next < (PLAYBOOK[job.planKey] || []).length) continue; // still building; it will use the new start
    job.retimed = job.retimed || 0;
    while (job.retimed < job.created.length && budget > 0) {
      const c = job.created[job.retimed];
      await x.cu(env, 'PUT', `/task/${c.id}`, { due_date: dueAt(start, c.day), start_date: dueAt(start, Math.max(0, c.day - 7)) }).catch((e) => console.error('retime', e.message));
      budget--; job.retimed++;
    }
    await env.REPORTS.put(`cujob:${dealId}`, JSON.stringify(job));
    if (job.retimed >= job.created.length) { delete job.retimed; await env.REPORTS.put(`cujob:${dealId}`, JSON.stringify(job)); await env.REPORTS.put(`start:${dealId}`, start); await env.REPORTS.delete(`retime:${dealId}`); await dropFrom(env, 'retimes', dealId); }
  }
  if (budget > 4) await approvalSweep(env, x, budget).catch((e) => console.error('approvals', e.message));
}

// tasks moved to "client review": find the proof link, email the client, remember it
async function approvalSweep(env, x, budget) {
  const teams = await x.cu(env, 'GET', '/team');
  const team = teams.teams?.[0]?.id;
  if (!team) return;
  const r = await x.cu(env, 'GET', `/team/${team}/task?space_ids[]=${env.CLICKUP_SPACE_ID}&statuses[]=client%20review&include_closed=false&subtasks=true`);
  budget -= 2;
  for (const t of r.tasks || []) {
    if (budget < 3) break;
    const prevTok = await env.REPORTS.get(`apprtask:${t.id}`);
    const prev = prevTok && (await env.REPORTS.get(`appr:${prevTok}`, 'json'));
    if (prev && prev.status === 'sent') continue; // already waiting on the client
    const meta = (await env.REPORTS.get(`cutask:${t.id}`, 'json')) || {};
    const dealId = meta.dealId || (t.folder?.id && (await env.REPORTS.get(`cufolder:${t.folder.id}`)));
    if (!dealId) continue;
    const mode = meta.mode === 'deliver' ? 'deliver' : 'approve';
    const cm = await x.cu(env, 'GET', `/task/${t.id}/comment`); budget--;
    const comments = (cm.comments || []).filter((c) => !/^Markit Mike automation:/.test(c.comment_text || ''));
    const withLink = comments.find((c) => /https?:\/\/\S+/.test(c.comment_text || ''));
    let link = withLink ? (withLink.comment_text.match(/https?:\/\/[^\s)>\]]+/) || [])[0] : '';
    let note = withLink ? withLink.comment_text.replace(/https?:\/\/\S+/g, '').trim() : '';
    if (!link) {
      const full = await x.cu(env, 'GET', `/task/${t.id}`); budget--;
      link = full.attachments?.[0]?.url || '';
    }
    if (!link) {
      await x.cu(env, 'POST', `/task/${t.id}/comment`, { comment_text: 'Markit Mike automation: add the proof or file link in a comment first, then move this task back to client review. Nothing was sent.', notify_all: false });
      await x.cu(env, 'PUT', `/task/${t.id}`, { status: 'in progress' });
      budget -= 2;
      continue;
    }
    const deal = await x.hs(env, 'GET', `/crm/v4/objects/deals/${dealId}/associations/contacts`).catch(() => null);
    const cid = deal?.results?.[0]?.toObjectId;
    const contact = cid && (await x.hs(env, 'GET', `/crm/v3/objects/contacts/${cid}?properties=email,firstname,lastname,company`));
    const email = contact?.properties?.email;
    if (!email) continue;
    const atok = token();
    const name = t.name.replace(/\s*\((chosen at kickoff|month \d+)\)\s*$/i, '');
    const rec = { tok: atok, taskId: t.id, dealId: String(dealId), contactId: String(cid), name, link, note: note.slice(0, 1200), mode, status: 'sent', sentAt: Date.now(), company: contact.properties.company || '' };
    await env.REPORTS.put(`appr:${atok}`, JSON.stringify(rec));
    await addTo(env, `apprdeal:${dealId}`, atok);
    const portal = await portalUrl(env, dealId);
    const mail = mode === 'approve' ? approvalEmail({ firstName: contact.properties.firstname, item: name, note, link: `${WORKER}/approve/${atok}`, portal }) : deliveryEmail({ firstName: contact.properties.firstname, item: name, note, link, portal });
    await x.sendAndLog(env, { to: email, contact, deal: { id: dealId }, ...mail });
    await x.cu(env, 'POST', `/task/${t.id}/comment`, { comment_text: `Markit Mike automation: ${mode === 'approve' ? 'sent to' : 'delivered to'} ${email} on ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT.${mode === 'approve' ? ' Their answer will move this task.' : ''}`, notify_all: false });
    if (mode === 'deliver') await x.cu(env, 'PUT', `/task/${t.id}`, { status: 'complete' });
    budget -= mode === 'deliver' ? 3 : 2;
    await env.REPORTS.put(`apprtask:${t.id}`, atok);
    if (mode === 'deliver') { rec.status = 'delivered'; await env.REPORTS.put(`appr:${atok}`, JSON.stringify(rec)); }
  }
}

/* ---------- pages ---------- */
function shell(title, inner) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--g:#E79A27;--t:#108193;--p:#5D0EA6;--ink:#1B1030;--mut:#6B6280;--line:#E7E0F0}
*{box-sizing:border-box}body{margin:0;background:#EFEAF6;font-family:Inter,Arial,sans-serif;color:var(--ink);font-size:16px;line-height:1.5}
.wrap{max-width:860px;margin:0 auto;padding:0 16px 60px}
.hdr{background:linear-gradient(160deg,#036684 0%,#0B3354 52%,#1D0A40 100%);color:#fff;padding:24px 28px 44px;border-radius:0 0 24px 24px;margin:0 -16px 22px;position:relative;overflow:hidden}
.hdr img{height:34px;display:block;margin-bottom:22px}.eb{margin:0;color:#FBE7C6;font:800 12px Montserrat,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
h1{font:900 clamp(26px,6vw,38px)/1.1 Montserrat,Arial,sans-serif;margin:6px 0 6px}.hdr .sub{color:#D9E8F2;margin:0}
.card{background:#fff;border-radius:16px;padding:20px 22px;box-shadow:0 10px 30px rgba(43,15,99,.08);margin-bottom:16px}
.k{font:800 12px Montserrat,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:var(--p);margin:0 0 12px}
.prog{height:12px;border-radius:999px;background:#F1ECF8;overflow:hidden}.prog i{display:block;height:100%;background:linear-gradient(90deg,#FFE08A,#E79A27 55%,#C06F14);border-radius:999px}
.stats{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px;font-size:14px;color:var(--mut)}.stats b{font:900 22px Montserrat,Arial,sans-serif;color:var(--ink);display:block}
.item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line)}.item:first-of-type{border-top:0}
.item b{font-weight:600}.item small{display:block;color:var(--mut)}
.pill{font:800 11px Montserrat,Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;border-radius:999px;padding:5px 10px;white-space:nowrap;background:#F1ECF8;color:var(--mut)}
.pill.done{background:#E3F4F1;color:#0B6B5E}.pill.rev{background:#FFF3DF;color:#9A5B00}.pill.wip{background:#EEE9FB;color:var(--p)}.pill.chg{background:#FDECEC;color:#B42318}
.btn{display:inline-block;border:0;border-radius:999px;padding:13px 26px;font:900 15px Montserrat,Arial,sans-serif;color:#2A0E52;background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);cursor:pointer;text-decoration:none}
.btn.alt{background:#fff;color:var(--p);border:2px solid var(--p)}.btn.sm{padding:9px 16px;font-size:13px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
textarea{width:100%;min-height:110px;border:1.5px solid var(--line);border-radius:12px;padding:12px;font:inherit;margin:10px 0}
.sig{display:flex;gap:12px;align-items:center;margin-top:22px;color:var(--mut);font-size:14px}.sig img{width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid var(--g)}
a{color:var(--t)}
</style></head><body><div class="wrap">${inner}<div class="sig"><img src="https://markitmike.com/wp-content/uploads/2026/10/mm-vp-me.png" alt="Markit Mike"><div><b style="color:var(--ink)">Markit Mike</b><br>Questions? Reply to any of our emails or call (714) 919 9469.</div></div></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
const hdr = (eb, title, sub) => `<div class="hdr"><img src="${LOGO}" alt="Markit Mike Agency"><p class="eb">${esc(eb)}</p><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div>`;

export async function approveRoute(req, env, x) {
  const url = new URL(req.url);
  const tok = (url.pathname.split('/')[2] || '').replace(/[^a-z0-9]/g, '');
  const rec = tok && (await env.REPORTS.get(`appr:${tok}`, 'json'));
  if (!rec) return shell('Not found', hdr('Markit Mike Agency', 'This link is not available.', 'Reply to our email and we will sort it out.'));
  const portal = await portalUrl(env, rec.dealId);
  if (req.method === 'POST' && rec.status === 'sent') {
    const f = await req.formData().catch(() => null);
    const choice = String(f?.get('choice') || '');
    const comments = String(f?.get('comments') || '').slice(0, 3000).trim();
    if (choice === 'approve' || (choice === 'changes' && comments)) {
      rec.status = choice === 'approve' ? 'approved' : 'changes'; rec.decidedAt = Date.now(); rec.comments = comments;
      await env.REPORTS.put(`appr:${tok}`, JSON.stringify(rec));
      const who = rec.company || 'The client';
      await Promise.allSettled([
        x.cu(env, 'PUT', `/task/${rec.taskId}`, { status: choice === 'approve' ? 'approved' : 'changes requested' }),
        x.cu(env, 'POST', `/task/${rec.taskId}/comment`, { comment_text: `Markit Mike automation: ${choice === 'approve' ? 'APPROVED by the client' : 'CHANGES REQUESTED by the client'}.${comments ? `\n\n${comments}` : ''}`, notify_all: true }),
        x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>${choice === 'approve' ? 'Approved' : 'Changes requested'}:</b> ${esc(rec.name)}</p>${comments ? `<p>${esc(comments).replace(/\n/g, '<br>')}</p>` : ''}` }, associations: [{ to: { id: rec.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }, { to: { id: rec.dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }] }),
        x.sendRaw && x.sendRaw(env, { to: env.OWNER_EMAIL, subject: `${choice === 'approve' ? 'Approved' : 'Changes requested'}: ${rec.name}${rec.company ? ` (${rec.company})` : ''}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:${choice === 'approve' ? '#108193' : '#B42318'};">${choice === 'approve' ? 'APPROVED' : 'CHANGES REQUESTED'}</p><p style="margin:0 0 12px;font-size:20px;font-weight:800;">${esc(who)}: ${esc(rec.name)}</p>${comments ? `<p style="font-size:15px;white-space:pre-wrap;">${esc(comments)}</p>` : '<p style="font-size:15px;">Good to go live.</p>'}<p><a href="https://app.clickup.com/t/${rec.taskId}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#5D0EA6;color:#fff;font-weight:700;text-decoration:none;">Open the task in ClickUp</a></p></div>` }),
      ]);
    }
    return Response.redirect(`${WORKER}/approve/${tok}`, 303);
  }
  const back = portal ? `<p><a href="${portal}">Back to your client portal</a></p>` : '';
  if (rec.status === 'approved') return shell('Approved', hdr('Thank you', 'Approved. Nice!', rec.name) + `<div class="card"><p>Our team has your approval and will take it from here.</p>${back}</div>`);
  if (rec.status === 'changes') return shell('Changes received', hdr('Thank you', 'Got your notes.', rec.name) + `<div class="card"><p>Our team is on the changes and will send an updated version for your review.</p><p style="color:var(--mut);white-space:pre-wrap">${esc(rec.comments)}</p>${back}</div>`);
  return shell(`Review: ${rec.name}`, hdr('Ready for your review', rec.name, rec.company) +
    `<div class="card"><p class="k">Step 1</p><p>${rec.note ? esc(rec.note) : 'Take a look and let us know what you think.'}</p><a class="btn alt" href="${esc(rec.link)}" target="_blank" rel="noopener">Open it to review</a></div>
<div class="card"><p class="k">Step 2</p><div class="row"><form method="post"><input type="hidden" name="choice" value="approve"><button class="btn" type="submit">Approve</button></form></div>
<form method="post" style="margin-top:18px"><input type="hidden" name="choice" value="changes"><label for="c"><b>Or request changes</b></label><textarea id="c" name="comments" placeholder="What would you like changed?" required></textarea><button class="btn alt sm" type="submit">Send my changes</button></form></div>${back}`);
}

const PILL = { 'to do': ['Up next', ''], 'in progress': ['In progress', 'wip'], 'client review': ['With you', 'rev'], 'changes requested': ['Revising', 'chg'], approved: ['Approved', 'done'], complete: ['Done', 'done'] };
export async function portalRoute(req, env, x) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const tok = (parts[2] || '').replace(/[^a-z0-9]/g, '');
  const rec = tok && (await env.REPORTS.get(`portal:${tok}`, 'json'));
  if (!rec) return shell('Not found', hdr('Markit Mike Agency', 'This link is not available.', 'Reply to our email and we will send you a fresh one.'));
  const lists = await env.REPORTS.get(`cu:${rec.dealId}`, 'json');

  if (req.method === 'POST' && parts[3] === 'book') {
    const type = parts[4];
    if (!['checkin', 'monthly'].includes(type)) return Response.redirect(`${WORKER}/portal/${tok}`, 303);
    const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${rec.contactId}?properties=email,firstname,lastname,company`);
    const cp = contact.properties || {};
    const o = await offerTimes(env, x, type, { dealId: `${rec.dealId}`, contactId: rec.contactId, company: rec.company, firstName: cp.firstname, name: [cp.firstname, cp.lastname].filter(Boolean).join(' '), email: cp.email });
    return Response.redirect(o.url, 303);
  }

  let tasks = [];
  if (lists?.Deliverables?.id) { try { tasks = (await x.cu(env, 'GET', `/list/${lists.Deliverables.id}/task?archived=false&include_closed=true&order_by=due_date&reverse=true`)).tasks || []; } catch (e) { console.error('portal tasks', e.message); } }
  const work = tasks.filter((t) => !/^(Next month|Client ask|Check in notes|Kickoff notes)/.test(t.name));
  const done = work.filter((t) => ['complete', 'approved'].includes(t.status?.status)).length;
  const pct = work.length ? Math.round((done / work.length) * 100) : 0;
  const apprs = [];
  for (const a of (await env.REPORTS.get(`apprdeal:${rec.dealId}`, 'json')) || []) { const r = await env.REPORTS.get(`appr:${a}`, 'json'); if (r) apprs.push(r); }
  const waiting = apprs.filter((a) => a.status === 'sent');
  const delivered = apprs.filter((a) => a.status !== 'sent').sort((p, q) => (q.decidedAt || q.sentAt) - (p.decidedAt || p.sentAt));
  const meetings = [];
  for (const type of Object.keys(MEETINGS)) {
    const bt = await env.REPORTS.get(`bookdeal:${type}:${rec.dealId}`);
    const b = bt && (await env.REPORTS.get(`book:${bt}`, 'json'));
    if (b?.status === 'booked' && new Date(b.booked.start).getTime() > Date.now() - 36e5) meetings.push(`<div class="item"><div><b>${esc(MEETINGS[type].title)}</b><small>${esc(whenText(b.booked.start))}</small></div>${b.booked.meet ? `<a class="btn sm alt" href="${esc(b.booked.meet)}">Join</a>` : ''}</div>`);
    else if (b?.status === 'offered') meetings.push(`<div class="item"><div><b>${esc(MEETINGS[type].title)}</b><small>Times are saved for you</small></div><a class="btn sm" href="${WORKER}/book/${bt}">Pick a time</a></div>`);
  }
  const due = (t) => (t.due_date ? new Date(Number(t.due_date)).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }) : '');
  const workRows = work.sort((p, q) => Number(p.due_date || 9e15) - Number(q.due_date || 9e15)).map((t) => { const [lab, cls] = PILL[t.status?.status] || ['In progress', 'wip']; return `<div class="item"><div><b>${esc(t.name.replace(/\s*\((chosen at kickoff|month \d+)\)\s*$/i, ''))}</b>${due(t) && !['complete', 'approved'].includes(t.status?.status) ? `<small>Target ${esc(due(t))}</small>` : ''}</div><span class="pill ${cls}">${lab}</span></div>`; }).join('');
  const body = hdr('Client portal', rec.company || 'Your plan', 'Everything we are working on for you, in one place.') +
    (waiting.length ? `<div class="card" style="border:2px solid var(--g)"><p class="k">Waiting on you</p>${waiting.map((a) => `<div class="item"><div><b>${esc(a.name)}</b><small>Ready for your review</small></div><a class="btn sm" href="${WORKER}/approve/${a.tok}">Review</a></div>`).join('')}</div>` : '') +
    `<div class="card"><p class="k">Progress</p><div class="prog"><i style="width:${pct}%"></i></div><div class="stats"><div><b>${pct}%</b>complete</div><div><b>${done}</b>done</div><div><b>${Math.max(0, work.length - done)}</b>to go</div></div></div>` +
    `<div class="card"><p class="k">Meetings</p>${meetings.join('') || '<p style="margin:0 0 12px;color:var(--mut)">Nothing booked right now.</p>'}<div class="row" style="margin-top:12px"><form method="post" action="${WORKER}/portal/${tok}/book/checkin"><button class="btn sm alt" type="submit">Book a quick check in</button></form><form method="post" action="${WORKER}/portal/${tok}/book/monthly"><button class="btn sm alt" type="submit">Book a monthly review</button></form></div></div>` +
    (delivered.length ? `<div class="card"><p class="k">Delivered to you</p>${delivered.map((a) => `<div class="item"><div><b>${esc(a.name)}</b><small>${esc(new Date(a.decidedAt || a.sentAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' }))}${a.status === 'changes' ? ', revising' : ''}</small></div><a class="btn sm alt" href="${esc(a.link)}" target="_blank" rel="noopener">Open</a></div>`).join('')}</div>` : '') +
    `<div class="card"><p class="k">Your plan</p>${workRows || '<p style="margin:0;color:var(--mut)">Your plan is being set up. Check back shortly.</p>'}</div>`;
  return shell(`${rec.company || 'Client'} portal`, body);
}
