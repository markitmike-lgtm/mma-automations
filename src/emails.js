import { briefEmailBlock } from './research.js';
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

export function welcomeEmail({ firstName, company, plan, portal }) {
  const next = plan.engagement
    ? [
        ['Your intake questionnaire', 'takes about 15 minutes and gives us everything we need to hit the ground running.'],
        ['Our kickoff', 'times arrive the moment your intake comes back. Pick one and you are booked.'],
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
        (portal ? card(`<strong>Your client portal</strong><br>Progress, approvals, deliveries and meetings, all in one private place. <a href="${portal}" style="color:#108193;font-weight:700;">Open your portal</a> and bookmark it.`) : '') +
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
        p('Want to skip the back and forth? Grab a time for a free Crown Fitting discovery call. It is a relaxed 30 minute conversation about your brand, your goals and what is standing in the way.') +
        button('https://markitmike.com/crownfitting', 'Book a Crown Fitting Discovery Call') +
        label('While you wait') +
        steps([
          ['See the work.', 'Real brands, real results: <a href="https://markitmike.com/portfolio/" style="color:#108193;font-weight:700;">View our work</a>.'],
          ['Need a fast fix?', 'Our fixed price <a href="https://markitmike.com/quick-wins/" style="color:#108193;font-weight:700;">Quick Wins</a> are delivered in days.'],
        ]) +
        p('Talk soon,'),
    }),
  };
}

