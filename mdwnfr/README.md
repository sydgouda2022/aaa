# MdwNfr — canonical Python editor
One source tree: Python engine in core/mdwnfr/, app in web/, and
canonical 41,330-spelling SQLite in data/lexicon.sqlite3.
Published JSON is pinned under web/lexicon/ for direct browser load.
Build using tools/build_static.py after vendoring the Python 3.12
runtime and licensed Noto font. QA lives in qa/.
No archived source, compatibility layer or legacy document migration.
The new browser document store is mdwnfr-canonical-v1.
