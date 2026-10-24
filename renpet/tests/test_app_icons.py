"""Release checks for the Khepri scarab PWA icon family (stdlib only)."""
from __future__ import annotations

import json
import re
import struct
import zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'web'
ICON=WEB/'assets/khepri-scarab.svg'
BLUE=(4,69,141)
GOLD=(237,188,64)
EXPECTED={'favicon-32.png':32,'icon-180.png':180,'icon-192.png':192,
          'icon-512.png':512,'icon-maskable-512.png':512}


def pixels(path,required):
    data=path.read_bytes()
    assert data.startswith(b'\x89PNG\r\n\x1a\n'),path
    ptr=8
    chunks={}
    while ptr<len(data):
        length=struct.unpack('>I',data[ptr:ptr+4])[0]
        name=data[ptr+4:ptr+8]
        value=data[ptr+8:ptr+8+length]
        assert zlib.crc32(name+value)==struct.unpack('>I',data[ptr+8+length:ptr+12+length])[0]
        chunks.setdefault(name,[]).append(value)
        ptr+=12+length
    w,h,depth,color,_,_,_=struct.unpack('>IIBBBBB',chunks[b'IHDR'][0])
    assert (w,h,depth,color)==(required,required,8,2),(path,w,h,depth,color)
    raw=zlib.decompress(b''.join(chunks[b'IDAT']))
    assert len(raw)==required*(1+required*3)
    result=[]
    for y in range(required):
        row=raw[y*(1+3*required):(y+1)*(1+3*required)]
        assert row[0]==0,'Unexpected PNG predictor'
        result.append([tuple(row[1+x*3:1+x*3+3]) for x in range(required)])
    return result


def main():
    source=ICON.read_text(encoding='utf-8')
    assert re.search(r'fill="#04458D"',source)
    assert re.search(r'fill="#EDBC40"',source)
    assert 'gradient' not in source.lower() and 'filter=' not in source
    manifest=json.loads((WEB/'manifest.webmanifest').read_text())
    for entry in manifest['icons']:
        src=entry['src'].split('?')[0]
        assert (WEB/src).is_file(),src
    assert any('maskable' in x['purpose'] and 'maskable-512' in x['src'] for x in manifest['icons'])
    html=(WEB/'index.html').read_text()
    assert 'apple-touch-icon' in html and 'khepri-scarab.svg' in html
    for name,dimension in EXPECTED.items():
        im=pixels(WEB/'assets'/name,dimension)
        assert im[0][0]==BLUE and im[-1][-1]==BLUE,'No white corners: '+name
        # The disk and beetle remain distinct gold figures.
        assert im[round(dimension*.2)][dimension//2]==GOLD,'Missing solar disk: '+name
        assert im[round(dimension*.7)][dimension//2]==GOLD,'Missing beetle: '+name
        gold=sum(1 for row in im for r,g,b in row if r>180 and 105<g<215 and b<100)
        assert gold>dimension*dimension*.07,('Unrecognizable icon',name,gold)
        if 'maskable' in name:
            points=[(x,y) for y,row in enumerate(im) for x,(r,g,b) in enumerate(row) if r>180 and b<100]
            assert min(x for x,y in points)>dimension*.18
            assert max(x for x,y in points)<dimension*.82
            assert min(y for x,y in points)>dimension*.15
            assert max(y for x,y in points)<dimension*.85
    print('Khepri SVG, iOS, Android, maskable and browser icons verified')


if __name__=='__main__':
    main()
