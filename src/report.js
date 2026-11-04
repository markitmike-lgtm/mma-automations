// Monthly Crown Report: one data object per client per month, rendered as the minimal drill down page.
//   GET /report/sample          the sample report (test client)
//   GET /report/<token>         a client's report, stored in KV as report:<token>
import { REPORT_CSS } from './report-css.js';

const CROWN = 'https://markitmike.com/wp-content/uploads/2026/06/Crown-Icon-14Degree-Tilt.png';
const ME = 'https://markitmike.com/wp-content/uploads/2026/10/mm-vp-me.png';
const e = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
const LBL = { good: 'On track', warn: 'Watch', bad: 'Needs attention' };
const CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6"/></svg>';
const row = (t, v, d) => `<div class="row"><div><span class="t">${t}</span>${d ? `<span class="d">${d}</span>` : ''}</div><span class="v num">${v}</span>${CHEV}</div>`;
const sub = (t, v, inner, open) => `<details class="sub"${open ? ' open' : ''}><summary>${row(t, v)}</summary><div class="inner">${inner}</div></details>`;
const st = (s) => `<span class="st ${s}">${LBL[s]}</span>`;
const kv = (pairs) => `<div class="kv num">${pairs.map(([k, v]) => `<div><small>${e(k)}</small><b>${e(v)}</b></div>`).join('')}</div>`;

export async function reportRoute(url, env) {
  const m = url.pathname.match(/^\/report\/([A-Za-z0-9_-]{6,64})\/?$/);
  if (!m) return null;
  let data;
  if (m[1] === 'sample') data = SAMPLE;
  else {
    if (!env.REPORTS) return html('<p>Reports are not set up yet.</p>', 503);
    data = await env.REPORTS.get('report:' + m[1], 'json');
    if (!data) return html(notFound(), 404);
  }
  return html(renderReport(data));
}

function html(body, status = 200) {
  return new Response(body.startsWith('<!doctype') ? body : `<!doctype html><meta charset="utf-8">${body}`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, max-age=60', 'Referrer-Policy': 'no-referrer' },
  });
}
const notFound = () => '<title>Report not found</title><body style="font-family:system-ui;padding:40px;color:#18102B"><h1 style="font-size:22px">This report link is not active</h1><p>Please use the link in your latest Crown Report email, or reply to it and our team will resend it.</p></body>';

