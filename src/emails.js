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
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:0 14px 0 0;vertical-align:middle;"><img src="https://markitmike.com/wp-content/uploads/2026/10/mm-vp-me.png" width="56" height="56" alt="Markit Mike" style="display:block;width:56px;height:56px;border-radius:50%;border:2px solid #E79A27;background:#f6efe3;object-fit:cover;"></td><td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#1B1030;"><strong>Markit Mike</strong><br><span style="color:#5A4F6B;">Markit Mike Agency&trade;</span><br>
<a href="tel:7149199469" style="color:#108193;text-decoration:none;">(714) 919&#8209;9469</a> &middot; <a href="https://markitmike.com" style="color:#108193;text-decoration:none;">markitmike.com</a></td></tr></table></td></tr>
<tr><td style="background:#0B3354;background-image:linear-gradient(160deg,#036684 0%,#0B3354 52%,#1D0A40 100%);border-top:4px solid #E79A27;padding:18px 36px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#BFB3D6;">Markit Mike Agency&trade; &middot; Orange County, California<br>You are receiving this because you reached out to or work with Markit Mike Agency. Just reply to reach our team.</td></tr>
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
      header: 'mma-email-hdr-payment-v2.jpg',
      headerAlt: 'Thank you. One last step.',
      preheader: `Your agreement is signed. Here is your secure payment link for ${plan.name}.`,
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p(`Your agreement is signed, and our team is excited to get started with ${esc(company) || 'your team'}. The last step is your first payment, through Stripe's secure checkout.`) +
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
        ['Your intake questionnaire', 'takes about 15 minutes and gives us everything we need to hit the ground running.'],
        ['Our kickoff', 'is booked as soon as your intake comes back.'],
        ['Work begins', 'the week of kickoff, with your first 30 day priorities.'],
      ]
    : [
        ['Your intake questionnaire', 'takes about 10 minutes.'],
        ['We get to work', 'as soon as it comes back.'],
        ['Your results', 'arrive by email, usually within a few business days.'],
      ];
  return {
    subject: `Welcome to Markit Mike Agency, ${firstName || 'friend'}!`,
    html: shell({
      header: 'mma-email-hdr-welcome-v2.jpg',
      headerAlt: 'Welcome to the family.',
      preheader: 'Your payment went through. Here is exactly what happens next.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p(`Your payment for <strong>${esc(plan.name)}</strong> went through, and our team could not be more excited to start working with ${esc(company) || 'you'}. Here is exactly what happens next.`) +
        steps(next) +
        button(`https://markitmike.com/intake?offer=${encodeURIComponent(plan.key)}`, 'Start your intake') +
        card('<strong>Good to know</strong><br>Billing questions? Just reply to this email. You will always reach a real person on our team, never a help desk.') +
        p("Let's build something great together,"),
    }),
  };
}

export function agreementEmail({ firstName }) {
  return {
    subject: 'Your Markit Mike Agency agreement is ready to sign',
    html: shell({
      header: 'mma-email-hdr-agreement-v2.jpg',
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
        p('Any questions at all, reply here or call us at (714) 919&#8209;9469.') +
        p("Let's do this,"),
    }),
  };
}

export function leadReplyEmail({ firstName }) {
  return {
    subject: 'We got your message',
    html: shell({
      header: 'mma-email-hdr-received-v2.jpg',
      headerAlt: "Thanks for reaching out. We're on it.",
      preheader: 'Your message is in. Here is what happens next, plus the fastest way to get time on the calendar.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p('Thank you for reaching out to Markit Mike Agency. Your message is in, and our team reads every word. You will hear back from us within 24 to 48 hours.') +
        p('Want to skip the back and forth? Grab a time for a free Crown Fitting. It is a relaxed 30 minute conversation about your brand, your goals and what is standing in the way.') +
        button('https://markitmike.com/crownfitting', 'Book my Crown Fitting') +
        label('While you wait') +
        steps([
          ['See the work.', 'Real brands, real results: <a href="https://markitmike.com/portfolio/" style="color:#108193;font-weight:700;">View our work</a>.'],
          ['Need a fast fix?', 'Our fixed price <a href="https://markitmike.com/quick-wins/" style="color:#108193;font-weight:700;">Quick Wins</a> are delivered in days.'],
        ]) +
        p('Talk soon,'),
    }),
  };
}

