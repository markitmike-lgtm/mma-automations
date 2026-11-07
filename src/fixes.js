// "Start fixing it": every Snapshot observation gets a category, a supporting visual and two ways forward:
//   DIY:           a free branded guide on this worker, /fix/<category>
//   Done for you:  the matching Quick Win offer on markitmike.com/quick-wins
// Clicks from a prospect's Snapshot (?s=<pub>) are logged on their HubSpot deal as a buying signal.

const WORKER = 'https://mma-automations.markitmike.workers.dev';
const LOGO = 'https://markitmike.com/wp-content/uploads/2026/11/mma-logo-reverse-tight.png';
const QW = 'https://markitmike.com/quick-wins/';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const P = '#5D0EA6', G = '#E79A27', T = '#108193', S = '#F7F4FB', L = '#E6DDF2';
const svg = (inner) => `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"><rect width="320" height="180" fill="${S}"/>${inner}</svg>`;
const stars = (x, y, n, on = 5) => [...Array(n)].map((_, i) => `<path transform="translate(${x + i * 18} ${y})" d="M7 0l2.1 4.4 4.9.7-3.5 3.4.8 4.8L7 11l-4.3 2.3.8-4.8L0 5.1l4.9-.7z" fill="${i < on ? G : L}"/>`).join('');