export function renderReport(d) {
  const goalsGood = d.goals.filter((g) => g.status === 'good').length;
  const goalsWatch = d.goals.filter((g) => g.status === 'warn').length;
  const goalsBad = d.goals.filter((g) => g.status === 'bad').length;
  const invested = d.roi.investment.reduce((a, x) => a + x.amount, 0);
  const sales = d.roi.sales.reduce((a, x) => a + x.amount, 0);
  const roi = Math.round((sales - invested) / invested * 100);
  const perDollar = (sales / invested).toFixed(2);
  const measures = d.pillars.reduce((a, p) => a + p.k.length, 0);

  const goals = d.goals.map((g) => sub(`${e(g.name)} ${st(g.status)}`, e(g.value), `<p class="note"><b>What moved:</b> ${e(g.moved)}</p><p class="note"><b>Next:</b> ${e(g.next)}</p>`)).join('');
  const roiBody =
    sub('Investment', money(invested), kv(d.roi.investment.map((x) => [x.label, money(x.amount)]).concat([['Total', money(invested)]]))) +
    sub('Sales tied to marketing', money(sales), kv(d.roi.sales.map((x) => [x.label, money(x.amount)]).concat([['Orders', String(d.roi.orders)]])) + `<p class="src">${e(d.roi.salesSource)}</p>`) +
    sub('How we calculate it', 'Formula', `<p class="note">(${money(sales)} minus ${money(invested)}) divided by ${money(invested)} = <b>${roi}%</b>. Our fee is included so the number is honest. Walk ins and word of mouth we cannot trace are left out, so the real return is likely higher.</p>`);
  const paths = sub('Customer paths', `Top ${d.paths.length}`, d.paths.map((p) => `<p class="note"><b>${e(p.label)}</b> · ${e(p.meta)}</p><div class="path">${p.steps.map((s) => `<span>${e(s)}</span>`).join('<i>&#8594;</i>')}</div>`).join(''));
  const pillars = d.pillars.map((g) => {
    const worst = g.k.some((k) => k.st === 'bad') ? 'bad' : g.k.some((k) => k.st === 'warn') ? 'warn' : 'good';
    return sub(`${e(g.p)} ${st(worst)}`, `${g.k.length} measure${g.k.length > 1 ? 's' : ''}`, g.k.map((k) =>
      sub(`${e(k.k)} ${st(k.st)}`, e(k.v), kv([[d.monthShort, k.v], ['Change', k.ch], ['Target', k.t], ['Source', k.src]]) + trend(k.h, d.trendMonths) + `<p class="note"><b>What it means:</b> ${e(k.def)}</p>`)).join(''));
  }).join('');
  const list = (a) => `<ul class="plain">${a.map((x) => `<li>${e(x)}</li>`).join('')}</ul>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow">
<title>${e(d.client)} · Crown Report · ${e(d.month)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>body{margin:0}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}${REPORT_CSS}</style></head><body>
<header class="wrap"><div class="top"><div class="brand"><img src="${CROWN}" alt="">MARKIT MIKE AGENCY</div><div class="meta"><b>${e(d.client)}</b> · ${e(d.plan)} · ${e(d.month)}</div></div>
<h1>${e(d.headline)}</h1><p class="lede">Your goal: &ldquo;${e(d.goal)}&rdquo;</p>${d.sample ? '<span class="tag">SAMPLE REPORT · TEST CLIENT DATA</span>' : ''}<div class="rule"></div></header>
<main class="wrap">
<div class="sum"><div><small>Return on investment</small><b class="hl num">${roi}%</b><span>$${perDollar} per $1</span></div><div><small>Sales tied to marketing</small><b class="num">${money(sales)}</b><span>${d.roi.orders.toLocaleString('en-US')} orders and visits</span></div><div><small>Total invested</small><b class="num">${money(invested)}</b><span>${e(d.roi.investedNote)}</span></div><div><small>Goals on track</small><b class="num">${goalsGood} of ${d.goals.length}</b><span>${goalsWatch} to watch, ${goalsBad} being fixed</span></div></div>
<details class="help"><summary>New to this report? Here is how to read it</summary><p>Start with the four numbers above. Every row below is one part of the report: open it for the detail, and open the rows inside for the full story behind each number, including where it comes from. <b>ROI</b> includes our fee. <b>Measured</b> means tracked by links, offer codes or your POS; <b>estimated</b> means modeled, and we always say which. Questions? Reply to the report email or text (714) 919&#8209;9469 for a 15 minute walkthrough.</p></details>
<div class="ctrl"><h2>The details</h2><div class="links"><button class="lnk" id="openall">Open all</button><button class="lnk" id="closeall">Close all</button></div></div>
<details class="sec" open><summary>${row('Goals', `${d.goals.length} goals`, 'How each part of your goal is tracking')}</summary><div class="body">${goals}</div></details>
<details class="sec"><summary>${row('Return on investment', `${roi}%`, 'What you put in and what came back')}</summary><div class="body">${roiBody}</div></details>
<details class="sec"><summary>${row('Attribution', `${d.channels.length} channels`, 'Which channels earned the sales')}</summary><div class="body"><div class="seg" role="group" aria-label="Credit model"><button data-m="last" aria-pressed="true">Last touch</button><button data-m="first" aria-pressed="false">First touch</button><button data-m="linear" aria-pressed="false">Shared</button></div><details class="help" style="margin-top:0"><summary>What do these mean?</summary><p><b>Last touch</b> credits the final step before an order. <b>First touch</b> credits what introduced the customer. <b>Shared</b> splits credit across every step. A channel that is big on first touch but small on last touch is doing the introducing.</p></details><div id="channels"></div><div style="margin-top:14px">${paths}</div></div></details>
<details class="sec"><summary>${row('Performance', `${measures} measures`, 'Every measure we track, by area')}</summary><div class="body">${pillars}</div></details>
<details class="sec"><summary>${row('Work and next steps', `${d.work.needs.length} asks`, 'What shipped, what is next, what we need')}</summary><div class="body">${sub(`Shipped in ${e(d.monthShort)}`, d.work.shipped.length, list(d.work.shipped))}${sub('Next 30 days', d.work.next.length, list(d.work.next))}${sub('What we need from you', d.work.needs.length, list(d.work.needs), true)}</div></details>
<div class="sign"><img src="${ME}" alt="Markit Mike"><p><b>Markit Mike</b>, Markit Mike Agency&#8482;<br>${e(d.signoff)}</p></div>
<p class="foot">Sources: ${e(d.sources)}${d.sample ? ' Sample numbers for a test client.' : ''}</p>
</main>
<script>
(function(){
var CH=${JSON.stringify(d.channels).replace(/</g, '\\u003c')};
var CHEV=${JSON.stringify(CHEV)};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function money(v){return '$'+Math.round(v).toLocaleString('en-US');}
var box=document.getElementById('channels');
function draw(m){var max=Math.max.apply(null,CH.map(function(c){return c[m];}));var open={};box.querySelectorAll('details').forEach(function(x){open[x.dataset.k]=x.open;});
box.innerHTML=CH.slice().sort(function(a,b){return b[m]-a[m];}).map(function(c){var roas=c.spend?(c[m]/c.spend).toFixed(1)+'x':'None';
return '<details class="sub" data-k="'+esc(c.n)+'"'+(open[c.n]?' open':'')+'><summary><div class="row"><span class="t">'+esc(c.n)+'<span class="badge">'+esc(c.tag.toUpperCase())+'</span><div class="bar"><i style="width:'+(c[m]/max*100).toFixed(1)+'%"></i></div></span><span class="v num">'+money(c[m])+'</span>'+CHEV+'</div></summary><div class="inner"><div class="kv num"><div><small>Orders</small><b>'+c.conv+'</b></div><div><small>Avg order</small><b>'+money(c.last/c.conv)+'</b></div><div><small>Ad spend</small><b>'+(c.spend?money(c.spend):'None')+'</b></div><div><small>ROAS</small><b>'+roas+'</b></div></div><p class="note"><b>Top performer:</b> '+esc(c.top)+'</p><p class="src">How it is tracked: '+esc(c.how)+'</p></div></details>';}).join('');}
document.querySelectorAll('[data-m]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('[data-m]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});draw(b.dataset.m);});});
draw('last');
document.getElementById('openall').onclick=function(){document.querySelectorAll('main details').forEach(function(x){x.open=true;});};
document.getElementById('closeall').onclick=function(){document.querySelectorAll('main details').forEach(function(x){x.open=false;});};
})();
</script></body></html>`;
}

