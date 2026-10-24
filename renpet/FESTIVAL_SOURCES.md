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

Renpet 7 uses one horizontal week band per seven or ten dates, with separators rather than individual boxes. The phone GUI is used below 700 CSS px of width or below 560 px of height; the iPad GUI stacks month and agenda at 700–1023 px and separates them at widths of 1024 px or greater. Its two panes share one selected-day state. Tests cover independent/combined festival sources, dated 2026-only events, appointment preservation, 7/10-day bands, and viewport changes.

## Coptic and hieroglyphic festival presentation (Renpet 7.1.1)

Every published festival entry now includes script-specific `cop` / `egy` title and `description_cop` / `description_egy` detail fields. The original, more expansive `description_ar` remains in the source catalog for evidence and review; Coptic and hieroglyphic modes never fall back to displaying Arabic prose. Six source descriptions and names are also localized. These texts are **modern editorial renderings and contextual summaries**, not claims that the entire modern prose or national, Christian, or Islamic festivities were originally expressed in an attested ancient Egyptian text. In ancient Egyptian mode, the festival sign follows attested TLA lemma ḥꜣb (103300), while original referenced primary/secondary materials remain accessible through source links. Coptic renderings should undergo independent native-language editorial review; they are not critical editions of ancient texts.

Source citation URLs are rendered as compact links in the detail sheet rather than printed inline in the scrollable paragraph, and modern Alexandrian date projections remain labelled in the selected script.