const ART = {
  google: svg(`<rect x="70" y="26" width="180" height="128" rx="14" fill="#fff" stroke="${L}"/><rect x="70" y="26" width="180" height="48" rx="14" fill="url(#gg)"/><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="${G}"/><stop offset=".6" stop-color="${T}"/><stop offset="1" stop-color="${P}"/></linearGradient></defs><rect x="86" y="86" width="96" height="9" rx="4" fill="#2A1B4A"/>${stars(86, 102, 5, 4)}<rect x="86" y="124" width="140" height="7" rx="3" fill="${L}"/><rect x="86" y="138" width="100" height="7" rx="3" fill="${L}"/><path d="M262 40c-12 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34c0-11-8-20-20-20z" fill="${P}"/><circle cx="262" cy="60" r="7" fill="#fff"/>`),
  reviews: svg(`<rect x="38" y="30" width="170" height="70" rx="14" fill="#fff" stroke="${L}"/>${stars(54, 46, 5, 3)}<rect x="54" y="70" width="130" height="7" rx="3" fill="${L}"/><rect x="54" y="83" width="90" height="7" rx="3" fill="${L}"/><path d="M60 100l-6 14 18-14z" fill="#fff"/><rect x="112" y="98" width="170" height="56" rx="14" fill="${P}"/><rect x="128" y="114" width="120" height="7" rx="3" fill="#fff" opacity=".85"/><rect x="128" y="128" width="84" height="7" rx="3" fill="#fff" opacity=".6"/><path d="M262 154l8 12-20-12z" fill="${P}"/><circle cx="276" cy="100" r="13" fill="${G}"/><path d="M270 100l4 4 8-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  sentiment: svg(`<rect x="40" y="28" width="240" height="124" rx="14" fill="#fff" stroke="${L}"/><circle cx="66" cy="62" r="12" fill="${T}"/><path d="M60 64q6 6 12 0" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/><rect x="88" y="56" width="150" height="12" rx="6" fill="${T}"/><circle cx="66" cy="94" r="12" fill="${G}"/><path d="M60 97h12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><rect x="88" y="88" width="90" height="12" rx="6" fill="${G}"/><circle cx="66" cy="126" r="12" fill="${P}"/><path d="M60 130q6-6 12 0" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/><rect x="88" y="120" width="54" height="12" rx="6" fill="${P}"/><rect x="200" y="114" width="64" height="24" rx="12" fill="${S}"/><rect x="210" y="123" width="44" height="6" rx="3" fill="${L}"/>`),
  website: svg(`<rect x="44" y="22" width="232" height="140" rx="12" fill="#fff" stroke="${L}"/><rect x="44" y="22" width="232" height="22" rx="12" fill="${L}"/><circle cx="60" cy="33" r="4" fill="${G}"/><circle cx="73" cy="33" r="4" fill="${T}"/><circle cx="86" cy="33" r="4" fill="${P}"/><rect x="60" y="56" width="200" height="54" rx="8" fill="url(#wg)"/><defs><linearGradient id="wg" x1="0" x2="1"><stop offset="0" stop-color="${P}"/><stop offset="1" stop-color="${T}"/></linearGradient></defs><rect x="72" y="70" width="96" height="9" rx="4" fill="#fff"/><rect x="72" y="85" width="64" height="7" rx="3" fill="#fff" opacity=".7"/><rect x="60" y="122" width="64" height="24" rx="12" fill="${G}"/><rect x="134" y="126" width="120" height="7" rx="3" fill="${L}"/><rect x="134" y="139" width="80" height="7" rx="3" fill="${L}"/>`),
  social: svg(`<rect x="112" y="14" width="96" height="156" rx="16" fill="#fff" stroke="${L}" stroke-width="2"/><circle cx="132" cy="38" r="9" fill="url(#sg)"/><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="${G}"/><stop offset="1" stop-color="${P}"/></linearGradient></defs><rect x="146" y="34" width="46" height="7" rx="3" fill="${L}"/>${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect x="${122 + c * 26}" y="${58 + r * 30}" width="22" height="26" rx="4" fill="${[P, G, T, L][(r + c) % 4]}" opacity="${(r + c) % 4 === 3 ? 1 : 0.8}"/>`).join('')).join('')}<path d="M238 70c-8-10-24-2-16 10l16 14 16-14c8-12-8-20-16-10z" fill="${G}"/><path d="M70 110c-6-7-17-1-11 7l11 10 11-10c6-8-5-14-11-7z" fill="${T}"/>`),
  loyalty: svg(`<rect x="50" y="36" width="220" height="112" rx="16" fill="url(#lg)"/><defs><linearGradient id="lg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${P}"/><stop offset="1" stop-color="#2B0F63"/></linearGradient></defs><rect x="68" y="52" width="90" height="9" rx="4" fill="#fff"/><rect x="68" y="66" width="56" height="6" rx="3" fill="#fff" opacity=".6"/>${[0, 1, 2, 3, 4].map((i) => `<circle cx="${84 + i * 38}" cy="114" r="13" fill="${i < 3 ? G : 'none'}" stroke="${G}" stroke-width="2.5"/>`).join('')}<path d="M232 50l6 6 10-12" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  opening: svg(`<rect x="88" y="30" width="144" height="124" rx="14" fill="#fff" stroke="${L}"/><rect x="88" y="30" width="144" height="34" rx="14" fill="${P}"/><rect x="88" y="50" width="144" height="14" fill="${P}"/><rect x="110" y="22" width="8" height="20" rx="4" fill="${G}"/><rect x="202" y="22" width="8" height="20" rx="4" fill="${G}"/>${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => `<rect x="${102 + c * 24}" y="${74 + r * 19}" width="16" height="12" rx="3" fill="${r === 2 && c === 3 ? G : L}"/>`).join('')).join('')}<path d="M20 60h46l-8 10 8 10H20z" fill="${G}"/><path d="M300 110h-46l8 10-8 10h46z" fill="${T}"/>`),
  brand: svg(`<path d="M100 128l-12-66 40 30 32-48 32 48 40-30-12 66z" fill="url(#cg)"/><defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset=".55" stop-color="${G}"/><stop offset="1" stop-color="#C06F14"/></linearGradient></defs><rect x="98" y="134" width="124" height="16" rx="6" fill="${P}"/><circle cx="160" cy="104" r="9" fill="${P}"/><circle cx="124" cy="110" r="6" fill="${T}"/><circle cx="196" cy="110" r="6" fill="${T}"/>`),
};

// the done for you offer for each category (anchors exist on the Quick Wins page)
const OFFERS = {
  glowup: { name: 'Google Profile Glow Up', price: '$297', url: `${QW}#glowup-explained`, cta: 'Have our team do it' },
  checkup: { name: 'Brand Checkup', price: '$197', url: `${QW}#checkup-explained`, cta: 'Have our team review it' },
  gold: { name: 'Gold Starter', price: '$497', url: 'https://markitmike.com/gold-starter/', cta: 'Get the full plan' },
};

