"""The sole user entry point: run main.py from the IDE. No Node required.

Run `main.py` from the IDE. The Documents library opens automatically. Production Cloudflare
Pages serves the output of tools/build_static.py without a Python server.
"""
from __future__ import annotations
import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import subprocess
import sys
import webbrowser
from threading import Timer

ROOT = Path(__file__).resolve().parent


def build() -> Path:
    # Import a complete, independently verified local publisher artifact if present.
    from tools.import_sqlite_lexicon import promote_authoritative_if_present
    # An existing verified publisher DB can be reused without relocating its
    # original bytes; this env var is optional and never silently downloads data.
    optional=os.environ.get('MDWNFR_LEXICON_SQLITE','').strip()
    if optional:
        from tools.import_sqlite_lexicon import validated_catalog, import_sqlite
        source=Path(optional).expanduser()
        meta=validated_catalog(source)
        if not meta['metadata']['complete']:
            raise ValueError('Provided lexicon is not a verified full publication')
        from tools.import_sqlite_lexicon import sha256_file, DEST
        current=DEST
        if (not current.is_file() or
            not __import__('json').loads(current.read_text()).get('metadata',{}).get('complete') or
            __import__('json').loads(current.read_text()).get('metadata',{}).get('input_sqlite_sha256') != sha256_file(source)):
            import_sqlite(source)
        print('[lexicon] Verified external publisher SQLite in use.',flush=True)
    else:
        # Safe, bounded discovery of publisher *data* in previously used local
        # project build directories. No disk crawl; no legacy code execution.
        from tools.recover_dictionary import ACTIVE, candidates, recover
        if not ACTIVE.is_file():
            for source in candidates([ROOT]):
                if source.resolve()==ACTIVE.resolve():continue
                try:
                    receipt=recover(source)
                except (ValueError,OSError) as exc:
                    print(f'[lexicon] Ignored unverified local candidate {source}: {exc}',flush=True)
                    continue
                print(f'[lexicon] Recovered verified local publication: '
                      f"{receipt['spelling_records']:,} spellings.",flush=True)
                break
        status=promote_authoritative_if_present()
        print('[lexicon]',status,flush=True)
        if status.startswith('Bundled development'):
            print('[lexicon] Pinned archives may be checked with main.py --inspect-sources '
                  'and acquired with --acquire-sources. '
                  'Source archives alone do NOT compile a full lexicon.',flush=True)
    subprocess.check_call([sys.executable,str(ROOT/'tools'/'build_static.py')])
    return ROOT/'dist'


def run() -> None:
    parser=argparse.ArgumentParser(description="MdwNfr Python 3.12 PWA")
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--build-only',action='store_true')
    parser.add_argument('--test',action='store_true')
    parser.add_argument('--verify-runtime-browser',action='store_true',help='Run true Pyodide + IndexedDB offline integration test')
    parser.add_argument('--check-runtime',action='store_true',help='Validate local offline PWA assets')
    parser.add_argument('--prepare-offline',action='store_true',help='Download pinned browser Python files and rebuild; requires Internet')
    parser.add_argument('--licensed-font',type=Path,help='Locally supplied licensed hieroglyph WOFF2 for --prepare-offline')
    parser.add_argument('--dictionary-status',action='store_true',help='Show installed dictionary/source readiness and compiler audit')
    parser.add_argument('--inspect-sources',action='store_true',help='Inspect pinned TLA/AED/AES/ORAEC archive cache')
    parser.add_argument('--acquire-sources',action='store_true',help='Download and verify pinned dictionary source archives')
    parser.add_argument('--compile-dictionary',action='store_true',help='Compile verified source archives to a diagnostic SQLite candidate')
    parser.add_argument('--publish-dictionary',action='store_true',help='Compile and install only a fully passing authoritative release')
    parser.add_argument('--bootstrap-dictionary',action='store_true',help='Acquire, compile, audit and install ONLY a fully verified full lexicon')
    args=parser.parse_args()
    if args.prepare_offline:
        from tools.vendor_runtime import vendor
        from tools.runtime_assets import inspect
        import json
        if args.licensed_font:
            from tools.prepare_font import install
            install(args.licensed_font)
        try:
            vendor()
            folder=build()
        except (OSError,ValueError) as exc:
            print('[offline] Preparation failed:',exc,file=sys.stderr,flush=True)
            raise SystemExit(1) from exc
        result=inspect()
        print(json.dumps(result,indent=2),flush=True)
        if not result['offline_ready']:
            print('[offline] Pyodide is prepared, but a licensed WOFF2 font is still required. '
                  'Install one with tools/prepare_font.py and rebuild.',flush=True)
        raise SystemExit(0 if result['offline_ready'] else 2)
    if args.licensed_font:
        parser.error('--licensed-font requires --prepare-offline')
    if args.verify_runtime_browser:
        from tools.browser_live_runtime import run as verify_browser
        verify_browser()
        return
    if args.dictionary_status:
        from tools.dictionary_status import status
        import json
        print(json.dumps(status(),indent=2,ensure_ascii=False),flush=True)
        return
    if args.bootstrap_dictionary:
        import json
        from tools.bootstrap_dictionary import bootstrap
        try:
            result=bootstrap()
            print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
        except (OSError,ValueError) as exc:
            print('[dictionary] Bootstrap failed safely:',exc,file=sys.stderr,flush=True)
            raise SystemExit(1) from exc
        raise SystemExit(0 if result['installed'] else 2)
    if args.compile_dictionary or args.publish_dictionary:
        import json
        from tools.compile_dictionary import compile_sources
        from tools.recover_dictionary import recover
        try:
            output=ROOT/'dictionary'/('compiled-release.sqlite3' if args.publish_dictionary else 'compiled-candidate.sqlite3')
            result=compile_sources(output=output,release=args.publish_dictionary)
            if args.publish_dictionary:
                receipt=recover(output)
                result['installed_spellings']=receipt['spelling_records']
            print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
        except (OSError,ValueError) as exc:
            print('[dictionary] Build not installed:',exc,file=sys.stderr,flush=True)
            raise SystemExit(1) from exc
        return
    if args.inspect_sources or args.acquire_sources:
        from tools.acquire_sources import cli
        raise SystemExit(cli(['--download' if args.acquire_sources else '--inspect']))
    if args.check_runtime:
        from tools.runtime_assets import inspect
        import json
        result=inspect()
        print(json.dumps(result,indent=2))
        raise SystemExit(0 if result['offline_ready'] else 1)
    if args.test:
        raise SystemExit(subprocess.call([sys.executable,'-m','unittest','discover','-s',str(ROOT/'tests'),'-v'],cwd=ROOT))
    folder=build()
    if args.build_only:return
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*a,**k):super().__init__(*a,directory=str(folder),**k)
        def end_headers(self):
            self.send_header('Cache-Control','no-cache')
            self.send_header('X-Content-Type-Options','nosniff')
            super().end_headers()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'MdwNfr development server: http://localhost:{args.port}',flush=True)
    print('Python 3.12 core runs in a browser worker; first load needs the pinned CDN unless Pyodide is vendored.',flush=True)
    # The only user launch path is IDE Run -> main.py -> browser Documents.
    browser=Timer(0.35,lambda: webbrowser.open(f'http://localhost:{args.port}/'))
    browser.daemon=True;browser.start()
    try: server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':run()