export function ownerLeadEmail({ name, email, phone, company, message, page, dealCreated, optIn, src, contactId, dealId, website, brief }) {
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
<table role="presentation" cellpadding="0" cellspacing="0">${row('Email', `<a href="mailto:${esc(email)}">${esc(email)}</a>`)}${row('Phone', phone ? `<a href="tel:${esc(phone.replace(/[^0-9+]/g, ''))}">${esc(phone)}</a>` : 'Not given')}${website ? row('Website', `<a href="https://${esc(website)}">${esc(website)}</a>`) : ''}${row('Page', esc(page || 'Contact'))}${row('Email list', optIn ? '<b style="color:#108193;">Opted in</b>' : 'Not opted in')}${row('Came from', esc(src || 'unknown'))}</table>
<div style="margin:16px 0;padding:14px 16px;background:#F6F2FB;border-left:4px solid #E79A27;border-radius:8px;font-size:15px;line-height:23px;white-space:pre-wrap;">${esc(message) || '(no message)'}</div>
${briefEmailBlock(brief)}
<p style="font-size:14px;line-height:22px;">Already done for you: ${dealCreated ? 'contact and deal created in HubSpot (Prospect)' : 'contact updated in HubSpot (they already have an open deal)'}, a branded reply with the Crown Fitting link sent, and a reply task due tomorrow.</p>
<p style="font-size:14px;line-height:22px;"><b>Your move:</b> reply personally within 24 hours. Just hit reply to this email to write to them.</p></div>`,
  };
}

export function intakeDoneEmail({ firstName, offerName, next, answersHtml, kickoff }) {
  return {
    subject: 'Intake received. Thank you!',
    html: shell({
      header: 'mma-email-hdr-intakedone-v2.jpg',
      headerAlt: 'Thank you. Your kickoff prep starts now.',
      preheader: `Your ${offerName} intake is in. A copy of your answers is inside.`,
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p(`Thank you for completing your intake. Our team is reviewing your answers now, and here is what happens next: ${esc(next)}.`) +
        timesBlock(kickoff, { title: 'Your kickoff workshop', intro: 'Next up is your 60 minute kickoff workshop on Google Meet, where we confirm goals and dates, choose your first Builds and set the roadmap.' }) +
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

// sent the moment Markit Mike submits the Crown Fitting Notes form
export function fittingThanksEmail({ firstName }) {
  return {
    subject: 'Thank you for your time today',
    html: shell({
      header: 'mma-email-hdr-fitthanks-v2.jpg',
      headerAlt: 'Thank you. Your Snapshot is on its way.',
      preheader: 'Thanks for the Crown Fitting. Here is what happens next.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p('Thank you for your time today. It was great getting to know your brand, your goals and what is standing in the way.') +
        label('What happens next') +
        steps([
          ['Your Brand Experience Snapshot.', 'Our team is putting together a branded one page summary of what we discussed, with your biggest opportunities and a few quick wins. Watch for it within one business day.'],
          ['A clear recommendation.', 'Along with it, you will get the plan we recommend and exactly what is included, so you can decide with confidence.'],
          ['Questions in the meantime?', 'Just reply to this email. It comes straight to our team.'],
        ]) +
        p('With gratitude,'),
    }),
  };
}

// sent when a Crown Fitting is marked No show
export function noShowEmail({ firstName }) {
  return {
    subject: "We missed you today. Let's find a new time",
    html: shell({
      header: 'mma-email-hdr-noshow-v2.jpg',
      headerAlt: "We missed you. Let's find a new time.",
      preheader: 'Life happens. Grab a new time for your free Crown Fitting in a few clicks.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p("We were sorry to miss you for your Crown Fitting today. Life happens, and there's no problem at all.") +
        p('If you would still like to talk through your brand, your goals and where you can grow, grab a new time that works better for you. It is free and takes about 30 minutes.') +
        button('https://markitmike.com/crownfitting', 'Pick a new time') +
        p('If now is not the right time, just reply and let us know. We are happy to reconnect whenever it suits you.') +
        p('Talk soon,'),
    }),
  };
}

// sent 3 and 7 days after a website inquiry when no Crown Fitting has been booked
export function leadNudgeEmail({ firstName, second }) {
  return {
    subject: second ? 'Still happy to help' : 'Quick follow up from Markit Mike Agency',
    html: shell({
      header: 'mma-email-hdr-nudge-v2.jpg',
      headerAlt: 'Still here to help. Your Crown Fitting is waiting.',
      preheader: second ? 'One last note from our team.' : 'A free 30 minute Crown Fitting is the fastest way to get answers.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        (second
          ? p("One last note so you don't miss it. If growing your brand is still on your list, a free Crown Fitting is the easiest place to start. If the timing isn't right, no worries at all, just reply and let us know.")
          : p('Thanks again for reaching out. The fastest way to get real answers is a free Crown Fitting: a relaxed 30 minute conversation about your brand, your goals and what is standing in the way. You will leave with a few ideas you can use right away, whether or not we work together.')) +
        button('https://markitmike.com/crownfitting', 'Book a Crown Fitting Discovery Call') +
        p('Prefer email? Just reply to this one and our team will pick it up.') +
        p('Talk soon,'),
    }),
  };
}

// the reviewed Brand Experience Snapshot, sent by Markit Mike from the review page
export function approvalEmail({ firstName, item, note, link, portal }) {
  return {
    subject: `Ready for your review: ${item}`,
    html: shell({
      header: 'mma-email-hdr-review-v2.jpg', headerAlt: 'Ready for your review.', preheader: `${item} is ready. Approve it or send changes in one click.`,
      body: p(`Hi ${esc(firstName) || 'there'},`) +
        p(`Good news: <strong>${esc(item)}</strong> is ready for your review.`) +
        (note ? card(esc(note).replace(/\n/g, '<br>')) : '') +
        p('Take a look, then approve it or tell us what to change. Either way it takes one click, and our team picks it right up.') +
        button(link, 'Review and approve') +
        (portal ? p(`<a href="${portal}" style="color:#108193;font-weight:700;">See everything in your client portal</a>`) : '') +
        p('With gratitude,'),
    }),
  };
}

export function deliveryEmail({ firstName, item, note, link, portal }) {
  return {
    subject: `Delivered: ${item}`,
    html: shell({
      header: 'mma-email-hdr-delivered-v2.jpg', headerAlt: 'Fresh from our team.', preheader: `${item} is here.`,
      body: p(`Hi ${esc(firstName) || 'there'},`) +
        p(`<strong>${esc(item)}</strong> is here.`) +
        (note ? card(esc(note).replace(/\n/g, '<br>')) : '') +
        button(link, 'Open it') +
        p('Questions about anything inside? Just reply to this email and our team will walk you through it.') +
        (portal ? p(`<a href="${portal}" style="color:#108193;font-weight:700;">Your client portal</a> keeps every delivery in one place.`) : '') +
        p('With gratitude,'),
    }),
  };
}

// three held times as tappable cards, or the confirmed time
export function timesBlock(booking, { title, intro, mins }) {
  if (!booking) return '';
  if (booking.booked) return label(title) + p(`We are all set for <strong>${esc(booking.booked.text)}</strong> on Google Meet. Your calendar invite came from michael@markitmike.com.`);
  const slots = booking.slots || [];
  if (!slots.length) return label(title) + p(`${intro} Reply to this email with a few times that work and we will send the invite.`);
  const rows = slots.map((s) => `<tr><td style="padding:0 0 10px 0;"><a href="${s.url}" style="display:block;border:2px solid #E79A27;border-radius:12px;padding:12px 16px;text-decoration:none;color:#1B1030;font-family:Montserrat,Arial,Helvetica,sans-serif;"><span style="font-size:16px;font-weight:800;">${esc(s.day)}</span><br><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6B6280;">${esc(s.time)} &middot; ${esc(s.et)}</span></a></td></tr>`).join('');
  return label(title) + p(`${intro} We are holding these times for you. Pick the one that works and your invite goes out right away:`) +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;">${rows}</table>` +
    p(`<a href="${booking.url}" style="color:#108193;font-weight:700;">None of these work? See more open times</a>`);
}

