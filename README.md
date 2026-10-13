# التقويم المصري القديم — اشتراك واحد ولغة قابلة للتغيير

Egyptian Alexandrian calendar subscriptions: **one calendar URL per subscriber**, with Arabic, English, Coptic and hieroglyphic display preferences. The year **6282** began **11 September 2026**. This release shows daily dates only, without festivals.

## Publishing status

- Daily language feeds are hosted on GitHub and refreshed monthly.
- The **single-calendar language-switching Worker is implemented and tested**, but its public Cloudflare URL will not exist until the repository is linked to a Cloudflare account.
- GitHub Actions workflow **Test single subscription** passed on 13 Oct 2026.

## One-time Cloudflare connection (do not send tokens by chat)

1. Open [Cloudflare dashboard](https://dash.cloudflare.com/) and note your **Account ID**. Activate your account's `workers.dev` subdomain if prompted.
2. In Cloudflare, create a scoped **API token** that permits **Workers Scripts: Edit** and **D1: Edit** on the account selected. Do not commit the token.
3. Open [GitHub repository Actions secrets](https://github.com/sydgouda2022/aaa/settings/secrets/actions). Add these two repository secrets:
   - `CLOUDFLARE_ACCOUNT_ID`: the 32-character account ID.
   - `CLOUDFLARE_API_TOKEN`: the API token.
4. Open [Deploy single calendar to Cloudflare](https://github.com/sydgouda2022/aaa/actions/workflows/deploy-cloudflare.yml), click **Run workflow** on the `main` branch.
5. The workflow reuses or creates the D1 database, sets up the schema, and deploys the Worker. Read the deployment job output for the **real public URL**.
6. Open the deployed Worker URL, choose a language and create one subscription. Add the returned HTTPS `.ics` link to Apple Calendar; bookmark your private settings link for changing language later.

No Cloudflare credentials should ever be put in source files, GitHub commits, chat messages, or browser query strings. GitHub stores these values as Actions secrets.

## How language switching works

- On creation the service returns **one permanent personalized calendar URL** and one **private settings URL**.
- The settings page changes a stored preference; the same subscription responds in the chosen language on future refreshes.
- Underlying event UIDs do **not** contain language codes: language changes update existing events instead of creating new events.
- Apple Calendar controls refresh timing; the new language need not appear immediately.
- Gregorian month/day labels in Apple's own interface remain unchanged.

## Implementation

- [Cloudflare Worker](worker/index.mjs): registration, settings and ICS endpoint.
- [D1 database schema](worker/schema.sql): only anonymous ID, SHA-256 of a random edit token, and preferred language.
- [Wrangler config](worker/wrangler.toml): configuration template; D1 UUID injected at deployment only.
- [Cloudflare D1 setup script](scripts/prepare_cloudflare.py): idempotently finds or creates the project's database.
- [Deployment workflow](.github/workflows/deploy-cloudflare.yml): manually triggered.
- [Automated Worker test](worker/test.mjs): covers registration, URL stability, language changes, event UID stability and rejection of invalid settings tokens.
- [ICS generator](generate.mjs): refreshes source feeds on a rolling multi-year horizon, in the background of GitHub Actions.
- The four language files under `calendar/` are internal source data, **not user-facing separate calendar subscriptions**.

No festivals are included yet. Hieroglyphic months are shown by their historical ordinal place within each season, not by putting later festival-derived names into royal cartouches.
