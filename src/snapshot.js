// Brand Experience Snapshot, drafted automatically the moment Crown Fitting Notes are submitted.
//   draft:   AI writes the content from the notes (nothing invented), saved to KV
//   review:  GET /snapshot/<tok>  private page for Markit Mike: edit any text in place, Save, Approve and send
//   client:  GET /s/<pub>         the prospect's view (printable); first open alerts the owner
import { snapshotEmail } from './emails.js';
import { FIT_SECTIONS } from './fitting.js';
import { CROWN_SCORES } from './crown.js';
import { offerTimes, shortWhen } from './schedule.js';
import { FIXES, FIX_KEYS, OFFER_KEYS, OFFER_LABELS, fixCategory, fixArt, fixLinks } from './fixes.js';

const WORKER = 'https://mma-automations.markitmike.workers.dev';
const LOGO = 'https://markitmike.com/wp-content/uploads/2026/11/mma-logo-reverse-tight.png';
const AVATAR = 'https://markitmike.com/wp-content/uploads/2026/10/mm-vp-me.png';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SCORES = CROWN_SCORES.map(([k, lab]) => [k, lab]);
// Snapshots drafted before the Crown Framework switch (Nov 2026) still show their original scores
const LEGACY_SCORES = [['s_brand', 'Brand'], ['s_digital', 'Digital presence'], ['s_loyalty', 'Loyalty and retention'], ['s_lsm', 'Local store marketing'], ['s_reviews', 'Reviews and reputation']];

function token(n = 14) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return [...a].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

const SYSTEM = `You write the Brand Experience Snapshot for Markit Mike Agency: a warm, sharp, one glance summary sent to a prospect the day after their free Crown Fitting call. You are given the call notes. Write ONLY from those notes. Never invent numbers, names, dates, ratings, tools or facts. If something is not in the notes, leave it out.

Voice: confident, warm, plain English, short sentences, speaking to the prospect as "you" and as "our team" (never "I", never the name Michael). No dashes of any kind (no hyphens, en dashes or em dashes); use commas or periods. If the business is a restaurant, capitalize Guest and Guests.

Return ONLY a JSON object with exactly these keys:
{
 "quote": "their single most telling line from the notes, lightly cleaned up, in their words (no quote marks)",
 "quote_label": "what the quote is, for example Your 90 day goal, in your words",
 "where": ["2 or 3 short statements about where things stand today"],
 "observations": [{"title": "3 to 5 word title", "saw": "what we saw, one sentence", "why": "why it matters, one sentence", "quick_win": "one concrete action they can take this week, or empty string", "category": "one of google, reviews (rating, volume, replies), sentiment (what customers repeatedly praise or complain about), website, social, ordering (online ordering and delivery), email (email or text marketing), loyalty (they have no loyalty program or app yet), loyaltyboost (they have a live loyalty program or app that could perform better), local (local store marketing and community), competitors (how they stack up against nearby competitors), experience (in store experience), opening, brand, other", "steps": ["2 or 3 short do it yourself steps specific to this observation, each under 15 words"], "stat_value": "one number from the notes or research that shows this gap, for example 3.8 or 12, or empty string", "stat_label": "what that number is, for example Google rating, or empty string", "stat_goal": "a target for that number only if the notes give one, else empty string"}],
 "summary": "one bold sentence that ties their goal to the biggest gap",
 "summary_more": "one supporting sentence",
 "help": [{"title": "what they want help with, short", "quote": "their words if the notes have them, else empty string"}],
 "dates": [{"when": "short label like Mar", "what": "the moment they mentioned"}],
 "attendees": [{"name": "name or role", "role": "why they should join"}],
 "recommendation": {"offer": "the recommended offer from the notes, or empty", "why": "one or two sentences on why it fits"},
 "next": "one sentence on the next step: the plan walkthrough"
}
Exactly 3 observations. Up to 3 help items. dates and attendees may be empty arrays if the notes have none. Only one observation may have a quick_win; the others use empty string. Pick the category that best matches where the fix lives. Never invent a stat; leave the stat fields empty unless the number is written in the notes or research.`;

function notesText(a) {
  const out = [];
  for (const s of FIT_SECTIONS) for (const [k, lab] of s.f) {
    const v = a[k];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    out.push(`${lab}: ${Array.isArray(v) ? v.join(', ') : v}`);
  }
  return out.join('\n');
}

