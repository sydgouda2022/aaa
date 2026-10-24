# Shared Dictionary, Keyboard and Dual Writing Model — authoritative build plan

## Nonnegotiable scope

A. Egyptian hieroglyphic and Coptic dictionaries are separate verified language packs under one governed publishing and query contract. Egyptian material is divided by documented language stage. Coptic material is divided by documented dialect, with no invented equivalences. The same shared predictor can read either pack.

B. Native Unicode input is the only required entry method. Users choose from real sign keys/letters, never Latin transliteration. The exact raw sequence remains selectable at position one; suggestions must have stable IDs, historical context and attestation metadata. Device-local and document-local learning may change rank but cannot create fabricated 'attestations'.

C. Renpet: Coptic and hieroglyphics have the same simple LTR inline text model. Use normal Unicode text controls, font-default sign metrics and consistent nominal font size; no custom quadrat geometry, sign scaling, advanced selection model, page engine or historical spatial compositor. The calendar and appointment manager continue to own the saved strings; 'saved' must mean rendered after reopen, not only accepted into a transient form. Egyptian hieroglyphic strings can contain user-typed Unicode signs without any automatic spatial controls. Coptic may retain its attested combining marks. All keyboard operations are grapheme-safe on iPhone.

D. MdwNfr: Late Egyptian hieroglyphic editing only, with Python 3.12 document model and page layout as the sole authoritative editing pipeline. Words/quadrats, image/table/cartouche objects and stable IDs remain in the document model. Both LTR/RTL, source-faithful sign facing, historically documented grouping, glyph outline metrics, composition, dragging, selection, undo/redo, autosave, recovery and exports are validated against one canonical representation. Do not add Coptic here. Preserve the currently agreed 'one word = one logical quadrat' contract unless the product owner explicitly changes it; flag historical overlong spellings for a design review, not a silent schema change.

## Source acquisition and dictionary publication

- Egyptian: prioritize pinned openly reusable TLA Late Egyptian v19 -> AED -> AES -> verified open-file ORAEC. A corpus of Earlier Egyptian spelling forms is not evidence for an entry labelled Late Egyptian. Preserve lemma, source document and original spelling provenance separately. Report measured source counts, accepted entries, rejected records, unattested/missing Unicode spellings, per-edition coverage and copyright/redistribution decisions. The historic target (~44,980 forms, 123,939 spellings, ~910k references) is a recovery target, not a verified count for the current v0.1.42 distribution.
- Coptic: start with the TEI/XML Comprehensive Coptic Lexicon (KELLIA/BBAW and DDGLC), then independently licensed Sahidic and Bohairic corpus forms from Coptic SCRIPTORIUM. Preserve dialect, lemma, written form, morphosyntax, contextual frequency and original orthography; separately license-check SCRIPTORIUM-derived word tables.
- Published packs: deterministic rebuild from pinned inputs; explicit SHA-256 manifest, individual source licenses and citation metadata, stable cross-version mapping, immutable version, integrity verification before IndexedDB activation, rollback and no failure-triggered deletion of existing offline packs.

## Predictive keyboard progression

Stage K0 implemented as a reusable engine contract (this directory): native Unicode, strict filters, provenance, indexed prefix search, local weights and context hints. **This is not yet an 'advanced' prediction release.**

Stage K1: parse full licensed word forms and corpus frequencies. Build per-script normalized prefix tables, exact hashes, diacritic-aware lookups and deterministic incremental search, including sign sequences with supplementary-plane UTF-16 handling.

Stage K2: explicit linguistic features: Coptic dialectal morphology/attested inflection and segmentation of bound groups; Egyptian spelling variants, language-stage priors and available morphological tags. Corpus-based next-word model. Never label a generated hypothesis 'attested'.

Stage K3: optional user-requested fuzzy spelling recovery and spelling alternatives, clearly distinct from primary evidence. No unrequested replacement; ranking learns locally and separately per app/origin, with explicit reset/export.

Stage K4: UI adapters. Renpet: iPhone LTR text fields, single consistent keyboard component with mode-specific keys and suggestions. MdwNfr: three sign-key pages and numeral strip, with a structured word commit to Python using selected stable spelling ID and full undo support. Keyboard UI can enlarge tiny signs *in the suggestions* while preserving authored sizes.

## MdwNfr sign-composition progression

Stage W0: obtain a redistributable hieroglyphic font and machine-readable outline metrics from the exact font version used in the PWA. Do not estimate geometry from CSS `font-size` or hard-coded provisional sign-ratio tables.

Stage W1: use sign intrinsic outline bounds, optical alignment, insertion slots and representative shape classes with non-destructive transforms. Preserve sign aspect ratio and minimum legible glyph dimensions. Glyphs may have differing proportions even when they share the same nominal author size.

