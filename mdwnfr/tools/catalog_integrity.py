"""Release gate for browser prediction data and its verified import receipt.

Checksum receipts attest that the catalog was not edited since the import. They
are not digital signatures and never replace source-SQLite validation on import.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path


def validate_release_catalog(raw:bytes, receipt_path:Path)->dict:
    data=json.loads(raw)
    if data.get('format')!='mdwnfr-predict-v1' or not isinstance(data.get('entries'),list) or not data['entries']:
        raise ValueError('Invalid packaged lexicon')
    meta=data.get('metadata')
    if not isinstance(meta,dict) or len(data['entries'])!=meta.get('spelling_records'):
        raise ValueError('Packaged lexicon spelling count mismatch')
    if meta.get('complete') is True:
        if not receipt_path.is_file():
            raise ValueError('Full lexicon requires verified import receipt')
        receipt=json.loads(receipt_path.read_text(encoding='utf-8'))
        if (receipt.get('format')!='mdwnfr-import-receipt-v1' or
            receipt.get('catalog_sha256')!=hashlib.sha256(raw).hexdigest() or
            not meta.get('input_sqlite_sha256') or
            receipt.get('input_sqlite_sha256')!=meta['input_sqlite_sha256'] or
            # The complete-release count policy must not be bypassed by just
            # hand-editing `complete: true` and recomputing a weak receipt.
            meta.get('forms')!=44980 or meta.get('spelling_records')!=123939 or
            meta.get('source_references')!=910176 or
            not meta.get('source_fingerprint_sha256')):
            raise ValueError('Full lexicon import receipt, release counts or catalog has changed')
    return data
