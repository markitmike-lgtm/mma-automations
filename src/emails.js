// Branded, table based HTML emails. Inline styles only, 600px, works in Gmail,
// Apple Mail and Outlook. Headers are hosted on markitmike.com.
const IMG = 'https://markitmike.com/wp-content/uploads/2026/11/';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function shell({ header, headerAlt, preheader, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(headerAlt)}</title></head>
<body style="margin:0;padding:0;background:#F4F1F8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1F8;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(42,13,85,.10);">
<tr><td><img src="${IMG}${header}" width="600" alt="${esc(headerAlt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
<tr><td style="padding:32px 36px 8px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#1B1030;">${body}</td></tr>
<tr><td style="padding:8px 36px 32px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#1B1030;">
<strong>Michael Hernandez</strong><br><span style="color:#5A4F6B;">Founder &amp; CEO, Markit Mike Agency&trade;</span><br>
<a href="tel:7149199469" style="color:#108193;text-decoration:none;">(714) 919&#8209;9469</a> &middot; <a href="https://markitmike.com" style="color:#108193;text-decoration:none;">markitmike.com</a></td></tr>
<tr><td style="background:#1D0A40;padding:18px 36px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#BFB3D6;">Markit Mike Agency&trade; &middot; Orange County, California<br>You are receiving this because you are working with Markit Mike Agency. Just reply to reach Michael directly.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (t) => `<p style="margin:0 0 16px 0;">${t}</p>`;
const label = (t) => `<p style="margin:8px 0 6px 0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#5D0EA6;">${t}</p>`;
const button = (href, text) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;"><tr><td style="border-radius:999px;background:#E79A27;background-image:linear-gradient(135deg,#FFE08A,#E79A27 55%,#C06F14);">
<a href="${href}" style="display:inline-block;padding:16px 34px;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:17px;font-weight:900;color:#2A0E52;text-decoration:none;border-radius:999px;">${text} &#10140;</a></td></tr></table>`;
const card = (inner) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px 0;background:#F6F2FB;border-radius:12px;border-left:4px solid #E79A27;"><tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#1B1030;">${inner}</td></tr></table>`;
const steps = (items) => items.map((s, i) => `<p style="margin:0 0 12px 0;"><strong style="color:#E79A27;">${i + 1}.</strong> <strong>${s[0]}</strong> ${s[1]}</p>`).join('');

export function paymentEmail({ firstName, company, plan }) {
  return {
    subject: 'One last step: your secure payment link',
    html: shell({
      header: 'mma-email-hdr-payment.jpg',
      headerAlt: 'Thank you. One last step.',
      preheader: `Your agreement is signed. Here is your secure payment link for ${plan.name}.`,
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p(`Your agreement is signed, and I'm excited to get started with ${esc(company) || 'your team'}. The last step is your first payment, through Stripe's secure checkout.`) +
        card(`<strong>${esc(plan.name)}</strong><br>${esc(plan.terms)}`) +
        button(plan.payLink, 'Secure my spot') +
        label('What happens next') +
        steps([
          ['Your receipt', 'arrives from Stripe right away.'],
          ['Your welcome email', 'follows, with your intake and client portal details.'],
          ['Kickoff,', 'where we build your roadmap together.'],
        ]) +
        p('Prefer to pay another way, or have a billing question? Just reply here.') +
        p("Let's crown your brand,"),
    }),
  };
}

export function welcomeEmail({ firstName, company, plan }) {
  const next = plan.engagement
    ? [
        ['Your intake questionnaire', 'takes about 15 minutes and gives me everything I need to hit the ground running.'],
        ['Our kickoff', 'is booked as soon as your intake comes back.'],
        ['Work begins', 'the week of kickoff, with your first 30 day priorities.'],
      ]
    : [
        ['Your intake questionnaire', 'takes about 10 minutes.'],
        ['I get to work', 'as soon as it comes back.'],
        ['Your results', 'arrive by email, usually within a few business days.'],
      ];
  return {
    subject: `Welcome to Markit Mike Agency, ${firstName || 'friend'}!`,
    html: shell({
      header: 'mma-email-hdr-welcome.jpg',
      headerAlt: 'Welcome to the family.',
      preheader: 'Your payment went through. Here is exactly what happens next.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p(`Your payment for <strong>${esc(plan.name)}</strong> went through, and I could not be more excited to start working with ${esc(company) || 'you'}. Here is exactly what happens next.`) +
        steps(next) +
        button('https://markitmike.com/intake', 'Start your intake') +
        card('<strong>Good to know</strong><br>Billing questions? Just reply to this email. You will always reach me directly, never a help desk.') +
        p("Let's build something great together,"),
    }),
  };
}

export function agreementEmail({ firstName }) {
  return {
    subject: 'Your Markit Mike Agency agreement is ready to sign',
    html: shell({
      header: 'mma-email-hdr-agreement.jpg',
      headerAlt: "Let's make it official.",
      preheader: 'Your agreement is on its way from SignWell. About five minutes to review and sign.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p("Your agreement is on its way from SignWell in a separate email. It's one page, plus Exhibit A: the line by line list of everything included in your plan. It takes about five minutes to review and sign.") +
        steps([
          ['Sign your agreement.', 'Look for the email from SignWell.'],
          ['Secure your payment.', 'Your payment link arrives right after you sign.'],
          ['Get your welcome packet.', 'Everything you need to kick things off.'],
        ]) +
        p('Any questions at all, reply here or call me directly.') +
        p("Let's do this,"),
    }),
  };
}
