"""Static checks for Renpet's offline startup contract."""
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1] / "web"
s = (root / "sw.js").read_text(encoding="utf-8")
html = (root / "index.html").read_text(encoding="utf-8")
version = json.loads((root / "data.json").read_text(encoding="utf-8"))["version"]
assert f"renpet-{version}-" in s, "Wrong installed cache version"
assert f"app.js?v={version}" in html, "Wrong module version"
assert "cache.match(event.request, {ignoreSearch: true})" in s, "Versioned JS/CSS must work offline"
assert "await cache.match('./index.html')" in s, "Offline navigation requires the cached shell"
assert "await cache.addAll(ASSETS)" in s, "Offline boot graph needs an atomic install"
assert "new Set([CACHE, ...older.slice(-1)])" in s, "Do not purge an active previous app cache"
assert "RenpetBoot" in html and "renpet-startup-failed" in html, "Startup watchdog/retry absent"
assert "getRegistrations()" in html, "Safe service-worker-only repair unavailable"
assert "localStorage.clear" not in html and "caches.delete" not in html, "Startup repair must preserve user data"
import base64, hashlib, re
inline = re.findall(r"<script>([\\s\\S]*?)</script>", html)
assert len(inline) == 1
digest = base64.b64encode(hashlib.sha256(inline[0].encode('utf-8')).digest()).decode('ascii')
headers = (root / '_headers').read_text(encoding='utf-8')
assert "script-src 'self' 'sha256-" + digest + "';" in headers, "CSP would block startup watchdog"
assert "script-src 'self' 'unsafe-inline'" not in headers, "Do not weaken script CSP"
print("Renpet offline query handling, boot recovery and safe update rules verified")
