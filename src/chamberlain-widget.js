// The chat widget, served at /chamberlain.js. Self contained: styles, markup and logic.
export const WIDGET_JS = String.raw`(function(){
if (window.__chamberlain) return; window.__chamberlain = 1;
var API = '__ENDPOINT__';
var CROWN = '__AVATAR__';
var css = '\
#mmc-btn{position:fixed;right:20px;bottom:var(--mmc-b,24px);z-index:99998;display:flex;align-items:center;padding:6px;border:0;border-radius:999px;cursor:pointer;font:800 15px Montserrat,Arial,sans-serif;color:#2a0d55;background:linear-gradient(110deg,#ffe08a,#E79A27 55%,#c06f14);box-shadow:0 14px 34px rgba(29,10,64,.35);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s,opacity .4s;opacity:0;pointer-events:none;transform:scale(.4);overflow:visible}\
#mmc-btn.in{opacity:1;pointer-events:auto;transform:none}\
#mmc-btn.in:hover{transform:translateY(-3px)}\
#mmc-btn .mmc-av{position:relative;display:block;width:48px;height:48px;border-radius:50%}\
#mmc-btn .mmc-av img{display:block;width:48px;height:48px;border-radius:50%;box-shadow:0 0 0 2px #fff}\
#mmc-btn .mmc-lbl{display:block;max-width:0;overflow:hidden;white-space:nowrap;opacity:0;transition:max-width .55s cubic-bezier(.2,.8,.2,1),opacity .35s,padding .55s;padding:0}\
#mmc-btn.open-lbl .mmc-lbl,#mmc-btn:hover .mmc-lbl,#mmc-btn:focus-visible .mmc-lbl{max-width:220px;opacity:1;padding:0 16px 0 10px}\
#mmc-btn::after{content:"";position:absolute;inset:0;border-radius:999px;pointer-events:none;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.75) 50%,transparent 70%);background-size:250% 100%;background-position:120% 0;opacity:0}\
#mmc-btn.shine::after{opacity:1;animation:mmcShine 1.1s ease-out forwards}\
@keyframes mmcShine{to{background-position:-120% 0}}\
#mmc-btn.drop .mmc-av{animation:mmcDrop 1s cubic-bezier(.3,1.35,.5,1) both}\
@keyframes mmcDrop{0%{transform:translateY(-70vh) rotate(-540deg) scale(.6);opacity:0}55%{opacity:1}75%{transform:translateY(6px) rotate(8deg) scale(1.05)}100%{transform:none}}\
#mmc-btn .mmc-ring{position:absolute;inset:-6px;border-radius:50%;border:2px solid #ffd27a;opacity:0;pointer-events:none}\
#mmc-btn.pulse .mmc-ring{animation:mmcRing 1.2s ease-out 2}\
@keyframes mmcRing{0%{opacity:.9;transform:scale(.8)}100%{opacity:0;transform:scale(1.7)}}\
#mmc-btn .mmc-burst i{position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3.5px;border-radius:50%;background:#ffd27a;box-shadow:0 0 8px #E79A27;opacity:0;pointer-events:none}\
#mmc-btn.burst .mmc-burst i{animation:mmcSpark .8s ease-out forwards}\
@keyframes mmcSpark{0%{opacity:1;transform:rotate(var(--a)) translateY(0) scale(1)}100%{opacity:0;transform:rotate(var(--a)) translateY(-46px) scale(.3)}}\
#mmc-btn i.it,#mmc-panel h3 i{font-style:italic;font-weight:900;padding:0 .06em;background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:mmcAi 3.2s linear infinite}\
#mmc-btn i.it{background-image:linear-gradient(110deg,#5D0EA6 0%,#7a3f06 34%,#b8650f 44%,#fff3cf 50%,#b8650f 56%,#7a3f06 66%,#5D0EA6 100%)}\
#mmc-panel h3 i{background-image:linear-gradient(110deg,#E79A27 0%,#E79A27 38%,#ffd27a 45%,#fffaf0 50%,#ffd27a 55%,#E79A27 62%,#E79A27 100%)}\
@keyframes mmcAi{from{background-position:120% 0}to{background-position:-120% 0}}\
#mmc-hello{position:fixed;right:20px;bottom:calc(var(--mmc-b,24px) + 72px);z-index:99998;max-width:250px;padding:12px 34px 12px 14px;border-radius:16px 16px 4px 16px;background:#fff;color:#1c1236;font:600 14px/1.45 Montserrat,Arial,sans-serif;box-shadow:0 18px 40px rgba(29,10,64,.25);opacity:0;transform:translateY(10px) scale(.9);transform-origin:bottom right;transition:opacity .35s,transform .45s cubic-bezier(.3,1.5,.5,1);pointer-events:none}\
#mmc-hello.in{opacity:1;transform:none;pointer-events:auto;cursor:pointer}\
#mmc-hello small{display:block;margin-bottom:2px;font-size:10px;font-weight:800;letter-spacing:2px;color:#5D0EA6}\
#mmc-hello button{position:absolute;top:6px;right:8px;border:0;background:none;font-size:18px;line-height:1;color:#8a83a3;cursor:pointer}\
@media (prefers-reduced-motion:reduce){#mmc-btn,#mmc-btn *,#mmc-hello{animation:none!important;transition:none!important}}\
#mmc-panel{position:fixed;right:20px;bottom:calc(var(--mmc-b,24px) + 72px);z-index:99999;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 190px));display:none;flex-direction:column;overflow:hidden;border-radius:22px;background:#fff;box-shadow:0 30px 80px rgba(29,10,64,.35);font:15px/1.5 Montserrat,Arial,sans-serif;color:#1c1236}\
#mmc-panel.open{display:flex;animation:mmcUp .35s cubic-bezier(.2,.8,.2,1)}\
@keyframes mmcUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}\
#mmc-head{display:flex;align-items:center;gap:12px;padding:16px 18px;color:#fff;background:radial-gradient(80% 120% at 90% 10%,rgba(93,14,166,.9),rgba(93,14,166,0) 70%),linear-gradient(140deg,#036684,#1d0a40)}\
#mmc-head img{width:44px;height:44px;border-radius:50%;box-shadow:0 0 0 2px rgba(255,210,122,.6)}\
#mmc-head h3{margin:0;font:800 17px Montserrat,Arial,sans-serif;color:#fff}\
#mmc-head small{display:block;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#ffd27a}\
#mmc-x{margin-left:auto;border:0;background:none;color:#fff;font-size:24px;line-height:1;cursor:pointer;opacity:.8}\
#mmc-log{flex:1;overflow-y:auto;padding:16px;background:#f6f3fa}\
.mmc-m{max-width:85%;margin:0 0 10px;padding:10px 14px;border-radius:16px;white-space:pre-wrap;word-wrap:break-word}\
.mmc-a{background:#fff;border:1px solid #ece5f6;border-bottom-left-radius:4px}.mmc-row{display:flex;gap:8px;align-items:flex-end;margin:0 0 10px}.mmc-row img{flex:none;width:28px;height:28px;border-radius:50%}.mmc-row .mmc-m{margin:0}\
.mmc-u{margin-left:auto;color:#fff;background:linear-gradient(110deg,#5D0EA6,#108193);border-bottom-right-radius:4px}\
.mmc-m a{color:#108193;font-weight:700}.mmc-u a{color:#ffd27a}\
.mmc-dots span{display:inline-block;width:7px;height:7px;margin-right:4px;border-radius:50%;background:#E79A27;animation:mmcB 1s infinite}\
.mmc-dots span:nth-child(2){animation-delay:.15s}.mmc-dots span:nth-child(3){animation-delay:.3s}\
@keyframes mmcB{50%{opacity:.25;transform:translateY(-3px)}}\
#mmc-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;background:#f6f3fa}\
#mmc-chips button{padding:6px 12px;border:1px solid #d6c9ea;border-radius:999px;background:#fff;font:700 12px Montserrat,Arial,sans-serif;color:#5D0EA6;cursor:pointer}\
#mmc-form{display:flex;gap:8px;padding:12px;border-top:1px solid #ece5f6}\
#mmc-in{flex:1;min-width:0;padding:11px 14px;border:1.5px solid #e6def3;border-radius:14px;font:15px Montserrat,Arial,sans-serif;resize:none;outline:none}\
#mmc-in:focus{border-color:#E79A27}\
#mmc-send{padding:0 16px;border:0;border-radius:14px;cursor:pointer;font:800 14px Montserrat,Arial,sans-serif;color:#fff;background:linear-gradient(110deg,#5D0EA6,#108193)}\
#mmc-note{padding:0 12px 10px;font-size:10px;color:#8a83a3;text-align:center}\
@media (max-width:480px){#mmc-panel{right:12px;left:12px;width:auto;height:calc(100vh - var(--mmc-b,24px) - 120px)}#mmc-btn{right:14px}#mmc-hello{right:14px}}';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

var NAME = 'Chamberl<i>ai</i>n';
var btn = document.createElement('button');
btn.id = 'mmc-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Ask Chamberlain');
btn.innerHTML = '<span class="mmc-av"><img src="' + CROWN + '" alt=""><span class="mmc-ring"></span><span class="mmc-burst">' + [0,45,90,135,180,225,270,315].map(function(a){ return '<i style="--a:' + a + 'deg"></i>'; }).join('') + '</span></span><span class="mmc-lbl">Ask Chamberl<i class="it">ai</i>n</span>';
var panel = document.createElement('div');
panel.id = 'mmc-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chamberlain chat');
panel.innerHTML = '<div id="mmc-head"><img src="' + CROWN + '" alt=""><div><small>YOUR AI ASSISTANT</small><h3>' + NAME + '</h3></div><button id="mmc-x" type="button" aria-label="Close">&times;</button></div>'
  + '<div id="mmc-log" aria-live="polite"></div><div id="mmc-chips"></div>'
  + '<form id="mmc-form"><textarea id="mmc-in" rows="1" maxlength="1500" placeholder="Ask me anything..."></textarea><button id="mmc-send" type="submit">Send</button></form>'
  + '<div id="mmc-note">AI assistant from Markit Mike Agency. Please do not share passwords or card numbers.</div>';
var hello = document.createElement('div'); hello.id = 'mmc-hello'; hello.setAttribute('role', 'status');
document.body.appendChild(btn); document.body.appendChild(panel); document.body.appendChild(hello);

// sit above the floating Subscribe button when the site shows one
function place(){ var sub = document.querySelector('.jetpack-subscribe-floating-button'); var b = 24; if (sub && sub.offsetWidth && getComputedStyle(sub).display !== 'none') b = Math.round(innerHeight - sub.getBoundingClientRect().top) + 14; document.documentElement.style.setProperty('--mmc-b', b + 'px'); }
place(); addEventListener('resize', place); setTimeout(place, 1500);

// the royal entrance: the avatar drops in with a spin, sparkles burst, the label unfurls with a gold shine
function seen(){ try { return sessionStorage.getItem('mmc-intro') === '1'; } catch (e) { return false; } }
function markSeen(){ try { sessionStorage.setItem('mmc-intro', '1'); } catch (e) {} }
var later = function(fn, ms){ return setTimeout(fn, ms); };
function enter(){
  if (btn.classList.contains('in')) return;
  place();
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (seen() || reduce) { btn.classList.add('in'); return; }
  markSeen();
  btn.classList.add('in', 'drop');
  later(function(){ btn.classList.add('burst', 'pulse'); }, 850);
  // phones keep the compact avatar so it never covers page buttons
  if (innerWidth > 600) later(function(){ btn.classList.add('open-lbl'); }, 1150);
  later(function(){ btn.classList.add('shine'); }, 1600);
  later(function(){
    if (panel.classList.contains('open')) return;
    hello.innerHTML = '<button type="button" aria-label="Dismiss">&times;</button><small>CHAMBERLAIN</small>' + (onIntake ? 'Need a hand with your intake? I am right here.' : 'Welcome to Markit Mike Agency, where brands get crowned! How may I be of service?');
    hello.classList.add('in');
    hello.querySelector('button').onclick = function(e){ e.stopPropagation(); hello.classList.remove('in'); };
    hello.onclick = function(){ hello.classList.remove('in'); toggle(true); };
  }, 1900);
  later(function(){ hello.classList.remove('in'); }, 9000);
  later(function(){ btn.classList.remove('open-lbl', 'drop', 'burst', 'pulse', 'shine'); }, 9500);
}
// appear after a short beat, or as soon as the visitor starts scrolling
var t0 = setTimeout(enter, 2200);
addEventListener('scroll', function once(){ removeEventListener('scroll', once); clearTimeout(t0); setTimeout(enter, 400); }, { passive: true });

// a soft two note royal chime, played only when the visitor opens the chat (never on page load)
var chimed = false;
function chime(){
  if (chimed) return; chimed = true;
  try {
    var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var ctx = new A();
    [[784, 0], [1175, .12], [1568, .24]].forEach(function(n){
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = n[0];
      var t = ctx.currentTime + n[1]; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .6);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .65);
    });
  } catch (e) {}
}

var log = panel.querySelector('#mmc-log'), input = panel.querySelector('#mmc-in'), chips = panel.querySelector('#mmc-chips');
var KEY = 'mmc-history', history = [];
try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]') || []; } catch (e) { history = []; }
function save(){ try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-20))); } catch (e) {} }
function esc(s){ return s.replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function linkify(s){ return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
function add(role, text){ var d = document.createElement('div'); d.className = 'mmc-m ' + (role === 'user' ? 'mmc-u' : 'mmc-a'); d.innerHTML = linkify(text); if (role === 'user') { log.appendChild(d); } else { var row = document.createElement('div'); row.className = 'mmc-row'; row.innerHTML = '<img src="' + CROWN + '" alt="">'; row.appendChild(d); log.appendChild(row); } log.scrollTop = log.scrollHeight; return d; }

var onIntake = /\/intake/.test(location.pathname);
var GREETING = onIntake
  ? 'Welcome! I am Chamberlain, here to help you breeze through your intake. Stuck on a question, or not sure what we mean? Just ask.'
  : 'Welcome to Markit Mike Agency, where brands get crowned! I am Chamberlain. How may I be of service? Ask me about our services, which offer fits your brand, or how to book a free Crown Fitting.';
var onBlog = /crownblog|crown-blog|\/\d{4}\/\d{2}\//.test(location.pathname) || document.body.classList.contains('single-post');
var SUGGEST = onIntake
  ? ['What does this question mean?', 'Can I skip a section?', 'How do I share my logins?']
  : onBlog ? ['Get The Crown Blog', 'Which offer fits my brand?', 'What is a Crown Fitting?']
  : ['Which offer fits my brand?', 'What is a Crown Fitting?', 'What are Quick Wins?'];
// "Get The Crown Blog" takes the reader straight to the signup form on the page instead of asking the AI
function subscribeHere(){ var f = document.querySelector('.mma-blog-sub input[type=email], .wp-block-jetpack-subscriptions input[type=email]'); if (f) { toggle(false); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function(){ f.focus(); }, 600); return true; } location.href = 'https://markitmike.com/crownblog/'; return true; }

function render(){
  log.innerHTML = ''; add('assistant', GREETING);
  history.forEach(function(m){ add(m.role, m.content); });
  chips.innerHTML = '';
  if (!history.length) SUGGEST.forEach(function(q){ var b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = function(){ if (q === 'Get The Crown Blog') subscribeHere(); else send(q); }; chips.appendChild(b); });
}
var busy = false;
function send(text){
  text = (text || '').trim(); if (!text || busy) return;
  busy = true; chips.innerHTML = ''; input.value = '';
  history.push({ role: 'user', content: text }); add('user', text); save(); if (window.mmaTrack) mmaTrack('chamberlain_message', { page_path: location.pathname, message_number: history.filter(function(m){ return m.role === 'user'; }).length });
  var wait = add('assistant', ''); wait.innerHTML = '<span class="mmc-dots"><span></span><span></span><span></span></span>';
  fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, page: location.pathname }) })
    .then(function(r){ return r.json(); })
    .then(function(d){ var t = (d && d.reply) || 'Our team is happy to help directly at info@markitmike.com.'; wait.innerHTML = linkify(t); history.push({ role: 'assistant', content: t }); save(); })
    .catch(function(){ wait.innerHTML = linkify('I could not connect just now. Please try again, or reach our team at info@markitmike.com.'); history.pop(); save(); })
    .then(function(){ busy = false; log.scrollTop = log.scrollHeight; input.focus(); });
}
function toggle(open){ panel.classList.toggle('open', open); if (open) { if (window.mmaTrack) mmaTrack('chamberlain_open', { page_path: location.pathname }); hello.classList.remove('in'); chime(); render(); setTimeout(function(){ input.focus(); }, 50); } }
btn.onclick = function(){ toggle(!panel.classList.contains('open')); };
panel.querySelector('#mmc-x').onclick = function(){ toggle(false); };
panel.querySelector('#mmc-form').onsubmit = function(e){ e.preventDefault(); send(input.value); };
input.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
window.askChamberlain = function(q){ toggle(true); if (q) send(q); };
})();`;