Stage W2: implement one canonical quadrat/word layout representation with controlled horizontal/vertical adjacency and documented inserted/overlaid placements. Compare each result with historically attested examples. Separate attested arrangement from algorithmic, reversible fallback; do not silently 'improve' a documented spelling.

Stage W3: unify screen, hit testing, selection, reflow, paper/papyrus, export and history around the same computed visual/ink bounds; no independent JS compositor contradicting Python.

## Completion gates

1. Source gate: 100% of published lexicon entries have pinned source, license status, language stage/dialect, attestation evidence, and stable IDs. All expected source record counts reconcile or exceptions are documented.
2. Search gate: raw candidate always first; exact attestations recognised; dialect and period never cross-contaminated; no generated forms misrepresented; reverse mapping to original spellings; portable deterministic tests.
3. Advanced prediction gate: morphology and contextual suggestions objectively improve a held-out licensed corpus against the existing prefix baseline; report top-1/top-3 metrics and errors by dialect/period. Measure actual iPhone latency and memory, not only desktop synthetic performance.
4. Renpet writing gate: type, select, delete graphemes, edit mixed Arabic/Coptic/hieroglyphic event strings, save, close, reopen, sync to view and run offline in Safari-installed mode; font rendering remains consistent and legible.
5. MdwNfr writing gate: no geometry distortion, historical fixture match, stable logical IDs, RTL/LTR, nested objects and alignment, real iPad/iPhone editing, PDF/DOCX/.mdwnfr checks and reversible crash recovery.
6. Release gate: complete source packs and installer verified offline, no silent default to development dictionary, no P0/P1 regressions in either app.

## Immediate implementation order

1. Finish archival corpus/rights inventory, then recover old full Egyptian lexical authority if its actual source files are available.
2. Build pinned source-specific adapters, reconciliation reports and two production lexical packs.
3. Complete and benchmark the shared advanced predictor, then integrate into Renpet first without altering its appointment data schema.
4. Integrate the same predictor into MdwNfr's Python word-commit bridge; remove competing prediction ranking logic after parity tests.
5. Implement/verify the MdwNfr-only advanced compositor on actual pinned font metrics; maintain independently verified Renpet inline presentation.

These steps are engineering requirements, not a claim that the completed dictionaries, iPhone UX, or advanced historical compositor already exist.

## Late Egyptian active open-data sources (updated 2026-10-24)

Only these four approved, publicly reusable source editions can feed the
canonical lexicon build: TLA Late Egyptian v19 filtered premium data, AED,
AES, and ORAEC **only for individual files verified CC0 or CC BY-SA**.

Permission-dependent or copyright-only sources (full TLA Corpus 20 absent an
independent open dataset license, Projet Ramsès, and Lesko) are **excluded**,
not merely lower-priority references. This is enforced in source registry
validation and in the production SQLite master build. Any future newly open
edition must be explicitly approved, not silently auto-detected.

AED/AES/ORAEC share an upstream editorial lineage; overlapping attestations
are not additional independent confirmation. Only entries actually marked
Late Egyptian qualify for the Late Egyptian runtime pack. These source inputs
are used at **build time only**, not fetched by either app.

## 2026-10-24 — Single-use source corpora, one Late Egyptian runtime database

This requirement **supersedes** wording elsewhere that could imply the apps
query external research sites at runtime or independently ingest them.
Each external source is a build-time evidence input. Import only after the source
can legitimately be accessed and normalized. Review known cross-source lemma
identities; merge spelling rows by reviewed lemma + exact Unicode surface +
morphology, but preserve every actual attestation reference in a distinct
`evidence` table. Do not count AES/AED/ORAEC as three independent witnesses for
an identical inherited underlying text. Keep homographs with different senses
separate.

The **one lexical authority** is the device-local master `lexicon.sqlite3`
produced from those normalized inputs. Produce a deterministic, versioned
prediction index from that master for browser clients; both Renpet and MdwNfr
consume the same indexed release. This derived index is not a second dictionary
or a reason to ship original source corpora. The same lexical data must be
available offline. Renpet has ordinary inline Unicode presentation; MdwNfr owns
its historically informed quadrat compositor.

Private and public production builds both use the same open-only source policy.
Open CC BY-SA licenses are permitted without individual negotiation, but
attribution and ShareAlike compliance still apply. Source file identity,
checksums, and per-file rights verification remain mandatory.

`src/build_master.py` and `src/export_runtime.py` implement the initial working
SQLite and release-index contracts on synthetic test fixtures. Completion is
not achieved until approved open-data source adapters populate the actual
Late Egyptian master and both application integrations pass end-to-end tests.
