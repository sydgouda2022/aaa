"""Install the working day/week/month/list views after the legacy UI bundle."""
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"web"/"index.html"
html=p.read_text(encoding="utf-8")
if 'views.js' not in html:
    if '</head>' not in html: raise SystemExit('Renpet index missing head')
    html=html.replace('</head>','<link rel="stylesheet" href="views.css"><script type="module" src="views.js"></script></head>',1)
p.write_text(html,encoding="utf-8")
