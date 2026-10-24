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

## Renpet 6 offline word dictionaries

### Coptic frequency and supplements
Renpet augments the pinned Sahidic/Bohairic surface-form lexicon with common forms and corpus-frequency hints from KELLIA's Coptic Dictionary Online `data/supplemental_entries.tab`, extracted on 2026-10-24 (CC BY-SA 4.0). The `coptic-popular.json` pack retains these rankings; independent dialect metadata is **not invented** for forms absent from the primary Scriptorium lexicon. Search ignores combining overbars for matching but inserts the original written form.

Source: https://github.com/KELLIA/dictionary; license https://creativecommons.org/licenses/by-sa/4.0/.

### Attested hieroglyphic words
Release 6 generates `egyptian-wordforms.json` from the Thesaurus Linguae Aegyptiae **Original Earlier Egyptian v18 premium** data (12,773 sentence records) without transliterating, inventing spellings or treating it as a Late Egyptian dictionary. The `hieroglyphs` field contains space-delimited Unicode word forms; predictions preserve each original sequence, attach a corpus-use count, and where aligned retain a TLA lemma ID. These attestations are **Earlier Egyptian**, not the complete MDWNFR Late Egyptian lexicon.

Source: https://huggingface.co/datasets/thesaurus-linguae-aegyptiae/tla-Earlier_Egyptian_original-v18-premium . Dataset: CC BY-SA 4.0. Cite as: Thesaurus Linguae Aegyptiae, Original Earlier Egyptian sentences, corpus v18, premium, v1.1, 16 February 2024, edited by T. S. Richter, D. A. Werning, H.-W. Fischer-Elfert, and P. Dils on behalf of BBAW and SAW.

Reproduction: `python renpet/tools/build_egyptian_words.py train.jsonl`. CI downloads the pinned corpus edition and compiles a compact local vocabulary; personal events and text are never uploaded.

**Remaining gap:** importing the 123,939 written spellings from the user's own `D:\Python Projects\MdwNfr\dictionary\lexicon.sqlite3` still requires access to that actual SQLite database and source redistribution rights. TLA Earlier Egyptian word forms must not be reported as replacement Late Egyptian evidence.

## Arabic interface font
Cairo variable font is bundled in `assets/fonts/Cairo-VF.ttf` during the verified build from https://github.com/google/fonts/tree/main/ofl/cairo under SIL Open Font License 1.1; licensing notice is included as `OFL-Cairo.txt`. Arabic calendar UI and inputs use Cairo. The operating system's keyboard UI remains controlled by iOS.

## Verified local Coptic lexicon installation (Renpet)

Renpet now publishes a dedicated `/coptic-lexicon/` release constructed deterministically from
its pinned Coptic SCRIPTORIUM Sahidic/Bohairic forms and KELLIA frequency supplement.
The original source JSON is a build input; the UI prediction engine loads only the verified
Coptic release installed to its independent `coptic-lexicon-install-v1` IndexedDB store.
The release is SHA-256 checked on startup and on downloads, with corruption recovery,
rollback and offline PWA-cache repair. This does not change any appointments, documents or
keyboard-personalization keys. No unattested dialect assignment is fabricated for a
KELLIA-only word. Current coverage is not described as a complete Coptic dictionary.
MdwNfr remains hieroglyphic-only and does not ship or use the Coptic installer.