function trend(h, months) {
  const W = 640, H = 120, L = 34, R = 12, T = 12, B = 24;
  const mn = Math.min(...h), mx = Math.max(...h), sp = (mx - mn) || 1;
  const x = (i) => L + i * (W - L - R) / (h.length - 1), y = (v) => T + (1 - (v - mn) / sp) * (H - T - B);
  const fmt = (v) => (v % 1 ? v.toFixed(1) : v.toLocaleString('en-US'));
  const d = h.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const lab = h.map((v, i) => `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--mut)">${e((months || [])[i] || '')}</text>`).join('');
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Six month trend"><line x1="${L}" x2="${W - R}" y1="${y(mx)}" y2="${y(mx)}" stroke="var(--line)"/><line x1="${L}" x2="${W - R}" y1="${y(mn)}" y2="${y(mn)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(mx) + 4}" text-anchor="end" font-size="10.5" fill="var(--mut)">${fmt(mx)}</text><text x="${L - 6}" y="${y(mn) + 4}" text-anchor="end" font-size="10.5" fill="var(--mut)">${fmt(mn)}</text><path d="${d}" fill="none" stroke="var(--bar)" stroke-width="2" stroke-linejoin="round"/><circle cx="${x(h.length - 1)}" cy="${y(h.at(-1))}" r="4" fill="var(--gold)"/>${lab}</svg>`;
}

