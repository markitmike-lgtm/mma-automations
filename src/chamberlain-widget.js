// The chat widget, served at /chamberlain.js. Self contained: styles, markup and logic.
export const WIDGET_JS = String.raw`(function(){
if (window.__chamberlain) return; window.__chamberlain = 1;
var API = '__ENDPOINT__';
var CROWN = 'https://markitmike.com/wp-content/uploads/2026/06/Crown-Icon-14Degree-Tilt.png';
var css = '\
#mmc-btn{position:fixed;right:20px;bottom:20px;z-index:99998;display:flex;align-items:center;gap:10px;padding:12px 20px 12px 12px;border:0;border-radius:999px;cursor:pointer;font:800 15px Montserrat,Arial,sans-serif;color:#2a0d55;background:linear-gradient(110deg,#ffe08a,#E79A27 55%,#c06f14);box-shadow:0 14px 34px rgba(29,10,64,.35);transition:transform .3s cubic-bezier(.2,.8,.2,1)}\
#mmc-btn:hover{transform:translateY(-3px)}\
#mmc-btn img{width:30px;height:30px;padding:4px;border-radius:50%;background:#2a0d55;box-sizing:border-box}\
#mmc-btn i,#mmc-panel h3 i{font-style:italic;font-weight:900}\
#mmc-panel{position:fixed;right:20px;bottom:88px;z-index:99999;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));display:none;flex-direction:column;overflow:hidden;border-radius:22px;background:#fff;box-shadow:0 30px 80px rgba(29,10,64,.35);font:15px/1.5 Montserrat,Arial,sans-serif;color:#1c1236}\
#mmc-panel.open{display:flex;animation:mmcUp .35s cubic-bezier(.2,.8,.2,1)}\
@keyframes mmcUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}\
#mmc-head{display:flex;align-items:center;gap:12px;padding:16px 18px;color:#fff;background:radial-gradient(80% 120% at 90% 10%,rgba(93,14,166,.9),rgba(93,14,166,0) 70%),linear-gradient(140deg,#036684,#1d0a40)}\
#mmc-head img{width:38px;height:38px;padding:6px;border-radius:50%;background:rgba(255,255,255,.12);box-sizing:border-box}\
#mmc-head h3{margin:0;font:800 17px Montserrat,Arial,sans-serif;color:#fff}\
#mmc-head small{display:block;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#ffd27a}\
#mmc-x{margin-left:auto;border:0;background:none;color:#fff;font-size:24px;line-height:1;cursor:pointer;opacity:.8}\
#mmc-log{flex:1;overflow-y:auto;padding:16px;background:#f6f3fa}\
.mmc-m{max-width:85%;margin:0 0 10px;padding:10px 14px;border-radius:16px;white-space:pre-wrap;word-wrap:break-word}\
.mmc-a{background:#fff;border:1px solid #ece5f6;border-bottom-left-radius:4px}\
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
@media (max-width:480px){#mmc-panel{right:16px;bottom:80px}#mmc-btn{right:16px;bottom:16px}}';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

var NAME = 'Chamberl<i>ai</i>n';
var btn = document.createElement('button');
btn.id = 'mmc-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Ask Chamberlain');
btn.innerHTML = '<img src="' + CROWN + '" alt=""><span>Ask ' + NAME + '</span>';
var panel = document.createElement('div');
panel.id = 'mmc-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chamberlain chat');
panel.innerHTML = '<div id="mmc-head"><img src="' + CROWN + '" alt=""><div><small>AT YOUR SERVICE</small><h3>' + NAME + '</h3></div><button id="mmc-x" type="button" aria-label="Close">&times;</button></div>'
  + '<div id="mmc-log" aria-live="polite"></div><div id="mmc-chips"></div>'
  + '<form id="mmc-form"><textarea id="mmc-in" rows="1" maxlength="1500" placeholder="Ask me anything..."></textarea><button id="mmc-send" type="submit">Send</button></form>'
  + '<div id="mmc-note">AI assistant from Markit Mike Agency. Please do not share passwords or card numbers.</div>';
document.body.appendChild(btn); document.body.appendChild(panel);

var log = panel.querySelector('#mmc-log'), input = panel.querySelector('#mmc-in'), chips = panel.querySelector('#mmc-chips');
var KEY = 'mmc-history', history = [];
try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]') || []; } catch (e) { history = []; }
function save(){ try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-20))); } catch (e) {} }
function esc(s){ return s.replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function linkify(s){ return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
function add(role, text){ var d = document.createElement('div'); d.className = 'mmc-m ' + (role === 'user' ? 'mmc-u' : 'mmc-a'); d.innerHTML = linkify(text); log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }

var onIntake = /\/intake/.test(location.pathname);
var GREETING = onIntake
  ? 'Welcome! I am Chamberlain, here to help you breeze through your intake. Stuck on a question, or not sure what we mean? Just ask.'
  : 'Greetings! I am Chamberlain, the Markit Mike Agency assistant. Ask me about our services, which offer fits your brand, or how to book a free Crown Fitting.';
var SUGGEST = onIntake
  ? ['What does this question mean?', 'Can I skip a section?', 'How do I share my logins?']
  : ['Which offer fits my brand?', 'What is a Crown Fitting?', 'What are Quick Wins?'];

function render(){
  log.innerHTML = ''; add('assistant', GREETING);
  history.forEach(function(m){ add(m.role, m.content); });
  chips.innerHTML = '';
  if (!history.length) SUGGEST.forEach(function(q){ var b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = function(){ send(q); }; chips.appendChild(b); });
}
var busy = false;
function send(text){
  text = (text || '').trim(); if (!text || busy) return;
  busy = true; chips.innerHTML = ''; input.value = '';
  history.push({ role: 'user', content: text }); add('user', text); save();
  var wait = add('assistant', ''); wait.innerHTML = '<span class="mmc-dots"><span></span><span></span><span></span></span>';
  fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, page: location.pathname }) })
    .then(function(r){ return r.json(); })
    .then(function(d){ var t = (d && d.reply) || 'Our team is happy to help directly at info@markitmike.com.'; wait.innerHTML = linkify(t); history.push({ role: 'assistant', content: t }); save(); })
    .catch(function(){ wait.innerHTML = linkify('I could not connect just now. Please try again, or reach our team at info@markitmike.com.'); history.pop(); save(); })
    .then(function(){ busy = false; log.scrollTop = log.scrollHeight; input.focus(); });
}
function toggle(open){ panel.classList.toggle('open', open); if (open) { render(); setTimeout(function(){ input.focus(); }, 50); } }
btn.onclick = function(){ toggle(!panel.classList.contains('open')); };
panel.querySelector('#mmc-x').onclick = function(){ toggle(false); };
panel.querySelector('#mmc-form').onsubmit = function(e){ e.preventDefault(); send(input.value); };
input.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
window.askChamberlain = function(q){ toggle(true); if (q) send(q); };
})();`;
