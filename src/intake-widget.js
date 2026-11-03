// Served at /intake.js. Renders the intake into <div id="mma-intake"></div> on markitmike.com/intake.
// __SECTIONS__, __NAMES__, __NEXT__ and __ENDPOINT__ are filled in by the worker.
export const INTAKE_JS = String.raw`(function(){
var SECTIONS = __SECTIONS__, NAMES = __NAMES__, NEXT = __NEXT__, API = '__ENDPOINT__';
var root = document.getElementById('mma-intake'); if (!root) return;
var css = '\
#mma-intake{--g:#E79A27;--t:#108193;--p:#5D0EA6;--ink:#1c1236;--mut:#4a4363;font-family:Montserrat,system-ui,sans-serif;color:var(--ink)}\
#mma-intake *{box-sizing:border-box}\
.mi-hero{position:relative;overflow:hidden;width:100vw;margin-left:calc(50% - 50vw);padding:72px 24px 150px;color:#fff;text-align:center;background:radial-gradient(70% 80% at 85% 60%,rgba(93,14,166,.8) 0%,rgba(93,14,166,0) 65%),linear-gradient(140deg,#036684 0%,#0b3354 40%,#1d0a40 100%)}\
.mi-hero img{width:54px;margin:0 auto 18px;display:block;animation:miF 5s ease-in-out infinite}\
@keyframes miF{50%{transform:translateY(-8px) rotate(4deg)}}\
.mi-eb{display:inline-block;margin:0 0 14px;padding:7px 18px;border-radius:999px;border:1px solid rgba(255,210,122,.5);font-size:12px;font-weight:800;letter-spacing:3px;color:#ffd27a}\
.mi-hero h1{margin:0 auto 14px;max-width:820px;font-size:clamp(32px,5vw,56px);font-weight:900;line-height:1.08;color:#fff;text-transform:none}\
.mi-hero p{margin:0 auto;max-width:680px;font-size:18px;line-height:1.65;color:rgba(255,255,255,.88)}\
.mi-wrap{position:relative;z-index:2;max-width:860px;margin:-100px auto 80px;padding:0 16px}\
.mi-card{background:#fff;border:1px solid #ece5f6;border-radius:26px;box-shadow:0 30px 80px rgba(29,10,64,.16);padding:34px 36px;margin-bottom:22px}\
.mi-card h2{display:flex;align-items:center;gap:14px;margin:0 0 6px;font-size:24px;font-weight:900;color:var(--ink);text-transform:none}\
.mi-card h2 b{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--p),var(--t));color:#fff;font-size:15px}\
.mi-note{margin:6px 0 4px;padding:12px 14px;border-radius:12px;background:#FDF4E7;color:#7a4a08;font-size:14px;font-weight:600;line-height:1.5}\
.mi-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;margin-top:16px}\
.mi-f{grid-column:1/-1;margin-bottom:18px}.mi-f.half{grid-column:auto}\
.mi-f>label,.mi-f legend{display:block;margin:0 0 7px;padding:0;font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#2a0d55}\
.mi-f legend{float:left;width:100%}\
.mi-f fieldset{margin:0;padding:0;border:0;min-width:0}\
.mi-req{color:var(--g);margin-left:4px}\
.mi-help{display:block;margin:-2px 0 8px;font-size:13px;color:#7a7392;font-weight:500;letter-spacing:0;text-transform:none}\
.mi-in{display:block;width:100%;padding:13px 15px;border:1.5px solid #e6def3;border-radius:14px;background:#faf8fd;font:500 16px Montserrat,system-ui,sans-serif;color:var(--ink);transition:border-color .2s,box-shadow .2s}\
textarea.mi-in{min-height:96px;resize:vertical}\
.mi-in:focus{outline:none;border-color:var(--g);background:#fff;box-shadow:0 0 0 4px rgba(231,154,39,.18)}\
.mi-opts{clear:both;display:flex;flex-wrap:wrap;gap:8px}\
.mi-opt{position:relative}\
.mi-opt input{position:absolute;opacity:0;pointer-events:none}\
.mi-opt span{display:inline-block;padding:9px 15px;border:1.5px solid #e6def3;border-radius:999px;background:#faf8fd;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}\
.mi-opt input:checked+span{border-color:var(--p);background:linear-gradient(110deg,var(--p),var(--t));color:#fff}\
.mi-opt input:focus-visible+span{box-shadow:0 0 0 4px rgba(231,154,39,.3)}\
.mi-acc{clear:both;display:grid;gap:8px}\
.mi-acc label{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1.5px solid #e6def3;border-radius:14px;cursor:pointer;font-size:15px;line-height:1.45}\
.mi-acc input{margin-top:3px;width:18px;height:18px;accent-color:#5D0EA6}\
.mi-acc small{display:block;color:#7a7392;font-size:13px}\
.mi-other{margin-top:8px}.mi-in[hidden]{display:none}\
.mi-err{display:none;margin-top:6px;font-size:13px;font-weight:700;color:#b42318}.mi-f.bad .mi-err{display:block}.mi-f.bad .mi-in{border-color:#e5484d}\
.mi-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}\
.mi-send{display:inline-flex;align-items:center;gap:10px;padding:18px 38px;border:0;border-radius:999px;cursor:pointer;font:800 17px Montserrat,system-ui,sans-serif;color:#2a0e52;background:linear-gradient(110deg,#ffe08a,#E79A27 55%,#c06f14);box-shadow:0 14px 30px rgba(192,111,20,.3);transition:transform .25s}\
.mi-send:hover{transform:translateY(-2px)}.mi-send[disabled]{opacity:.6;cursor:wait}\
.mi-foot{text-align:center}.mi-foot p{color:var(--mut);font-size:14px}\
.mi-done{text-align:center;padding:46px 34px}\
.mi-done img{width:64px;margin:0 auto 14px;display:block}\
.mi-done h2{display:block;font-size:30px}\
.mi-done p{font-size:17px;line-height:1.65;color:var(--mut);max-width:560px;margin:10px auto 0}\
@media(max-width:700px){.mi-grid{grid-template-columns:1fr}.mi-f.half{grid-column:1/-1}.mi-card{padding:26px 20px;border-radius:22px}.mi-hero{padding:54px 18px 130px}}\
';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
var CROWN = 'https://markitmike.com/wp-content/uploads/2026/06/Crown-Icon-14Degree-Tilt.png';
var offer = (new URLSearchParams(location.search).get('offer') || '').toLowerCase();
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
var hero = '<section class="mi-hero"><img src="' + CROWN + '" alt=""><span class="mi-eb">CLIENT INTAKE</span><h1>Welcome to Markit Mike Agency. Let\'s get to know your brand.</h1><p>This short form gives our team everything we need to hit the ground running. There are no wrong answers, and "not sure" is always fine. Your answers stay private and are only used to do your work.</p></section>';
if (!NAMES[offer]) {
  root.innerHTML = hero + '<div class="mi-wrap"><div class="mi-card mi-done"><img src="' + CROWN + '" alt=""><h2>Please use the link in your welcome email</h2><p>Your intake is personalized to what you purchased, so it opens from the button in your welcome email. Can\'t find it? Just reply to that email, or call or text (714) 919&#8209;9469, and our team will resend it.</p></div></div>';
  return;
}
var secs = SECTIONS.filter(function(s){ return s.show.indexOf(offer) > -1; }).map(function(s){
  var c = JSON.parse(JSON.stringify(s));
  c.q = c.q.filter(function(q){ return !q.show || q.show.indexOf(offer) > -1; });
  c.q.forEach(function(q){ if (q.access) q.opts = q.opts.filter(function(o){ return o.show.indexOf(offer) > -1; }); });
  return c;
});
var mins = { checkup: 5, glowup: 5, gold: 10, platinum: 15, crownjewel: 15 }[offer];
function field(q){
  var r = q.req ? '<span class="mi-req" aria-hidden="true">*</span>' : '';
  var help = q.help ? '<span class="mi-help">' + esc(q.help) + '</span>' : '';
  var h = '<div class="mi-f' + (q.half ? ' half' : '') + '" data-q="' + q.id + '">';
  if (q.type === 'radio' || q.type === 'checks') {
    var t = q.type === 'radio' ? 'radio' : 'checkbox';
    h += '<fieldset><legend>' + esc(q.label) + r + '</legend>' + help;
    if (q.access) {
      h += '<div class="mi-acc">' + q.opts.map(function(o){ return '<label><input type="checkbox" name="' + q.id + '" value="' + esc(o.v) + '"><span><b>' + esc(o.v) + '</b><small>' + esc(o.how) + '</small></span></label>'; }).join('') + '</div>';
    } else {
      var opts = q.opts.slice(); if (q.other) opts.push('Other');
      h += '<div class="mi-opts">' + opts.map(function(o){ return '<label class="mi-opt"><input type="' + t + '" name="' + q.id + '" value="' + esc(o) + '"><span>' + esc(o) + '</span></label>'; }).join('') + '</div>';
      if (q.other) h += '<input class="mi-in mi-other" name="' + q.id + '__other" placeholder="Other: tell us" hidden>';
    }
    h += '</fieldset>';
  } else {
    var id = 'mi-' + q.id, ph = q.ph ? ' placeholder="' + esc(q.ph) + '"' : '';
    h += '<label for="' + id + '">' + esc(q.label) + r + '</label>' + help;
    h += q.type === 'textarea' ? '<textarea class="mi-in" id="' + id + '" name="' + q.id + '"' + ph + ' maxlength="4000"></textarea>'
      : '<input class="mi-in" id="' + id + '" name="' + q.id + '" type="' + (q.type === 'email' ? 'email' : q.type === 'tel' ? 'tel' : 'text') + '"' + ph + ' maxlength="400">';
  }
  return h + '<div class="mi-err">Please answer this one.</div></div>';
}
var html = hero + '<form class="mi-wrap" novalidate><input class="mi-hp" name="company_site" tabindex="-1" autocomplete="off" aria-hidden="true">';
secs.forEach(function(s, i){
  html += '<div class="mi-card"><h2><b>' + (i + 1) + '</b>' + esc(s.title) + '</h2>' + (s.note ? '<p class="mi-note">' + esc(s.note) + '</p>' : '') + '<div class="mi-grid">' + s.q.map(field).join('') + '</div></div>';
});
html += '<div class="mi-foot"><button class="mi-send" type="submit">Send my answers &#10140;</button><p>About ' + mins + ' minutes. Required questions are marked with <span class="mi-req">*</span>. Questions? Call or text (714) 919&#8209;9469.</p></div></form>';
root.innerHTML = html;
var form = root.querySelector('form'), started = Date.now();
// Guests for restaurants, customers for everyone else
function swapWord(){
  var v = (form.querySelector('input[name="btype"]:checked') || {}).value || '';
  var guest = /Restaurant|Entertainment/.test(v);
  root.querySelectorAll('legend, label, .mi-help').forEach(function(el){
    el.childNodes.forEach(function(n){ if (n.nodeType === 3) n.nodeValue = guest ? n.nodeValue.replace(/\bcustomers\b/g, 'Guests').replace(/\bcustomer\b/g, 'Guest').replace(/\bCustomers\b/g, 'Guests') : n.nodeValue.replace(/\bGuests\b/g, 'customers').replace(/\bGuest\b/g, 'customer'); });
  });
}
form.addEventListener('change', function(e){
  var t = e.target;
  if (t.name === 'btype') swapWord();
  var o = form.querySelector('[name="' + t.name + '__other"]');
  if (o) { var on = !!form.querySelector('input[name="' + t.name + '"][value="Other"]:checked'); o.hidden = !on; }
  var q = findQ(t.name);
  if (q && q.max && t.checked) { var n = form.querySelectorAll('input[name="' + t.name + '"]:checked').length; if (n > q.max) t.checked = false; }
  var f = t.closest('.mi-f'); if (f) f.classList.remove('bad');
});
form.addEventListener('input', function(e){ var f = e.target.closest('.mi-f'); if (f) f.classList.remove('bad'); });
function findQ(id){ for (var i = 0; i < secs.length; i++) for (var j = 0; j < secs[i].q.length; j++) if (secs[i].q[j].id === id) return secs[i].q[j]; return null; }
function value(q){
  if (q.type === 'radio' || q.type === 'checks') {
    var vals = [].map.call(form.querySelectorAll('input[name="' + q.id + '"]:checked'), function(x){ return x.value; });
    var o = form.querySelector('[name="' + q.id + '__other"]');
    vals = vals.map(function(v){ return v === 'Other' && o && o.value.trim() ? 'Other: ' + o.value.trim() : v; });
    return q.type === 'radio' ? (vals[0] || '') : vals;
  }
  return (form.querySelector('[name="' + q.id + '"]').value || '').trim();
}
form.addEventListener('submit', function(e){
  e.preventDefault();
  var answers = {}, firstBad = null;
  secs.forEach(function(s){ s.q.forEach(function(q){
    var v = value(q); answers[q.id] = v;
    var empty = Array.isArray(v) ? !v.length : !v;
    var bad = (q.req && empty) || (q.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
    var f = form.querySelector('[data-q="' + q.id + '"]'); f.classList.toggle('bad', !!bad);
    if (bad && !firstBad) firstBad = f;
  }); });
  if (firstBad) { firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  var btn = form.querySelector('.mi-send'); btn.disabled = true; btn.innerHTML = 'Sending...';
  fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer: offer, answers: answers, website: form.company_site.value, elapsed: Date.now() - started }) })
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'error'); return d; }); })
    .then(function(){
      root.innerHTML = hero + '<div class="mi-wrap"><div class="mi-card mi-done"><img src="' + CROWN + '" alt=""><h2>You\'re all set, ' + esc(answers.first || 'friend') + '. Thank you.</h2><p>Our team is reviewing your answers now. Here\'s what happens next: ' + esc(NEXT[offer]) + '. A copy of your answers is on its way to your inbox.</p></div></div>';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
    .catch(function(){ btn.disabled = false; btn.innerHTML = 'Send my answers &#10140;'; var m = form.querySelector('.mi-foot p'); m.style.color = '#b42318'; m.style.fontWeight = '700'; m.textContent = 'We could not send your answers just now. Please try again in a moment, or call or text (714) 919-9469.'; });
});
})();`;