// The report a client sees is this exact shape: copy it, change the numbers, save it to KV.
export const SAMPLE = {
  sample: true,
  client: 'Crown Royale Burgers', plan: 'Platinum Accelerator', month: 'October 2026', monthShort: 'October',
  trendMonths: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  headline: 'October was a strong month for getting found. Weekdays still need work.',
  goal: 'We want our new locations to feel as busy on a Tuesday as our flagship does on a Saturday.',
  goals: [
    { name: 'Get found on Google in every neighborhood', status: 'good', value: '+18%', moved: 'Google profile actions rose from 4,120 to 4,860 after all three profiles got new photos, descriptions and holiday hours.', next: 'Keep posting weekly updates to each profile.' },
    { name: 'Turn first visits into loyalty members', status: 'warn', value: '612 / 700', moved: 'Sign ups rose 25% with the new welcome email flow, but are 88 short of target.', next: 'Table tent and receipt prompt test in November.' },
    { name: 'Fill weekday traffic at the two new stores', status: 'bad', value: '+6% / +15%', moved: 'Tuesday and Wednesday visits at Fullerton and Brea are up 6% against August, well short of the 15% target.', next: 'Launch the Tuesday Royale weekday offer and move Meta budget to weekday mornings.' },
  ],
  roi: {
    investment: [{ label: 'Agency fee', amount: 2499 }, { label: 'Meta ads', amount: 1800 }, { label: 'Postcards', amount: 450 }],
    investedNote: 'Fee, ads, printing',
    sales: [{ label: 'Online orders', amount: 14980 }, { label: 'Offer code visits', amount: 3912 }, { label: 'Catering', amount: 2478 }],
    orders: 945,
    salesSource: 'Measured from your online ordering platform, offer codes in your POS and booked catering.',
  },
  channels: [
    { n: 'Google Business Profile', tag: 'estimated', spend: 0, last: 6840, first: 5020, linear: 5980, conv: 312, top: 'Directions and calls from the Brea listing', how: 'Direction requests and calls matched to visits by time and location.' },
    { n: 'Email and loyalty', tag: 'measured', spend: 0, last: 5120, first: 2140, linear: 3750, conv: 241, top: 'Welcome flow email 2: free fries on visit two', how: 'Tagged links and the loyalty offer code in your POS.' },
    { n: 'Meta ads', tag: 'measured', spend: 1800, last: 4210, first: 6930, linear: 5460, conv: 168, top: 'Smash burger reel, weekday lunch audience', how: 'Tagged ad links to online ordering, plus catering bookings.' },
    { n: 'Organic search', tag: 'measured', spend: 0, last: 2480, first: 3110, linear: 2790, conv: 109, top: '"burgers near me" in Brea and Fullerton', how: 'GA4 organic sessions that placed an online order.' },
    { n: 'Weekday postcards', tag: 'measured', spend: 450, last: 1460, first: 1500, linear: 1450, conv: 61, top: 'QR code to the Tuesday offer', how: 'QR scans and the printed offer code in your POS.' },
    { n: 'Instagram organic', tag: 'measured', spend: 0, last: 1260, first: 2670, linear: 1940, conv: 54, top: 'Behind the grill story series', how: 'Link in bio and story link tags.' },
  ],
  paths: [
    { label: 'Most common', meta: '212 orders', steps: ['Instagram post', 'Google profile', 'Online order'] },
    { label: 'Fastest', meta: '1.4 days on average', steps: ['Postcard QR', 'Order'] },
    { label: 'Highest value', meta: '$386 average', steps: ['Meta ad', 'Catering page', 'Email follow up', 'Booking'] },
  ],
  pillars: [
    { p: 'Be found', k: [{ k: 'Google profile actions', v: '4,860', t: '4,500', ch: '+18%', st: 'good', h: [3540, 3610, 3720, 3890, 4120, 4860], def: 'Calls, direction requests and website clicks from your Google listings.', src: 'Google Business Profile' }] },
    { p: 'Reputation', k: [{ k: 'Average rating', v: '4.6', t: '4.6', ch: '+0.1', st: 'good', h: [4.3, 4.3, 4.4, 4.4, 4.5, 4.6], def: 'Average star rating across Google and Yelp, all stores.', src: 'Google, Yelp' }, { k: 'Review response rate', v: '98%', t: '95%', ch: '+36 pts', st: 'good', h: [12, 10, 15, 20, 62, 98], def: 'Share of new reviews answered within 24 hours.', src: 'Google, Yelp' }] },
    { p: 'Website and ordering', k: [{ k: 'Online orders', v: '1,082', t: '1,150', ch: '+15%', st: 'warn', h: [870, 860, 905, 890, 940, 1082], def: 'Orders placed on your website and app.', src: 'GA4, ordering platform' }] },
    { p: 'Loyalty and email', k: [{ k: 'Loyalty sign ups', v: '612', t: '700', ch: '+25%', st: 'warn', h: [410, 395, 430, 450, 488, 612], def: 'New loyalty members this month.', src: 'Loyalty platform' }, { k: 'Email click rate', v: '3.9%', t: '3.5%', ch: '+0.8 pts', st: 'good', h: [2.2, 2.3, 2.4, 2.6, 3.1, 3.9], def: 'Share of people who opened an email and clicked.', src: 'Email platform' }] },
    { p: 'Paid media', k: [{ k: 'Meta cost per order', v: '$10.71', t: '$12.00', ch: '-20%', st: 'good', h: [16.2, 15.8, 15.1, 14.6, 13.4, 10.71], def: 'Meta ad spend divided by orders from Meta. Lower is better.', src: 'Meta Ads Manager' }] },
    { p: 'Business results', k: [{ k: 'Weekday traffic, new stores', v: '+6%', t: '+15%', ch: '+4 pts', st: 'bad', h: [0, 0, 1, 1, 2, 6], def: 'Tuesday and Wednesday visits at Fullerton and Brea versus August.', src: 'POS export' }] },
  ],
  work: {
    shipped: ['Google Profile Glow Up for all 3 locations', 'Review response system, replies inside 24 hours', 'Welcome email flow for new loyalty members', 'Weekday offer postcards to 6,000 homes near Fullerton'],
    next: ['Tuesday Royale weekday offer at the two new stores', 'Local Store Marketing kit for store managers', 'Loyalty table tent and receipt prompt test'],
    needs: ['October POS export for all 3 stores, by Nov 7', 'Approval of the Tuesday Royale offer and price, by Nov 10'],
  },
  signoff: 'Google is working and the money is coming back. November is all about weekdays.',
  sources: 'GA4, Google Business Profile, Search Console, Meta Business Suite, Yelp, email platform and POS exports.',
};
