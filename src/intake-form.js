// The client intake questionnaire. One schema drives both the page (served as /intake.js)
// and the answers the worker writes to HubSpot and ClickUp.
// show: which offers see a section or question. Offers: checkup, glowup, gold, platinum, crownjewel.
const ALL = ['checkup', 'glowup', 'gold', 'platinum', 'crownjewel'];
const PLANS = ['platinum', 'crownjewel'];

export const OFFER_NAMES = {
  checkup: 'Brand Checkup', glowup: 'Google Profile Glow Up', gold: 'Gold Starter',
  platinum: 'Platinum Accelerator', crownjewel: 'Crown Jewel',
};

export const ACCESS_EMAIL = 'team@markitmike.com';

export const SECTIONS = [
  { id: 's1', title: 'About you and your business', show: ALL, q: [
    { id: 'first', label: 'First name', type: 'text', req: true, half: true },
    { id: 'last', label: 'Last name', type: 'text', req: true, half: true },
    { id: 'title', label: 'Your title', type: 'text', req: true, half: true },
    { id: 'mobile', label: 'Mobile number', type: 'tel', req: true, half: true, help: 'For quick questions by text' },
    { id: 'email', label: 'Best email', type: 'email', req: true },
    { id: 'business', label: 'Business name', type: 'text', req: true, help: 'As customers know it', half: true },
    { id: 'legal', label: 'Legal business name, if different', type: 'text', help: 'It goes on invoices and agreements', half: true },
    { id: 'btype', label: 'Business type', type: 'radio', req: true, other: true, opts: ['Restaurant or food and beverage', 'Retail', 'Health, beauty or fitness', 'Home or professional services', 'Entertainment or hospitality', 'Franchise brand (franchisor)'] },
    { id: 'locations', label: 'How many locations do you have today?', type: 'radio', req: true, opts: ['1', '2 to 5', '6 to 20', '21 or more'] },
    { id: 'openings', label: 'Any openings planned in the next 12 months?', type: 'text', help: 'If yes, how many and roughly when. Leave blank if none.' },
    { id: 'area', label: 'City or area you serve', type: 'text', req: true, ph: 'e.g. Orange County, CA' },
    { id: 'what', label: 'In one or two sentences, what does your business do?', type: 'textarea', req: true },
    { id: 'approvers', label: 'Who else should we know?', type: 'textarea', help: 'Anyone who approves marketing, plus their email' },
  ]},
  { id: 's2', title: 'Where we will look', note: 'Links only. Never share passwords here.', show: ALL, q: [
    { id: 'website', label: 'Website address', type: 'text', req: true, ph: "https://... or \"I don't have one\"" },
    { id: 'gbp', label: 'Google Business Profile link for each location', type: 'textarea', help: 'Open your listing on Google Maps, tap Share, and paste the link' },
    { id: 'yelp', label: 'Yelp link, if you have one', type: 'text' },
    { id: 'social', label: 'Social media links', type: 'textarea', help: 'Instagram, Facebook, TikTok, LinkedIn or other. Paste the ones you use.' },
    { id: 'channel', label: 'Which channel matters most to you right now?', type: 'radio', opts: ['Website', 'Google', 'Instagram', 'Facebook', 'TikTok', 'Email', 'Other'] },
    { id: 'apps', label: 'Online ordering, booking or delivery apps you use', type: 'text', ph: 'e.g. DoorDash, OpenTable, Square, Vagaro' },
    { id: 'competitors', label: 'Up to 3 competitors you watch', type: 'textarea', req: true, help: '"Not sure" is fine, and we will find them.' },
  ]},
  { id: 's3', title: 'Goals and what success looks like', show: ALL, q: [
    { id: 'why', label: 'What made you reach out now?', type: 'textarea', req: true },
    { id: 'goals', label: 'Pick your top goals for the next 90 days', type: 'checks', max: 3, req: true, other: true, help: 'Up to 3', opts: ['More new customers', 'More repeat visits', 'Better reviews and rating', 'Show up higher on Google', 'Stronger social presence', 'A successful opening or launch', 'A clearer brand', 'Fill slow days or hours', 'More catering, events or large orders'] },
    { id: 'perfect', label: 'If the next 90 days went perfectly, what would be different?', type: 'textarea', req: true },
    { id: 'number', label: 'What number would tell you it worked?', type: 'text', help: 'Sales, visits, bookings, reviews, followers. "Not sure" is fine.' },
    { id: 'worry', label: 'What keeps you up at night about marketing?', type: 'textarea' },
    { id: 'tried', label: "Anything you've tried that didn't work?", type: 'textarea', help: 'What it was, and why you think it fell short' },
  ]},
  { id: 's4', title: 'Your customers and what makes you different', show: ['gold', ...PLANS], q: [
    { id: 'best', label: 'Describe your best customer', type: 'textarea', req: true, help: 'Who they are, where they come from, why they choose you' },
    { id: 'more', label: 'Is there a customer you want more of?', type: 'text', ph: 'e.g. families, office lunch crowd, students, a new neighborhood' },
    { id: 'praise', label: 'What do customers praise most?', type: 'textarea' },
    { id: 'complain', label: 'What do they complain about most?', type: 'textarea', help: 'Honest answers make the plan better.' },
    { id: 'different', label: 'What makes you different from the competition?', type: 'textarea', req: true },
    { id: 'times', label: 'Your busiest and slowest times', type: 'text', help: 'Days, hours or seasons' },
    { id: 'spend', label: 'Average spend per visit or order, roughly', type: 'text', half: true },
    { id: 'volume', label: 'Customers or transactions in a typical week', type: 'text', half: true, help: 'Ballpark is fine' },
    { id: 'brandkit', label: 'Do you have brand guidelines, a logo file or brand colors?', type: 'radio', opts: ["Yes, I'll send them", 'Some pieces', 'No'], help: 'Reply to your confirmation email with any files and we will add them to your folder.' },
  ]},
  { id: 's5', title: 'Marketing today', show: ['gold', ...PLANS], q: [
    { id: 'who', label: 'Who handles marketing today?', type: 'radio', req: true, opts: ['Me', 'Someone on my team', 'An agency or freelancer', 'Nobody right now'] },
    { id: 'agency', label: 'If an agency or freelancer, what do they handle, and are they staying?', type: 'textarea' },
    { id: 'doing', label: 'What are you doing now?', type: 'checks', help: 'Check all that apply', opts: ['Social posts', 'Paid social ads', 'Google ads', 'Email or text marketing', 'Loyalty program', 'Direct mail', 'Local partnerships or events', 'Influencers', 'PR', 'Nothing yet'] },
    { id: 'working', label: "What's working best right now?", type: 'textarea' },
    { id: 'budget', label: 'Monthly marketing budget, not counting our fee', type: 'radio', req: true, opts: ['Under $500', '$500 to $2,000', '$2,000 to $5,000', '$5,000 to $15,000', 'Over $15,000', 'Not set yet'] },
    { id: 'tools', label: 'Tools you use', type: 'checks', other: true, help: 'Check all that apply', opts: ['Square', 'Toast', 'Clover', 'Shopify', 'Mailchimp', 'Klaviyo', 'HubSpot', 'Google Analytics', 'Canva'] },
    { id: 'list', label: 'Do you have an email or text list?', type: 'text', help: 'If yes, about how many people. Leave blank if not.' },
  ]},
  { id: 's6', title: 'Access', show: ['glowup', ...PLANS], note: `We never ask for passwords. Instead, send an invite to ${ACCESS_EMAIL} for each item below, then check it off. Anything you'd rather do together, we handle live on the kickoff call.`, q: [
    { id: 'access', label: 'Invites I have sent', type: 'checks', access: true, opts: [
      { v: 'Google Business Profile', how: 'Add us as a Manager on each location', show: ['glowup', ...PLANS] },
      { v: 'Google Analytics', how: 'Add us as a Viewer', show: PLANS },
      { v: 'Google Search Console', how: 'Add us as a Full user', show: PLANS },
      { v: 'Facebook and Instagram', how: 'Meta Business Suite: add us as a Partner or with Content access', show: PLANS },
      { v: 'Website', how: 'Add a user login (WordPress, Squarespace, Wix and others allow this)', show: PLANS },
      { v: 'Yelp for Business', how: 'Add us as a User', show: PLANS },
      { v: 'Email or text platform', how: 'Add a user, or share it on the kickoff call', show: PLANS },
      { v: 'Point of sale or loyalty reports', how: 'An export or a read only login, if comfortable', show: ['crownjewel'] },
    ]},
    { id: 'walkthrough', label: "Anything you'd rather walk through together on the kickoff call?", type: 'textarea', show: PLANS },
  ]},
  { id: 's7', title: 'Working together', show: PLANS, q: [
    { id: 'point', label: 'Who is your one point person?', type: 'text', req: true, help: 'Name, email and mobile' },
    { id: 'approve', label: 'Who approves proofs and spending?', type: 'text', req: true, help: 'If more than one person, who has the final say' },
    { id: 'updates', label: 'How do you like updates?', type: 'radio', req: true, opts: ['Email', 'Text', 'Quick call', 'Client portal only'] },
    { id: 'calltimes', label: 'Best days and times for our strategy calls', type: 'text', req: true, ph: 'e.g. Tuesday or Thursday mornings' },
    { id: 'never', label: 'Times we should never schedule', type: 'text', ph: 'e.g. lunch rush, Friday nights' },
    { id: 'upcoming', label: 'Anything coming up we should plan around?', type: 'textarea', help: 'Holidays, launches, events, renovations, busy seasons' },
    { id: 'feature', label: 'May we feature your results publicly once we have them?', type: 'radio', opts: ['Yes', 'Ask me first', 'No (it never affects your service)'] },
    { id: 'else', label: 'Anything else our team should know?', type: 'textarea' },
  ]},
  { id: 's8', title: 'A few questions for your plan', show: ALL, q: [
    { id: 'first_look', label: 'What should Markit Mike look at first?', type: 'radio', req: true, opts: ['Website', 'Google', 'Reviews', 'Social', 'Surprise me'], show: ['checkup'] },
    { id: 'which_loc', label: 'Which location should we review, if you have more than one?', type: 'text', show: ['checkup'] },
    { id: 'deliver_email', label: 'Best email for your video and Snapshot', type: 'email', req: true, show: ['checkup'] },
    { id: 'glow_locs', label: 'Which locations are included?', type: 'textarea', req: true, help: 'Name and address of each. The first is $297, each additional is $197.', show: ['glowup'] },
    { id: 'glow_hours', label: 'Correct hours, phone and address for each location', type: 'textarea', req: true, help: 'Including holiday hours', show: ['glowup'] },
    { id: 'glow_highlight', label: 'Main products or services to highlight', type: 'textarea', help: 'Up to 5', show: ['glowup'] },
    { id: 'glow_photos', label: 'Photos', type: 'radio', opts: ["I'll send them", "Use what's on my site and social", 'I need new photos (quoted separately)'], show: ['glowup'] },
    { id: 'glow_wrong', label: "Anything Google shows that's wrong today?", type: 'textarea', show: ['glowup'] },
    { id: 'gold_opening', label: 'Is a new location opening in the next 12 months?', type: 'text', help: 'If yes, address and target date. This unlocks the opening strategy.', show: ['gold'] },
    { id: 'gold_times', label: 'Two times that work for your 60 minute plan walkthrough', type: 'text', req: true, ph: 'e.g. Tue Nov 18 at 10am, or Thu Nov 20 at 2pm', show: ['gold'] },
    { id: 'plat_builds', label: 'Which Builds interest you most?', type: 'checks', max: 3, help: 'Pick up to 3', opts: ['Local Store Marketing kit', 'Welcome or loyalty email flow', 'Landing page', 'Social content kit', 'Review generation program', 'Website refresh (uses Build credit)', 'Not sure, recommend for me'], show: ['platinum'] },
    { id: 'plat_campaign', label: 'Is there a campaign, opening or event in the next 90 days?', type: 'text', help: 'What and when', show: ['platinum'] },
    { id: 'cj_team', label: 'Who is on your leadership team, and who joins our weekly call?', type: 'textarea', req: true, show: ['crownjewel'] },
    { id: 'cj_partners', label: 'Which partners do you work with today?', type: 'textarea', help: 'Ad agency, social, PR, web developer, printer. Name and contact for each.', show: ['crownjewel'] },
    { id: 'cj_budget', label: 'Annual marketing budget or target, if set', type: 'text', show: ['crownjewel'] },
    { id: 'cj_initiatives', label: 'Biggest initiatives on the next 12 month calendar', type: 'textarea', help: 'Openings, launches, rebrands, franchise sales', show: ['crownjewel'] },
    { id: 'cj_meeting', label: 'When is your monthly leadership or operations meeting?', type: 'text', req: true, show: ['crownjewel'] },
    { id: 'kick_times', label: 'Two times that work for your kickoff workshop', type: 'text', req: true, help: 'About 2 hours', ph: 'e.g. Tue Nov 18 at 10am, or Thu Nov 20 at 2pm', show: PLANS },
  ]},
];

export const NEXT_LINE = {
  checkup: 'your video walkthrough and Brand Experience Snapshot arrive within 3 business days',
  glowup: 'your Google profile is updated within 5 business days',
  gold: 'our team confirms your plan walkthrough time within 1 business day',
  platinum: 'our team confirms your kickoff workshop time within 1 business day',
  crownjewel: 'our team confirms your kickoff workshop time within 1 business day',
};

// visible questions for an offer, as [{section, questions}]
export function sectionsFor(offer) {
  return SECTIONS.filter((s) => s.show.includes(offer)).map((s) => ({
    ...s,
    q: s.q.filter((q) => !q.show || q.show.includes(offer)).map((q) => (q.access ? { ...q, opts: q.opts.filter((o) => o.show.includes(offer)) } : q)),
  }));
}