export function ownerLeadEmail({ name, email, phone, company, message, page, dealCreated, optIn, src, contactId, dealId }) {
  const HS = 'https://app-na2.hubspot.com/contacts/246716405/record';
  const btn = (href, label, solid) => `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;${solid ? 'background:#5D0EA6;color:#ffffff;' : 'background:#ffffff;color:#5D0EA6;border:2px solid #5D0EA6;'}">${label}</a>`;
  const buttons = [
    contactId && btn(`${HS}/0-1/${contactId}`, 'Open contact in HubSpot', true),
    dealId && btn(`${HS}/0-3/${dealId}`, 'Open deal', false),
    btn(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Re: your note to Markit Mike Agency')}`, 'Reply', false),
    phone && btn(`tel:${phone.replace(/[^0-9+]/g, '')}`, 'Call', false),
  ].filter(Boolean).join('');
  const row = (k, v) => `<tr><td style="padding:6px 12px 6px 0;color:#5A4F6B;font-size:13px;font-weight:700;vertical-align:top;white-space:nowrap;">${k}</td><td style="padding:6px 0;font-size:15px;">${v}</td></tr>`;
  return {
    subject: `New website lead: ${name}${company ? ', ' + company : ''}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1030;max-width:600px;">
<p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#5D0EA6;">NEW WEBSITE LEAD</p>
<p style="margin:0 0 16px;font-size:20px;font-weight:800;">${esc(name)}${company ? ' &middot; ' + esc(company) : ''}</p>
<div style="margin:0 0 14px;">${buttons}</div>
<table role="presentation" cellpadding="0" cellspacing="0">${row('Email', `<a href="mailto:${esc(email)}">${esc(email)}</a>`)}${row('Phone', phone ? `<a href="tel:${esc(phone.replace(/[^0-9+]/g, ''))}">${esc(phone)}</a>` : 'Not given')}${row('Page', esc(page || 'Contact'))}${row('Email list', optIn ? '<b style="color:#108193;">Opted in</b>' : 'Not opted in')}${row('Came from', esc(src || 'unknown'))}</table>
<div style="margin:16px 0;padding:14px 16px;background:#F6F2FB;border-left:4px solid #E79A27;border-radius:8px;font-size:15px;line-height:23px;white-space:pre-wrap;">${esc(message) || '(no message)'}</div>
<p style="font-size:14px;line-height:22px;">Already done for you: ${dealCreated ? 'contact and deal created in HubSpot (Prospect)' : 'contact updated in HubSpot (they already have an open deal)'}, a branded reply with the Crown Fitting link sent, and a reply task due tomorrow.</p>
<p style="font-size:14px;line-height:22px;"><b>Your move:</b> reply personally within 24 hours. Just hit reply to this email to write to them.</p></div>`,
  };
}

export function intakeDoneEmail({ firstName, offerName, next, answersHtml }) {
  return {
    subject: 'Intake received. Thank you!',
    html: shell({
      header: 'mma-email-hdr-intakedone-v2.jpg',
      headerAlt: 'Thank you. Your kickoff prep starts now.',
      preheader: `Your ${offerName} intake is in. A copy of your answers is inside.`,
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p(`Thank you for completing your intake. Our team is reviewing your answers now, and here is what happens next: ${esc(next)}.`) +
        p('Have a logo, brand guide, photos or reports to share? Just reply to this email and attach them. We will add them to your project folder.') +
        label('A copy of your answers') +
        card(answersHtml) +
        p('Need to change something? Reply here and let us know.') +
        p('With gratitude,'),
    }),
  };
}

export function intakeReminderEmail({ firstName, plan, second }) {
  const link = `https://markitmike.com/intake?offer=${encodeURIComponent(plan.key)}`;
  return {
    subject: second ? 'Quick nudge: your intake is still waiting' : 'Your intake is waiting for you',
    html: shell({
      header: 'mma-email-hdr-intake-v2.jpg',
      headerAlt: 'Your intake is waiting for you.',
      preheader: 'A few minutes now keeps your project right on schedule.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p(second
          ? `Just checking in. Your ${esc(plan.name)} intake is the one thing standing between you and getting started. It only takes a few minutes, and rough answers are perfectly fine.`
          : `Friendly reminder: your ${esc(plan.name)} intake is ready for you. It takes just a few minutes and gives our team everything we need to get started.`) +
        button(link, 'Finish my intake') +
        p('Stuck on a question, or would you rather go through it together? Just reply to this email.') +
        p('Talk soon,'),
    }),
  };
}

export function briefEmail({ date, sec }) {
  const block = (title, items, empty) => `<p style="margin:22px 0 8px;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#5D0EA6;">${title}</p>` +
    (items && items.length ? `<ul style="margin:0;padding-left:18px;">${items.map((i) => `<li style="margin:0 0 6px;">${i}</li>`).join('')}</ul>` : `<p style="margin:0;color:#7a7392;">${empty}</p>`);
  const count = (sec.tasks?.length || 0) + (sec.clickup?.length || 0);
  return {
    subject: `Daily Crown Brief: ${count ? `${count} thing${count === 1 ? '' : 's'} need you today` : 'all clear today'}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#1B1030;max-width:600px;">
<div style="padding:22px 24px;border-radius:14px;background:linear-gradient(135deg,#1D0A40,#2B0F63 55%,#3A1180);color:#fff;">
<p style="margin:0;font-size:12px;font-weight:800;letter-spacing:3px;color:#FFC95C;">DAILY CROWN BRIEF</p>
<p style="margin:6px 0 0;font-size:22px;font-weight:900;">${date}</p></div>
${block("Today's meetings", sec.meetings, 'No meetings on the calendar.')}
${block('HubSpot tasks due', sec.tasks, 'Nothing due. Nice.')}
${block('Client work due (ClickUp)', sec.clickup, 'Nothing due today.')}
${sec.unpaid?.length ? block('Waiting on payment', sec.unpaid, '') : ''}
${block('Deals gone quiet (7+ days)', sec.quiet, 'Every open deal has moved this week.')}
${block('Open pipeline', sec.pipeline, 'No open deals.')}
<p style="margin:26px 0 0;font-size:12px;color:#7a7392;">Sent every morning by your automations. Reply to nothing; just work the list.</p></div>`,
  };
}

export function alertEmail({ where, detail }) {
  return {
    subject: `Automation alert: ${where} needs a look`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#1B1030;max-width:600px;">
<p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:#b42318;">AUTOMATION ALERT</p>
<p style="margin:0 0 14px;font-size:20px;font-weight:800;">${esc(where)} hit a problem</p>
<pre style="white-space:pre-wrap;background:#F6F2FB;border-left:4px solid #E79A27;border-radius:8px;padding:12px 14px;font-size:13px;">${esc(detail).slice(0, 3000)}</pre>
<p>Nothing is lost: webhooks from Stripe and SignWell retry on their own for days. If this keeps happening, forward this email to Claude to fix.</p>
<p style="font-size:12px;color:#7a7392;">At most one alert per area per hour.</p></div>`,
  };
}