export const FIXES = {
  google: {
    label: 'Google profile', offer: 'glowup', guide: 'The 20 minute Google profile tune up',
    intro: 'For most new customers, your Google profile is the front door. These steps fix the gaps people notice first.',
    steps: [
      ['Check your hours', 'Confirm regular hours, then add holiday hours for the next 60 days. Wrong hours are the fastest way to lose trust.'],
      ['Pick the right categories', 'Your primary category should be the one thing you most want to be found for. Add 2 to 4 secondary categories that are true.'],
      ['Fill in services or menu', 'Add your top items or services with a short line each. Profiles with complete details get more clicks.'],
      ['Write a 750 character description', 'Say who you serve, what makes you different and where you are. Use the words people actually search.'],
      ['Add 10 fresh photos', 'Exterior so people can find you, interior, your team, and your best sellers. Bright, real, and recent beats polished.'],
      ['Turn on messaging and add your booking or order link', 'Make the next step one tap away.'],
      ['Set a monthly reminder', 'Post one update and add a few new photos every month. Active profiles stay visible.'],
    ],
  },
  reviews: {
    label: 'Reviews and reputation', offer: 'glowup', guide: 'The review reply playbook',
    intro: 'Replies are read by every future customer, not just the reviewer. Answer every review within 48 hours using these frames.',
    steps: [
      ['Reply to the newest 10 first', 'Start with anything under 4 stars, then thank the happy ones.'],
      ['Use their name and one detail', 'It proves a real person read it.'],
      ['Keep negative replies short and take it offline', 'Own it, apologize once, invite them to reach you directly. Never argue in public.'],
      ['Ask happy customers in person', 'The best moment to ask is right after a great experience. A small card with a QR code helps.'],
      ['Check reviews twice a week', 'Put it on the calendar so it never piles up.'],
    ],
    templates: [
      ['5 stars', 'Thank you, [Name]! We are so glad you loved [detail]. Our team will be thrilled to hear it. See you again soon!'],
      ['3 or 4 stars', 'Thanks for the honest feedback, [Name]. We are glad you enjoyed [detail], and we hear you on [issue]. We are working on it, and we would love the chance to make your next visit a 5.'],
      ['1 or 2 stars', 'Hi [Name], we are sorry your visit fell short. That is not the experience we want for anyone. Please reach us at [email or phone] so we can make it right.'],
    ],
  },
  sentiment: {
    label: 'Customer sentiment', offer: 'gold', guide: 'The customer sentiment scan',
    intro: 'Your rating says how people feel. Your reviews say why. This 30 minute scan shows you what customers keep repeating, good and bad.',
    steps: [
      ['Pull your last 50 reviews', 'Use Google and Yelp together. Recent reviews matter most.'],
      ['Tag each one with a theme', 'Speed, friendliness, quality, cleanliness, value, accuracy. Keep it to 6 or fewer.'],
      ['Count your top 3 praises and top 3 complaints', 'A simple tally is enough. Patterns beat one loud review.'],
      ['Fix the most repeated complaint first', 'Pick one change, assign one owner, and set a date.'],
      ['Share the praise with your team', 'Read the best comments out loud at your next meeting. People repeat what gets recognized.'],
      ['Put your top praise to work', 'Use those exact words in your website headline, Google description and social bio.'],
      ['Repeat the scan every month', 'Watch the complaint shrink and the praise grow.'],
    ],
  },
  website: {
    label: 'Website', offer: 'checkup', guide: 'The 5 second website check',
    intro: 'New visitors decide in about five seconds whether to stay. Open your site on your phone and check each item.',
    steps: [
      ['Say what you do and where, above the fold', 'One clear headline, your city, and a photo of the real thing.'],
      ['Put one main button at the top', 'Order, Book, or Call. One action, high contrast, visible without scrolling.'],
      ['Test it on your phone', 'Tap every button. Check the text is readable without zooming.'],
      ['Make hours, address and phone easy to find', 'In the header or footer of every page, matching your Google profile exactly.'],
      ['Check the speed', 'If the home page takes more than 3 seconds, compress the big images first.'],
      ['Add proof', 'Three short reviews or a rating badge near the top builds trust fast.'],
    ],
  },
  social: {
    label: 'Social media', offer: 'checkup', guide: 'The simple social rhythm',
    intro: 'Consistency beats volume. This rhythm keeps you visible without taking over your week.',
    steps: [
      ['Fix your profile first', 'Clear photo or logo, a bio that says what and where, and a link to order, book or visit.'],
      ['Pick 3 content buckets', 'For example: behind the scenes, your best sellers, and your people or customers.'],
      ['Post 3 times a week', 'Batch a week of photos in one 30 minute session.'],
      ['Use short video', 'A 10 second clip of something being made or served often beats a polished photo.'],
      ['Reply to every comment and message within a day', 'It is customer service in public.'],
      ['Pin your best 3 posts', 'New visitors see your highlights first.'],
    ],
  },
  loyalty: {
    label: 'Loyalty and repeat visits', offer: 'gold', guide: 'The repeat visit starter kit',
    intro: 'Bringing a customer back costs far less than finding a new one. Start simple and make it easy to join.',
    steps: [
      ['Pick one simple reward', 'Visit based or points based, explained in one sentence.'],
      ['Make joining take under 10 seconds', 'Phone number at checkout, or a QR code at the counter.'],
      ['Train your team on one line', 'For example: Are you a member yet? Your next visit could be on us.'],
      ['Send a welcome message', 'Thank them and tell them what they are working toward.'],
      ['Win back quiet customers', 'Anyone who has not visited in 30 to 45 days gets a friendly reason to return.'],
      ['Track 2 numbers monthly', 'New members and the share of sales from members.'],
    ],
  },
  opening: {
    label: 'Opening or launch', offer: 'gold', guide: 'The 30 day opening countdown',
    intro: 'A strong opening sets the tone for the first year. Work backward from your date.',
    steps: [
      ['30 days out: claim and complete every listing', 'Google, Yelp and Apple Maps, with photos and opening date.'],
      ['21 days out: start a VIP list', 'A simple signup on your site and social for first access and an opening offer.'],
      ['14 days out: invite your neighbors', 'Nearby businesses, local groups and media. Offer a sneak peek.'],
      ['7 days out: soft open', 'Friends and VIPs first, so your team is ready for day one.'],
      ['Opening day: capture everything', 'Photos, video and reviews. Ask your first customers to share.'],
      ['Week 2: follow up', 'Thank your VIP list and give them a reason to come back.'],
    ],
  },
  brand: {
    label: 'Brand and positioning', offer: 'gold', guide: 'The one line brand check',
    intro: 'If customers cannot say why you are different, they will choose on price. Sharpen the story first.',
    steps: [
      ['Write your one line', 'We help [who] get [result] by [what makes us different].'],
      ['Ask 5 customers why they chose you', 'Use their words, not yours.'],
      ['Check your top 3 competitors', 'Note what they all say, then say something they do not.'],
      ['Match your look everywhere', 'Same logo, colors and tone across your site, Google, social and storefront.'],
      ['Put your one line to work', 'Website headline, social bio and the first thing your team says.'],
    ],
  },
};

