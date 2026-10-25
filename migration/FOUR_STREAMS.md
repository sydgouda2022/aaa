# Four independent development streams

Decision date: 2026-10-25. Source repository until cutover: `sydgouda2022/aaa`.
This file is a **migration specification**, NOT evidence that four independent repositories
or downstream automatic updates have been created. Do not delete the source
repository or switch Cloudflare deployments until all cutover gates pass.

## Ownership and dependency graph

| Future repository | Sole owner of | Consumers |
| --- | --- | --- |
| `sydgouda2022/coptic-keyboard` | Coptic native typing/prediction engine, dialect-aware search, lexicon master, builder, licensing/source registry, source-backed release manifests | Renpet |
| `sydgouda2022/hieroglyphic-keyboard` | Hieroglyphic native typing/prediction engine, sign catalogue, Late Egyptian lexicon master, builder, provenance, source-backed release manifests | Renpet; MdwNfr |
| `sydgouda2022/renpet` | Egyptian calendar, three-language UX, festivals, appointments, offline storage, keyboard UI integration adapters, Cloudflare worker | End users |
| `sydgouda2022/mdwnfr` | Hieroglyphic document model, quadrat and silhouette compositor, page/PDF/export/editor UX, keyboard UI integration adapter, Cloudflare worker | End users |

Allowed runtime/build dependency edges:
`coptic-keyboard -> renpet`,
`hieroglyphic-keyboard -> renpet`,
`hieroglyphic-keyboard -> mdwnfr`.
No dependency edge may point from a keyboard to a consumer. The two keyboards
remain independent: Coptic may NOT require Hieroglyphic merely to reuse common
prediction algorithms. Common algorithms can be independently versioned
inside both packages (with parity tests) or code-generated from an explicitly
vendored, hash-recorded source, NOT placed in a hidden fifth repository.

Renpet uses a normal Unicode text-input adapter. MdwNfr uses a structured
word-to-Python adapter; DO NOT overwrite its native quadrat/page-layout engine
with the calendar's simpler rendering code. Likewise, consumers own their own
private history, learning, appointments, documents and backup data. Keyboard
updates must not rewrite user data or local storage keys.

## Source allocation, before physically separating repositories

**Coptic keyboard:** extract Coptic routines from
`shared-language/src/compile_lexica.py`, `source_registry.py`,
`publish_compiled_coptic.py`, `publish_coptic_release.py`,
`coptic_install.mjs`, and the Coptic branches of
`keyboard_search.mjs` / `predict.mjs`; move the pinned KELLIA/Scriptorium
provenance and Coptic tests from `shared-language/tests`. The original build
inputs `renpet/web/assets/dictionaries/coptic.json` and
`coptic-popular.json` are SOURCE material, not runtime app dictionaries.

**Hieroglyphic keyboard:** extract the hieroglyphic routines from
`shared-language/src` and `shared-language/sources`; sign mappings from
`mdwnfr/web/keyboard_catalog.js` and `renpet/tools/build_keyboard_signs.py`;
the authoritative Late Egyptian SQLite master
`mdwnfr/data/lexicon.sqlite3`; and JSON/manifest projection currently in
`mdwnfr/web/lexicon`. Keep all TLA, AED, AES, Ramses and font/sign catalogue
licenses/provenance with their source-specific build records. The Ramses-model
unlinked forms must never silently acquire verified lemma status.

**Renpet:** migrate `renpet/` preserving deployment config, tests, seasonal
assets and user-data contract, but replace dictionary compilers/copies with two
versioned published keyboard assets. Its existing `keyboard.js` is a PRODUCT
adapter; it may not become the canonical dictionary/predictor source.

**MdwNfr:** migrate `mdwnfr/` preserving document format, editor, geometry,
user files and recovery, but replace hardcoded dictionary copies with a
verified import of the Hieroglyphic keyboard release. The historical version
of each layout/lexicon must remain inspectable. Do not publish the 32 MiB
SQLite master as a Cloudflare Worker static asset: preserve it as a release
audit/build artifact; publish its ~8.5 MiB SHA-256-checked JSON projection.

Do not simply move the whole `shared-language` directory into either keyboard:
it presently mixes the two language authorities. First partition code,
data provenance and tests and confirm both builds reproduce the current pack
hashes and counted source records.

## Release contract: auditable, automatic, offline

A keyboard release consists of (1) immutable semantic version and Git commit;
(2) canonical SQLite build artifact; (3) browser lexicon JSON and its existing
SHA-256 manifest; (4) keyboard library JavaScript and public adapter contract;
(5) source/rights manifest and a build report (counts, excluded records,
coverage, caveats); and (6) unit-test and reproducibility attestations.