function fallback(a) {
  const pick = (...k) => k.map((x) => a[x]).find(Boolean) || '';
  return {
    quote: pick('win90', 'why', 'pain'), quote_label: a.win90 ? 'Your 90 day goal, in your words' : 'Why you reached out, in your words',
    where: [a.who && `Marketing today: ${[].concat(a.who).join(', ')}.`, a.working && `Working: ${a.working}`, a.notworking && `Not working yet: ${a.notworking}`].filter(Boolean).slice(0, 3),
    observations: [
      { title: 'Your biggest priority', saw: pick('pri1', 'pain'), why: 'This is where focus will pay off first.', quick_win: '' },
      { title: 'What is holding you back', saw: pick('pain', 'notworking'), why: 'Solving it unlocks the rest of the plan.', quick_win: '' },
      { title: 'Customer experience', saw: pick('webnotes', 'loyalty'), why: 'First impressions online and in store drive repeat visits.', quick_win: '' },
    ],
    summary: 'You have a clear goal and a few fixable gaps standing in the way.', summary_more: 'Your plan walkthrough will show exactly what to do first.',
    help: [a.pri1, a.pri2, a.pri3].filter(Boolean).map((t) => ({ title: t, quote: '' })),
    dates: [], attendees: a.decider ? [{ name: a.decider, role: 'weighs in on decisions' }] : [],
    recommendation: { offer: a.offer && a.offer !== 'Not a fit' ? a.offer : '', why: a.next || '' }, next: 'Next, we walk through your plan together and answer every question.',
  };
}

