# MdwNfr — iPhone PWA development preview

Dedicated Cloudflare Workers deployment, sharing GitHub Actions with the existing
repository without changing Renpet, the existing calendar or their workflows.

- **Target:** `https://mdwnfr.sydgouda.workers.dev/` (only usable after successful GitHub Actions deployment).
- **Editor core:** preserved Python-first MdwNfr v0.1.42. No separate browser editing implementation.
- **Build:** `.github/workflows/deploy-mdwnfr.yml` reconstructs the pinned source archive from `mdwnfr/.source`, vendors Python 3.12 / Pyodide 0.27.8 and an OFL font, builds and verifies an offline asset inventory, and deploys a separate Cloudflare Worker.
- **Privacy:** documents stored locally on the iPhone via IndexedDB; no cloud sync.
- **Contents:** a source-verified **41,330-spelling-record, 40,265-distinct-form, 3,129-verified-lemma** Late Egyptian runtime release derived from pinned TLA v19, AED, individually approved AES literary sources and 34,144 additional Ramses word-model spellings that retain explicit *unlinked* lexical identity. This is not an exhaustive historical Late Egyptian dictionary. PDF/DOCX/native document exchange remains future work.
- **Artwork:** source drawings resized/quantized for phone preview with catalog checksums re-generated, silhouette data preserved. Full-resolution originals are retained in the release archive.

## iPhone installation

When the public deployment passes CI: open the HTTPS URL in **Safari**, tap **Share**, select **Add to Home Screen**, and tap **Add**. Wait for the initial app assets to install while online; reopen it from the new Home Screen icon.

This preview is not certified against physical iPhone Safari and has not passed the final product-completion gates.
