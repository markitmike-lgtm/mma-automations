# MMA Automations

Runs the Markit Mike Agency client journey on its own, at no cost.

| Event | What happens automatically |
|---|---|
| SignWell agreement sent | Deal moves to **Agreement Sent**. Branded "agreement is on its way" email goes out. |
| SignWell agreement completed (both signed) | Deal moves to **Signed, Awaiting Payment**. Branded payment email with the right Stripe link goes out. Nudge and payment tasks close. |
| Stripe checkout paid | Deal moves to **Client Won**. Branded welcome email goes out. ClickUp client folder is created with lists, deliverables and onboarding tasks. |

Every email is sent from michael@markitmike.com (you are BCC'd) and logged on the HubSpot contact and deal.

## Free services used
Cloudflare Workers (runs it), Resend (sends email, 3,000 a month free), HubSpot private app, Stripe webhooks, SignWell webhooks, ClickUp API.

## One time setup
1. **Cloudflare**: free account. Workers & Pages > Create > Import a repository > pick this repo. Deploy.
2. **Secrets** (Worker > Settings > Variables and Secrets, type Secret). Never put these in the code.
   - `HUBSPOT_TOKEN`: HubSpot > Settings > Integrations > Private Apps > Create. Scopes: contacts read and write, deals read and write, companies read, line items read. Copy the token.
   - `STRIPE_API_KEY`: Stripe > Developers > API keys > Create restricted key. Read only on Checkout Sessions and Products.
   - `STRIPE_WEBHOOK_SECRET`: Stripe > Developers > Webhooks > Add endpoint `https://<worker>.workers.dev/stripe`, event `checkout.session.completed`. Copy the signing secret (whsec_...).
   - `SIGNWELL_WEBHOOK_ID`: SignWell > Settings > API > Webhooks > add `https://<worker>.workers.dev/signwell`. Copy the webhook ID.
   - `CLICKUP_TOKEN`: ClickUp > Settings > Apps > API Token.
   - `RESEND_API_KEY`: resend.com > API Keys. First add the domain markitmike.com and its DNS records.
3. Set `DRY_RUN` to `true` for the first test, check the Worker logs, then set it to `false`.

## Test locally
`npm test` fakes every service and runs all three events.
