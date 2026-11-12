// Served at /site.js on every markitmike.com page.
//  1. Loads GA4 (when GA4_ID is set) and exposes window.mmaTrack(event, params) for our own scripts.
//  2. Remembers where a visitor first came from (UTM tags, referrer, landing page) so every form can pass it to HubSpot.
//  3. Copies Crown Blog (Jetpack) signups to HubSpot, without changing how Jetpack sends the newsletter.
//  4. Tracks the clicks that matter: Crown Fitting, checkout, call, email.
export const SITE_JS = String.raw`(function(){
if (window.__mmaSite) return; window.__mmaSite = 1;
var GA = '__GA4__', API = '__API__';
// "this device is me": open any page with ?mma=me once per browser to stop counting your own visits
// (Google Analytics, HubSpot and outreach click alerts); ?mma=reset turns counting back on.
var ME = false;
(function(){
  var m = new URLSearchParams(location.search).get('mma');
  try {
    if (m === 'me') localStorage.setItem('mma-me', '1');
    if (m === 'reset') localStorage.removeItem('mma-me');
    ME = localStorage.getItem('mma-me') === '1';
  } catch (e) {}
  if (m === 'me' || m === 'reset') {
    var n = document.createElement('div');
    n.textContent = m === 'me' ? 'This browser is now marked as you. Your visits will not be counted.' : 'This browser is counted again.';
    n.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;background:#1D0A40;color:#fff;padding:12px 18px;border-radius:12px;font:600 14px Montserrat,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:90vw;text-align:center';
    (document.body ? Promise.resolve() : new Promise(function(r){ document.addEventListener('DOMContentLoaded', r); })).then(function(){ document.body.appendChild(n); setTimeout(function(){ n.remove(); }, 6000); });
  }
})();
if (ME) { (window._hsq = window._hsq || []).push(['doNotTrack']); GA = ''; }
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){ dataLayer.push(arguments); };
if (GA) {
  var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA; document.head.appendChild(s);
  gtag('js', new Date()); gtag('config', GA);
}
window.mmaTrack = function(ev, params){ try { if (GA) gtag('event', ev, params || {}); } catch (e) {} };

// first touch attribution, kept for 90 days in this browser
var KEY = 'mma-src';
function getSrc(){ try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && Date.now() - v.t < 90 * 864e5) return v; } catch (e) {} return null; }
(function(){
  var q = new URLSearchParams(location.search), utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ref'].forEach(function(k){ if (q.get(k)) utm[k] = q.get(k).slice(0, 120); });
  var ext = document.referrer && document.referrer.indexOf(location.host) < 0 ? document.referrer.slice(0, 200) : '';
  if (!getSrc() || Object.keys(utm).length) {
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), utm: utm, ref: ext || (getSrc() || {}).ref || 'direct', landing: location.pathname })); } catch (e) {}
  }
})();
window.mmaSource = function(){ var v = getSrc() || {}; return { utm: v.utm || {}, ref: v.ref || 'direct', landing: v.landing || location.pathname, page: location.pathname }; };

// a prospect from our outreach email landed here (?mmc=token): tell the worker once per visit
// Only counts a real person: not an automated browser, and only after a scroll, tap, key press, or 10
// seconds on a visible page. Email security scanners load the link and leave, so they never report.
(function(){ var t = new URLSearchParams(location.search).get('mmc'); if (!t || ME || navigator.webdriver) return;
  var done = false, timer = null;
  function report(){ if (done) return; done = true; clearTimeout(timer);
    ['scroll','pointerdown','keydown','touchstart'].forEach(function(e){ removeEventListener(e, report, true); });
    var body = JSON.stringify({ t: t, page: location.pathname });
    try { navigator.sendBeacon ? navigator.sendBeacon(API + '/seen', new Blob([body], { type: 'text/plain' })) : fetch(API + '/seen', { method: 'POST', body: body, keepalive: true }); } catch (x) {}
    window.mmaTrack('outreach_click', { page_path: location.pathname });
  }
  ['scroll','pointerdown','keydown','touchstart'].forEach(function(e){ addEventListener(e, report, { capture: true, passive: true }); });
  function arm(){ if (document.visibilityState === 'visible' && !timer) timer = setTimeout(report, 10000); }
  document.addEventListener('visibilitychange', arm); arm();
})();

// a personal link from Michael (?hi=<name>): tell the worker so he knows they opened it
(function(){ var h = new URLSearchParams(location.search).get('hi'); if (!h || ME) return;
  var body = JSON.stringify({ h: h, page: location.pathname });
  try { navigator.sendBeacon ? navigator.sendBeacon(API + '/hi', new Blob([body], { type: 'text/plain' })) : fetch(API + '/hi', { method: 'POST', body: body, keepalive: true }); } catch (x) {}
  window.mmaTrack('personal_link_open', { page_path: location.pathname });
})();

// Crown Blog signups: let Jetpack do its job, and send a copy to HubSpot
document.addEventListener('submit', function(e){
  var f = e.target; if (!f || !f.closest || !f.closest('.wp-block-jetpack-subscriptions, .jetpack_subscription_widget')) return;
  var em = f.querySelector('input[type=email], input[name=email]'); if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) return;
  var body = JSON.stringify({ email: em.value.trim(), source: 'Crown Blog signup', src: window.mmaSource() });
  try { navigator.sendBeacon ? navigator.sendBeacon(API + '/subscribe', new Blob([body], { type: 'text/plain' })) : fetch(API + '/subscribe', { method: 'POST', body: body, keepalive: true }); } catch (x) {}
  window.mmaTrack('sign_up', { method: 'crown_blog', page_path: location.pathname });
}, true);

// clicks worth counting
document.addEventListener('click', function(e){
  var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
  var h = a.getAttribute('href') || '';
  if (/crownfitting/i.test(h)) window.mmaTrack('crown_fitting_click', { link_text: (a.innerText || '').trim().slice(0, 60), page_path: location.pathname });
  else if (/buy\.stripe\.com/i.test(h)) { var card = a.closest('article, .qw-card, .mmt-card'); var t = card && card.querySelector('h3'); window.mmaTrack('begin_checkout', { item_name: t ? t.innerText.trim() : '', page_path: location.pathname }); }
  else if (/^tel:/i.test(h)) window.mmaTrack('click_to_call', { page_path: location.pathname });
  else if (/^mailto:/i.test(h)) window.mmaTrack('click_to_email', { page_path: location.pathname });
}, true);
})();`;
