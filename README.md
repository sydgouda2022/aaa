# التقويم المصري القديم — اشتراك واحد، ولغة قابلة للتغيير

**One Egyptian Alexandrian calendar per user. Four languages are display options, NOT four subscriptions.**

The Egyptian year 6282 began on 11 September 2026. No festivals included yet.

## How it works

1. Open the deployed Cloudflare Worker site (the Worker has **not yet been deployed**).
2. Choose Arabic, Coptic, hieroglyphic or English, then create your personal subscription URL.
3. Subscribe ONCE to the returned HTTPS .ics URL in Apple Calendar.
4. Save the **private settings URL** and use it to switch languages without re-subscribing.
5. Apple Calendar shows updated event titles at its next calendar subscription refresh, which Apple controls.

## Files

- [Cloudflare Worker](worker/index.mjs): generates one stable user subscription link and accepts settings changes.
- [D1 database schema](worker/schema.sql): stores anonymous ID, hashed edit secret, chosen language.
- [Wrangler configuration](worker/wrangler.toml): for Cloudflare account deployment.
- [Calendar generator](generate.mjs): rebuilds underlying feeds monthly with language-independent event UIDs.
- The four static language feeds under calendar/ are implementation assets, NOT four calendars that a user must subscribe to.

## Deploy

1. Install Wrangler and authenticate to your Cloudflare account.
2. Create a D1 database named ancient-egyptian-calendar.
3. Insert D1 database UUID in worker/wrangler.toml.
4. From worker/, execute remote migration: `wrangler d1 execute ancient-egyptian-calendar --remote --file=./schema.sql`.
5. Run `wrangler deploy` from worker/.
6. Open the actual worker URL, create one calendar and use its HTTPS .ics link in Apple Calendar.

Until the Worker is deployed, the earlier direct GitHub ICS links remain static-language previews; they do **not** fulfill the single changeable-language calendar requirement.

Historical note: Egyptian hieroglyphic ordinal month names are used. Royal cartouches are not automatically appropriate for the names of months.