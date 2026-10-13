"""Regenerate compact Egyptian numeral SVGs from bundled OFL Noto glyph outlines."""
from pathlib import Path
from math import ceil
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT=Path(__file__).resolve().parents[1]
font=TTFont(ROOT/'web/assets/fonts/Egyptian.ttf')
glyphs=font.getGlyphSet(); cmap=font.getBestCmap()
signs={}
for value,sign in [(1000,'𓆼'),(100,'𓍢'),(10,'𓎆'),(1,'𓏺')]:
    glyph=glyphs[cmap[ord(sign)]]
    path=SVGPathPen(glyphs); glyph.draw(path)
    bounds=BoundsPen(glyphs); glyph.draw(bounds)
    signs[value]=(path.getCommands(),bounds.bounds)

def svg(n):
    groups=[]; remaining=n; cursor=2; maxheight=0
    for value in signs:
        count,remaining=divmod(remaining,value)
        if not count: continue
        path,(xmin,ymin,xmax,ymax)=signs[value]
        h=20; scale=h/(ymax-ymin); w=(xmax-xmin)*scale
        cols=min(count,3); rows=ceil(count/cols); gap=2
        width=cols*w+(cols-1)*gap; height=rows*h+(rows-1)*gap
        maxheight=max(maxheight,height); parts=[]
        for i in range(count):
            x=cursor+(i%cols)*(w+gap); y=2+(i//cols)*(h+gap)
            parts.append(f'<path transform="translate({x-xmin*scale:.3f} {y+ymax*scale:.3f}) scale({scale:.6f} {-scale:.6f})" d="{path}"/>')
        groups.append(''.join(parts)); cursor+=width+4
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cursor:.3f} {maxheight+4:.3f}" fill="currentColor">'+''.join(groups)+'</svg>'

if __name__=='__main__':
    out=ROOT/'web/assets/numerals'; out.mkdir(parents=True,exist_ok=True)
    # The bundled calendar data covers Egyptian years 6155 through 6457.
    for n in [*range(1,31),*range(6155,6458)]:
        (out/f'{n}.svg').write_text(svg(n),encoding='utf-8')
    print('Created',len(list(out.glob('*.svg'))),'Egyptian numeral SVG assets.')
