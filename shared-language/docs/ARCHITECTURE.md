# Shared Dictionary, Keyboard and Dual Writing Model — authoritative build plan

## Nonnegotiable scope

A. Egyptian hieroglyphic and Coptic dictionaries are separate verified language packs under one governed publishing and query contract. Egyptian material is divided by documented language stage. Coptic material is divided by documented dialect, with no invented equivalences. The same shared predictor can read either pack.

B. Native Unicode input is the only required entry method. Users choose from real sign keys/letters, never Latin transliteration. The exact raw sequence remains selectable at position one; suggestions must have stable IDs, historical context and attestation metadata. Device-local and document-local learning may change rank but cannot create fabricated 'attestations'.

C. Renpet: Coptic and hieroglyphics have the same simple LTR inline text model. Use normal Unicode text controls, font-default sign metrics and consistent nominal font size; no custom quadrat geometry, sign scaling, advanced selection model, page engine or historical spatial compositor. The calendar and appointment manager continue to own the saved strings; 'saved' must mean rendered after reopen, not only accepted into a transient form. Egyptian hieroglyphic strings can contain user-typed Unicode signs without any automatic spatial controls. Coptic may retain its attested combining marks. All keyboard operations are grapheme-safe on iPhone.

D. MdwNfr: Late Egyptian hieroglyphic editing only, with Python 3.12 document model and page layout as the sole authoritative editing pipeline. Words/quadrats, image/table/cartouche objects and stable IDs remain in the document model. Both LTR/RTL, source-faithful sign facing, historically documented grouping, glyph outline metrics, composition, dragging, selection, undo/redo, autosave, recovery and exports are validated against one canonical representation. Do not add Coptic here. Preserve the currently agreed 'one word = one logical quadrat' contract unless the product owner explicitly changes it; flag historical overlong spellings for a design review, not a silent schema change.

## Source acquisition and dictionary publication

- Egyptian: prioritize pinned TLA Late -> AED -> AES -> ORAEC. A corpus of Earlier Egyptian spelling forms is not evidence for an entry labelled Late Egyptian. Preserve lemma, source document and original spelling provenance separately. Report measured source counts, accepted entries, rejected records, unattested/missing Unicode spellings, per-edition coverage and copyright/redistribution decisions. The historic target (~44,980 forms, 123,939 spellings, ~910k references) is a recovery target, not a verified count for the current v0.1.42 distribution.
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

## Late Egyptian corpus expansion (approved 2026-10-24)

The Late Egyptian acquisition authority is now
`sources/late_egyptian_registry.json` (seven *editions*, six project names):

1. **TLA Corpus 20**: primary lexical reference; only individual raw editions
   with verified open-data permissions may be distributed. A web interface is
   not equivalent to a bulk-data license.
2. **TLA Late Egyptian v19 premium**: attested, filtered, downloadable baseline;
   a subset, not the entire Corpus 20. Its overlapping TLA editorial lineage
   must not be double-counted.
3. **Projet Ramsès**: preferred Late Egyptian contextual supplement, blocked from
   bulk ingestion and redistribution until authorized machine-readable access
   and a license are documented. Historical project size is not a current export.
4. **AED**: open CC BY-SA lexicon, needs an edition pin and stage filtering.
5. **AES**: open CC BY-SA sentence data, needs an edition pin, complete-sign
   checks, stage filtering and source-level identity preservation.
6. **ORAEC**: per-file CC BY-SA or CC0, source text lineage overlaps AED/AES,
   and only eligible files with proven rights may be ingested.
7. **Lesko, _A Dictionary of Late Egyptian_, 2nd ed.**: specialist scholarly
   comparison only; no automatic transcription of the copyrighted dictionary.

Priority ranks are not evidence weights or independent-vote counts. Only
wordforms demonstrably from Late Egyptian records qualify as primary Late
Egyptian predictions; unknown-stage and earlier/other Egyptian material must
remain separately tagged and must not be silently promoted. This registry is
for all future writing apps; no change is made to MdwNfr's existing pinned
four-source lexicon or current PWA until replacement data has passed the
independent checksum, provenance, overlap, publication and compatibility gates.
