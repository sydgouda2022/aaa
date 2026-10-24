# Festival source registry — Renpet

Renpet's festival sources are **independent, multi-select read-only overlays**. User appointments, birthdays, reminders, backups and personal calendar collections never share a festival data store. Festival choices persist in `renpet.settings.v1.festivalSources`. The old `festivals` boolean migrates to Amun-only or none.

## Available lists (additional lists opt-in)

| Source ID | Type | Currently evidenced content | Date rule |
| --- | --- | --- | --- |
| `amun-theban` | Ancient Egyptian | The previously curated 13 Theban Amun festivals | Egyptian fixed |
| `national-egypt` | Egyptian civic | Six fixed anniversary dates; 2026 Sham El-Nessim | Gregorian annual + 2026 dated |
| `christian-coptic` | Christian | Christmas annually; 2026 Easter | Gregorian annual + 2026 dated |
| `muslim-egypt` | Islamic | Eid al-Fitr, Eid al-Adha and the observed Mawlid holiday in 2026 | Individually dated 2026 |

**These are partial lists, not comprehensive catalogs** of the traditions. Other theological lists such as Esna and Isis require independent source research before publication. No ancient lunar festival will be given an invented fixed date. The user may enable any combination of available lists. Adding a source does not alter existing appointments.

All published modern entries include a provenance URL. Annual observance/anniversary dates are **not** automatically moved to the weekday of the associated public holiday. The 2026-specific religious dates are not repeated in 2027 or later years unless authoritative dates for those years are explicitly added.

## Add a documented list

1. Create a new descriptor in `web/festival-sources.json`, including `id`, `status:available`, `category`, localized `name`, `calendarRule`, and `data:{type:file,path:'./festival-packs/your-id.json'}`.
2. Create the referenced JSON pack with `schema:1`, matching `sourceId`, and `events` array. Every event requires stable ASCII lowercase `id`, Arabic `ar` label, optional duration and an attested date.
3. Each source has a default date rule; events can override it via `calendarRule`. Supported rules: `egyptian-fixed` (Alexandrian month/day), `gregorian-annual` / `gregorian-fixed` (Gregorian month/day), and `dated` (exact `YYYY-MM-DD`; **no automatic recurrence**).
4. Keep provenance, historical confidence, and meanings in the data. Do not confuse religious festival dates with public vacation schedules. PWA builds precache all validated source packs under `web`.

## Migration, safety and tests

Only Amun is enabled by default for existing users. Each new list is opt-in. An unavailable optional pack is skipped without deleting the existing registry, Amun data or personal scheduler records. Saving the festival preference changes only the overlay selection.

The 6.7 UI uses one horizontal week band per seven or ten dates, with separators but no individual boxes. At iPad/web widths of 768 CSS pixels or more, the same app state appears in a navigation-rail and two-pane layout. Tests should cover separate/combined sources, 2026-only dated items, preserved appointments, 7/10-day bands and phone/tablet viewport limits.