export function snapshotEmail({ firstName, company, link, booking }) {
  const slots = (booking && booking.slots) || [];
  const slotRows = slots.map((s) => `<tr><td style="padding:0 0 10px 0;"><a href="${s.url}" style="display:block;border:2px solid #E79A27;border-radius:12px;padding:12px 16px;text-decoration:none;color:#1B1030;font-family:Montserrat,Arial,Helvetica,sans-serif;"><span style="font-size:16px;font-weight:800;">${esc(s.day)}</span><br><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6B6280;">${esc(s.time)} &middot; ${esc(s.et)}</span></a></td></tr>`).join('');
  const times = booking && booking.booked
    ? label('Your plan walkthrough') + p(`We are all set for <strong>${esc(booking.booked.text)}</strong> on Google Meet. Your calendar invite came from michael@markitmike.com. Feel free to invite anyone who should weigh in.`)
    : slots.length
    ? label('Your plan walkthrough') +
      p('The next step is a 45 minute plan walkthrough on Google Meet, where we go through exactly what to do first and answer every question. We are holding these times for you. Pick the one that works and your invite goes out right away:') +
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;">${slotRows}</table>` +
      p(`<a href="${booking.url}" style="color:#108193;font-weight:700;">None of these work? See more open times</a>`) +
      p('Feel free to invite anyone who should weigh in.')
    : p('The next step is a short plan walkthrough, where we go through exactly what to do first and answer every question. Reply to this email with a few times that work and we will send the invite.');
  return {
    subject: `Your Brand Experience Snapshot${company ? ' for ' + company : ''}`,
    html: shell({
      header: 'mma-email-hdr-snapshot-v2.jpg',
      headerAlt: 'Thank you. Your Brand Experience Snapshot is here.',
      preheader: slots.length ? 'What we heard, the first opportunity we spotted, and three walkthrough times saved for you.' : 'What we heard, the first opportunity we spotted, and where we go from here.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p('Thank you again for your time. As promised, here is a preview of your Brand Experience Snapshot: what we heard, and the first opportunity we spotted, with a quick win you can use right away.') +
        button(link, 'View my Snapshot preview') +
        p('In your plan walkthrough, we will reveal the full Snapshot: your Crown scorecard, everything else we found, and the 90 day plan we recommend.') +
        times +
        p('With gratitude,'),
    }),
  };
}

// Crown Partners welcome, sent by partnerJoin. Points the new partner to the Sales Kit first,
// where the share link lives with its context, instead of handing over the bare share link.
export function partnerWelcomeEmail({ firstName, kit }) {
  return {
    subject: `Welcome to Crown Partners, ${firstName || 'partner'}`,
    html: shell({
      header: 'mma-email-hdr-partner-v2.jpg',
      headerAlt: 'Crown Partners by Markit Mike Agency. Welcome to the court.',
      preheader: 'Your private Sales Kit is ready. Start there.',
      body:
        p(`Hi ${esc(firstName) || 'there'},`) +
        p('Thank you for joining Crown Partners by Markit Mike Agency. We are glad to have you on the team.') +
        p('Your private Sales Kit is your home base. It walks you through how the program works, then gives you everything you need to share: your personal link and QR code with how and when to use them, a printable flyer, ready to send texts and emails, and your earnings as they grow.') +
        button(kit, 'Open my Sales Kit') +
        card('<strong>Start in your Sales Kit</strong><br>Your personal share link is inside, along with the context for using it. Bookmark the kit. It is private to you.') +
        label('How you earn') +
        steps([
          ['Refer it.', 'Earn 20% on Quick Wins and Gold Starter, and 10% of each monthly payment on our plans, paid within 15 days of each client payment clearing.'],
          ['Resell it.', 'Want to sell a Google Profile Glow Up, Brand Checkup or Mail Ready Page under your own name? Reply to this email and we will set you up with partner pricing.'],
          ['Introduce by email.', 'Prefer a warm intro? Email the client and copy michael@markitmike.com. That counts too.'],
        ]) +
        p('Our team will reach out within one business day to welcome you and answer any questions.') +
        p('Talk soon,'),
    }),
  };
}
