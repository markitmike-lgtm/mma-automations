// Every offer the automations know about. "match" is tested against HubSpot line
// item names and Stripe product names, so renaming a product only needs a new match.
export const PLANS = [
  {
    key: 'platinum',
    match: /platinum/i,
    name: 'Platinum Accelerator, 90 Day Growth Plan',
    payLink: 'https://buy.stripe.com/5kQcMYf6t7XC8undF2eME05',
    terms: '$2,499 today, then $2,499 on the same date each of the next two months. Total $7,497, exactly as listed in your proposal and Exhibit A.',
    engagement: true,
    deliverables: [
      'Full brand assessment',
      'Kickoff workshop and 90 day roadmap',
      'Strategy calls, 45 minutes (6 biweekly)',
      'Google Profile Glow Up (up to 3 locations)',
      'Yelp, Apple Maps and Bing cleanup',
      'Review response system',
      'Build 1 (chosen at kickoff)',
      'Build 2 (chosen at kickoff)',
      'Launch: one campaign, landing page included',
      'Monthly Crown Report (3)',
      'Day 90 review and next 90 day recommendation',
    ],
  },
  {
    key: 'crownjewel',
    match: /crown jewel/i,
    name: 'Crown Jewel, Fractional CMO',
    payLink: 'TODO_CROWN_JEWEL_LINK', // confirm the full ...ME04 link in Stripe before go live
    terms: '$5,000 today, then $5,000 on the same date each month for five more months. Total $30,000, exactly as listed in your proposal and Exhibit A.',
    engagement: true,
    deliverables: [
      'Annual marketing plan and budget',
      'Weekly leadership calls (24)',
      'Monthly leadership or operations meetings (6)',
      'Full assessment and all foundation fixes',
      'Build 1 (month 1)', 'Build 2 (month 2)', 'Build 3 (month 3)',
      'Build 4 (month 4)', 'Build 5 (month 5)', 'Build 6 (month 6)',
      'Campaign 1', 'Campaign 2', 'Campaign 3',
      'Paid media and social partner management',
      'Monthly Crown Report (6)',
      'Quarterly business review 1', 'Quarterly business review 2',
    ],
  },
  {
    key: 'gold',
    match: /gold/i,
    name: 'Gold Starter',
    payLink: 'https://buy.stripe.com/3cI6oAbUh1zedOH58weME03',
    terms: '$497, one time.',
    engagement: false,
    deliverables: ['Gold Starter deliverables'],
  },
  {
    key: 'checkup',
    match: /checkup/i,
    name: 'Brand Checkup',
    payLink: 'https://buy.stripe.com/bJefZacYla5K5ib58weME06',
    terms: '$197, one time.',
    engagement: false,
    deliverables: ['Brand Checkup report'],
  },
  {
    key: 'glowup',
    match: /glow up/i,
    name: 'Google Profile Glow Up',
    payLink: 'https://buy.stripe.com/14A6oA8I5fq4eSL30oeME07',
    terms: '$297, one time.',
    engagement: false,
    deliverables: ['Google Profile Glow Up'],
  },
];

export const ONBOARDING_TASKS = [
  'Create client portal login and send access email',
  'Connect Stripe customer to portal Billing tab',
  'Upload signed agreement, Exhibit A and proposal to portal Documents',
  'Collect logins: Google Business Profile, Yelp, website, email platform, social',
  'Connect GA4, Google profiles and ad accounts to the client dashboard',
  'Confirm one point person and approval contact for proofs',
  'Book kickoff workshop and recurring strategy calls',
];

export const CLIENT_LISTS = ['Deliverables', 'Onboarding', 'Proofs and Approvals', 'Reporting and KPIs', 'Assets and Access'];

export function findPlan(...names) {
  for (const n of names) {
    if (!n) continue;
    const p = PLANS.find((x) => x.match.test(n));
    if (p) return p;
  }
  return null;
}
