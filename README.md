# Egyptian Alexandrian Calendar — Offline-first PWA

**Live application:** https://ancient-egyptian-calendar.sydgouda.workers.dev/

A **standalone Egyptian calendar** for iPhone, iPad, Android and desktop. Each Egyptian month is rendered as a true calendar grid with Gregorian counterpart dates in the same day cell. No ICS subscriptions, no all-day events, no external calendar app required.

## Install on iPhone / iPad
1. Open the live HTTPS link in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open the icon on your home screen. It behaves like a standalone PWA.

## What it includes
- Egyptian Alexandrian calendar: 12 × 30-day months, plus the 5/6 epagomenal days.
- **11 September 2026 = 1 Thout 6282**, with Egyptian year numbering offset +4539 from the Coptic year.
- Daily Egyptian and Gregorian dates **inside each calendar square**, plus selectable day details.
- Four display choices: Arabic (default), English, Coptic and hieroglyphic **including date numerals**.
- Historical ordinal-month-by-season style for Egyptian hieroglyphs. **No royal cartouches** invented for month names.
- Month navigation with taps or swipes, jump to Gregorian date, today button.
- Saves the chosen language locally. Works without a network after the first online load with service worker assets cached.
- No account, no tracking, no events, no prayers or holidays in this first calendar-only release.

## Development and automatic publishing
- Static PWA frontend: [worker/public/](worker/public/)
- Calendar conversion engine: [worker/public/calendar-core.mjs](worker/public/calendar-core.mjs)
- Offline service worker: [worker/public/sw.js](worker/public/sw.js)
- Cloudflare static Workers frontend: [worker/index.mjs](worker/index.mjs) and [worker/wrangler.toml](worker/wrangler.toml)
- GitHub Actions deployment: [.github/workflows/deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml)
- Calendar and PWA checks: [tests/calendar.test.mjs](tests/calendar.test.mjs)
- Build/test with Node.js 24; works with standard modern browsers. The calendar arithmetic runs entirely on-device.

The earlier ICS-feed prototype has been superseded. It does **not** support adding a new calendar-system type to the native Apple Calendar app, which is why this independent PWA exists.