export const FIX_KEYS = Object.keys(FIXES);

// best guess for drafts made before categories existed, or when the AI leaves it out
export function fixCategory(o = {}) {
  if (FIXES[o.category]) return o.category;
  const t = `${o.title} ${o.saw} ${o.quick_win}`.toLowerCase();
  if (/sentiment|complain|praise|feedback|theme|mention|people say|guests say|customers say|feel about/.test(t)) return 'sentiment';
  if (/review|rating|yelp|star/.test(t)) return 'reviews';
  if (/google|map|listing|profile|search/.test(t)) return 'google';
  if (/website|site|online order|mobile|page|seo/.test(t)) return 'website';
  if (/instagram|facebook|tiktok|social|post/.test(t)) return 'social';
  if (/loyal|repeat|reward|member|retention|come back/.test(t)) return 'loyalty';
  if (/open|launch|new location|new store/.test(t)) return 'opening';
  return 'brand';
}

export function fixArt(cat) { return ART[cat] || ART.brand; }

// pub: the Snapshot's public token, so clicks can be tied back to the deal
export function fixLinks(cat, pub) {
  const f = FIXES[cat] || FIXES.brand;
  const o = OFFERS[f.offer];
  const q = pub ? `?s=${encodeURIComponent(pub)}` : '';
  return { guide: f.guide, diy: `${WORKER}/fix/${cat}${q}`, offer: o, dfy: `${WORKER}/fix/${cat}/go${q}` };
}

