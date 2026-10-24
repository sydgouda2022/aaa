# MdwNfr — canonical Python editor

MdwNfr has one Python 3.12 document, layout and prediction engine in `core/mdwnfr/`, and one PWA in `web/`.

- The sole reference dictionary is `data/lexicon.sqlite3` (41,330 source-backed spellings).
- `web/lexicon/lexicon.json` and the equal Python JSON projection are verified against their release manifest.
- GitHub Actions builds the PWA directly from these files and vendors pinned Pyodide 0.27.8 and a licensed font.
- No source archives, runtime CDN fallback, heritage engines, legacy document migrations, or Python PC-launch compatibility.
- Documents are created in the new device-only `mdwnfr-canonical-v1` IndexedDB. Previous-format data is not imported.
- Focused tests are under `qa/`.

Deployment: https://mdwnfr.sydgouda.workers.dev/
