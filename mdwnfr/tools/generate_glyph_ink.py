"""Build exact visible-glyph bounds from the one Noto font shipped with MdwNfr."""
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

FONT_SHA256='ad50e535500acc88b9582c648cc84ca9a4679c1810a426aa85b7ba8bada8af15'

def build(font_path:Path,output:Path)->None:
    data=font_path.read_bytes()
    digest=hashlib.sha256(data).hexdigest()
    if digest!=FONT_SHA256:
        raise ValueError('The Egyptian glyph font differs from the verified master')
    font=TTFont(font_path)
    upm=font['head'].unitsPerEm
    cmap=font.getBestCmap()
    outlines=font.getGlyphSet()
    entries={}
    for cp in range(0x13000,0x13430):
        glyph=cmap.get(cp)
        if glyph is None:continue
        pen=BoundsPen(outlines)
        outlines[glyph].draw(pen)
        if not pen.bounds:continue
        x0,y0,x1,y1=pen.bounds
        if x1<=x0 or y1<=y0:continue
        entries[chr(cp)]=[round(x/upm,6) for x in (x0,y0,x1,y1)]
    if len(entries)!=1071:
        raise ValueError(f'Expected 1,071 actual hieroglyphic outlines, found {len(entries)}')
    payload={'format':'mdwnfr-glyph-ink-v1','font_sha256':digest,
             'em_units':upm,'glyphs':entries}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(payload,ensure_ascii=False,
        sort_keys=True,separators=(',',':')),encoding='utf-8')
    print(f'Installed {len(entries)} verified visible-glyph bounds')

if __name__=='__main__':
    build(Path(sys.argv[1]),Path(sys.argv[2]))
