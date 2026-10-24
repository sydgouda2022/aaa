# Egyptian Language Platform — infrastructure foundation

**Status: Stage 0 / contract and test harness, not a comprehensive corpus or finished keyboard.**

Reusable native-script dictionaries and prediction APIs for Renpet (Coptic + Egyptian)
and MdwNfr (Egyptian only). Two separate *language-specific packs* share one search
protocol. The shared package neither imports MdwNfr's document model nor changes
Renpet's appointment storage. This directory is not hooked into either released app.

## Current implementation

- `src/predict.mjs`: deterministic UTF-8/native-script Unicode candidate search using
  binary search over pre-sorted lexical keys, strict language-stage/dialect filters,
  documented-source candidate identities, context weights and caller-provided local
  personalization; user's exact raw input is always first. No silent fallback.
- `src/build_packs.py`: Python 3.12-compatible compiler for verified normalized
  JSONL records and a pinned source manifest, with explicit failure for missing
  provenance, stage/dialect or invented spellings. Coverage is always `UNVERIFIED`
  until individual source adapters have been audited.
- `tests/`: purely synthetic contract fixtures. **No test fixture is an attested
  historical word and none is distributed as a production dictionary.**

Run `node --test tests/predict.test.mjs` and
`python -m unittest discover -s tests -p 'test_*.py' -v`.

## Next required implementations

1. Source-specific importers for approved *open* Late Egyptian data only:
   TLA Late Egyptian v19 filtered extract, AED, AES and individually verified
   CC BY-SA/CC0 ORAEC files. Ramsès, Lesko and the full TLA Corpus 20 are
   excluded from all active source builds. Pin each actual file and audit
   spelling provenance, stage and overlaps. Recover and validate the original
   full MdwNfr lexicon only when its underlying records satisfy this policy.
2. Morphological inference limited to documented grammatical paradigms,
   non-destructive fuzzy correction, per-language contextual models from licensed
   corpora and an efficient install/download/verify/rollback protocol.
3. Renpet adapter: native inline LTR Unicode text for both Coptic and hieroglyphics.
   No quadrat editor, no custom glyph scaling, no formatting; preserve appointments.
4. MdwNfr adapter: Python remains sole authority for document mutations and
   layout, while shared predictor returns spelling IDs + evidence. No Coptic mode.
5. MdwNfr sign compositor: outline-measured dimensions; historically grounded
   quadrat arrangement; RTL/LTR, sign facing, robust hit testing/export. Retain
   existing *one word = one logical quadrat* rule until explicitly changed.

### Publication gate

No claims of `complete`, `comprehensive`, or `offline-ready` based only on the
sample packs or passing synthetic tests. Tests must compare actual source record
counts/hashes, fonts, stage/dialect partitions, reproducible lexical evidence,
physical iPhone keyboard input, save/reload behavior and airplane mode.

**Sources to evaluate:** KELLIA Coptic Dictionary Online (CC BY-SA 4.0 lexical
TEI), Coptic SCRIPTORIUM NLP and corpus resources (per-dataset license), TLA and
user-pinned AED/AES/ORAEC editions (rights and source-format verification).

## Late Egyptian open-only registry (2026-10-24)

The active registry contains **four openly reusable source editions**:
TLA v19 Late Egyptian, AED, AES and selected ORAEC files. Restricted or
permission-only material has been **removed from the registry and rejected by
the production canonical builder**. These open editions still have attribution
and, for CC BY-SA, ShareAlike requirements. The registry is not an archive and
no full source corpus has yet been imported. Run
`python src/source_registry.py status` for the active list.

## Canonical single-database design (2026-10-24 decision)

**External source corpora never ship with or serve the apps.** They are consulted
in a repeatable *offline build stage* that produces the one canonical Late Egyptian
`lexicon.sqlite3`. `src/build_master.py` builds this database from normalized,
attested records and their reviewed cross-source lemma mappings. It preserves
referential provenance inside the database and deduplicates exact spelling/forms
only when semantic lemma equivalence has been verified. Two identical written
strings do not automatically have the same meaning. AED/AES/ORAEC shared lineage
is tracked to avoid false independent-corpus counts.

`src/export_runtime.py` derives a compact native-Unicode prediction index from
that SQLite master, using the *same release* in both Renpet and MdwNfr. The
browser adapter may read that index as JSON (Safari cannot natively open SQLite
without a reader); this is a generated view of the same database, not another
linguistic authority. Native Python can query the master directly. No runtime
fetch to TLA, Ramsès, AED, AES, ORAEC or Lesko is ever required.

**Private, build-only use and public distribution are different decisions.** A
personal, noncommercial project lowers distribution needs but does not erase
copyright, website access rules, or permission requirements. The local builder
accepts legitimately obtained research input and records its provenance; the
separate `--distribution public` export refuses any non-open input.
The current GitHub repository and Cloudflare PWA are public, so full restricted
lexical datasets must not be pushed there as part of a private workflow.

Example after source-specific adapters have produced verified normalized records:

```bash
python shared-language/src/build_master.py \
  --records /private/late-egyptian-normalized.jsonl \
  --manifest /private/source-manifest.json \
  --out /private/lexicon.sqlite3
python shared-language/src/export_runtime.py \
  --db /private/lexicon.sqlite3 \
  --out /private/egyptian-late-runtime.json \
  --distribution local
```

No full historical corpora have yet been imported by these contract tests.
