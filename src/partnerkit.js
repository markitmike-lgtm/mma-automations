// Crown Partners toolkit, everything personalized per partner:
//   KV prec:<code>      partner profile { code, contactId, first, last, email, phone, company, dba, sells, showPhoto, hasPhoto, kit }
//   KV pkit:<token>     private kit token -> code
//   KV pimg:<code>      partner photo { type, b64 }
//   GET  /pcard?ref=<code>        public card for markitmike.com/recommended (name, business, photo if allowed)
//   GET  /pimg/<code>             the photo
//   GET  /pk/<token>              the partner's private Sales Kit (also how Michael opens it, link in HubSpot)
//   POST /pk/<token>              save profile (business name, display name, photo, show photo)
//   GET  /pk/<token>/flyer        print ready leave behind flyer with their QR
//   GET  /pk/<token>/card         print ready desk talk track card
import qrcode from 'qrcode-generator';

const WORKER = 'https://mma-automations.markitmike.workers.dev';
const LOGO = 'https://markitmike.com/wp-content/uploads/2026/11/mma-logo-reverse-tight.png';
const CROWN = 'https://markitmike.com/wp-content/uploads/2026/06/Crown-Icon-14Degree-Tilt.png';
const ME = 'https://markitmike.com/wp-content/uploads/2026/10/mm-vp-me.png';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const shareLink = (code) => `https://markitmike.com/recommended/?ref=${code}`;
export const kitLink = (token) => `${WORKER}/pk/${token}`;

export function qrSvg(text, cell = 4) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: cell, margin: 0, scalable: true });
}

function token(n = 18) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return [...a].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

export async function getPartner(env, code) { return code ? env.REPORTS.get(`prec:${code}`, 'json') : null; }

// called by partnerJoin: create or refresh the profile and make sure there is a private kit token
export async function upsertPartner(env, p) {
  const prev = (await getPartner(env, p.code)) || {};
  const rec = { showPhoto: false, hasPhoto: false, dba: p.company || '', joinedAt: Date.now(), ...prev, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null)) };
  if (prev.dba) rec.dba = prev.dba; // a business name they edited in the kit wins over the join form
  if (!rec.kit) { rec.kit = token(); await env.REPORTS.put(`pkit:${rec.kit}`, rec.code); }
  await env.REPORTS.put(`prec:${rec.code}`, JSON.stringify(rec));
  const list = (await env.REPORTS.get('partners', 'json')) || [];
  if (!list.includes(rec.code)) { list.push(rec.code); await env.REPORTS.put('partners', JSON.stringify(list)); }
  return rec;
}

const displayName = (p) => [p.first, p.last].filter(Boolean).join(' ');

/* ---------- public card for the share page ---------- */
export async function pcardRoute(url, env) {
  const code = (url.searchParams.get('ref') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  const p = await getPartner(env, code);
  const body = p ? { ok: true, name: displayName(p), first: p.first || '', business: p.dba || '', photo: p.showPhoto && p.hasPhoto ? `${WORKER}/pimg/${code}?v=${p.photoV || 1}` : '' } : { ok: false };
  if (p) { p.views = (p.views || 0) + 1; await env.REPORTS.put(`prec:${code}`, JSON.stringify(p)); }
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
}

export async function pimgRoute(url, env) {
  const code = (url.pathname.split('/')[2] || '').replace(/[^a-z0-9]/g, '');
  const img = await env.REPORTS.get(`pimg:${code}`, 'json');
  if (!img) return new Response('Not found', { status: 404 });
  const bin = Uint8Array.from(atob(img.b64), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { 'Content-Type': img.type, 'Cache-Control': 'public, max-age=3600' } });
}

