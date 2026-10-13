# Ancient Egyptian Calendar Subscriptions

Read-only Egyptian Alexandrian calendar feeds. Year **6282** began **11 September 2026**. This is a modern conventional year numbering, not a claim about a historically proven epoch.

**No religious festivals included yet.** Daily feeds show Egyptian dates alongside Gregorian dates in the user's existing calendar. Compact feeds show Egyptian month starts and epagomenal period.

| Language | Full (daily) | Compact (monthly) |
|---|---|---|
| Arabic / العربية | [Subscribe](https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar/ar/full.ics) | [Subscribe](https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar/ar/compact.ics) |
| English | [Subscribe](https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar/en/full.ics) | [Subscribe](https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar/en/compact.ics) |
| Coptic / Ⲙⲉⲧⲣⲉⲙⲛ̀ⲭⲏⲙⲓ | [Subscribe](https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar/cop/full.ics) | [Subscribe](https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar/cop/compact.ics) |
| Egyptian hieroglyphs | [Subscribe](https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar/egy/full.ics) | [Subscribe](https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar/egy/compact.ics) |

## Apple Calendar subscription

On iPhone or iPad: Calendar → Calendars → Add Calendar → Add Subscription Calendar, then paste the HTTPS link above. On Mac: Calendar → File → New Calendar Subscription. Choose iCloud if you want the subscription on all your devices. The link is read-only and does not alter personal events.

## Historical notation

Ancient Egyptian edition uses **ordinal month number within season** (hieroglyphic month sign 𓇹, numerical month, season signs) and Egyptian numeric signs for both day and year. It does not guess the twelve hieroglyphic festival-name spellings or put divine month names in royal cartouches. The cartouche traditionally encloses royal names and some divine names in special contexts, so cannot be automatically applied to month names.

## Maintenance

The zero-dependency source is [generate.mjs](generate.mjs). GitHub Actions regenerates the calendars monthly with a rolling multi-year horizon; stable URLs are retained. Feeds contain all-day `TRANSP:TRANSPARENT` events with deterministic UIDs and no alarms.

References: [UCL calendar](https://www.ucl.ac.uk/museums-static/digitalegypt/chronology/calendar.html), [UCLA cartouches](https://escholarship.org/uc/item/3g726122), [Library of Congress Coptic numerals](https://www.loc.gov/catdir/cpso/romanization/coptic.pdf).
