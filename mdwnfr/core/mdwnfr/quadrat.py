"""Silhouette-first, deterministic hieroglyphic column composition.

The document fixes ONE column width. Glyph proportions and bearings come from
the actual outlines of the same verified font served to the browser. The
horizontal gaps around ink silhouettes equal half their visible widths.
Vertical gaps equal half each neighboring row's tallest silhouette height.
The full row's height is determined by its tallest sign. No distortion.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from functools import lru_cache
from pathlib import Path
from typing import Mapping
import json, math

DATA_PATH=Path(__file__).resolve().parent/'data'/'glyph_geometry.json'
NARROW_RATIO=.65
PAIR_HEIGHT_PARITY=.60


@dataclass(frozen=True)
class SignBox:
    sign:str
    x:float
    y:float
    width:float
    height:float
    font_size:float
    text_x:float
    text_y:float


@dataclass(frozen=True)
class Quadrat:
    width:float
    height:float
    signs:tuple[SignBox,...]
    rows:tuple[tuple[int,...],...]
    flexible_gaps:tuple[float,...]

    def payload(self)->dict:
        return {'width':self.width,'height':self.height,
                'signs':[asdict(s) for s in self.signs],
                'rows':[list(row) for row in self.rows],
                'flexible_gaps':list(self.flexible_gaps)}


@lru_cache(maxsize=1)
def _catalogue()->tuple[dict,dict]:
    source=json.loads(DATA_PATH.read_text(encoding='utf-8'))
    glyphs=source.get('glyphs',{})
    scans=source.get('scanlines',{})
    resolution=source.get('resolution')
    if (source.get('format')!='mdwnfr-glyph-ink-v2' or
        len(glyphs)!=1072 or set(scans)!=set(glyphs) or resolution!=64):
        raise ValueError('Verified two-dimensional Egyptian glyph silhouettes are missing')
    for sign,bounds in glyphs.items():
        if (len(sign)!=1 or len(bounds)!=4 or
            not all(isinstance(v,(int,float)) and math.isfinite(v) for v in bounds) or
            bounds[2]<=bounds[0] or bounds[3]<=bounds[1]):
            raise ValueError('Invalid Egyptian glyph outline')
        rows=scans[sign]
        if not isinstance(rows,list) or len(rows)!=resolution:
            raise ValueError('Invalid glyph ink scan length')
        valid_rows=0
        for row in rows:
            if row is None:continue
            if (not isinstance(row,list) or len(row)!=2 or
                any(type(v) is not int for v in row) or
                not 0<=row[0]<row[1]<=resolution):
                raise ValueError('Invalid glyph silhouette scan')
            valid_rows+=1
        if not valid_rows:raise ValueError('Empty glyph silhouette')
    return glyphs,scans


def glyph_geometry()->dict:
    return _catalogue()[0]


def glyph_scanlines()->dict:
    return _catalogue()[1]


def _silhouette_advance(left:list,right:list,w_left:float,h_left:float,
                        w_right:float,h_right:float)->float:
    """Nearest facing ink edges at the SAME vertical position, not rectangles.

    The quarter-sum-width gap is retained between visible ink contours.
    The rounding allowance bounds raster error. Never move glyphs farther
    apart than the original bounding-box spacing.
    """
    gap=(w_left+w_right)/4
    high=max(h_left,h_right)
    max_facing=None
    for step in range(128):
        y=(step+.5)*high/128
        l_y=y-(high-h_left)/2
        r_y=y-(high-h_right)/2
        if not(0<=l_y<h_left and 0<=r_y<h_right):continue
        l=left[min(63,int(l_y/h_left*64))]
        r=right[min(63,int(r_y/h_right*64))]
        if l is None or r is None:continue
        facing=l[1]*w_left/64-r[0]*w_right/64
        max_facing=facing if max_facing is None else max(max_facing,facing)
    if max_facing is None:
        return w_left+gap
    return min(w_left+gap,max_facing+gap+max(w_left,w_right)/64)


def _shape_ratio(sign:str,glyph_metrics:Mapping[str,object]|None=None)->float:
    bounds=glyph_geometry().get(sign)
    if bounds is None:
        raise ValueError('This sign has no outline in the installed hieroglyphic font')
    if glyph_metrics and sign in glyph_metrics:
        source=glyph_metrics[sign]
        if isinstance(source,dict):
            ratio=float(source['width'])/float(source['height'])
        else:
            ratio=float(source)
        if not math.isfinite(ratio) or ratio<=0:
            raise ValueError('Invalid requested glyph ratio')
        return ratio
    return (bounds[2]-bounds[0])/(bounds[3]-bounds[1])


def compose(signs:list[str],column_width:float,
            glyph_metrics:Mapping[str,object]|None=None)->Quadrat:
    if (not signs or not isinstance(column_width,(int,float)) or
        not math.isfinite(column_width) or column_width<=0):
        raise ValueError('Nonempty signs and positive finite column width required')
    width=float(column_width)
    bounds=glyph_geometry()
    ink_scans=glyph_scanlines()
    ratios=[_shape_ratio(s,glyph_metrics) for s in signs]

    # A single ink silhouette occupies up to C/2 width. If two slender signs
    # share a row, each has up to 2C/7 width. The actual silhouette can be
    # narrower because no glyph may become taller than C. The unused width is
    # centered column slack, not a distorted or artificially wider character.
    def dimensions(ratio:float,limit:float)->tuple[float,float]:
        h=min(width,limit/ratio)
        return ratio*h,h

    @lru_cache(maxsize=None)
    def choose(index:int)->tuple[float,tuple[tuple[int,...],...]]:
        if index==len(signs):return 0.0,()
        _,single_h=dimensions(ratios[index],width/2)
        rest,candidate=choose(index+1)
        choices=[(single_h+rest,((index,),)+candidate)]
        if (index+1<len(signs) and ratios[index]<=NARROW_RATIO and
            ratios[index+1]<=NARROW_RATIO):
            h1=dimensions(ratios[index],2*width/7)[1]
            h2=dimensions(ratios[index+1],2*width/7)[1]
            if min(h1,h2)/max(h1,h2)>=PAIR_HEIGHT_PARITY:
                rest,candidate=choose(index+2)
                choices.append((max(h1,h2)+rest,((index,index+1),)+candidate))
        return min(choices,key=lambda choice:choice[0])

    rows=choose(0)[1]
    heights=[max(dimensions(ratios[i],width/2 if len(row)==1 else
                            2*width/7)[1] for i in row) for row in rows]
    gaps=[heights[0]/2]
    gaps.extend((left+right)/2 for left,right in zip(heights,heights[1:]))
    gaps.append(heights[-1]/2)
    placed=[None]*len(signs)
    y=gaps[0]
    for row_number,row in enumerate(rows):
        row_height=heights[row_number]
        limit=width/2 if len(row)==1 else 2*width/7
        dims=[dimensions(ratios[i],limit) for i in row]
        if len(row)==1:
            w=dims[0][0]
            # Local left/right clearance is w/2. Distribute additional slack.
            xs=[(width-2*w)/2+w/2]
        else:
            w1,w2=dims[0][0],dims[1][0]
            advance=_silhouette_advance(ink_scans[signs[row[0]]],
                                        ink_scans[signs[row[1]]],
                                        w1,dims[0][1],w2,dims[1][1])
            # Left and right external clearances are half their respective
            # ink widths; unused column slack is distributed symmetrically.
            occupied=w1/2+advance+w2+w2/2
            slack=max(0.0,width-occupied)/2
            xs=[slack+w1/2,slack+w1/2+advance]
        for (w,h),x,index in zip(dims,xs,row):
            ink_y=y+(row_height-h)/2
            left,bottom,right,top=bounds[signs[index]]
            em=h/(top-bottom)
            placed[index]=SignBox(signs[index],x,ink_y,w,h,em,
                                  x-left*em,ink_y+top*em)
        if row_number+1<len(rows):
            y+=row_height+gaps[row_number+1]

    # Half-height outer margins plus mean adjacent-row heights produce
    # precisely twice the sum of the row's ink heights.
    return Quadrat(width,2*sum(heights),tuple(placed),tuple(rows),tuple(gaps))


def expand_internal(quadrat:Quadrat,additional_height:float)->Quadrat:
    """Distribute column justification through whitespace only; do not scale ink."""
    if additional_height<=0:return quadrat
    gaps=quadrat.flexible_gaps
    total=sum(gaps)
    if total<=0:return quadrat
    additions=[additional_height*g/total for g in gaps]
    revised=[None]*len(quadrat.signs)
    for row_number,indices in enumerate(quadrat.rows):
        delta=sum(additions[:row_number+1])
        for index in indices:
            sign=quadrat.signs[index]
            revised[index]=SignBox(sign.sign,sign.x,sign.y+delta,
                                  sign.width,sign.height,sign.font_size,
                                  sign.text_x,sign.text_y+delta)
    return Quadrat(quadrat.width,quadrat.height+additional_height,
                   tuple(revised),quadrat.rows,
                   tuple(g+a for g,a in zip(gaps,additions)))
