#!/usr/bin/env python3
"""Prepare an idempotent Cloudflare D1 deployment in GitHub Actions.

Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the process
environment. Never commits account IDs or API tokens to the repository.
"""
import json
import os
from pathlib import Path
import re
from urllib import parse, request, error

DB_NAME = "ancient-egyptian-calendar"
account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
if not re.fullmatch(r"[a-fA-F0-9]{32}", account):
    raise SystemExit("CLOUDFLARE_ACCOUNT_ID is missing or invalid (32 hex characters expected).")
if not token:
    raise SystemExit("CLOUDFLARE_API_TOKEN is missing.")

base = f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database"

def call(url, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(
        url,
        data=data,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST" if data is not None else "GET",
    )
    try:
        with request.urlopen(req, timeout=45) as response:
            result = json.load(response)
    except error.HTTPError as exc:
        # Intentionally don't print request headers/tokens.
        raise SystemExit(f"Cloudflare API HTTP {exc.code}: check account ID and token permissions.") from exc
    if not result.get("success"):
        errors = result.get("errors", [])
        raise SystemExit(f"Cloudflare API rejected request: {errors}")
    return result["result"]

items = call(base + "?" + parse.urlencode({"name": DB_NAME, "per_page": 10}))
found = [x for x in items if x.get("name") == DB_NAME]
if len(found) > 1:
    raise SystemExit("Multiple same-name D1 databases found: select manually.")
if found:
    db = found[0]
    print("Reusing existing project D1 database.")
else:
    db = call(base, {"name": DB_NAME})
    print("Created project D1 database.")
uuid = str(db.get("uuid", ""))
if not re.fullmatch(r"[a-fA-F0-9-]{36}", uuid):
    raise SystemExit("Cloudflare did not return a valid D1 UUID.")

config_path = Path("worker/wrangler.toml")
config = config_path.read_text(encoding="utf-8")
config = re.sub(r'(?m)^database_id = "[^"]+"$', f'database_id = "{uuid}"', config)
if f'database_id = "{uuid}"' not in config:
    raise SystemExit("D1 binding is missing from the Wrangler configuration.")
config_path.write_text(config, encoding="utf-8")
print("Wrangler D1 binding configured in CI workspace (not committed).")
