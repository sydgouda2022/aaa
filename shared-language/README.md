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

1. Source-specific, legally permitted importers for pinned TLA Late → AED → AES →
   ORAEC datasets and KELLIA/Scriptorium Coptic resources, with source IDs and
   per-source reproducible coverage reports. Recover and validate the original
   full MdwNfr lexicon, **not** the 665/728-record development pack.
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
