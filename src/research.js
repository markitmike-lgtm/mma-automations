// Pre-Call Brief: automatic research on a new lead before Markit Mike ever opens it.
//
//   queueBrief()   called by the website form and Crown Fitting bookings; works out the website
//                  (form field, else the business email domain) and queues the lead
//   briefSweep()   every 2 minutes: researches queued leads (their website plus a short web search),
//                  writes a "Pre-Call Brief" note on the HubSpot deal, keeps a copy for the Notes form
//                  and the Snapshot, and, for website leads, sends the one new lead alert with the
//                  brief inside (the alert waits for the brief, at most about 8 minutes)
//
// The brief is internal prep, never sent to the prospect. Findings from the web can be out of date,
// so the brief says what to confirm on the call.
import { CROWN_SCORES } from './crown.js';

const FREE = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'comcast.net', 'att.net', 'sbcglobal.net', 'verizon.net', 'cox.net', 'charter.net', 'yandex.com', 'zoho.com']);
const QUEUE = 'brief:queue';
const MAX_WAIT = 8 * 60e3;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function siteFor({ email, website }) {
  const clean = (u) => {
    let s = String(u || '').trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#\s]/)[0];
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : '';
  };
  const given = clean(website);
  if (given) return given;
  const dom = String(email || '').toLowerCase().split('@')[1] || '';
  return dom && !FREE.has(dom) ? clean(dom) : '';
}

// item: { dealId, contactId, name, email, company, website, message, source, alert? }
export async function queueBrief(env, item) {
  if (!env.REPORTS || !item.dealId) return false;
  const site = siteFor(item);
  if (!site && !item.company) return false;
  if (await env.REPORTS.get(`brief:${item.dealId}`)) return false; // already researched
  const rec = { ...item, site, queuedAt: Date.now(), tries: 0 };
  await env.REPORTS.put(`briefq:${item.dealId}`, JSON.stringify(rec));
  const q = (await env.REPORTS.get(QUEUE, 'json')) || [];
  if (!q.includes(String(item.dealId))) q.push(String(item.dealId));
  await env.REPORTS.put(QUEUE, JSON.stringify(q.slice(-100)));
  return true;
}

async function fetchSite(site) {
  if (!site) return null;
  const started = Date.now();
  for (const url of [`https://${site}/`, `https://www.${site}/`]) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarkitMikeAgencyPrep/1.0)' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const html = (await r.text()).slice(0, 600000);
      const ms = Date.now() - started;
      const pick = (re) => (html.match(re) || [])[1] || '';
      const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
      const has = (re) => links.some((l) => re.test(l)) || re.test(html);
      const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      return {
        url: r.url, ms,
        title: pick(/<title[^>]*>([^<]{0,200})/i).trim(),
        description: pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,400})/i),
        mobileReady: /<meta[^>]+name=["']viewport["']/i.test(html),
        https: r.url.startsWith('https://'),
        social: ['instagram.com', 'facebook.com', 'tiktok.com', 'linkedin.com', 'youtube.com', 'x.com/', 'twitter.com'].filter((d) => links.some((l) => l.includes(d))),
        ordering: ['toasttab', 'olo.com', 'doordash', 'ubereats', 'grubhub', 'chownow', 'square.site', 'clover', 'spoton', 'order'].filter((d) => links.some((l) => l.toLowerCase().includes(d))),
        loyalty: has(/rewards|loyalty|punchh|thanx|paytronix|fivestars|join the club|vip/i),
        emailSignup: has(/newsletter|subscribe|sign up for|join our (email|list)|mailchimp|klaviyo/i),
        locationsPage: links.some((l) => /locations|find-us|stores/i.test(l)),
        text: text.slice(0, 7000),
      };
    } catch (e) { /* try the next address */ }
  }
  return { url: `https://${site}/`, error: 'Website did not load (it may be down, blocked or slow)' };
}

const SYSTEM = `You are the research assistant for Markit Mike Agency, a fractional CMO agency led by an operator turned marketer (restaurant, franchise, hospitality, entertainment and local direct to consumer brands). A new lead just came in. Using the website snapshot provided and a few web searches, write a Pre-Call Brief that prepares the agency for its first conversation.

Rules:
- This is internal prep. Be specific and factual. Never invent numbers, names or reviews. If you could not find something, say "Not found".
- Search for: the business's Google rating and review count, what reviewers praise and complain about, number of locations, recent news (openings, ownership changes, funding), and who leads marketing if public.
- Observations must be things the agency could genuinely help with, framed as opportunities, each grounded in something you actually saw.
- Never use dashes of any kind (no em dashes, en dashes or hyphens between words). Use commas or periods instead.
- Capitalize "Guest" and "Guests" when referring to restaurant or hospitality customers.

Return ONLY a JSON object, no prose before or after:
{
 "headline": "one sentence: who they are and the single biggest opportunity",
 "business": "2 to 3 sentences: concept, offer, audience, size and footprint",
 "locations": "number and where, or Not found",
 "reviews": { "rating": "e.g. 4.3 on Google, or Not found", "count": "e.g. 1,240 reviews, or Not found", "praise": "short phrase", "complaints": "short phrase" },
 "digital": { "website": "one sentence first impression", "loyalty": "what exists, or None found", "ordering": "what exists, or None found", "email": "signup present or not", "social": "which channels and how active, if known" },
 "news": "recent news worth mentioning, or Nothing recent found",
 "people": "marketing or leadership names and titles if public, or Not found",
 "observations": [ { "title": "short", "saw": "one sentence", "why": "one sentence on why it matters to revenue or Guests/customers" } ],
 "crown_guess": { "c_loyalty": 1-5, "r_revenue": 1-5, "o_ops": 1-5, "w_position": 1-5, "n_innovation": 1-5 },
 "best_offer": "Brand Checkup, Glow Up, Gold Starter, Platinum Accelerator or Crown Jewel",
 "offer_why": "one sentence",
 "opening_line": "one warm, specific sentence Michael could use in his personal reply, referencing something real",
 "questions": [ "3 smart discovery questions for the Crown Fitting" ],
 "confirm": "what to double check on the call because web info may be stale",
 "sources": [ "urls you relied on" ]
}
Exactly 3 observations and 3 questions.`;