/* ---------- shared page shell ---------- */
const CSS = `
:root{--gold:#E79A27;--teal:#108193;--purple:#5D0EA6;--ink:#1c1236;--body:#3b3550;--muted:#6e6788;--line:#E6DDF2;--soft:#F7F4FB}
*{box-sizing:border-box}body{margin:0;background:#F1ECF8;color:var(--body);font:16px/1.6 Inter,Arial,sans-serif}
h1,h2,h3{font-family:Montserrat,Arial,sans-serif;color:var(--ink);margin:0;line-height:1.15;text-wrap:balance}
.top{background:radial-gradient(60% 90% at 90% 20%,rgba(231,154,39,.28),transparent 60%),linear-gradient(140deg,#5D0EA6,#2B0F63 60%,#1A0838);color:#fff;padding:28px max(18px,env(safe-area-inset-left)) 34px;border-bottom:5px solid #E79A27}
.top .in{max-width:980px;margin:0 auto;display:grid;gap:14px}
.top img.logo{height:32px;width:auto}.top .eb{font:800 12px Montserrat,Arial;letter-spacing:.24em;color:#FFD27A}
.top h1{color:#fff;font-size:clamp(28px,5vw,42px);font-weight:900}.top p{margin:0;color:rgba(255,255,255,.88);max-width:62ch}
main{max-width:980px;margin:0 auto;padding:24px max(16px,env(safe-area-inset-left)) 60px;display:grid;gap:22px}
.sec{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;display:grid;gap:14px;min-width:0}
.sec h2{font-size:22px;font-weight:900}.k{font:800 11px Montserrat,Arial;letter-spacing:.18em;text-transform:uppercase;color:var(--purple)}
.lede{margin:0;color:var(--muted)}
.linkrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center}
.linkbox{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--soft);border-radius:14px;padding:12px 14px;min-width:0}
.linkbox code{font:700 15px Inter,Arial;color:var(--teal);word-break:break-all;flex:1;min-width:0}
.qr{width:120px;height:120px;padding:8px;background:#fff;border:2px solid var(--gold);border-radius:12px}.qr svg{width:100%;height:100%;display:block}
.btn,button{display:inline-block;border:0;cursor:pointer;border-radius:999px;padding:11px 20px;font:800 14px Montserrat,Arial;text-decoration:none;color:#2A0E52;background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14)}
.btn.ghost{background:#fff;border:2px solid var(--line);color:var(--ink)}
button:focus-visible,.btn:focus-visible{outline:2px solid var(--purple);outline-offset:2px}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.card{background:var(--soft);border-radius:14px;padding:16px;display:grid;gap:6px;min-width:0}.card b{color:var(--ink)}
.copy{border:1px solid var(--line);border-radius:14px;overflow:hidden}.copy .hd{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 14px;background:var(--soft);flex-wrap:wrap}
.copy .hd span{font:800 12px Montserrat,Arial;letter-spacing:.08em;text-transform:uppercase;color:var(--teal)}
.copy pre{margin:0;padding:14px;white-space:pre-wrap;font:15px/1.6 Inter,Arial;color:var(--body)}
.qa{border-bottom:1px solid var(--line);padding:12px 0}.qa:last-child{border:0}.qa b{display:block;color:var(--ink)}
table{width:100%;border-collapse:collapse;font-size:15px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}th{font:800 11px Montserrat,Arial;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
td.n{font-weight:800;color:var(--ink);white-space:nowrap}.tw{overflow-x:auto}
form.profile{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}form.profile label{display:grid;gap:5px;font:700 13px Inter,Arial;color:var(--ink)}
form.profile input[type=text]{font:16px Inter,Arial;padding:11px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--soft);min-width:0}
.ph{display:flex;gap:16px;align-items:center;grid-column:1/-1;flex-wrap:wrap}.ph img{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);background:#0B3354}
.ph .none{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:var(--soft);border:2px dashed var(--line);color:var(--muted);font:700 12px Inter}
.chk{grid-column:1/-1;display:flex;gap:10px;align-items:flex-start;font:500 14px Inter!important}.chk input{width:20px;height:20px;accent-color:var(--purple)}
#st{font:700 14px Inter;color:var(--teal)}
.box{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.box .card{text-align:center;justify-items:center}
.box svg.i{width:46px;height:46px;fill:none;stroke:var(--purple);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
@media(max-width:760px){.grid2,.grid3,.box,form.profile{grid-template-columns:1fr}.linkrow{grid-template-columns:1fr}}
`;
function page(title, body, extra = '') {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Montserrat:wght@800;900&family=Caveat:wght@600&family=Playfair+Display:ital,wght@1,600&display=swap"><style>${CSS}${extra}</style></head><body>${body}</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

const ICON = {
  flyer: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h6M7 14h10"/>',
  note: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
  pin: '<circle cx="12" cy="12" r="9"/><path d="M7 15l-.6-6 3 2.4L12 7l2.6 4.4 3-2.4-.6 6z"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v7M14 20h3"/>',
};
const icon = (k) => `<svg class="i" viewBox="0 0 24 24">${ICON[k]}</svg>`;

/* ---------- the private Sales Kit ---------- */
async function earningsFor(env, contactId) {
  const ids = (await env.REPORTS.get('commissions', 'json')) || [];
  const out = [];
  for (const id of ids.slice(-200)) {
    const c = await env.REPORTS.get(`commission:${id}`, 'json');
    if (c && String(c.partnerId) === String(contactId)) out.push(c);
  }
  return out.sort((a, b) => b.at - a.at);
}

export async function kitRoute(req, env, x) {
  const url = new URL(req.url);
  const [, , tok, sub] = url.pathname.split('/');
  const code = tok && (await env.REPORTS.get(`pkit:${tok.replace(/[^a-z0-9]/g, '')}`));
  const p = code && (await getPartner(env, code));
  if (!p) return page('Not found', '<main><div class="sec"><h2>This kit link is not available.</h2><p>Email michael@markitmike.com and we will send you a fresh one.</p></div></main>');

  if (req.method === 'POST') {
    let b = {}; try { b = await req.json(); } catch {}
    const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
    if (b.dba != null) p.dba = clean(b.dba, 80);
    if (b.name != null) { const [f, ...r] = clean(b.name, 80).split(/\s+/); if (f) { p.first = f; p.last = r.join(' '); } }
    if (typeof b.showPhoto === 'boolean') p.showPhoto = b.showPhoto;
    if (b.photo) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.photo));
      if (!m || m[2].length > 900000) return new Response(JSON.stringify({ error: 'That photo could not be used. Try a JPG or PNG under 5 MB.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      await env.REPORTS.put(`pimg:${code}`, JSON.stringify({ type: m[1], b64: m[2] }));
      p.hasPhoto = true; p.photoV = (p.photoV || 0) + 1;
    }
    if (b.removePhoto) { await env.REPORTS.delete(`pimg:${code}`); p.hasPhoto = false; p.showPhoto = false; }
    p.updatedAt = Date.now();
    await env.REPORTS.put(`prec:${code}`, JSON.stringify(p));
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  const link = shareLink(code);
  if (sub === 'flyer') return flyerPage(p, link);
  if (sub === 'card') return deskCardPage(p, link);

  const name = displayName(p);
  const earn = await earningsFor(env, p.contactId);
  const total = earn.reduce((s, c) => s + c.amount, 0);
  const money = (n) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
  const photo = p.hasPhoto ? `<img id="phimg" src="${WORKER}/pimg/${code}?v=${p.photoV || 1}" alt="${esc(name)}">` : '<div class="none" id="phnone">No photo</div>';
  const T = {
    text1: `Hi [Client name], quick one. When your mailer lands, a lot of people Google you before they call. I partner with a team that makes that first look great: your Google profile, website and reviews. Here's their page: ${link}\n\nWorth a free 30 minute call with them? No pressure either way.`,
    email1: `Subject: An intro I think you'll like\n\nHi [Client name],\n\nI'd like to introduce you to Michael Hernandez at Markit Mike Agency (copied here). He spent nearly 20 years in restaurant and franchise marketing, and his team helps local businesses look as good online as they are in person.\n\nWhen your mailers land, people search for you before they call or visit. Michael's team makes sure what they find closes the deal: your Google profile, your website and your reviews.\n\nMichael, [Client name] runs [Business] here in [City]. I think a free Crown Fitting call would be a great place to start.\n\nMore about them: ${link}\n\n${name}${p.dba ? `\n${p.dba}` : ''}`,
    text2: `Hi [Client name], your cards hit mailboxes this week! One tip: search your business name on Google right now and look at what comes up. That's what your new customers see first. If it needs help, my partner's team can fix it fast: ${link}`,
  };
  const copyBlock = (k, label) => `<div class="copy"><div class="hd"><span>${label}</span><button type="button" data-copy="${k}">Copy</button></div><pre id="t-${k}">${esc(T[k])}</pre></div>`;

  const body = `<header class="top"><div class="in"><img class="logo" src="${LOGO}" alt="Markit Mike Agency"><span class="eb">CROWN PARTNERS · YOUR SALES KIT</span><h1>Welcome to the team, ${esc(p.first || 'partner')}.</h1><p>Everything you need to introduce a client in two minutes. Bookmark this page. It's private to you, and everything here already has your name and link built in.</p></div></header>
<main>
<section class="sec"><span class="k">Before you start</span><h2>Your questions, answered</h2>
<div class="qa"><b>Will your team try to take my client?</b>No. When you refer, the client is credited to you. When you resell, the work is done under your name, and our team never sells to your client directly. Better results make your mail look better, which helps you renew.</div>
<div class="qa"><b>I'm not a digital person. Can I still do this?</b>Yes. Ask the three questions, share your link, and our team handles the conversation, the sale and the work. You'll get an update on every client you send.</div></section>
<section class="sec"><span class="k">1 · Your link</span><h2>One link does the selling</h2><p class="lede">Text it, email it, or print the QR. It opens a page that says you recommended us, and every client who comes through it is credited to you for 90 days.</p>
<div class="linkrow"><div style="display:grid;gap:10px;min-width:0"><div class="linkbox"><code id="lnk">${esc(link)}</code><button type="button" data-copylink>Copy link</button></div><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Preview your page</a><a class="btn ghost" href="${kitLink(p.kit)}/flyer" target="_blank" rel="noopener">Print your flyer</a><a class="btn ghost" href="${kitLink(p.kit)}/card" target="_blank" rel="noopener">Print your desk card</a></div></div><div class="qr">${qrSvg(link)}</div></div></section>

<section class="sec"><span class="k">2 · Your profile</span><h2>How you appear to your clients</h2><p class="lede">Your share page says "Recommended by" you. Choose the business name to show, and add your photo if you'd like. Clients trust a face they know.</p>
<form class="profile" id="pf"><label>Your name<input type="text" id="pname" value="${esc(name)}" autocomplete="name"></label><label>Business name to show<input type="text" id="pdba" value="${esc(p.dba || '')}" placeholder="For example, your own agency or DBA"></label>
<div class="ph">${photo}<div style="display:grid;gap:8px"><label class="btn ghost" for="pfile" style="text-align:center">Upload a photo<input type="file" id="pfile" accept="image/*" hidden></label>${p.hasPhoto ? '<button type="button" class="btn ghost" id="prm">Remove photo</button>' : ''}</div></div>
<label class="chk" for="pshow"><input type="checkbox" id="pshow" ${p.showPhoto ? 'checked' : ''}>Show my photo on my share page and flyer</label>
<div style="grid-column:1/-1;display:flex;gap:12px;align-items:center"><button type="submit">Save my profile</button><span id="st"></span></div></form></section>

<section class="sec"><span class="k">3 · Spot the opportunity</span><h2>Three questions that find the right clients</h2><p class="lede">Ask these while you're already talking about their mail. Any "not sure" is your opening.</p>
<div class="grid3"><div class="card"><b>"When your mailer lands, what do people find when they Google you?"</b><span>Hours wrong, few photos or old reviews? That's a Google Profile Glow Up.</span></div><div class="card"><b>"Where does your QR code or web address send people?"</b><span>If it's just the home page, a Mail Ready Page turns the offer into calls you can count.</span></div><div class="card"><b>"Do you have a plan for the next 90 days, or is it one mailer at a time?"</b><span>That's a Crown Fitting, and maybe Gold Starter or a 90 day plan. Your biggest commissions.</span></div></div></section>

<section class="sec"><span class="k">4 · Ready to send</span><h2>Copy, personalize, send</h2>
${copyBlock('text1', 'Text to a client')}${copyBlock('email1', 'Email introduction (copy michael@markitmike.com)')}${copyBlock('text2', 'Text the week their mailer drops')}</section>

<section class="sec"><span class="k">5 · When your clients ask</span><h2>Easy answers to what business owners say</h2><p class="lede">These are the questions your clients will ask you. Short, honest answers work best, and you can always hand off to our team.</p>
<div class="qa"><b>"I don't have the budget."</b>Start small. The Brand Checkup is $197 and the Google Profile Glow Up is $297. One new customer usually covers it, and it makes every mailer work harder.</div>
<div class="qa"><b>"I already have someone doing my marketing."</b>Great, this works alongside them. We fix the basics people see when they look you up, like your Google profile and reviews, so everything else they do works better.</div>
<div class="qa"><b>"What results will I get?"</b>We fix what customers see when they look a business up, and show a before and after. We don't promise specific numbers, and neither should you. That honesty is part of why clients trust it.</div>
<div class="qa"><b>"Why should I trust this?"</b>Because you know me, and I wouldn't send you somewhere I don't trust. Start with the free Snapshot. There's no cost and no pressure, and you'll see exactly what they'd fix.</div></section>

<section class="sec"><span class="k">6 · Your earnings</span><h2>${total ? `${money(total)} earned so far` : 'Your first commission is one intro away'}</h2>
${earn.length ? `<div class="tw"><table><thead><tr><th>Date</th><th>What they bought</th><th>Commission</th><th>Paid by</th></tr></thead><tbody>${earn.map((c) => `<tr><td>${new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}</td><td>${esc(c.what)}</td><td class="n">${money(c.amount)}</td><td>${new Date(c.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}</td></tr>`).join('')}</tbody></table></div>` : '<p class="lede">Refer it: 20% on Quick Wins and Gold Starter, 10% of each monthly plan payment. One client on our 90 day plan is about $750 to you. Commission is paid within 15 days of each client payment.</p>'}</section>

<section class="sec"><span class="k">7 · Resell it</span><h2>Sell it under your own name</h2><p class="lede">Buy at partner pricing, set your own price, and our team does the work behind you. To order, email michael@markitmike.com with the client's business name, what they bought and their Google or website login. We'll send a partner invoice, and work starts once it's paid.</p>
<div class="tw"><table><thead><tr><th>Service</th><th>Your cost</th><th>Suggested price</th><th>Delivery</th></tr></thead><tbody><tr><td>Brand Checkup</td><td class="n">$129</td><td>$197</td><td>3 business days</td></tr><tr><td>Google Profile Glow Up</td><td class="n">$199</td><td>$297</td><td>5 business days</td></tr><tr><td>Mail Ready Page</td><td class="n">$199</td><td>$297</td><td>5 business days</td></tr></tbody></table></div></section>

<section class="sec"><span class="k">8 · Your Welcome Box</span><h2>On its way once your agreement is signed</h2><p class="lede">Real mail, from one direct mail person to another. Here's what lands on your doorstep.</p>
${boxScene(p)}
<div class="box"><div class="card">${icon('flyer')}<b>25 leave behind flyers</b><span>With your name and personal QR code.</span></div><div class="card">${icon('card')}<b>A desk card</b><span>The three questions and your link, at a glance.</span></div><div class="card">${icon('qr')}<b>QR stickers</b><span>For your own mailers and proofs.</span></div><div class="card">${icon('note')}<b>A handwritten note</b><span>From Michael.</span></div><div class="card">${icon('pin')}<b>Founding Partner pin</b><span>For the first partners in.</span></div></div></section>

<section class="sec"><span class="k">9 · Questions</span><h2>We're a text away</h2><p class="lede">Michael Hernandez · (714) 919-9469 · michael@markitmike.com</p></section>
</main>
<script>
(function(){
var T=${JSON.stringify(T)};
function flash(b,t){var o=b.textContent;b.textContent=t;setTimeout(function(){b.textContent=o;},1500);}
function cp(text,b){try{navigator.clipboard.writeText(text).then(function(){flash(b,'Copied');},function(){flash(b,'Press and hold to copy');});}catch(e){flash(b,'Press and hold to copy');}}
document.querySelectorAll('[data-copy]').forEach(function(b){b.onclick=function(){cp(T[b.getAttribute('data-copy')],b);};});
var cl=document.querySelector('[data-copylink]');cl.onclick=function(){cp(document.getElementById('lnk').textContent,cl);};
var st=document.getElementById('st'),photo=null;
function save(extra){st.textContent='Saving...';var body=Object.assign({name:document.getElementById('pname').value,dba:document.getElementById('pdba').value,showPhoto:document.getElementById('pshow').checked},extra||{});
 return fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Could not save');return d;});}).then(function(){st.textContent='Saved. Your page is updated.';}).catch(function(e){st.textContent=e.message;});}
document.getElementById('pf').onsubmit=function(e){e.preventDefault();save(photo?{photo:photo}:null).then(function(){if(photo)location.reload();});};
document.getElementById('pfile').onchange=function(e){var f=e.target.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(){var im=new Image();im.onload=function(){var s=Math.min(1,480/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);photo=c.toDataURL('image/jpeg',.86);
 var ex=document.getElementById('phimg')||document.getElementById('phnone');var ni=document.createElement('img');ni.id='phimg';ni.src=photo;ex.replaceWith(ni);document.getElementById('pshow').checked=true;st.textContent='Looks good. Press Save my profile.';};im.src=rd.result;};rd.readAsDataURL(f);};
var rm=document.getElementById('prm');if(rm)rm.onclick=function(){save({removePhoto:true}).then(function(){location.reload();});};
})();
</script>`;
  return page(`Crown Partners Kit: ${name}`, body);
}


/* ---------- the Welcome Box, drawn as a flat lay with the real logo and crown ---------- */
function boxScene(p) {
  const first = esc(p.first || 'partner');
  return `<style>
.wb{container-type:inline-size;position:relative;width:100%;aspect-ratio:16/10;border-radius:18px;overflow:hidden;background:radial-gradient(70% 80% at 30% 20%,#FFF8EC 0%,#F4E9DA 55%,#E9DCC8 100%)}
.wb *{position:absolute}
.wb .shadow{filter:drop-shadow(0 1.4cqw 1.6cqw rgba(43,15,99,.28))}
.wb .lid{left:6%;top:6%;width:44%;height:34%;border-radius:1.4cqw;background:linear-gradient(140deg,#5D0EA6,#2B0F63 70%,#1A0838);transform:rotate(-7deg);overflow:hidden}
.wb .lid .band{left:0;right:0;top:58%;height:12%;background:linear-gradient(90deg,#FFE08A,#E79A27 50%,#C06F14)}
.wb .lid img.cr{left:50%;top:7%;width:15%;transform:translateX(-50%)}
.wb .lid .t{left:0;right:0;top:41%;text-align:center;font:900 2.3cqw Montserrat,Arial;letter-spacing:.32em;color:#FFD27A}
.wb .lid img.lg{left:50%;bottom:9%;height:9%;transform:translateX(-50%)}
.wb .base{left:30%;top:36%;width:46%;height:46%;border-radius:1.2cqw;background:linear-gradient(160deg,#4A0B86,#2B0F63);transform:rotate(3deg)}
.wb .tissue{left:33%;top:38.5%;width:40%;height:40%;border-radius:.8cqw;background:repeating-linear-gradient(115deg,#F7D58B 0 2.2cqw,#EDBE61 2.2cqw 4.4cqw);transform:rotate(3deg)}
.wb .flyer{left:36%;top:26%;width:20%;height:30%;background:#fff;border-radius:.4cqw;transform:rotate(-11deg);overflow:hidden}
.wb .flyer .hd{left:0;right:0;top:0;height:42%;background:linear-gradient(140deg,#5D0EA6,#2B0F63)}
.wb .flyer .hd i{left:8%;right:10%;font:900 1.25cqw/1.1 Montserrat,Arial;color:#fff;font-style:normal;top:22%}
.wb .flyer .gb{left:0;right:0;top:42%;height:4%;background:#E79A27}
.wb .flyer .row{left:8%;height:3.5%;border-radius:1cqw;background:#E6DDF2}
.wb .flyer .q{right:8%;bottom:7%;width:22%;aspect-ratio:1;background:repeating-conic-gradient(#1c1236 0 25%,#fff 0 50%) 0 0/28% 28%;border:.25cqw solid #E79A27}
.wb .card{left:58%;top:30%;width:22%;height:15%;background:#fff;border-radius:.5cqw;transform:rotate(8deg);padding:1.2cqw}
.wb .card b{position:static;display:block;font:800 .95cqw Montserrat,Arial;letter-spacing:.2em;color:#5D0EA6}
.wb .card .l{position:static;display:block;height:.7cqw;margin-top:.8cqw;border-radius:1cqw;background:#E6DDF2}
.wb .note{left:62%;top:54%;width:26%;height:24%;background:#FFFDF6;border-radius:.4cqw;transform:rotate(-5deg);padding:1.6cqw}
.wb .note span{position:static;display:block;font:600 2.3cqw/1.15 Caveat,'Bradley Hand',cursive;color:#0B3354}
.wb .stk{width:9%;aspect-ratio:1;border-radius:50%;background:#fff;border:.5cqw solid #E79A27;display:grid;place-items:center}
.wb .stk i{position:static;width:60%;aspect-ratio:1;background:repeating-conic-gradient(#1c1236 0 25%,#fff 0 50%) 0 0/33% 33%}
.wb .pin{left:14%;top:60%;width:11%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 30%,#7B2BD0,#3A0A75);border:.6cqw solid #E79A27;display:grid;place-items:center}
.wb .pin img{position:static;width:62%}
.wb .tag{left:12%;top:74%;font:800 1.1cqw Montserrat,Arial;letter-spacing:.18em;color:#9A5B00}
</style>
<div class="wb" role="img" aria-label="The Crown Partners Welcome Box: a purple box with gold tissue, flyers with your QR code, a desk card, QR stickers, a handwritten note and a Founding Partner pin">
 <div class="lid shadow"><img class="cr" src="${CROWN}" alt=""><div class="t">CROWN PARTNERS</div><div class="band"></div><img class="lg" src="${LOGO}" alt=""></div>
 <div class="base shadow"></div><div class="tissue"></div>
 <div class="flyer shadow"><div class="hd"><i>Your customers Google you before they call.</i></div><div class="gb"></div><div class="row" style="top:54%;width:62%"></div><div class="row" style="top:62%;width:48%"></div><div class="row" style="top:70%;width:55%"></div><div class="q"></div></div>
 <div class="card shadow"><b>ASK</b><span class="l" style="width:90%"></span><span class="l" style="width:75%"></span><span class="l" style="width:82%"></span></div>
 <div class="note shadow"><span>Welcome to the team, ${first}!</span><span style="margin-top:1cqw;font-size:2cqw">Michael</span></div>
 <div class="stk shadow" style="left:47%;top:80%"><i></i></div><div class="stk shadow" style="left:56%;top:84%;transform:rotate(12deg)"><i></i></div>
 <div class="pin shadow"><img src="${CROWN}" alt=""></div><div class="tag">FOUNDING PARTNER</div>
</div>`;
}

/* ---------- print pieces ---------- */
const PRINT = `@page{size:letter;margin:0}body{background:#ddd}.sheet{width:8.5in;min-height:11in;margin:20px auto;background:#fff;position:relative;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.2)}
@media print{body{background:#fff}.sheet{margin:0;box-shadow:none}.noprint{display:none!important}}.noprint{max-width:8.5in;margin:16px auto 0;display:flex;gap:10px;justify-content:center;font:600 14px Inter}`;

function partnerBadge(p) {
  const n = displayName(p);
  return `${p.showPhoto && p.hasPhoto ? `<img src="${WORKER}/pimg/${p.code}?v=${p.photoV || 1}" alt="" style="width:.9in;height:.9in;border-radius:50%;object-fit:cover;border:3px solid #E79A27">` : ''}<div><div style="font:800 9pt Montserrat;letter-spacing:.14em;color:#5D0EA6">RECOMMENDED BY</div><div style="font:900 15pt Montserrat;color:#1c1236">${esc(n)}</div>${p.dba ? `<div style="font:600 11pt Inter;color:#3b3550">${esc(p.dba)}</div>` : ''}</div>`;
}

function flyerPage(p, link) {
  const body = `<div class="noprint"><button onclick="window.print()">Print this flyer</button><span style="align-self:center;color:#555">Letter size. Choose "fit to page" off and margins none.</span></div>
<div class="sheet">
 <div style="background:radial-gradient(60% 90% at 90% 15%,rgba(231,154,39,.35),transparent 60%),linear-gradient(140deg,#5D0EA6,#2B0F63 60%,#1A0838);color:#fff;padding:.6in .6in .9in;position:relative">
  <img src="${LOGO}" style="height:.42in" alt="Markit Mike Agency">
  <img src="${CROWN}" alt="" style="position:absolute;right:-.4in;top:-.3in;width:3.4in;opacity:.18;transform:rotate(12deg)">
  <div style="margin-top:.5in;font:800 10pt Montserrat;letter-spacing:.3em;color:#FFD27A">FOR LOCAL BUSINESS OWNERS</div>
  <div style="font:900 34pt/1.05 Montserrat;margin-top:.12in;max-width:6in">Your customers Google you before they call.</div>
  <div style="font:600 italic 15pt/1.35 'Playfair Display',Georgia,serif;margin-top:.18in;max-width:5.6in;color:rgba(255,255,255,.9)">Make sure what they find wins the sale.</div>
 </div>
 <div style="height:.16in;background:linear-gradient(90deg,#FFE08A,#E79A27 55%,#C06F14)"></div>
 <div style="padding:.45in .6in 0;display:grid;grid-template-columns:repeat(3,1fr);gap:.22in">
  ${[['Google Profile Glow Up', 'Hours, photos, description and review replies, so you win the search.', '$297'], ['Mail Ready Page', 'A page and QR code made for your mailer offer, so every card turns into calls you can count.', '$297'], ['Brand Checkup', 'A recorded walkthrough of your website, Google, reviews and social, with what to fix first.', '$197']].map(([h, d, pr]) => `<div style="background:#F7F4FB;border-radius:.16in;padding:.2in;display:grid;gap:.06in"><div style="font:900 13pt/1.15 Montserrat;color:#1c1236">${h}</div><div style="font:10.5pt/1.45 Inter;color:#3b3550">${d}</div><div style="font:900 15pt Montserrat;color:#5D0EA6">${pr}</div></div>`).join('')}
 </div>
 <div style="padding:.3in .6in 0;font:11pt/1.5 Inter;color:#3b3550">Want the bigger picture? Start with a <b>free 30 minute Crown Fitting</b>. Our team looks at how customers find you, and maps what to fix first, from quick wins to a full 90 day plan.</div>
 <div style="position:absolute;left:.6in;right:.6in;bottom:.55in;display:flex;gap:.35in;align-items:center;border-top:2px solid #E6DDF2;padding-top:.3in">
  <div style="width:1.55in;height:1.55in;padding:.08in;border:3px solid #E79A27;border-radius:.14in;flex:none">${qrSvg(link)}</div>
  <div style="display:grid;gap:.08in;flex:1"><div style="font:900 16pt Montserrat;color:#1c1236">Scan to book your free Crown Fitting</div><div style="font:10pt Inter;color:#6e6788">or visit ${esc(link.replace('https://', ''))}</div><div style="display:flex;gap:.14in;align-items:center;margin-top:.06in">${partnerBadge(p)}</div></div>
 </div>
</div>`;
  return page(`Flyer: ${displayName(p)}`, body, PRINT);
}

function deskCardPage(p, link) {
  const body = `<div class="noprint"><button onclick="window.print()">Print this card</button><span style="align-self:center;color:#555">Prints two cards per letter sheet. Cut on the line.</span></div>
<div class="sheet">${[0, 1].map(() => `<div style="height:5.5in;padding:.4in .55in;border-bottom:1px dashed #bbb;display:grid;grid-template-columns:1.25fr 1fr;gap:.35in">
 <div style="display:grid;gap:.1in;align-content:start"><div style="font:800 9pt Montserrat;letter-spacing:.24em;color:#5D0EA6">CROWN PARTNERS · ASK</div>
 ${['When your mailer lands, what do people find when they Google you?', 'Where does your QR code or web address send people?', 'Do you have a plan for the next 90 days, or one mailer at a time?'].map((q, i) => `<div style="display:flex;gap:.1in"><b style="font:900 14pt Montserrat;color:#E79A27">${i + 1}</b><span style="font:600 11pt/1.35 Inter;color:#1c1236">${q}</span></div>`).join('')}
 <div style="font:800 9pt Montserrat;letter-spacing:.24em;color:#108193;margin-top:.1in">THEN</div><div style="font:11pt/1.4 Inter;color:#3b3550">Share your link or QR. Our team handles the call, the sale and the work. You earn 20% on Quick Wins, 10% of monthly plans.</div></div>
 <div style="display:grid;gap:.12in;align-content:start;justify-items:center;text-align:center;background:#F7F4FB;border-radius:.16in;padding:.25in"><div style="width:1.7in;height:1.7in">${qrSvg(link)}</div><div style="font:700 9pt Inter;color:#6e6788;word-break:break-all">${esc(link.replace('https://', ''))}</div><div style="font:900 12pt Montserrat;color:#1c1236">${esc(displayName(p))}</div><div style="font:600 9pt Inter;color:#3b3550">Questions? Michael · (714) 919-9469</div></div></div>`).join('')}</div>`;
  return page(`Desk card: ${displayName(p)}`, body, PRINT);
}
