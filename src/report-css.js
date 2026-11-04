// Styles for the Monthly Crown Report page (minimal design).
export const REPORT_CSS = String.raw`/* Layout: one quiet column. Summary numbers up top, then every section is a single row you can open, and rows inside open again for the detail. */
:root{
  --bg:#FFFFFF; --panel:#FAF8FC; --line:#ECE6F3; --ink:#18102B; --body:#4A4560; --mut:#8A84A0;
  --accent:#5D0EA6; --teal:#108193; --gold:#E79A27;
  --good:#118A5B; --warn:#B26A00; --bad:#C2341F; --bar:#5D0EA6; --bar2:#108193;
  --display:'Montserrat',system-ui,sans-serif; --text:'Inter',system-ui,sans-serif;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#110B1F;--panel:#18102B;--line:#2C2245;--ink:#F2EEFA;--body:#CFC8E0;--mut:#9890B0;--accent:#B98AF2;--teal:#4CC6D8;--good:#4FD39B;--warn:#F2B85A;--bad:#FF8A80;--bar:#B98AF2;--bar2:#4CC6D8;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#110B1F;--panel:#18102B;--line:#2C2245;--ink:#F2EEFA;--body:#CFC8E0;--mut:#9890B0;--accent:#B98AF2;--teal:#4CC6D8;--good:#4FD39B;--warn:#F2B85A;--bad:#FF8A80;--bar:#B98AF2;--bar2:#4CC6D8;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--body);font:15px/1.6 var(--text);-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1,h2,h3,summary{font-family:var(--display);color:var(--ink)}
.num{font-variant-numeric:tabular-nums}
button{font:inherit}
button:focus-visible,summary:focus-visible{outline:3px solid var(--gold);outline-offset:3px;border-radius:8px}

/* header */
header{padding-block:28px 0}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;font:800 13px var(--display);letter-spacing:.14em;color:var(--ink)}
.brand img{width:26px;height:auto}
.meta{font-size:13px;color:var(--mut)}
.meta b{color:var(--ink);font-weight:600}
h1{font-size:clamp(26px,4vw,34px);font-weight:800;margin:22px 0 4px;letter-spacing:-.01em;text-wrap:balance}
.lede{margin:0;font-size:16px;color:var(--body);max-width:62ch}
.tag{display:inline-block;margin-top:10px;font:700 10.5px var(--display);letter-spacing:.14em;color:var(--mut);border:1px dashed var(--line);border-radius:999px;padding:3px 10px}
.rule{height:2px;margin-top:22px;background:linear-gradient(90deg,var(--gold),transparent 70%)}

/* summary */
.sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:22px 0 6px;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.sum div{padding:16px 18px;border-right:1px solid var(--line)}
.sum div:last-child{border-right:0}
.sum small{display:block;font:700 10.5px var(--display);letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
.sum b{display:block;font:800 26px var(--display);color:var(--ink);line-height:1.2;margin-top:4px}
.sum b.hl{color:var(--accent)}
.sum span{font-size:12.5px;color:var(--mut)}
.dots{display:flex;gap:5px;margin-top:10px}
.dots i{width:10px;height:10px;border-radius:50%}

/* controls */
.ctrl{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:26px 0 8px}
.ctrl h2{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--mut)}
.links{display:flex;gap:16px}
.lnk{background:none;border:0;padding:4px 0;color:var(--accent);font:700 13px var(--display);cursor:pointer}

/* accordion */
details.sec{border-top:1px solid var(--line)}
details.sec:last-of-type{border-bottom:1px solid var(--line)}
details>summary{list-style:none;cursor:pointer}
details>summary::-webkit-details-marker{display:none}
.row{display:grid;grid-template-columns:1fr auto 18px;gap:14px;align-items:center;padding:18px 4px}
.row .t{font-size:16.5px;font-weight:700}
.row .d{display:block;font:500 13.5px var(--text);color:var(--mut);margin-top:2px}
.row .v{font:800 16px var(--display);color:var(--ink);text-align:right}
.chev{width:18px;height:18px;transition:transform .25s;color:var(--mut)}
details[open]>summary .chev{transform:rotate(90deg)}
.body{padding:0 4px 22px}
.sub{border:1px solid var(--line);border-radius:14px;margin-top:10px;background:var(--bg)}
.sub>summary .row{padding:13px 16px;grid-template-columns:1fr auto 16px}
.sub>summary .t{font-size:14.5px}
.sub .v{font-size:14.5px}
.sub .inner{padding:0 16px 16px;border-top:1px solid var(--line);background:var(--panel);border-radius:0 0 14px 14px}
.st{font:700 10.5px var(--display);letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid currentColor;margin-left:8px;white-space:nowrap}
.st.good{color:var(--good)}.st.warn{color:var(--warn)}.st.bad{color:var(--bad)}
.kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding-top:14px}
.kv div small{display:block;font:700 10px var(--display);letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
.kv div b{font:700 15px var(--display);color:var(--ink)}
.note{font-size:13.5px;margin:12px 0 0}
.note b{color:var(--ink)}
.src{font-size:12px;color:var(--mut);margin-top:10px}
.bar{height:6px;border-radius:6px;background:var(--line);overflow:hidden;margin-top:6px;width:min(220px,40vw)}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--bar),var(--bar2));border-radius:6px;transition:width .5s}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:3px;margin:4px 0 6px}
.seg button{border:0;background:none;padding:6px 12px;border-radius:999px;font:700 12.5px var(--display);color:var(--mut);cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.trend{display:block;width:100%;height:auto;margin-top:12px}
.path{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;margin-top:8px}
.path span{padding:3px 9px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--ink)}
.path i{font-style:normal;color:var(--mut)}
ul.plain{margin:10px 0 0;padding-left:18px}
ul.plain li{margin:4px 0}
.badge{font:700 9.5px var(--display);letter-spacing:.08em;color:var(--mut);border:1px solid var(--line);border-radius:999px;padding:1px 7px;margin-left:6px;vertical-align:2px}

/* footer */
.sign{display:flex;gap:14px;align-items:center;margin:30px 0 8px}
.sign img{width:52px;height:52px;border-radius:50%;object-fit:cover;object-position:50% 18%;border:2px solid var(--gold);background:#f6efe3}
.sign p{margin:0;font-size:14px}
.sign p b{color:var(--ink)}
.foot{font-size:12px;color:var(--mut);padding-block:10px 40px;border-top:1px solid var(--line);margin-top:22px}
.help{margin-top:10px;font-size:13.5px}
.help summary{display:inline;font:700 13px var(--display);color:var(--accent)}
.help p{margin:8px 0 0;padding:12px 14px;border-radius:12px;background:var(--panel)}

@media (max-width:680px){.sum{grid-template-columns:1fr 1fr}.sum div:nth-child(2){border-right:0}.sum div:nth-child(-n+2){border-bottom:1px solid var(--line)}.kv{grid-template-columns:1fr 1fr}.row{grid-template-columns:1fr auto 16px}.bar{display:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;
