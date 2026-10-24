# Late Egyptian source register and ingestion policy

**Registered != acquired != normalized != verified != distributable.**

Inspect: `python src/source_registry.py status` from the platform root.

The machine-readable registry lists every approved source edition and its
precedence, contributor/provenance family, expected value and current
acquisition/publication constraints. All entries target Late Egyptian.
The registry is a source of *governance*, not an archive of copyrighted data.

### Acquisition gates

1. Locate a real corpus release or licensed export (and separately record
   direct URL/DOI, release/tag, authors and exact selected file license).
2. Pin a content SHA-256 digest from its local bytes.
3. Run the appropriate reviewed per-source adapter. Keep original IDs and
   original script spellings, stage evidence, date and contextual citations.
4. Compare shared lineage (AED/AES/ORAEC vs TLA release overlap) before
   counting corpus coverage; distinguish cross-references from new attestations.
5. `verified_source_manifest` creates a local evidence manifest for eligible
   sources only, then the pack compiler validates native-script attestation.
6. Verify prefix search, raw-first behavior, physical device reading, and
   PWA offline activation before enabling the pack in either app.

Ramsès: do not scrape/download complete restricted material via a web GUI.
Lesko: do not OCR/copy a copyrighted reference to assemble a redistributable
dataset. If permission is later obtained, review and update the gate explicitly.

### Authoritative source landing pages

- TLA: https://tla.digital/home?lang=en
- TLA raw release inventory: https://aaew.bbaw.de/daten-veroeffentlichungen
- TLA Late Egyptian v19 filtered: https://huggingface.co/datasets/thesaurus-linguae-aegyptiae/tla-late_egyptian-v19-premium
- Ramsès: https://ramses.ulg.ac.be/site/corpus
- AED: https://zenodo.org/records/3581069
- AES: https://github.com/simondschweitzer/aes
- ORAEC: https://github.com/oraec/corpus_raw_data
- Lesko 2nd ed. catalog: https://search.worldcat.org/title/A-dictionary-of-Late-Egyptian/oclc/706029298

## Source use boundary

**All seven editions are build-time evidence inputs only.** The applications
never call their servers, parse their original files, or ship source PDFs/corpora.
Build one canonical Late Egyptian `lexicon.sqlite3` with spelling and lemma
records; attach source references/lineage for auditing. Cross-source word identity
is not inferred from matching glyphs alone. Renpet and MdwNfr receive generated
indexes from the same SQLite release, never parallel hand-curated dictionaries.
A private local build may use legitimately obtained source materials without
turning those materials into a public downloadable app asset.
