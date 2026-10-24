# Renpet Native Script Keyboards — Source and Behavior

## Keyboards
- Coptic: one page, 32 Unicode Coptic characters, Shift (upper/lower), space, delete and a horizontally scrolling strip of additive Coptic number signs.
- Hieroglyphic: three pages (uniliteral, biliteral, triliteral phonograms), with one shared Egyptian number strip on each page (1–9, 10, 100, 1,000, 10,000, 100,000, 1,000,000).
- Direct native script; no Latin transliteration is required to type.
- Both layouts share one UI module and word-composition/prediction engine.
- Each accepted suggestion inserts its written form. The raw input is always the first candidate and can be committed unchanged.
- Training only happens on the device, never on a server; learning can be reset by clearing this site's data.

## Coptic prediction sources
- The offline Coptic lexicon combines Sahidic and Bohairic word forms from Coptic SCRIPTORIUM's [coptic-nlp](https://github.com/CopticScriptorium/coptic-nlp).
- Source revision: `30e02f9e2d6a64386eaf788ec5d6ccb467daca4b`.
- Source files: `data/copt_lemma_lex.tab` and `data.b/copt_lemma_lex.tab`.
- Corresponding source repository publishes Apache-2.0 software and recognizes contributions by CMCL, Saint Shenouda the Archimandrite Society, and other lexical collaborators. This project retains source attribution; confirm underlying lexicon data terms before commercial republishing.
- Curated entries are not manufactured as hypothetical cross-dialect equivalents. Identical Unicode forms are represented once with a bit mask: 1 = Sahidic, 2 = Bohairic, 3 = both.
- Prediction is conservative *prefix matching*, not an unverified generative AI spelling system. Frequencies are not provided by this lexicon and the ranking does not pretend they are.

## Hieroglyphic sign inventory
- MDWNFR's keyboard layout and user-facing behavior (three pages, numbers available throughout, raw-input-first predictions) form the UI specification.
- The actual latest MDWNFR Python keyboard source was not available in the connected Renpet GitHub repository or file library. Therefore **this release does not claim byte-for-byte code reuse of that source**.
- An MIT-licensed phonogram sign catalog from [MichalPaszkiewicz/hieroglyph](https://github.com/MichalPaszkiewicz/hieroglyph) was used to seed the keyboard pages. The catalog retains Gardiner IDs for traceability.
- Python `unicodedata` converts Gardiner IDs into real Unicode Egyptian signs during the build; signs lacking a verified Unicode mapping are omitted, not fabricated.
- Hieroglyphic lexical *word* predictions currently learn local Unicode spellings that a user has committed. The comprehensive MDWNFR lexicon spelling database is **not** bundled because its latest actual source and redistribution permissions have not been provided.
- An eventual MDWNFR lexicon import should produce `rows: [[unicodeSpelling,sourceRef],...]` inside `signs.json`, keeping the raw-first suggestion behavior and existing local learning.

## Privacy, offline and resilience
- Coptic lexicon and sign pages ship as static, service-worker-cached resources. Network access is not required once installed.
- Local learning is saved in `localStorage` at `renpet.keyboard.personal.v1` and is capped to 1500 forms.
- No app text or usage information is sent to external suggestion services.
- Missing dictionaries fail safely: the user can continue typing Unicode, accept raw input and save events without prediction.
