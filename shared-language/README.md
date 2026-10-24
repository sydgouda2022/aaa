# Egyptian Language Platform — source-expanded lexicon releases

**Status (2026-10-24): Source ingestion, canonical SQLite compilation, signed-by-SHA256 browser release installation and two-app deployment are implemented and tested. The selected available source editions have been fully processed; historically exhaustive coverage and advanced morphological/contextual prediction are NOT certified.**

## Current independently audited source builds

| Pack | Native prediction surfaces | SQLite records | Lexical evidence |
| --- | ---: | ---: | --- |
| Late Egyptian hieroglyphic | **7,186** attested native-script word spellings | 3,129 lemmas; 7,186 spellings; 13,821 TLA sentence references plus curated AES manuscript attestations | 3,606 TLA Late Egyptian v19 sentences with 23,403 Unicode word occurrences; 13,112 complete, lemma-linked AES occurrences from seven individually vetted literary documents; matching AED metadata for 3,061 lemmas |
| Coptic | **20,652** native-script word forms | 11,283 TEI entries plus 20,652 unlinked corpus-index identities; 38,194 spelling records with per-form provenance | 32,229 TEI form records from the full published KELLIA Comprehensive Coptic Lexicon v1.2 (2020), reconciled against existing Scriptorium Sahidic/Bohairic forms and KELLIA supplements |

Unique prediction surfaces are **not** the number of meanings, lemmas, textual occurrences, or the total vocabulary used in all periods.

The Coptic prediction masks retain Sahidic-only (12,246), Bohairic-only (3,358), both (4,041), and no verified Sahidic/Bohairic attribution (1,007) forms. Unverified dialect attribution is never guessed.

All provided datasets were acquired from their explicit public release and checked against pinned SHA-256 source hashes. The Late Egyptian vocabulary does **not** silently include Earlier Egyptian material. AES now supplies **1,036 additional** exact lemma–spelling records from individually identified Late Egyptian narratives and letters. ORAEC remains a stage-qualified supplement candidate, not a counted independent attestation source. Access-restricted Ramsès, Lesko and the full TLA online corpus are excluded.

## Binary authority and app behavior

- **One canonical SQLite master per language:** `src/compile_lexica.py` produces immutable `lexicon.sqlite3` with lemma, spelling and evidence tables.
- The compact Unicode prediction JSON is an **export of that master build**, not another independently edited dictionary.
- Renpet bundles and installs both validated releases; MdwNfr bundles and installs only the Late Egyptian release. Renpet no longer ships raw Scriptorium/KELLIA word source tables as its editable prediction authority.
- A dedicated IndexedDB installation area checks SHA-256 and structural integrity on every startup. Valid saved copies start offline. Missing or corrupt copies are installed, repaired from a verified previous release or fetched from the bundled PWA cache/network. Failed updates cannot delete personal appointments, documents or learning.
- MdwNfr's Python runtime spelling catalog is replaced at build time with the **same 7,186-record release** shipped in Renpet; MdwNfr's advanced layout and Renpet's simple inline Unicode layout remain separate.

## How to regenerate the verified release

Download these specific open files into a private build directory, checking the exact SHA-256 digest:

- TLA Late Egyptian v19 premium `train.jsonl`: `dfded75c7d34bc1f2f12e18af6936394dc0c5cadacd1229dc28d46751d6389df`
- AED-TEI `dictionary.xml` at commit `462c722e0323e05641aea2eee8cdf1e27303d939`: `faaca47fc4e3c89899a764e56321ca2dc051e58ef6462acedaa6205ea666b730`
- AES literary text collection `_aes_sawlit.json` at commit `35276d2527cca1a055e31ed5f6683e777717170f`: `b3d5eb695584be976b9981392eb4e149d13f447f677cf445b5a954898bc82ef4`. Only IDs in `sources/aes_late_documents.json` qualify.
- KELLIA Comprehensive Coptic Lexicon v1.2 (2020) XML at commit `f365e2d239bd12b6897f3a761487e40d384b2b24`: `ace84fce11b76386a6adb9888b2cb947056954fc9fe9c04aa0676b1f595fd43d`

```bash
python shared-language/src/compile_lexica.py egyptian \
  --tla /private/tla.jsonl --aed /private/aed.xml \
  --aes /private/aes_sawlit.json \
  --aes-whitelist shared-language/sources/aes_late_documents.json \
  --out /private/build/egy
python shared-language/src/publish_release.py \
  --catalog /private/build/egy/lexicon.json --out /private/build/egy
python shared-language/src/compile_lexica.py coptic \
  --tei /private/coptic.xml \
  --forms renpet/web/assets/dictionaries/coptic.json \
  --popular renpet/web/assets/dictionaries/coptic-popular.json \
  --out /private/build/cop
python shared-language/src/publish_compiled_coptic.py --out /private/build/cop
```

The compiler prints coverage reports and writes `coverage.json`, `manifest.json`, `lexicon.json`, and `lexicon.sqlite3` per language. The automated source-build workflow also uploads both master databases as a downloadable artifact.

## Verification

- `validate-corpora.yml`: checks all source imports, manifests, SQLite integrity, reproducible coverage counts, native-script exclusion filters and licensed source fingerprints.
- `test-shared-language.yml`: verifies missing/corrupt/offline/rollback first-run scenarios and dictionary-pack contracts.
- `deploy-renpet-pages.yml` and `deploy-mdwnfr.yml`: reconstruct and verify the same source editions, then check deployed release counts via HTTPS smoke tests.
- `renpet-mobile-qa.yml`: exercises iPhone-size WebKit/Chromium calendar input, save/reopen and offline behavior against the source-expanded packs.

## What is still NOT 100% linguistically complete

The downloadable TLA v19 premium dataset contains a *filtered portion* of known Late Egyptian materials; curated AES literary evidence substantially improves coverage but does not supply the entire historical stage, not the entire TLA corpus. Some attested words use non-Unicode or unencoded signs (1,034 word occurrences in this import), which cannot become valid native-sign suggestions without independent source verification. AED additionally contains many broader-stage transliteration-only entries; those are **not** automatically converted into Late Egyptian written words.

The Coptic sources are substantial, not all historic dialects or inflected word forms ever attested. TEI lexical descriptions do not automatically constitute a contextual predictive language model. A future comprehensive orthographic coverage audit and trained next-word/morphology evaluation are separate requirements.

This distinction prevents a falsely '100% complete' badge even though the **implemented database pipeline, bootstrap and deployment** are production-operational for the imported material.

Attribution: Thesaurus Linguae Aegyptiae, Simon D. Schweitzer and contributors (AED), KELLIA Comprehensive Coptic Lexicon (BBAW/DDGLC), Coptic SCRIPTORIUM. Reuse follows the respective published CC BY-SA permissions and acknowledgments.
