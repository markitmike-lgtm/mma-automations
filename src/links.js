// Personal tracked links for 1:1 outreach: add ?hi=<name> to any markitmike.com link you send someone
// (for example markitmike.com/about?hi=randy-sharpe). When that person opens it, site.js tells the worker,
// and you get one email per person per day: "randy sharpe opened markitmike.com/about".
// Opens by Michael's own browsers (?mma=me) are never sent.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function hiRoute(req, env, x) {
  let b = {};
  try { b = JSON.parse(await req.text()); } catch {}
  const slug = String(b.h || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  const page = String(b.page || '/').replace(/[^\w\-/.]/g, '').slice(0, 120);
  const ua = (req.headers.get('User-Agent') || '').toLowerCase();
  if (!slug || /bot|crawl|spider|preview|scan|headless|linkedin|facebookexternalhit|slack|whatsapp/.test(ua)) return new Response(null, { status: 204 });
  const day = new Date().toISOString().slice(0, 10);
  const key = `hi:${slug}`;
  const rec = (await env.REPORTS.get(key, 'json')) || { slug, opens: 0, pages: [] };
  rec.opens += 1; rec.last = Date.now(); rec.first = rec.first || Date.now();
  if (!rec.pages.includes(page)) rec.pages = rec.pages.concat(page).slice(-10);
  const alertToday = rec.alerted !== day;
  rec.alerted = day;
  await env.REPORTS.put(key, JSON.stringify(rec));
  if (alertToday) {
    const who = slug.replace(/-/g, ' ');
    await x.sendRaw(env, { to: env.OWNER_EMAIL, subject: `${who} opened your link: markitmike.com${page}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#108193;">LINK OPENED</p><p style="margin:0 0 12px;font-size:20px;font-weight:800;">${esc(who)} is looking at markitmike.com${esc(page)}</p><p style="font-size:15px;">That's ${rec.opens === 1 ? 'their first visit' : `visit ${rec.opens}`} through the link you sent. A good moment for a friendly follow up.</p></div>` }).catch((e) => console.error('hi alert', e.message));
  }
  return new Response(null, { status: 204 });
}
