// Offline test: fakes HubSpot, Stripe, Resend and ClickUp, then runs both webhooks.
import worker from '../src/index.js';
import { writeFileSync } from 'fs';
import crypto from 'crypto';
const calls = [];
const env = { OWNER_EMAIL:'michael@markitmike.com', FROM_EMAIL:'Michael <michael@markitmike.com>', CLICKUP_SPACE_ID:'1', STAGE_AGREEMENT_SENT:'4534780662', STAGE_SIGNED:'4534780663', STAGE_WON:'closedwon', SEND_AGREEMENT_EMAIL:'true', DRY_RUN:'false', STRIPE_WEBHOOK_SECRET:'whsec_test', SIGNWELL_WEBHOOK_ID:'wh_1', HUBSPOT_TOKEN:'x', STRIPE_API_KEY:'x', CLICKUP_TOKEN:'x', RESEND_API_KEY:'x' };
let stage = 'contractsent';
globalThis.fetch = async (u, o={}) => {
  const body = o.body ? JSON.parse(o.body) : null; calls.push([o.method||'GET', u]);
  const ok = (j) => new Response(JSON.stringify(j), {status:200});
  if (u.includes('contacts/search')) return ok({results:[{id:'1',properties:{firstname:'Taylor',company:''}}]});
  if (u.includes('contacts/1/associations/deals')) return ok({results:[{toObjectId:360}]});
  if (u.includes('deals/batch/read')) return ok({results:[{id:'360',properties:{dealname:'TEST Crown Royale Burgers',dealstage:stage,hs_lastmodifieddate:'2026-11-02'}}]});
  if (u.includes('associations/line_items')) return ok({results:[{toObjectId:9}]});
  if (u.includes('line_items/batch/read')) return ok({results:[{properties:{name:'Platinum Accelerator, 90 Day Growth Plan'}}]});
  if (u.includes('associations/companies')) return ok({results:[]});
  if (u.includes('associations/tasks')) return ok({results:[{toObjectId:5}]});
  if (u.includes('tasks/batch/read')) return ok({results:[{id:'5',properties:{hs_task_subject:'Agreement not signed yet? Send a friendly nudge',hs_task_status:'NOT_STARTED'}}]});
  if (u.includes('/deals/360') && o.method==='PATCH') { stage = body.properties.dealstage; return ok({}); }
  if (u.includes('resend.com')) { writeFileSync(`/tmp/claude-0/-home-claude/9be0b172-0c62-5b47-a803-152834d4697d/scratchpad/email-${body.subject.slice(0,12).replace(/\W/g,'')}.html`, body.html); return ok({id:'r1'}); }
  if (u.includes('line_items?expand')) return ok({data:[{price:{product:{name:'Platinum Accelerator, 90 Day Growth Plan'}}}]});
  if (u.includes('clickup')) return ok({id:'c'+calls.length});
  return ok({results:[]});
};
const sw = (type) => { const time = 1793600000; const hash = crypto.createHmac('sha256','wh_1').update(`${type}@${time}`).digest('hex');
  return new Request('https://x/signwell',{method:'POST',body:JSON.stringify({event:{type,time,hash},data:{object:{recipients:[{email:'michael@markitmike.com'},{email:'markitmike@gmail.com',name:'Taylor Test'}]}}})}); };
for (const t of ['document_sent','document_completed']) { const r = await worker.fetch(sw(t), env); console.log(t, r.status, await r.text(), 'stage now', stage); }
const payload = JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_1',payment_status:'paid',customer_details:{email:'markitmike@gmail.com',name:'Taylor Test'},custom_fields:[{key:'businessname',text:{value:'TEST Crown Royale Burgers'}}]}}});
const t = Math.floor(Date.now()/1000); const sig = crypto.createHmac('sha256','whsec_test').update(`${t}.${payload}`).digest('hex');
const r = await worker.fetch(new Request('https://x/stripe',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${sig}`},body:payload}), env);
console.log('stripe', r.status, await r.text(), 'stage now', stage);
const bad = await worker.fetch(new Request('https://x/stripe',{method:'POST',headers:{'stripe-signature':`t=${t},v1=deadbeef`},body:payload}), env);
console.log('bad sig ->', bad.status);
console.log('clickup calls', calls.filter(c=>c[1].includes('clickup')).length);
