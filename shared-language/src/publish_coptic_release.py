"""Publish a pinned native-script Coptic lexicon from Renpet's verified offline source files.

The public payload contains merged written forms and ranking hints, not original source corpora.
Preserves Sahidic/Bohairic membership and prevents invented dialect assignments.
"""
import argparse
import hashlib
import json
from pathlib import Path

def _native(form):
    return isinstance(form,str) and bool(form) and any(
        0x2c80 <= ord(c) <= 0x2cff or 0x03e2 <= ord(c) <= 0x03ef or
        0x0370 <= ord(c) <= 0x03ff or 0x1f00 <= ord(c) <= 0x1fff for c in form
    )

def publish(coptic: Path, popular: Path, destination: Path):
    first = Path(coptic).read_bytes()
    second = Path(popular).read_bytes()
    base = json.loads(first)
    extra = json.loads(second)
    if base.get('schema') != 1 or base.get('dialects') != ['Sahidic','Bohairic'] or extra.get('schema') != 1:
        raise ValueError('Unrecognized source pack or dialect inventory')
    forms = {}
    for item in base['rows']:
        if not isinstance(item,list) or len(item)!=2:
            raise ValueError('Bad source word row')
        word, mask = item
        if not _native(word) or type(mask) is not int or mask not in (1,2,3):
            raise ValueError('Invalid source written form or dialect mask')
        forms[word] = forms.get(word, 0) | mask
    counts = {}
    for item in extra['rows']:
        if not isinstance(item,list) or len(item)!=2:
            raise ValueError('Bad frequency record')
        word, count = item
        if not _native(word) or type(count) is not int or count < 0:
            raise ValueError('Invalid frequency or written form')
        forms.setdefault(word, 0)  # Unassigned dialect is NOT inferred.
        counts[word] = max(counts.get(word, 0), count)
    if len(forms) < 10000 or not any(x == 1 for x in forms.values()) or not any(x == 2 for x in forms.values()):
        raise ValueError('Source catalog is incomplete or lost dialect assignments')
    rows = [[word, mask] for word, mask in sorted(forms.items())]
    payload = {
        'format': 'coptic-predict-v1', 'language':'cop',
        'dialects':['Sahidic','Bohairic'],
        'rows':rows, 'popularity':{k:counts[k] for k in sorted(counts)},
        'metadata':{
            'spelling_records':len(rows), 'complete':False,
            'source_editions':[
                {'label':base.get('source'), 'revision':base.get('revision'), 'sha256':hashlib.sha256(first).hexdigest()},
                {'label':extra.get('source'), 'revision':extra.get('revision'), 'sha256':hashlib.sha256(second).hexdigest()}
            ]
        }
    }
    encoded=(json.dumps(payload,sort_keys=True,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8')
    digest=hashlib.sha256(encoded).hexdigest()
    manifest={'format':'coptic-lexicon-install-v1','language':'cop',
              'dialects':['Sahidic','Bohairic'],
              'release':'coptic-development-'+digest[:16],
              'bytes':len(encoded),'sha256':digest,
              'spelling_records':len(rows),'complete':False}
    dest=Path(destination)
    dest.mkdir(parents=True,exist_ok=True)
    (dest/'lexicon.json').write_bytes(encoded)
    (dest/'manifest.json').write_text(json.dumps(manifest,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')
    return manifest

if __name__ == '__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--coptic',type=Path,required=True)
    p.add_argument('--popular',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    print(json.dumps(publish(args.coptic,args.popular,args.out),sort_keys=True))