async function claude(env, user, useSearch) {
  const body = { model: env.CHAMBERLAIN_MODEL || 'claude-sonnet-5-5', max_tokens: 3000, system: SYSTEM, messages: [{ role: 'user', content: user }] };
  if (useSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', ...(env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(110000),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  if (!data.headline || !Array.isArray(data.observations)) throw new Error('incomplete brief');
  const clean = (v) => (typeof v === 'string' ? v.replace(/\s*[–—]\s*/g, ', ').replace(/(\w)-(\w)/g, '$1 $2') : Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v);
  return clean(data);
}

export async function researchLead(env, item) {
  const page = await fetchSite(item.site);
  const facts = page && !page.error ? [
    `Website: ${page.url} (loaded in ${(page.ms / 1000).toFixed(1)}s, ${page.https ? 'secure' : 'NOT secure'}, ${page.mobileReady ? 'mobile ready' : 'no mobile viewport tag'})`,
    `Title: ${page.title}`, `Meta description: ${page.description || 'none'}`,
    `Social links found: ${page.social.join(', ') || 'none'}`, `Ordering links found: ${page.ordering.join(', ') || 'none'}`,
    `Loyalty or rewards mentioned: ${page.loyalty ? 'yes' : 'no'}`, `Email signup found: ${page.emailSignup ? 'yes' : 'no'}`, `Locations page: ${page.locationsPage ? 'yes' : 'no'}`,
    `Homepage text:\n${page.text}`,
  ].join('\n') : `Website: ${item.site || 'unknown'}. ${page?.error || 'No website given.'}`;
  const user = `Lead: ${item.name || ''}, ${item.company || 'company unknown'}\nEmail: ${item.email || ''}\nCame in through: ${item.source || 'website'}\nTheir message: ${item.message || '(none)'}\n\n${facts}`;
  let data;
  try { data = await claude(env, user, true); } catch (e) {
    console.error('brief with search', e.message);
    data = await claude(env, user + '\n\n(Web search is unavailable. Work only from the website snapshot and say what you could not verify.)', false);
    data.searchUnavailable = true;
  }
  return { at: Date.now(), site: item.site, page: page ? { url: page.url, ms: page.ms, https: page.https, mobileReady: page.mobileReady, error: page.error || null } : null, data };
}

export function briefNoteHtml(b) {
  const d = b.data;
  const li = (k, v) => (v ? `<li><b>${esc(k)}:</b> ${esc(v)}</li>` : '');
  const scores = d.crown_guess ? CROWN_SCORES.map(([k, lab]) => (d.crown_guess[k] ? `${lab} ${d.crown_guess[k]}` : '')).filter(Boolean).join(', ') : '';
  return `<p><b>Pre-Call Brief</b> (automatic research, verify on the call)</p><p><b>${esc(d.headline)}</b></p><p>${esc(d.business)}</p>`
    + `<ul>${li('Website', b.page?.url)}${li('Locations', d.locations)}${li('Reviews', [d.reviews?.rating, d.reviews?.count].filter(Boolean).join(', '))}${li('Guests love', d.reviews?.praise)}${li('Complaints', d.reviews?.complaints)}${li('Website first look', d.digital?.website)}${li('Loyalty', d.digital?.loyalty)}${li('Ordering', d.digital?.ordering)}${li('Email signup', d.digital?.email)}${li('Social', d.digital?.social)}${li('News', d.news)}${li('People', d.people)}</ul>`
    + `<p><b>Three observations</b></p><ol>${(d.observations || []).map((o) => `<li><b>${esc(o.title)}.</b> ${esc(o.saw)} <i>${esc(o.why)}</i></li>`).join('')}</ol>`
    + (scores ? `<p><b>First guess Crown scores:</b> ${esc(scores)}</p>` : '')
    + `<p><b>Best fit offer:</b> ${esc(d.best_offer)}. ${esc(d.offer_why)}</p>`
    + `<p><b>Opening line for your reply:</b> ${esc(d.opening_line)}</p>`
    + `<p><b>Questions for the Crown Fitting</b></p><ol>${(d.questions || []).map((q) => `<li>${esc(q)}</li>`).join('')}</ol>`
    + `<p><b>Confirm on the call:</b> ${esc(d.confirm)}${d.searchUnavailable ? ' (Web search was unavailable, so reviews and news were not checked.)' : ''}</p>`
    + ((d.sources || []).length ? `<p>Sources: ${(d.sources || []).slice(0, 6).map((u) => `<a href="${esc(u)}">${esc(u)}</a>`).join(', ')}</p>` : '');
}

// the block that goes inside the new lead alert email
export function briefEmailBlock(b) {
  if (!b) return '';
  const d = b.data;
  const obs = (d.observations || []).map((o, i) => `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-weight:800;color:#E79A27;">${i + 1}</td><td style="padding:4px 0;font-size:14px;line-height:21px;"><b>${esc(o.title)}.</b> ${esc(o.saw)}</td></tr>`).join('');
  return `<div style="margin:18px 0;padding:16px 18px;border:2px solid #108193;border-radius:12px;">
<p style="margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:2px;color:#108193;">PRE-CALL BRIEF</p>
<p style="margin:0 0 10px;font-size:16px;font-weight:800;line-height:23px;">${esc(d.headline)}</p>
<p style="margin:0 0 10px;font-size:14px;line-height:21px;color:#5A4F6B;">${esc([d.locations && d.locations !== 'Not found' ? d.locations : '', d.reviews?.rating && d.reviews.rating !== 'Not found' ? `${d.reviews.rating}${d.reviews.count && d.reviews.count !== 'Not found' ? ' (' + d.reviews.count + ')' : ''}` : ''].filter(Boolean).join(' · '))}</p>
<table role="presentation" cellpadding="0" cellspacing="0">${obs}</table>
<p style="margin:12px 0 0;font-size:14px;line-height:21px;"><b>Try this in your reply:</b> ${esc(d.opening_line)}</p>
<p style="margin:8px 0 0;font-size:14px;"><b>Best fit:</b> ${esc(d.best_offer)}</p>
<p style="margin:10px 0 0;font-size:12px;color:#5A4F6B;">Automatic research from public sources. The full brief, with sources and call questions, is on the deal.</p></div>`;
}

export async function briefSweep(env, x) {
  if (!env.REPORTS || !env.ANTHROPIC_API_KEY) return;
  const q = (await env.REPORTS.get(QUEUE, 'json')) || [];
  if (!q.length) return;
  const keep = [];
  let done = 0;
  for (const dealId of q) {
    const item = await env.REPORTS.get(`briefq:${dealId}`, 'json');
    if (!item) continue;
    if (done >= 2) { keep.push(dealId); continue; } // a few per run keeps each run short
    done++;
    let brief = null;
    try {
      brief = await researchLead(env, item);
      await env.REPORTS.put(`brief:${dealId}`, JSON.stringify(brief));
      const assoc = [
        ...(item.contactId ? [{ to: { id: String(item.contactId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }] : []),
        { to: { id: String(dealId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] },
      ];
      await x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: briefNoteHtml(brief) }, associations: assoc });
    } catch (e) {
      console.error('brief', dealId, e.message);
      item.tries = (item.tries || 0) + 1;
      const late = Date.now() - item.queuedAt > MAX_WAIT;
      if (item.tries < 2 && !late) { await env.REPORTS.put(`briefq:${dealId}`, JSON.stringify(item)); keep.push(dealId); continue; }
    }
    // the one new lead alert, now with the brief inside (or without it if research failed)
    if (item.alert && x.sendRaw) {
      const { ownerLeadEmail } = await import('./emails.js');
      const a = ownerLeadEmail({ ...item.alert, brief });
      await x.sendRaw(env, { to: env.OWNER_EMAIL, reply_to: item.alert.email, ...a }).catch((e) => console.error('lead alert', e.message));
    }
    await env.REPORTS.delete(`briefq:${dealId}`);
  }
  await env.REPORTS.put(QUEUE, JSON.stringify(keep));
}

// safety net: a website lead alert never waits longer than MAX_WAIT, even if a run was missed
export async function briefOverdue(env, x) {
  const q = (await env.REPORTS.get(QUEUE, 'json')) || [];
  for (const dealId of q) {
    const item = await env.REPORTS.get(`briefq:${dealId}`, 'json');
    if (item && item.alert && !item.alertSent && Date.now() - item.queuedAt > MAX_WAIT + 4 * 60e3) {
      const { ownerLeadEmail } = await import('./emails.js');
      await x.sendRaw(env, { to: env.OWNER_EMAIL, reply_to: item.alert.email, ...ownerLeadEmail({ ...item.alert, brief: null }) }).catch(() => {});
      item.alert = null; item.alertSent = true;
      await env.REPORTS.put(`briefq:${dealId}`, JSON.stringify(item));
    }
  }
}