async function logClick(env, x, pub, what) {
  if (!pub || !/^[a-z0-9]{10,24}$/.test(pub)) return;
  const tok = await env.REPORTS.get(`snappub:${pub}`);
  const rec = tok && (await env.REPORTS.get(`snap:${tok}`, 'json'));
  if (!rec?.dealId) return;
  const key = `fixclick:${pub}:${what}`;
  if (await env.REPORTS.get(key)) return; // one note per action is enough
  await env.REPORTS.put(key, '1', { expirationTtl: 60 * 60 * 24 * 90 });
  await x.hs(env, 'POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p><b>Buying signal:</b> ${esc(rec.who || rec.company)} ${esc(what)} from their Brand Experience Snapshot.</p>` }, associations: [{ to: { id: rec.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }, { to: { id: rec.dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }] }).catch((e) => console.error('fix click note', e.message));
}

// GET /fix/<cat> (free guide) and /fix/<cat>/go (redirect to the done for you offer)
export async function fixRoute(req, env, x, ctx) {
  const u = new URL(req.url);
  const [, , cat, go] = u.pathname.split('/');
  const f = FIXES[cat];
  if (!f) return Response.redirect(QW, 302);
  const pub = u.searchParams.get('s') || '';
  const bot = /bot|crawl|spider|preview|scan|proofpoint|mimecast|barracuda|safelinks|headless/i.test(req.headers.get('User-Agent') || '');
  const o = OFFERS[f.offer];
  if (go === 'go') {
    if (!bot) ctx.waitUntil(logClick(env, x, pub, `clicked the ${o.name} offer (${f.label})`));
    return Response.redirect(o.url, 302);
  }
  if (!bot) ctx.waitUntil(logClick(env, x, pub, `opened the free guide: ${f.guide}`));
  const steps = f.steps.map(([h, p], i) => `<li><label><input type="checkbox"><span><b>${esc(h)}</b>${esc(p)}</span></label></li>`).join('');
  const tpl = (f.templates || []).map(([h, p]) => `<div class="tp"><p class="k">${esc(h)}</p><p>${esc(p)}</p></div>`).join('');
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(f.guide)} | Markit Mike Agency</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Montserrat:wght@800;900&display=swap"><style>
body{margin:0;background:#F3EEF9;font:16px/1.55 Inter,Arial,sans-serif;color:#2b2540}.w{max-width:760px;margin:28px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 18px 48px rgba(43,15,99,.12)}
header{background:linear-gradient(125deg,#5D0EA6,#2B0F63 60%,#1A0838);color:#fff;padding:26px 36px 30px}header img{height:34px}.ey{margin:22px 0 6px;font:800 12px Montserrat,Arial;letter-spacing:.2em;text-transform:uppercase;color:#FBD38A}h1{margin:0;font:900 30px/1.15 Montserrat,Arial}
.art{background:#F7F4FB}.art svg{display:block;width:100%;height:auto;max-height:260px}main{padding:26px 36px 34px}.intro{font-size:17px;margin:0 0 18px}
ol{list-style:none;margin:0;padding:0;display:grid;gap:10px}li label{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid #E6DDF2;border-radius:12px;cursor:pointer}li input{width:20px;height:20px;margin-top:2px;accent-color:#5D0EA6;flex:none}li b{display:block;color:#1c1236}li input:checked+span{opacity:.55;text-decoration:line-through}
h2{font:900 18px Montserrat,Arial;color:#1c1236;margin:26px 0 10px}.tp{background:#FDF4E7;border-radius:12px;padding:12px 14px;margin-bottom:10px}.tp p{margin:0}.k{font:800 11px Montserrat,Arial!important;letter-spacing:.16em;text-transform:uppercase;color:#9A5B00;margin-bottom:4px!important}
.dfy{margin-top:26px;padding:20px 22px;border-radius:16px;background:linear-gradient(110deg,#F7F4FB,#FDF4E7);display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}.dfy p{margin:0}.dfy b{color:#1c1236}
.btn{display:inline-block;padding:12px 22px;border-radius:999px;background:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);color:#2A0E52;font:900 15px Montserrat,Arial;text-decoration:none}.pr{margin-top:18px;font-size:13px;color:#7A7388}.pr a{color:#5D0EA6}
@media (max-width:600px){.w{margin:0;border-radius:0}header,main{padding-left:18px;padding-right:18px}h1{font-size:24px}}@media print{body{background:#fff}.w{box-shadow:none;margin:0}.dfy,.pr{display:none}}
</style></head><body><div class="w"><header><img src="${LOGO}" alt="Markit Mike Agency"><p class="ey">Free guide · ${esc(f.label)}</p><h1>${esc(f.guide)}</h1></header><div class="art">${fixArt(cat)}</div>
<main><p class="intro">${esc(f.intro)}</p><ol>${steps}</ol>${tpl ? `<h2>Copy and paste replies</h2>${tpl}` : ''}
<div class="dfy"><p><b>Rather have it done for you?</b><br>Our team handles this in the ${esc(o.name)}, ${esc(o.price)}.</p><a class="btn" href="${WORKER}/fix/${cat}/go${pub ? `?s=${encodeURIComponent(pub)}` : ''}">${esc(o.cta)}</a></div>
<p class="pr">Tip: check items off as you go, or print this page. Questions? <a href="mailto:team@markitmike.com">team@markitmike.com</a></p></main></div></body></html>`;
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
}
