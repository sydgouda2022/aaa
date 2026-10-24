"""Publish a compiled full-TEI Coptic runtime snapshot and its checksum manifest.

Must never describe a bounded source inventory as historically exhaustive.
"""
import argparse
import hashlib
import json
from pathlib import Path


def publish(directory):
    d=Path(directory)
    original=(d/'lexicon.json').read_bytes()
    pack=json.loads(original)
    rows=pack.get('rows',[])
    if pack.get('format')!='coptic-predict-v1' or pack.get('language')!='cop' or not rows or pack.get('dialects')!=['Sahidic','Bohairic']:
        raise ValueError('Not a Coptic source-compiled release')
    if pack['metadata'].get('spelling_records')!=len(rows) or pack['metadata'].get('complete') is not False:
        raise ValueError('Invalid coverage metadata')
    if not (d/'lexicon.sqlite3').exists():
        raise ValueError('No canonical SQLite master')
    sha=hashlib.sha256(original).hexdigest()
    result={'format':'coptic-lexicon-install-v1','language':'cop',
        'dialects':['Sahidic','Bohairic'],
        'release':'coptic-expanded-'+sha[:16],
        'bytes':len(original),'sha256':sha,
        'spelling_records':len(rows),'complete':False}
    (d/'manifest.json').write_text(json.dumps(result,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    print(json.dumps(publish(args.out),sort_keys=True))
