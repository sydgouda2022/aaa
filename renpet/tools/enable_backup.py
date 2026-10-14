"""Attach Renpet's device-only backup controls after the bundled UI overlay."""
from pathlib import Path
p = Path(__file__).resolve().parents[1] / "web" / "index.html"
html = p.read_text(encoding="utf-8")
if 'backup.js' not in html:
    if '</head>' not in html:
        raise SystemExit("Renpet HTML has no head section")
    html = html.replace('</head>', '<link rel="stylesheet" href="backup.css"><script type="module" src="backup.js"></script></head>', 1)
p.write_text(html, encoding="utf-8")
