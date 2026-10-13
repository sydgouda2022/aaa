#!/usr/bin/env python3
"""Prepare the Cloudflare D1 database for the single-calendar Worker.

Cloudflare credentials are read only from CI secrets. Token verification never
prints the token, credential values, or Cloudflare response bodies.
"""
import json
import os
from pathlib import Path
import re
from urllib import parse, request, error

DB_NAME = "ancient-egyptian-calendar"
ROOT = "https://api.cloudflare.com/client/v4"
account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()

if not re.fullmatch(r"[a-fA-F0-9]{32}", account):
    raise SystemExit("CLOUDFLARE_ACCOUNT_ID must be the 32-character Account ID.")
if not token:
    raise SystemExit("CLOUDFLARE_API_TOKEN is missing.")
if token.lower().startswith("bearer ") or token.lower().startswith("authorization:"):
    raise SystemExit("CLOUDFLARE_API_TOKEN must contain only the raw token, not 'Bearer' or 'Authorization:'.")
if token.startswith(("'", '"')) or token.endswith(("'", '"')):
    raise SystemExit("CLOUDFLARE_API_TOKEN must not include quotation marks.")
if any(ch.isspace() for ch in token):
    raise SystemExit("CLOUDFLARE_API_TOKEN contains whitespace. Paste the raw API Token value only.")

def request_api(url, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(url, data=data, method="POST" if data is not None else "GET",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        })
    try:
        with request.urlopen(req, timeout=45) as response:
            return response.status, json.load(response)
    except error.HTTPError as exc:
        # Print HTTP codes only; never response headers/bodies, which could
        # contain sensitive server-provided diagnostics.
        return exc.code, None

def verify_token():
    # A user-owned token may verify via /user; account-owned tokens via
    # /accounts/{account}/tokens/verify. Both forms are supported.
    endpoints = [
        ("user", ROOT + "/user/tokens/verify"),
        ("account", ROOT + f"/accounts/{account}/tokens/verify"),
    ]
    outcomes = []
    for label, endpoint in endpoints:
        code, result = request_api(endpoint)
        if code == 200 and isinstance(result, dict) and result.get("success"):
            status = result.get("result", {}).get("status", "unknown")
            if status == "active":
                print(f"Cloudflare API token verified: {label}-owned, active. Token value never logged.")
                return
            raise SystemExit(f"Cloudflare token is {status}. Renew or create an active API Token.")
        outcomes.append(f"{label} HTTP {code}")
    raise SystemExit(
        "Cloudflare rejected the API token verification (" + ", ".join(outcomes) + "). "
        "Check that the GitHub secret contains the *API Token value* (NOT a Global API Key, "
        "token ID, copied 'Bearer' prefix, or JSON). Verify the token in Cloudflare "
        "and confirm account ownership, validity and IP restrictions."
    )

verify_token()
base = ROOT + f"/accounts/{account}/d1/database"

def call(url, payload=None):
    code, result = request_api(url, payload)
    if code == 401:
        raise SystemExit(
            "Cloudflare HTTP 401 on D1 despite an active token. Ensure this token's "
            "Account Resources include the Account ID in CLOUDFLARE_ACCOUNT_ID. "
            "Check IP restrictions and reissue the token if necessary."
        )
    if code == 403:
        raise SystemExit(
            "Cloudflare HTTP 403 on D1: API Token is active but lacks D1 permissions "
            "on the selected account. Enable Account / D1 Edit (Write) and authorize "
            "the correct account. For creating the Worker also enable Workers Scripts Edit."
        )
    if code != 200 or not isinstance(result, dict):
        raise SystemExit(f"Cloudflare D1 API returned HTTP {code}; check account scope and service status.")
    if not result.get("success"):
        # Error codes are sufficient for troubleshooting and avoid disclosing
        # response text that could reflect user credentials.
        codes = [e.get("code") for e in result.get("errors", []) if isinstance(e, dict)]
        raise SystemExit(f"Cloudflare D1 API rejected request. Cloudflare error codes: {codes}")
    return result["result"]

items = call(base + "?" + parse.urlencode({"name": DB_NAME, "per_page": 10}))
found = [x for x in items if x.get("name") == DB_NAME]
if len(found) > 1:
    raise SystemExit("Multiple same-name D1 databases found; select manually.")
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
    raise SystemExit("D1 binding is missing from Wrangler configuration.")
config_path.write_text(config, encoding="utf-8")
print("Wrangler D1 binding configured in CI workspace; no account identifier is committed.")
