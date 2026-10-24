#!/usr/bin/env bash
# Single canonical Renpet release builder for CI and local reproducible builds.
# Run with: bash renpet/tools/build_release.sh (from repository root).
set -euo pipefail
# Generate all installable icon sizes from the user's gold rope emblem.
python renpet/tools/build_app_icons.py
mkdir -p renpet/web/assets/fonts
curl -fLsS --retry 3 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansegyptianhieroglyphs/NotoSansEgyptianHieroglyphs-Regular.ttf' -o renpet/web/assets/fonts/NotoSansEgyptianHieroglyphs-Regular.ttf
curl -fLsS --retry 3 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansegyptianhieroglyphs/OFL.txt' -o renpet/web/assets/fonts/OFL-NotoEgyptian.txt
test "$(wc -c <renpet/web/assets/fonts/NotoSansEgyptianHieroglyphs-Regular.ttf)" -gt 200000
curl -fLsS --retry 3 'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf' -o renpet/web/assets/fonts/Cairo-VF.ttf
curl -fLsS --retry 3 'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/OFL.txt' -o renpet/web/assets/fonts/OFL-Cairo.txt
test "$(wc -c <renpet/web/assets/fonts/Cairo-VF.ttf)" -gt 100000
python renpet/tools/make_numerals.py
python renpet/tools/build_keyboard_signs.py
mkdir -p /tmp/lexicon-sources
curl -fLsS --retry 3 --max-time 150 'https://huggingface.co/datasets/thesaurus-linguae-aegyptiae/tla-late_egyptian-v19-premium/resolve/main/train.jsonl' -o /tmp/lexicon-sources/tla.jsonl
curl -fLsS --retry 3 --max-time 150 'https://raw.githubusercontent.com/simondschweitzer/aed-tei/462c722e0323e05641aea2eee8cdf1e27303d939/files/dictionary.xml' -o /tmp/lexicon-sources/aed.xml
echo 'dfded75c7d34bc1f2f12e18af6936394dc0c5cadacd1229dc28d46751d6389df  /tmp/lexicon-sources/tla.jsonl' | sha256sum -c -
echo 'faaca47fc4e3c89899a764e56321ca2dc051e58ef6462acedaa6205ea666b730  /tmp/lexicon-sources/aed.xml' | sha256sum -c -
curl -fLsS --retry 3 --max-time 180 'https://raw.githubusercontent.com/simondschweitzer/aes/35276d2527cca1a055e31ed5f6683e777717170f/files/aes/_aes_sawlit.json' -o /tmp/lexicon-sources/aes_sawlit.json
echo 'b3d5eb695584be976b9981392eb4e149d13f447f677cf445b5a954898bc82ef4  /tmp/lexicon-sources/aes_sawlit.json' | sha256sum -c -
curl -fLsS --retry 3 --max-time 180 'https://raw.githubusercontent.com/MaReTEgyptologists/TranslitModels/c612a91407bddf8d546beedaf46edd5190a67eef/Models/RamsesTrainingSetModel.json' -o /tmp/lexicon-sources/ramses.json
echo 'b399acfef9462c76f4df97794a97369c24f33dc6d87269f315e41a5d16103691  /tmp/lexicon-sources/ramses.json' | sha256sum -c -
curl -fLsS --retry 3 --max-time 150 'https://raw.githubusercontent.com/KELLIA/dictionary/f365e2d239bd12b6897f3a761487e40d384b2b24/xml/Comprehensive_Coptic_Lexicon-v1.2-2020.xml' -o /tmp/lexicon-sources/coptic.xml
echo 'ace84fce11b76386a6adb9888b2cb947056954fc9fe9c04aa0676b1f595fd43d  /tmp/lexicon-sources/coptic.xml' | sha256sum -c -
cp shared-language/src/keyboard_search.mjs renpet/web/keyboard-search.mjs
cp shared-language/src/lexicon_install.mjs renpet/web/lexicon-install.mjs
cp shared-language/src/coptic_install.mjs renpet/web/coptic-install.mjs
python shared-language/src/compile_lexica.py egyptian --tla /tmp/lexicon-sources/tla.jsonl --aed /tmp/lexicon-sources/aed.xml --aes /tmp/lexicon-sources/aes_sawlit.json --aes-whitelist shared-language/sources/aes_late_documents.json --ramses /tmp/lexicon-sources/ramses.json --out renpet/web/lexicon
python shared-language/src/publish_release.py --catalog renpet/web/lexicon/lexicon.json --out renpet/web/lexicon
python shared-language/src/compile_lexica.py coptic --tei /tmp/lexicon-sources/coptic.xml --forms renpet/web/assets/dictionaries/coptic.json --popular renpet/web/assets/dictionaries/coptic-popular.json --out renpet/web/coptic-lexicon
python shared-language/src/publish_compiled_coptic.py --out renpet/web/coptic-lexicon
# Historical source word tables are build inputs and must not ship in the PWA.
rm renpet/web/assets/dictionaries/coptic.json renpet/web/assets/dictionaries/coptic-popular.json
python - <<'PY'
import json, sqlite3
from pathlib import Path
for name,minimum in [('lexicon',40000),('coptic-lexicon',20000)]:
    root=Path('renpet/web')/name
    release=json.loads((root/'manifest.json').read_text())
    assert release['spelling_records']>=minimum and release['complete'] is False
    conn=sqlite3.connect(root/'lexicon.sqlite3')
    assert conn.execute('pragma integrity_check').fetchone()[0]=='ok'
    conn.close()
PY
# Cloudflare static assets allow at most 25 MiB. The browser uses the
# SHA-verified JSON projection; keep SQLite in the release audit but do not ship.
rm renpet/web/lexicon/lexicon.sqlite3
python renpet/tools/stamp_assets.py
python renpet/tools/build_csp.py
python renpet/tools/build_service_worker.py