- Semantic compatibility: major = breaking API/pack-schema change; minor =
  compatible features and new signed-off sources; patch = compatible fixes.
- Every file is hashed separately. A consumer records EXACT upstream release
  version, commit SHA and asset hashes in `keyboard-lock.json`.
- Released source data stays pinned to reviewed source editions and licenses.
  Never scrape outside databases at app runtime or insert unattested forms.
- Consumers fetch releases at **build time**, from versioned GitHub releases,
  not live per-keystroke from the network. Installation checks SHA-256,
  validates the schema, retains a verified previous release and remains
  operable offline.
- Every keyboard publish triggers consumer sync/PR workflow (ideally GitHub
  App repository-dispatch with narrow permissions). For public repos,
  an independent scheduled consumer updater checking the Releases API is a
  no-cross-repository-token fallback. Configure an acceptable schedule (e.g.
  hourly), not a false guarantee of instantaneous updates.
- Consumer sync updates the lock and verified bundle, runs full unit and
  Chromium/WebKit offline regression, then deploys Cloudflare if all checks
  pass. Failed builds keep the prior production release; visible failures
  become issues/alerts, not silent version drift.
- Keep source generation, binary master validation, hash verification,
  dependency compatibility, per-language prediction ranking benchmarks and
  acceptance tests in PUBLIC CI logs and attach immutable release evidence.
- Each consumer shows deployed keyboard version(s) in app diagnostics. A
  dynamic "latest" dependency without an auditable lock and rollback is
  prohibited.

## Present technical debt / before/after

Currently `renpet/tools/build_release.sh` COPIES
`shared-language/src/keyboard_search.mjs`,
`shared-language/src/lexicon_install.mjs` and
`shared-language/src/coptic_install.mjs` and RECOMPILES both lexicons. Its
repository workflow watches parts of `shared-language`. MdwNfr's deployment
workflow watches `mdwnfr/**` and does NOT subscribe to changes in
`shared-language` by default. The two app keyboard adapters differ, and
publishing shared-language code alone is NOT equivalent to releasing a common
keyboard dependency.

Current measured baseline, subject to source-qualified completeness caveats:
Coptic 20,652 distinct surfaces; Late Egyptian 40,265 distinct surfaces /
41,330 SQLite spelling records. These are NOT claims of historical
completeness or verified lemma identity for all Ramses entries.

## Auditable migration gates

- [ ] New four repos created under the intended GitHub account.
- [ ] Each source's history or an immutable original-commit provenance map
      transferred; compare file hashes with the pre-migration baseline.
- [ ] Coptic and Hieroglyphic standalone builds reproduce validated source
      counts, attribution, SHA-256, source exclusions and license audit.
- [ ] Libraries have independent tests, API versions, immutable releases,
      changelogs, and narrowly scoped CI permissions.
- [ ] Renpet installs BOTH library releases from hashes in a lockfile;
      displays versions; all keyboard/editor/calendar/offline tests pass.
- [ ] MdwNfr installs Hieroglyphic release; Python and browser packs match;
      typography, document, offline and touch tests pass.
- [ ] **Exercise upstream change -> both downstream applications**. Verify
      published release IDs in Cloudflare and on actual iPhone/iPad browser.
      Verify failing update stays on previous known-good production.
- [ ] Reconfigure repository-scoped `CLOUDFLARE_ACCOUNT_ID` and
      `CLOUDFLARE_API_TOKEN` secrets for both new app repositories.
- [ ] Preserve Cloudflare worker names and addresses
      `renpet.sydgouda.workers.dev` and
      `mdwnfr.sydgouda.workers.dev`; prevent parallel old/new workflows
      deploying the same worker. Turn off old workflows after cutover.
- [ ] Audit and export the five existing repositories before deletion.
      Delete obsolete repositories **only after** all four new ones are
      functional, the data is preserved, and both deployments are verified.

## Existing-repository disposition

GitHub inventory on 2026-10-25: `aaa` (authoritative monorepo, KEEP UNTIL
CUTOVER), `egypt-radio-gateway`, `egyptian-radio-pwa`,
`Object-Detection-in-an-Urban-Environment`, and
`Udacity-Self-Driving-Car-Engineer-Nanodegree-Program-Sensor-Fusion-and-Tracking`.
The non-four repositories are **deletion candidates** per the user's cleanup
request, not evidence of safe deletion. Preserve backups/issues/releases and
avoid irreversible deletion while they are still the sole source of any app.

No repo creation/deletion, data migration, or live dependency updates may be
inferred merely because this specification is committed.
