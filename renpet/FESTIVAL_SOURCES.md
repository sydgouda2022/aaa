# Festival source catalogs — Renpet

Renpet separates **festival sources** (read-only public lists) from **personal appointments** (device-local, editable, optionally recurring). No festival source can delete or suppress a user's appointments, birthdays, reminders, backups or calendar collections.

## Available catalog in 6.6

Only **amun-theban** is selectable. Its existing 13 Egyptian-year dated festivals are loaded from the already-reviewed \`web/data.json\` festival array. Dates and descriptions are unchanged; the movable lunar Beautiful Festival of the Valley is not silently assigned a fixed day.

## Add a festival source later

1. Add a source descriptor to \`web/festival-sources.json\` with a distinct stable ID and \`status: "available"\`, localized \`name\`, \`category\`, \`calendarRule\` and a data pack:
   \`\`\`json
   {"id":"example-source","status":"available","category":"national",
    "name":{"ar":"مثال","cop":"Example","egy":"Example"},
    "calendarRule":"gregorian-annual",
    "data":{"type":"file","path":"./festival-packs/example-source.json"}}
   \`\`\`
   This is a **schema example, not an actual festival**.
2. Create \`web/festival-packs/example-source.json\`:
   \`\`\`json
   {"schema":1,"sourceId":"example-source","events":[
     {"id":"example","ar":"Example","month":12,"day":25,"duration":1}
   ]}
   \`\`\`
3. Include accurate dates, source provenance, confidence and rules in each event record. Publish only after research approval. PWA service-worker generation automatically precaches all files under \`web\`.
4. No new Settings UI or extra calendar renderers are necessary. Sources appear as independent checkboxes and can be enabled together.

\`calendarRule\` values supported by the engine:
- \`egyptian-fixed\`: \`month\`, \`day\`, and optional \`duration\`, based on Renpet's Alexandrian Egyptian year. Historical Egypt-specific festivals.
- \`gregorian-annual\`: annual fixed civil \`month\`, \`day\`, \`duration\` in the Gregorian calendar (national or selected modern traditions).
- \`dated\`: an **explicit researched Gregorian ISO date** \`date:"YYYY-MM-DD"\` and optional \`duration\`. This is suitable for a published instance of a movable/lunar festival; the engine **does not invent astronomical, ecclesiastical or Islamic dates**. Supply dated entries for each occurrence and year.
- \`gregorian-fixed\`: retained alias of the fixed Gregorian month/day rule.

Each resolved event carries a stable \`sourceId\`, so a multi-selection merges events without losing attribution. Source colors can be added later without changing date logic.

## Settings migration / user data

The saved setting still resides at \`renpet.settings.v1\` for backward compatibility; the old \`festivals:true\` migrates to \`festivalSources:["amun-theban"]\`, and \`festivals:false\` migrates to an empty list. Only explicitly selected sources show overlays. Other calendar preferences, saved appointments and recurring birthdays remain intact.

Historical festival data and user-created calendar events never share a storage collection. Future user-owned festivals can be built on existing recurring appointments or a dedicated personal-source adapter **without changing the global source picker**.