async function draftContent(env, answers, company, brief) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', ...(env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } : {}) },
      body: JSON.stringify({ model: env.CHAMBERLAIN_MODEL || 'claude-sonnet-5-5', max_tokens: 2000, system: SYSTEM, messages: [{ role: 'user', content: `Business: ${company}\n\nCrown Fitting notes:\n${notesText(answers)}${brief?.data ? `\n\nPre-call research from public sources (use it only where the call notes agree or are silent, never over them, and never mention that research was done):\n${JSON.stringify({ business: brief.data.business, locations: brief.data.locations, reviews: brief.data.reviews, digital: brief.data.digital, observations: brief.data.observations })}` : ''}` }] }),
    });
    if (!r.ok) throw new Error(`anthropic ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (!Array.isArray(data.observations) || !data.quote) throw new Error('incomplete draft');
    // belt and braces on the house style
    const clean = (v) => (typeof v === 'string' ? v.replace(/\s*[–—]\s*/g, ', ').replace(/(\w)-(\w)/g, '$1 $2') : Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v);
    const out = clean(data);
    for (const o of out.observations || []) { if (Array.isArray(o.steps)) o.diy = o.steps.filter(Boolean).slice(0, 3).join('\n'); delete o.steps; }
    return { data: out, ai: true };
  } catch (e) {
    console.error('snapshot draft', e.message);
    return { data: fallback(answers), ai: false };
  }
}

// called after Crown Fitting Notes are saved; returns the review link
export async function buildSnapshot(env, x, { dealId, contactId, answers, who, company, firstName }) {
  const brief = await env.REPORTS.get(`brief:${dealId}`, 'json').catch(() => null);
  const { data, ai } = await draftContent(env, answers, company || who, brief);
  let site = brief?.page?.url || (brief?.site ? `https://${brief.site}/` : '');
  if (!site) { const c = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${contactId}?properties=website`).catch(() => null); const w = c?.properties?.website; if (w) site = /^https?:/i.test(w) ? w : `https://${w}`; }
  // ask the screenshot service to start rendering now, so the image is ready when the Snapshot is opened
  if (site) fetch(shot(site)).catch(() => {});
  const prev = await env.REPORTS.get(`snapdeal:${dealId}`);
  const tok = prev || token();
  // a redraft (notes resubmitted) keeps the same review link, client link and HubSpot task
  const old = prev ? await env.REPORTS.get(`snap:${prev}`, 'json') : null;
  const rec = { dealId: String(dealId), contactId: String(contactId), company: company || who, who, firstName, date: new Date().toISOString(), scores: Object.fromEntries(SCORES.map(([k]) => [k, Number(answers[k]) || null])), data, ai, site: site || old?.site || '', status: 'draft', pub: old?.pub || token(16), ...(old?.taskId ? { taskId: old.taskId } : {}) };
  await env.REPORTS.put(`snap:${tok}`, JSON.stringify(rec));
  await env.REPORTS.put(`snapdeal:${dealId}`, tok);
  return { url: `${WORKER}/snapshot/${tok}`, ai };
}

const shot = (site) => `https://s.wordpress.com/mshots/v1/${encodeURIComponent(site)}?w=960&h=540`;

function visual(o, i, cat, rec, ed, E) {
  const img = /^https:\/\/\S+$/.test(o.image || '') ? o.image : cat === 'website' && rec.site ? shot(rec.site) : '';
  const stat = o.stat_value || ed ? `<div class="stat">${E(`observations.${i}.stat_value`, o.stat_value || '', 'b')}${E(`observations.${i}.stat_label`, o.stat_label || '', 'span')}${o.stat_goal || ed ? `<em>Goal ${E(`observations.${i}.stat_goal`, o.stat_goal || '')}</em>` : ''}</div>` : '';
  return `<div class="vis">${img ? `<img src="${esc(img)}" alt="${esc(o.title)}" loading="lazy">` : fixArt(cat)}${!img && stat ? stat : ''}</div>`;
}

function fixBlock(o, i, cat, rec, ed, track, E) {
  // only the prospect's own view carries their token, so our clicks in review or present mode are never logged
  const l = fixLinks(cat, track ? rec.pub : '', o.offer);
  const diy = o.diy || ed ? `<p class="k sub">Do it yourself</p>${E(`observations.${i}.diy`, o.diy || '', 'p', 'steps')}` : '';
  const btn = l.offer.inline ? `<a class="dfy" href="${l.dfy}">${esc(l.offer.cta)} <small>We cover this in ${esc(l.offer.name)}</small></a>` : `<a class="dfy" href="${l.dfy}" target="_blank" rel="noopener">${esc(l.offer.cta)} <small>${esc(l.offer.name)}, ${esc(l.offer.price)}</small></a>`;
  const ctl = ed ? `<div class="ctl"><label>Done for you <select data-k="observations.${i}.offer">${OFFER_KEYS.map((k) => `<option value="${k}"${k === l.offerKey ? ' selected' : ''}>${esc(OFFER_LABELS[k])}</option>`).join('')}</select></label><label>Fix type <select data-k="observations.${i}.category">${FIX_KEYS.map((k) => `<option value="${k}"${k === cat ? ' selected' : ''}>${esc(FIXES[k].label)}</option>`).join('')}</select></label><label>Picture URL <input data-k="observations.${i}.image" value="${esc(o.image || '')}" placeholder="Optional: paste a screenshot link"></label></div>` : '';
  return `<div class="fix"><p class="k">Start fixing it</p>${diy}${l.diy ? `<a class="diy" href="${l.diy}" target="_blank" rel="noopener">Free guide: ${esc(l.guide)} &rarr;</a>` : ''}${btn}</div>${ctl}`;
}

function doc(rec, mode) {
  const d = rec.data || {};
  const ed = mode === 'review';
  const E = (path, val, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''}${ed ? ` data-k="${path}" contenteditable="true"` : ''}>${esc(val)}</${tag}>`;
  const date = new Date(rec.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
  const scores = [...SCORES, ...LEGACY_SCORES].filter(([k]) => rec.scores && rec.scores[k]).map(([k, lab]) => `<div class="sc"><span>${esc(lab)}</span><b><i style="width:${(rec.scores[k] / 5) * 100}%"></i></b><em>${rec.scores[k]}/5</em></div>`).join('');
  // the prospect's emailed view is a preview: what we heard plus one standout observation.
  // The scorecard, the other observations and the recommendation are revealed live in the walkthrough.
  const preview = mode === 'client';
  const allObs = (d.observations || []).slice(0, 3);
  const featured = Math.max(0, allObs.findIndex((o) => o && o.quick_win));
  const obs = allObs.map((o, i) => [o, i]).filter(([, i]) => !preview || i === featured).map(([o, i]) => [o, i, fixCategory(o)]).map(([o, i, cat]) => `<div class="card">${visual(o, i, cat, rec, ed, E)}<div class="num">${i + 1}</div>${E(`observations.${i}.title`, o.title, 'h3')}<p class="k">What we saw</p>${E(`observations.${i}.saw`, o.saw, 'p')}<p class="k">Why it matters</p>${E(`observations.${i}.why`, o.why, 'p')}${o.quick_win || ed ? `<div class="qw"${!o.quick_win && ed ? ' data-empty="1"' : ''}><p class="k">Quick win</p>${E(`observations.${i}.quick_win`, o.quick_win || '', 'p')}</div>` : ''}${fixBlock(o, i, cat, rec, ed, preview, E)}</div>`).join('');
  const help = (d.help || []).map((h, i) => `<li><b>&#10003;</b><div>${E(`help.${i}.title`, h.title, 'strong')}${h.quote || ed ? `<small>&ldquo;${E(`help.${i}.quote`, h.quote || '')}&rdquo;</small>` : ''}</div></li>`).join('');
  const dates = (d.dates || []).map((t, i) => `<div class="dt">${E(`dates.${i}.when`, t.when, 'b')}${E(`dates.${i}.what`, t.what, 'span')}</div>`).join('');
  const att = (d.attendees || []).map((t, i) => `<li>${E(`attendees.${i}.name`, t.name, 'b')} &middot; ${E(`attendees.${i}.role`, t.role)}</li>`).join('');
  return `<article class="snap">
<header class="hdr"><div class="hdr-top"><img src="${LOGO}" alt="Markit Mike Agency" class="logo"><div class="meta">Prepared for<b>${esc(rec.company)}</b>${esc(date)}</div></div>
<p class="eyebrow">${preview ? 'Crown Fitting recap · preview' : 'Crown Fitting recap'}</p><h1>Brand Experience <span>Snapshot</span></h1></header>
<div class="foil"></div>
<section class="sec heard"><div><p class="label">What we heard</p><blockquote>&ldquo;${E('quote', d.quote)}&rdquo;<small>${E('quote_label', d.quote_label)}</small></blockquote></div>
<div class="today"><h4>Where things stand</h4>${(d.where || []).map((w, i) => E(`where.${i}`, w, 'p')).join('')}</div></section>
${preview ? `<section class="sec"><p class="label">The first opportunity we spotted</p><div class="cards one">${obs}</div></section>
<section class="sec reveal"><p class="label">Saved for your walkthrough</p><div class="locks"><div><b>Your Crown scorecard</b><span>How your brand scores across all five areas of the Crown Framework</span></div><div><b>Two more observations</b><span>The rest of what we found, and why it matters</span></div><div><b>Your 90 day plan</b><span>Exactly what to do first, and our recommendation</span></div></div></section>` : `${scores ? `<section class="sec"><p class="label">Your Crown scorecard</p><div class="scores">${scores}</div></section>` : ''}
<section class="sec"><p class="label">Three observations</p><div class="cards">${obs}</div></section>
<section class="sec sum"><p>${E('summary', d.summary, 'strong')} ${E('summary_more', d.summary_more)}</p></section>`}
<section class="sec two"><div><p class="label">What you told us you want help with</p><ul class="help">${help}</ul></div>
<div>${dates ? `<p class="label">Key dates you mentioned</p><div class="dates">${dates}</div>` : ''}${att ? `<p class="label">Who should join the walkthrough</p><ul class="att">${att}</ul>` : ''}</div></section>
${!preview && d.recommendation && (d.recommendation.offer || ed) ? `<section class="sec rec"><p class="label">Our recommendation</p><h3>${E('recommendation.offer', d.recommendation.offer || '')}</h3>${E('recommendation.why', d.recommendation.why || '', 'p')}</section>` : ''}
<section class="sec next" id="next"><p class="label">Where we go from here</p>${E('next', d.next, 'p')}${walkthroughBlock(rec, mode)}</section>
<footer class="sig"><img src="${AVATAR}" alt="Markit Mike"><div><b>Markit Mike</b><span>Markit Mike Agency&trade;</span><span>(714) 919 9469 &middot; team@markitmike.com &middot; markitmike.com</span></div></footer>
</article>`;
}

function walkthroughBlock(rec, mode) {
  const b = rec.booking;
  if (mode === 'review' && !b) return '<p class="wt-note">When you send, 3 walkthrough times are held on your calendar and offered here and in the email.</p>';
  if (!b) return '';
  if (b.booked) return `<p class="wt-k">Your plan walkthrough</p><p><b>${esc(b.booked.text)}</b> on Google Meet. Your invite came from michael@markitmike.com.</p>`;
  const live = (b.slots || []).filter((s) => new Date(s.start).getTime() > Date.now());
  const btns = live.map((s, i) => { const w = shortWhen(s.start); return `<a class="slotbtn" href="${b.url}?s=${(b.slots || []).indexOf(s)}"><b>${esc(w.day)}</b><span>${esc(w.time)} &middot; ${esc(w.et)}</span></a>`; }).join('');
  return `${btns ? `<p class="wt-k">Times saved for you</p><div class="slotrow">${btns}</div>` : ''}<a class="cta" href="${b.url}">${btns ? 'See all times' : 'Book your plan walkthrough'}</a>`;
}

const CSS = `
.slotrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:6px 0 16px}.slotbtn{display:block;background:#fff;border:2px solid #E79A27;border-radius:12px;padding:12px 14px;text-decoration:none;color:#1B1030}.slotbtn b{display:block;font:800 15px Montserrat,Arial,sans-serif}.slotbtn span{font-size:13px;color:#6B6280}.slotbtn:hover{background:#FFF8EC}.wt-k{font:800 12px Montserrat,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#5D0EA6;margin:14px 0 4px}.wt-note{font-size:13px;opacity:.8;margin-top:10px}
:root{--gold:#E79A27;--teal:#108193;--purple:#5D0EA6;--ink:#1B1030;--body:#3A3646;--soft:#F6F2FB;--line:#E7E0F0;--bg:#EFEAF6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:Inter,Arial,sans-serif;color:var(--body);font-size:15px;line-height:1.5}
.snap{max-width:860px;margin:24px auto 60px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(43,15,99,.14)}
.hdr{background:linear-gradient(160deg,#036684 0%,#0B3354 52%,#1D0A40 100%);color:#fff;padding:26px 44px 56px;clip-path:polygon(0 0,100% 0,100% calc(100% - 30px),0 100%)}
.hdr-top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.logo{height:40px}
.meta{text-align:right;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.78)}.meta b{display:block;color:#fff;font:800 16px Montserrat,Arial;letter-spacing:0;text-transform:none}
.eyebrow{margin:22px 0 0;font:800 11px Montserrat,Arial;letter-spacing:.3em;text-transform:uppercase;color:#FBE7C6}
h1{margin:6px 0 0;font:900 clamp(28px,5vw,40px)/1.05 Montserrat,Arial;color:#fff}h1 span{background:linear-gradient(90deg,#F7C66B,#E79A27 55%,#C9741A);-webkit-background-clip:text;background-clip:text;color:transparent}
.cards.one{grid-template-columns:minmax(0,520px)!important}.locks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.locks div{padding:16px 18px;border-radius:14px;border:1.5px dashed #d9cdec;background:#faf7fd}.locks b{display:block;font:800 15px Montserrat,Arial;color:#2a0d55}.locks b::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#E79A27;margin-right:8px;vertical-align:2px}.locks span{display:block;margin-top:4px;font-size:13px;color:#6b6280}@media (max-width:640px){.locks{grid-template-columns:1fr}}
.foil{position:relative;height:36px;margin-top:-30px;margin-bottom:-22px;background:linear-gradient(90deg,#F7D58B,#E79A27 40%,#B8681A 70%,#F2B85A);clip-path:polygon(0 30px,100% 0,100% 6px,0 36px);pointer-events:none}
.sec{padding:22px 44px 0}.sec:last-of-type{padding-bottom:10px}
.label{display:flex;align-items:center;gap:8px;margin:0 0 10px;font:800 11px Montserrat,Arial;letter-spacing:.2em;text-transform:uppercase;color:var(--purple)}.label::before{content:"";width:18px;height:3px;border-radius:2px;background:var(--gold)}
.heard{display:grid;grid-template-columns:1.5fr 1fr;gap:28px;align-items:center}
blockquote{margin:0;padding-left:16px;border-left:3px solid var(--gold);font:italic 500 21px/1.3 "Playfair Display",Georgia,serif;color:var(--ink)}blockquote small{display:block;margin-top:8px;font:12px Inter,Arial;color:#7A7388;font-style:normal}
.today{background:var(--soft);border-radius:12px;padding:14px 16px;font-size:14px}.today h4{margin:0 0 6px;font:800 11px Montserrat,Arial;letter-spacing:.14em;text-transform:uppercase;color:var(--teal)}.today p{margin:0 0 6px}
.scores{display:grid;gap:8px}.sc{display:grid;grid-template-columns:200px 1fr 44px;align-items:center;gap:12px;font-size:14px;font-weight:600;color:var(--ink)}
.sc b{height:10px;border-radius:99px;background:#EEE8F6;overflow:hidden}.sc i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--teal),var(--purple))}.sc em{font-style:normal;font-weight:800;color:var(--purple);text-align:right}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{position:relative;border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 6px 18px rgba(43,15,99,.07)}
.card .num{position:absolute;right:14px;top:14px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:900 13px Montserrat,Arial;color:#fff;background:linear-gradient(135deg,var(--gold),var(--purple))}
.card h3{margin:0 36px 10px 0;font:900 17px/1.2 Montserrat,Arial;color:var(--ink)}.card p{margin:0 0 8px;font-size:14px}.k{margin:0!important;font:800 10px Montserrat,Arial!important;letter-spacing:.16em;text-transform:uppercase;color:var(--teal)}
.vis{position:relative;margin:-16px -16px 14px;border-radius:14px 14px 0 0;overflow:hidden;background:#F7F4FB;aspect-ratio:16/9}.vis svg,.vis img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.stat{position:absolute;left:12px;bottom:12px;display:grid;gap:1px;padding:8px 12px;border-radius:12px;background:#fff;box-shadow:0 6px 16px rgba(43,15,99,.18);min-width:96px}.stat b{font:900 24px/1 Montserrat,Arial;color:var(--purple)}.stat span{font:700 11px Inter,Arial;color:#5a5372}.stat em{font:800 10px Montserrat,Arial;font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--teal)}
.fix{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);display:grid;gap:8px}.fix .k{color:var(--purple)}.fix .sub{color:var(--teal)!important;font-size:9px!important}.steps{white-space:pre-line;font-size:13.5px!important;margin:0!important;padding-left:10px;border-left:3px solid var(--gold)}.diy{color:var(--teal);font-weight:700;font-size:14px;text-decoration:none}.dfy{display:block;text-align:center;padding:10px 14px;border-radius:999px;background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);color:#2A0E52;font:900 14px Montserrat,Arial;text-decoration:none}.dfy small{display:block;font:600 11px Inter,Arial;opacity:.8}
.ctl{margin-top:10px;padding:10px;border-radius:10px;background:#1D0A40;color:#FBE7C6;display:grid;gap:6px;font:700 11px Inter,Arial}.ctl label{display:grid;gap:3px}.ctl select,.ctl input{font:13px Inter,Arial;padding:6px 8px;border-radius:6px;border:0}
.qw{margin-top:8px;padding:10px 12px;border-radius:10px;background:#FDF4E7}.qw .k{color:#9A5B00}.plan{color:#7A7388;font-style:italic}
.sum p{margin:0;padding:16px 18px;border-radius:14px;background:linear-gradient(110deg,var(--soft),#FDF4E7);font-size:16px;color:var(--ink)}
.two{display:grid;grid-template-columns:1.3fr 1fr;gap:28px}.help,.att{list-style:none;margin:0;padding:0;display:grid;gap:10px}.help li{display:flex;gap:10px}.help li>b{color:var(--gold)}
.help strong{display:block;color:var(--ink)}.help small{display:block;color:#7A7388;font-style:italic}.att li{font-size:14px}
.dates{display:grid;gap:8px;margin-bottom:16px}.dt{display:flex;gap:12px;align-items:baseline}.dt b{min-width:52px;font:900 14px Montserrat,Arial;color:var(--purple)}
.rec h3{margin:0 0 6px;font:900 22px Montserrat,Arial;color:var(--ink)}.rec p{margin:0}
.next p{margin:0 0 14px}.cta{display:inline-block;padding:13px 26px;border-radius:999px;background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);color:#2A0E52;font:900 15px Montserrat,Arial;text-decoration:none}
.sig{display:flex;gap:14px;align-items:center;margin:26px 44px 0;padding:18px 0 28px;border-top:1px solid var(--line)}.sig img{width:56px;height:56px;border-radius:50%;border:2px solid var(--gold);object-fit:cover}.sig div{display:grid;font-size:13px}.sig b{color:var(--ink);font-size:15px}
[contenteditable]{outline:1px dashed rgba(93,14,166,.35);outline-offset:2px;border-radius:4px;cursor:text}[contenteditable]:focus{outline:2px solid var(--gold);background:#FFFBF2}
[contenteditable]:empty::before{content:"Click to add, or leave blank";color:#b3a9c4;font-style:italic}
.bar{position:sticky;top:0;z-index:5;background:#1D0A40;color:#fff;padding:12px max(16px,env(safe-area-inset-left));display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.bar p{margin:0;font-size:14px}.bar .b{display:flex;gap:10px;flex-wrap:wrap}.bar button{border:0;border-radius:999px;padding:10px 18px;font:800 14px Montserrat,Arial;cursor:pointer}
.save{background:#fff;color:#1D0A40}.send{background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);color:#2A0E52}.bar button[disabled]{opacity:.6;cursor:wait}
@media (max-width:720px){.heard,.two{grid-template-columns:1fr}.cards{grid-template-columns:1fr}.sec{padding:20px 20px 0}.hdr{padding:22px 20px 50px}.sig{margin:22px 20px 0}.sc{grid-template-columns:130px 1fr 40px}}
@media print{body{background:#fff}.bar,.ctl{display:none}.snap{box-shadow:none;margin:0;border-radius:0}}
`;

function html(title, body, extraHead = '') {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Montserrat:wght@800;900&family=Playfair+Display:ital,wght@1,500&display=swap"><style>${CSS}</style>${extraHead}</head><body>${body}</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) { const k = /^\d+$/.test(ks[i]) ? Number(ks[i]) : ks[i]; if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; }
  o[/^\d+$/.test(ks[ks.length - 1]) ? Number(ks[ks.length - 1]) : ks[ks.length - 1]] = val;
}

// GET and POST /snapshot/<tok>: the review page
export async function snapshotReview(req, env, x) {
  const raw = new URL(req.url).pathname.split('/')[2] || '';
  // older HubSpot tasks glued the next word onto the link (".../abc123Click"); review tokens are 14 characters
  const tok = /^[a-z0-9]{10,24}$/.test(raw) ? raw : (raw.match(/^[a-z0-9]{14}(?=[A-Z])/) || [''])[0];
  if (!tok) return new Response('Not found', { status: 404 });
  const rec = await env.REPORTS.get(`snap:${tok}`, 'json');
  // A brand new draft can take up to a minute to reach every Cloudflare location, so a miss right after
  // the HubSpot task appears is usually just that delay: show a friendly page that refreshes itself.
  if (!rec) {
    if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'This Snapshot is still being prepared. Refresh in a minute.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return html('Preparing your Snapshot', '<div style="max-width:520px;margin:80px auto;padding:32px;text-align:center;background:#fff;border-radius:18px;box-shadow:0 12px 30px rgba(29,10,64,.08);font-family:Inter,system-ui,sans-serif"><h1 style="font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:24px;margin:0 0 10px;color:#1c1236">Your Snapshot is almost ready</h1><p style="color:#5a5372;margin:0">A new draft can take up to a minute to appear. This page refreshes on its own every 15 seconds.</p><p style="color:#5a5372;font-size:13px;margin:18px 0 0">Still here after 3 minutes? The link may be from an older draft. Open the newest Review and send task in HubSpot.</p></div>', '<meta http-equiv="refresh" content="15">');
  }
  if (req.method === 'POST') {
    let b = {};
    try { b = await req.json(); } catch {}
    if (b.edits && typeof b.edits === 'object') for (const [k, v] of Object.entries(b.edits)) if (/^[a-z_]+(\.(\d+|[a-z_]+)){0,2}$/.test(k)) setPath(rec.data, k, String(v).slice(0, 1500).trim());
    // tidy: drop empty list items the editor cleared
    for (const k of ['help', 'dates', 'attendees']) if (Array.isArray(rec.data[k])) rec.data[k] = rec.data[k].filter((it) => it && Object.values(it).some((v) => String(v || '').trim()));
    if (Array.isArray(rec.data.where)) rec.data.where = rec.data.where.filter((w) => String(w || '').trim());
    rec.updated = Date.now();
    let msg = 'Saved.';
    if (b.action === 'send') {
      const contact = await x.hs(env, 'GET', `/crm/v3/objects/contacts/${rec.contactId}?properties=email,firstname,lastname`);
      const email = contact.properties?.email;
      if (!email) return new Response(JSON.stringify({ error: 'This contact has no email address in HubSpot' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      await env.REPORTS.put(`snappub:${rec.pub}`, tok);
      if (!rec.booking) {
        try { rec.booking = await offerTimes(env, x, 'walkthrough', { dealId: rec.dealId, contactId: rec.contactId, company: rec.company, firstName: contact.properties.firstname, name: [contact.properties.firstname, contact.properties.lastname].filter(Boolean).join(' ') || rec.who, email }); }
        catch (e) { console.error('offer walkthrough times', e.message); }
      }
      await x.sendAndLog(env, { to: email, contact, deal: { id: rec.dealId }, ...snapshotEmail({ firstName: contact.properties.firstname, company: rec.company, link: `${WORKER}/s/${rec.pub}`, booking: rec.booking }) });
      rec.status = 'sent'; rec.sentAt = Date.now();
      await x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Brand Experience Snapshot sent</b> to ${esc(email)}.</p><p><a href="${WORKER}/s/${rec.pub}?by=${tok}">Their preview (your opens are not tracked)</a> &middot; <a href="${WORKER}/snapshot/${tok}">Edit view</a></p>` }, associations: [{ to: { id: rec.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }, { to: { id: rec.dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }] }).catch((e) => console.error('snap note', e.message));
      if (rec.taskId) await x.hs(env, 'PATCH', `/crm/v3/objects/tasks/${rec.taskId}`, { properties: { hs_task_status: 'COMPLETED' } }).catch(() => {});
      msg = `Sent to ${email}. You will get an alert the first time they open it.`;
    }
    await env.REPORTS.put(`snap:${tok}`, JSON.stringify(rec));
    return new Response(JSON.stringify({ ok: true, message: msg }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (new URL(req.url).searchParams.get('present') === '1') return html(`Snapshot: ${rec.company}`, doc(rec, 'present'));
  const sent = rec.status === 'sent';
  const bar = `<div class="bar"><p>${sent ? '<b>Sent.</b> Edits you save now also update what they see.' : rec.ai ? '<b>Draft ready.</b> Click any text to edit it, then Save or Approve and send. They get a preview: What we heard and the observation with the quick win. The rest is for the walkthrough.' : '<b>Starter draft.</b> The AI draft was unavailable, so this was built straight from your notes. Edit, then send.'}</p><div class="b"><span id="st" style="align-self:center;font-size:13px;opacity:.8"></span><button class="save" id="save" type="button">Save</button><a href="${WORKER}/snapshot/${tok}?present=1" target="_blank" rel="noopener" style="color:#FBE7C6;align-self:center;font-weight:800;font-size:14px">Present full</a>${sent ? `<a href="${WORKER}/s/${rec.pub}?by=${tok}" target="_blank" rel="noopener" style="color:#FBE7C6;align-self:center;font-weight:800;font-size:14px">Their preview</a>` : '<button class="send" id="send" type="button">Approve and send</button>'}</div></div>`;
  const js = `<script>(function(){var st=document.getElementById('st');function edits(){var o={};document.querySelectorAll('[data-k]').forEach(function(el){o[el.getAttribute('data-k')]=(el.tagName==='SELECT'||el.tagName==='INPUT')?el.value:el.innerText;});return o;}
function go(action,btn){btn.disabled=true;st.textContent=action==='send'?'Sending...':'Saving...';fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({edits:edits(),action:action})}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Something went wrong');return d;});}).then(function(d){st.textContent=d.message;btn.disabled=false;if(action==='send')setTimeout(function(){location.reload();},1200);}).catch(function(e){st.textContent=e.message;btn.disabled=false;});}
document.getElementById('save').onclick=function(){go('save',this);};var s=document.getElementById('send');if(s)s.onclick=function(){go('send',this);};
document.addEventListener('paste',function(e){if(e.target.closest&&e.target.closest('[contenteditable]')){e.preventDefault();document.execCommand('insertText',false,(e.clipboardData||window.clipboardData).getData('text'));}});})();</script>`;
  return html(`Snapshot: ${rec.company}`, bar + doc(rec, 'review') + js);
}

// GET /s/<pub>: what the prospect sees
export async function snapshotClient(req, env, x) {
  const pub = new URL(req.url).pathname.split('/')[2] || '';
  if (!/^[a-z0-9]{10,24}$/.test(pub)) return new Response('Not found', { status: 404 });
  const tok = await env.REPORTS.get(`snappub:${pub}`);
  const rec = tok && (await env.REPORTS.get(`snap:${tok}`, 'json'));
  if (!rec) return html('Not found', '<p style="padding:40px;text-align:center">This link is not available.</p>');
  // Opens by Markit Mike (links from the review page and HubSpot carry ?by=<review token>), by email
  // security scanners that click every link the moment the email lands, or by obvious bots are not
  // real opens, so they never trigger the warm lead alert.
  const u = new URL(req.url);
  const ua = (req.headers.get('User-Agent') || '').toLowerCase();
  const owner = u.searchParams.get('by') === tok;
  const scanner = (rec.sentAt && Date.now() - rec.sentAt < 2 * 60e3) || /bot|crawl|spider|preview|scan|proofpoint|mimecast|barracuda|safelinks|headless|python|curl|wget/.test(ua);
  if (!rec.openedAt && !owner && !scanner) {
    rec.openedAt = Date.now();
    await env.REPORTS.put(`snap:${tok}`, JSON.stringify(rec));
    const title = `${rec.who || rec.company} opened their Brand Experience Snapshot`;
    await Promise.allSettled([
      x.sendRaw && x.sendRaw(env, { to: env.OWNER_EMAIL, subject: `Warm lead: ${title}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#5D0EA6;">WARM LEAD</p><p style="margin:0 0 12px;font-size:20px;font-weight:800;">${esc(title)}</p><p style="font-size:15px;">They are reading it right now. A great moment to confirm the plan walkthrough.</p><p><a href="https://app-na2.hubspot.com/contacts/246716405/record/0-3/${rec.dealId}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#5D0EA6;color:#fff;font-weight:700;text-decoration:none;">Open deal in HubSpot</a></p></div>` }),
      x.hs(env, 'POST', '/crm/v3/objects/tasks', { properties: { hs_timestamp: new Date().toISOString(), hs_task_subject: title, hs_task_body: 'They are reading it right now. A good moment to confirm the plan walkthrough.', hs_task_status: 'NOT_STARTED', hs_task_priority: 'HIGH', hs_task_type: 'CALL' }, associations: [{ to: { id: rec.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }] }, { to: { id: rec.dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }] }] }),
    ]);
  }
  return html(`Brand Experience Snapshot: ${rec.company}`, doc(rec, 'client'));
}
