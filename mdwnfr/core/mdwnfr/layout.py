"""Deterministic word-column layout with revision-safe incremental reuse.

All geometry, including full and incremental layout, flows through ONE engine.
Only *completed* columns can be reused; a final unfinished column must be
reflowed when subsequent words are appended. No page coordinates are document
data. Clip art uses alpha-silhouette clearance with reusable vertical text sectors.
"""
from __future__ import annotations

from copy import deepcopy
from collections import deque
from functools import lru_cache
from math import ceil
from .document import SURFACES, assert_document, DocumentError, artwork_catalog, validated_margins
from .quadrat import compose, expand_internal, _shape_ratio
from .silhouette import free_sectors, solid_object_mask, cartouche_object_mask, silhouettes_collide
from .tables import typeset_table, paginate_table, TableError
from .cartouches import typeset_cartouche, CartoucheError
from .typography import divider_stroke_mm

MARGIN_MM = 18.0
PT_TO_MM = 25.4 / 72.0
LAYOUT_PARAMETERS = ('id', 'direction', 'surface', 'font_size_pt', 'papyrus_height_mm', 'margins_mm')


def object_clearance_mm(column_width: float) -> float:
    """One whole current-font quadrat of breathing room around every object.

    The same physical distance applies to normal text, floated text, tables,
    cartouches, raster images, and decorative dividers. It is not a percent of
    object width or a static screen-pixel padding.
    """
    return column_width


def proportional_extra(heights: list[float], remainder: float) -> list[float]:
    """One universal allocation law for page and object-bounded text sectors.

    Each *quadrat box*, not its visible glyph, receives an increment weighted
    by its ORIGINAL height. Any between-word gap is already reserved before
    calling this function and stays constant.
    """
    total = sum(heights)
    if remainder <= 0 or total <= 0:
        return [0.0] * len(heights)
    return [remainder * height / total for height in heights]


def column_width_mm(font_size_pt: float) -> float:
    return float(font_size_pt) * PT_TO_MM * 2.0


def _art_x(column_x: float, column_width: float, image_width: float,
           owner: dict, direction: str, offset_override: float | None = None) -> float:
    """Page-local position, derived from the logical anchor and facing direction.

    A positive offset lets the object float *forward* in reading order across
    arbitrarily many adjacent slots. It does not store a page coordinate.
    Pre-0.1.17 art uses the old within-band x_align exactly.
    """
    column_x = round(column_x, 5)
    requested = (owner.get('x_offset_mm', 0.0) if offset_override is None
                 else offset_override)
    if requested < 0:
        # Artwork floats backwards from the beginning of its normal band.
        # The compositor has already cleared all affected predecessor slots.
        return round(column_x - abs(requested) if direction == 'ltr'
                     else column_x + column_width - image_width + abs(requested), 5)
    lead = min(requested, max(0.0,column_width-image_width))
    if lead > 0:
        return round(column_x + (column_width - image_width - lead
                       if direction == 'rtl' else lead), 5)
    return round(column_x + (column_width-image_width)*owner.get('x_align',0.0 if owner.get('type') in ('table','cartouche') else 0.5), 5)


def _physical_auto_flip(owner: dict, physical_x: float, page_w: float,
                        direction: str, papyrus: bool = False) -> str:
    """Resolve visual facing ONCE in the Python layout, not in the renderer.

    This same result is used for 2D mask intersection and painted artwork.
    Papyrus has no fixed right edge; its center follows document direction.
    """
    if owner['flip']!='auto':return owner['flip']
    if owner['type']=='image':natural='left'
    else:natural=artwork_catalog()[owner['artwork_id']]['native_facing']
    if natural=='neutral':return 'normal'
    if papyrus:inward='left' if direction=='rtl' else 'right'
    else:
        inward=('right' if physical_x<page_w/3 else
                'left' if physical_x>page_w*2/3 else
                ('left' if direction=='rtl' else 'right'))
    return 'normal' if natural==inward else 'mirror'


def _logical_auto_flip(owner:dict, logical_x:float, image_w:float,
                       page_w:float, margins:dict, direction:str, papyrus:bool) -> str:
    physical_x=(margins['left']+logical_x if direction=='ltr' else
                page_w-margins['right']-logical_x-image_w)
    return _physical_auto_flip(owner,physical_x,page_w,direction,papyrus)


@lru_cache(maxsize=32768)
def _cached_quadrat(spelling: tuple[str, ...], width: float,
                    ratios: tuple[float, ...]):
    # Using normalized outline ratios in the key means a font metric change
    # cannot reuse stale sign geometry. Quadrat is an immutable dataclass.
    return compose(list(spelling), width, dict(zip(spelling, ratios)))


def _item_signature(item: dict) -> dict:
    # Full equality also tracks color/bold; these only impact the affected
    # column's presentation, not its natural composition height.
    return item


def _flatten_columns(layout: dict) -> list[dict]:
    return [col for page in layout['pages'] for col in page['columns']]


def _placement_id(placement) -> str:
    return placement['id'] if isinstance(placement, dict) else placement[0]


def _seed_from_column(col: dict) -> dict:
    # Share untouched nested sign geometry (read-only by contract). Create fresh
    # placement dictionaries because x changes during page packing.
    # A compact placement is an immutable 4-tuple, not a materialized sign tree.
    # Only the outer list must be copied: no geometry within it can be mutated.
    return {'placements': [({k: v for k, v in placement.items() if k != 'x'}
                            if isinstance(placement, dict) else placement)
                           for placement in col['placements']],
            'text_top': col['text_top'], 'text_bottom': col['text_bottom'],
            'span':col.get('span', 1), 'kind':col.get('kind', 'words'),
            **({'table_fragment_index':col['table_fragment_index']} if 'table_fragment_index' in col else {}),
            **({'break_before':True} if col.get('break_before') else {}),
            **({'slot_offset':col['slot_offset'],'slot_width':col['slot_width']}
               if 'slot_offset' in col else {}),
            **({'float_offset':col['float_offset']} if 'float_offset' in col else {})}


def _pack_pages(doc: dict, columns: list[dict], width: float, page_width: float,
                page_height: float, page_capacity: int | None,
                compact: bool = False, nested_masks: dict | None = None) -> list[dict]:
    margins = validated_margins(doc)
    # Column slots are the same width as a text column. A clip-art object
    # reserves an integral number of slots so it cannot overlap text; it
    # remains one logical item and one selectable object in the document.
    page_chunks: list[list[dict]] = []
    if page_capacity is None:
        page_chunks = [columns]
    else:
        chunk: list[dict] = []
        occupied = 0
        for seed in columns:
            span = seed.get('span', 1)
            if chunk and (seed.get('break_before') or occupied + span > page_capacity):
                page_chunks.append(chunk)
                chunk, occupied = [], 0
            chunk.append(seed)
            occupied += span
        if chunk:
            page_chunks.append(chunk)
    if not page_chunks:
        page_chunks = [[]]
    pages: list[dict] = []
    clipart_by_id={o['id']:o for o in doc['items'] if o['type'] in ('clipart','image')}
    nested_by_id={o['id']:o for o in doc['items'] if o['type'] in ('table','cartouche')}
    nested_masks=nested_masks or {}
    for chunk in page_chunks:
        occupied = sum(seed.get('span', 1) for seed in chunk)
        page_w = margins['left'] + margins['right'] + occupied * width if page_capacity is None else page_width
        positioned: list[dict] = []
        slot = 0
        for ci, seed in enumerate(chunk):
            span = seed.get('span', 1)
            used_slots = seed.get('slot_width', span)
            effective_slot = slot + seed.get('slot_offset', 0)
            col_width = used_slots * width
            x = (page_w-margins['right']-(effective_slot+used_slots)*width if doc['direction'] == 'rtl'
                 else margins['left']+effective_slot*width)
            placements = seed['placements'] if compact else []
            if not compact:
                for placement in seed['placements']:
                    if placement['type'] in ('table','cartouche'):
                        owner=nested_by_id[placement['id']]
                        ox=_art_x(x,col_width,placement['width_mm'],owner,
                                  doc['direction'],seed.get('float_offset'))
                        placements.append({**placement,'x':ox})
                    elif placement['type'] in ('clipart','image'):
                        owner=clipart_by_id[placement['id']]
                        px=_art_x(x,col_width,placement['width_mm'],owner,
                                  doc['direction'],seed.get('float_offset'))
                        placements.append({**placement,'x':px,
                           'resolved_flip':_physical_auto_flip(owner,px,page_w,
                              doc['direction'],page_capacity is None)})
                    else:
                        placements.append({**placement,'x':round(x,5)})
            positioned.append({'placements':placements,
                               'text_top':seed['text_top'], 'text_bottom':seed['text_bottom'],
                               'kind':seed.get('kind','words'), 'span':span,
                               **({'table_fragment_index':seed['table_fragment_index']} if 'table_fragment_index' in seed else {}),
                               'x':round(x,5), 'width':col_width,'index':ci,
                               **({'slot_offset':seed['slot_offset'],'slot_width':used_slots}
                                  if 'slot_offset' in seed else {}),
                               **({'float_offset':seed['float_offset']}
                                  if 'float_offset' in seed else {})})
            slot += span
        # Lines are derived decoration, never inputs to text geometry.
        # They stop one current-sign-width before a visible artwork contour
        # and resume in the next unobstructed vertical sector.
        artworks=[]
        for col in positioned:
            if col['kind']=='clipart' and col['placements']:
                art=col['placements'][0]
                if isinstance(art,dict): artworks.append({**art, 'flip':art['resolved_flip'], 'bands':clipart_by_id[art['id']].get('bands'), 'mask':clipart_by_id[art['id']].get('mask')})
                else:
                    ident, ay, ah, aw=art
                    obj=clipart_by_id[ident]
                    artworks.append({'id':ident,'artwork_id':obj.get('artwork_id'), 'bands':obj.get('bands'),'mask':obj.get('mask'),
                      'flip':_physical_auto_flip(obj,_art_x(col['x'],col['width'],aw,obj,doc['direction'],col.get('float_offset')),page_w,doc['direction'],page_capacity is None),'y':ay,'height':ah,
                      'width_mm':aw,'x':_art_x(col['x'],col['width'],aw,obj,doc['direction'],
                                               col.get('float_offset'))})
            elif col['kind'] in ('table','cartouche') and col['placements']:
                pos=col['placements'][0]
                if isinstance(pos,dict):
                    artworks.append({'id':pos['id'],'mask':nested_masks.get(pos['id']),
                      'width_mm':pos['width_mm'],'height':pos['height'],
                      'x':pos['x'],'y':pos['y'],'flip':'normal'})
                else:
                    ident,oy,oh,ow=pos
                    owner=nested_by_id[ident]
                    artworks.append({'id':ident,'mask':nested_masks.get(ident),
                      'width_mm':ow,'height':oh,
                      'x':_art_x(col['x'],col['width'],ow,owner,doc['direction'],col.get('float_offset')),
                      'y':oy,'flip':'normal'})
        dividers=[]
        # Shared typography design metric: 3 nominal glyph stems, each
        # proportional to the document's universal font size. Lines remain
        # derived decoration and never change quadrat geometry.
        divider_thickness = divider_stroke_mm(doc['font_size_pt'])
        for ci in range(1,len(positioned)):
            a,b=positioned[ci-1],positioned[ci]
            if a['kind']!='words' or b['kind']!='words':continue
            # Overlaid columns may share a boundary with a previous column;
            # never emit the same line twice or draw inside a word column.
            if abs(a['x']-b['x'])<width*0.5:continue
            y1=max(a['text_top'],b['text_top'])
            y2=min(a['text_bottom'],b['text_bottom'])
            if y2<=y1+1e-8:continue
            x=max(a['x'],b['x'])
            spans=[(y1,y2)]
            for art in artworks:
                remaining=[]
                for top,bottom in spans:
                    clear=free_sectors(art.get('artwork_id'), bands=art.get('bands'), mask=art.get('mask'), image_width=art['width_mm'],
                         image_height=art['height'],x_offset=art['x'],
                         slot_left=x-0.0001,slot_right=x+0.0001,
                         top=top,bottom=bottom,clearance=width,
                         flip=art['flip'],image_top=art['y'])
                    remaining.extend(clear)
                spans=remaining
                if not spans:break
            for top,bottom in spans:
                if bottom>top+1e-6:
                    dividers.append({'x':round(x,5),'y1':round(top,5),
                                     'y2':round(bottom,5),
                                     'thickness_mm':divider_thickness})
        pages.append({'index':len(pages),'width':page_w,
                      'height':page_height,'columns':positioned,'dividers':dividers})
    return pages


def _layout(doc: dict, glyph_metrics: dict | None,
            previous: tuple[dict, dict, dict | None] | None,
            compact: bool = False) -> tuple[dict, dict]:
    assert_document(doc)
    glyph_metrics = glyph_metrics or {}
    for item in doc['items']:
        if item['type'] not in ('word','clipart','image','table','cartouche'):
            raise DocumentError(f"Layout of {item['type']} is planned for a later milestone")
    surface = doc['surface']
    papyrus = surface == 'papyrus'
    width = column_width_mm(doc['font_size_pt'])
    if papyrus:
        page_height = float(doc['papyrus_height_mm'])
        page_width = 0.0
    else:
        page_width, page_height = SURFACES[surface]
    margins = validated_margins(doc)
    page_top = margins['top']
    page_bottom = page_height - margins['bottom']
    usable_height = page_bottom - page_top
    if usable_height <= 0:
        raise DocumentError('Surface too short for margins')
    usable_width = page_width - margins['left'] - margins['right'] if not papyrus else 0.0
    page_capacity = None if papyrus else max(1, int((usable_width + 1e-9)//width))
    if not papyrus and usable_width < width:
        raise DocumentError('Font too large for selected paper width')
    # All full-size columns on one sheet have exactly equal width. The unused
    # horizontal remainder belongs to the columns, not to the far margin.
    if page_capacity is not None:
        width = usable_width / page_capacity

    stats = {'mode': 'full', 'reused_prefix_columns': 0,
             'reused_suffix_columns': 0, 'computed_columns': 0,
             'composed_quadrats': 0, 'start_index': 0}
    old_columns: list[dict] = []
    previous_doc: dict | None = None
    first_changed = 0
    if previous is not None:
        previous_doc, previous_layout, previous_metrics = previous
        if (all(doc.get(k) == previous_doc.get(k) for k in LAYOUT_PARAMETERS)
                and glyph_metrics == (previous_metrics or {})
                and previous_layout.get('document_id') == doc['id']
                and previous_layout.get('revision') == previous_doc.get('revision')
                and not previous_layout.get('warnings')):
            old_items = previous_doc['items']
            new_items = doc['items']
            first_changed = 0
            while (first_changed < min(len(old_items), len(new_items))
                   and _item_signature(old_items[first_changed]) == _item_signature(new_items[first_changed])):
                first_changed += 1
            if first_changed == len(old_items) == len(new_items):
                # Formatting outside the stream (e.g. name) and a revision
                # update cannot affect geometry. Snapshot is never mutated.
                same = deepcopy(previous_layout)
                same['revision'] = doc['revision']
                stats.update(mode='unchanged', reused_prefix_columns=sum(
                    len(page['columns']) for page in same['pages']), start_index=len(new_items))
                return same, stats
            old_columns = _flatten_columns(previous_layout)
            stats['mode'] = 'incremental'

    # Until boundary-level dependency tracking can reconstruct a reused
    # silhouette group, never reuse partial clip-art sectors. Correctness
    # wins over unsafe incremental reuse for mixed documents.
    if any(o['type'] in ('clipart','image','table','cartouche') for o in doc['items']) or (previous_doc and any(
            o['type'] in ('clipart','image','table','cartouche') for o in previous_doc['items'])):
        old_columns=[]
        stats['mode']='full_silhouette'
    columns: list[dict] = []
    start_index = 0
    # Prefix columns end *before* the first modified item. Last unfinished
    # column is NEVER reused on append, since it may now need equalization.
    for j, old_col in enumerate(old_columns):
        count = len(old_col['placements'])
        if start_index + count >= first_changed:
            break
        if j == len(old_columns)-1 and len(doc['items']) > len(previous_doc['items']):
            break
        columns.append(_seed_from_column(old_col))
        start_index += count
    stats['reused_prefix_columns'] = len(columns)
    stats['start_index'] = start_index

    # Old column starts are indexed for safe stabilization of a suffix. Reuse
    # only when newly computed geometry is identical AND the entire remaining
    # object stream is identical (IDs, signs, styles and order).
    candidates: dict[str, tuple[int, int]] = {}
    if old_columns and previous_doc:
        old_idx = 0
        for ci, col in enumerate(old_columns):
            if col['placements']:
                candidates[_placement_id(col['placements'][0])] = (ci, old_idx)
            old_idx += len(col['placements'])

    @lru_cache(maxsize=8192)
    def quadrat_for(spelling: tuple[str, ...]):
        ratios = tuple(_shape_ratio(s, glyph_metrics) for s in spelling)
        before = _cached_quadrat.cache_info().misses
        q = _cached_quadrat(spelling, width, ratios)
        stats['composed_quadrats'] += _cached_quadrat.cache_info().misses - before
        return q

    gap = .20 * width
    pending: list[tuple[dict, object]] = []
    used = 0.0
    warnings: list[str] = []
    artwork_by_id={o['id']:o for o in doc['items'] if o['type'] in ('clipart','image')}
    all_objects={o['id']:o for o in doc['items']}
    nested_masks={}

    def finish_column(justified: bool) -> dict:
        nonlocal pending, used
        extra = max(0.0, usable_height-used) if justified else 0.0
        # Distribute unused length by ORIGINAL quadrat heights, not by their
        # existing internal gaps. 20 x 15 mm boxes and 10 mm spare -> +0.5 mm
        # per box. Fixed inter-quadrat gap is already in `used`.
        expanded = proportional_extra([q.height for _, q in pending], extra)
        newgap = gap
        y = page_top
        placements = []
        for i, (obj, q) in enumerate(pending):
            if compact:
                # ID, final Y, final height, and *unrounded* internal expansion.
                # The signs, formatting and glyph arrangements are recovered
                # from the authoritative document and cached quadrat on demand.
                placements.append((obj['id'], round(y, 5),
                                   round(q.height + expanded[i], 5), expanded[i]))
            else:
                adjusted = expand_internal(q, expanded[i])
                placements.append({'id': obj['id'], 'type': 'word', 'signs': obj['signs'],
                                   'color': obj.get('color', '#192433'),
                                   'bold': obj.get('bold', False), 'y': round(y, 5),
                                   'height': round(adjusted.height, 5),
                                   'quadrat': adjusted.payload()})
            y += q.height + expanded[i]
            if i < len(pending)-1:
                y += newgap
        seed = {'placements': placements, 'text_top': (placements[0][1] if compact else placements[0]['y']),
                'text_bottom': round(y, 5), 'span':1, 'kind':'words'}
        pending = []
        used = 0.0
        stats['computed_columns'] += 1
        return seed

    def wrapped_sector(items: list[tuple[dict,object]], top:float, bottom:float,
                       slot_offset:int) -> dict:
        """Emit a wrapped text column aligned to the sector neutral lines.

        It consumes NO additional page slots: these are unused channels of the
        single clip-art reservation. A one-word sector is bottom-aligned.
        """
        natural=sum(q.height for _,q in items)+gap*(len(items)-1)
        extra=max(0.0,(bottom-top)-natural)
        allocations=([0.0] if len(items)==1 else
                     proportional_extra([q.height for _,q in items],extra))
        normalgap=gap
        y=bottom-items[0][1].height if len(items)==1 else top
        placements=[]
        for j,(ob,q) in enumerate(items):
            if compact:
                placements.append((ob['id'],round(y,5),round(q.height+allocations[j],5),
                                   allocations[j]))
            else:
                adjusted=expand_internal(q,allocations[j])
                placements.append({'id':ob['id'],'type':'word','signs':ob['signs'],
                   'color':ob.get('color','#192433'),'bold':ob.get('bold',False),
                   'y':round(y,5),'height':round(adjusted.height,5),
                   'quadrat':adjusted.payload()})
            y+=q.height+allocations[j]
            if j<len(items)-1:y+=normalgap
        stats['computed_columns']+=1
        return {'placements':placements,'text_top':placements[0][1] if compact else placements[0]['y'],
           'text_bottom':round(y,5),'kind':'words','span':0,
           'slot_offset':slot_offset,'slot_width':1}

    def reserve_shared_object_clearance(obj: dict, image_w: float,
                                        image_h: float, image_y: float,
                                        span: int, mask: str | None) -> None:
        """Prevent a later float from invalidating ANY preceding object sector.

        Normal look-behind can recompose ordinary word columns, but cannot
        safely borrow words nested inside a previous object's zero-span
        sectors. For these multi-object cases, reserve the smallest number of
        *logical* empty slots necessary for the new footprint to clear earlier
        placed ink and the other objects. This is a derived typesetting choice;
        it never changes document order, IDs, or stored page coordinates.

        Obstacles and words are tested on the page where the new object would
        actually land. Crossing a paper edge starts a fresh collision field.
        """
        prior_objects_present = any(seed.get('kind') in ('clipart', 'table', 'cartouche')
                                    for seed in columns)
        if not prior_objects_present:
            return
        clearance = object_clearance_mm(width)
        # A bounded search terminates even when a user requests an impossible
        # backward float or positions several objects at the same height.
        budget = (page_capacity or max(len(columns) + 6, 32)) + \
                 ceil(max(0.0, -float(obj.get('x_offset_mm', 0.0))) / width) + 4
        for _ in range(budget):
            slot = 0
            earlier = []
            for seed in columns:
                span_here = seed.get('span', 1)
                if page_capacity is not None and (seed.get('break_before') or
                        (slot and slot + span_here > page_capacity)):
                    slot = 0
                    earlier = []
                for placement in seed['placements']:
                    ident = _placement_id(placement)
                    owner = all_objects[ident]
                    if compact:
                        y, h, ow = placement[1], placement[2], placement[3]
                    else:
                        y, h = placement['y'], placement['height']
                        ow = placement.get('width_mm', width)
                    if owner['type'] == 'word':
                        px = (slot + seed.get('slot_offset', 0)) * width
                        earlier.append(('word', px, y, width, h))
                    else:
                        lead = seed.get('float_offset', owner.get('x_offset_mm', 0.0))
                        if lead < 0:
                            delta = lead
                        elif lead > 0:
                            delta = min(lead, max(0., span_here * width - ow))
                        else:
                            align = owner.get('x_align', 0.0 if owner['type'] in ('table', 'cartouche') else .5)
                            delta = (span_here * width - ow) * (1-align if doc['direction'] == 'rtl' else align)
                        ix = slot * width + delta
                        if owner['type'] in ('clipart', 'image'):
                            facing = _logical_auto_flip(owner, ix, ow, page_width,
                                                        margins, doc['direction'], papyrus)
                            if doc['direction'] == 'rtl':
                                facing = ('normal' if facing == 'mirror' else 'mirror')
                            silhouette = owner.get('mask')
                        else:
                            facing = 'mirror' if doc['direction'] == 'rtl' else 'normal'
                            silhouette = nested_masks.get(ident)
                        earlier.append(('object', ix, y, ow, h, silhouette,
                                        facing, owner.get('artwork_id')))
                slot += span_here
            if page_capacity is not None and slot + span > page_capacity:
                # The next item starts on a new sheet, without borrowing
                # geometry or text from the previous page.
                slot = 0
                earlier = []
            requested = float(obj.get('x_offset_mm', 0.0))
            if requested < 0:
                # Match wrap_before_clipart's exact clamp. Previous object
                # sectors are zero-span overlays, not borrowable columns.
                available = 0
                for preceding_seed in reversed(columns):
                    if (preceding_seed.get('kind') != 'words' or
                            preceding_seed.get('span') != 1 or
                            preceding_seed.get('slot_offset') is not None or
                            not preceding_seed['placements']):
                        break
                    available += 1
                maximum = max(0., available*width-1e-7)
                delta = -min(-requested, maximum)
            elif requested > 0:
                delta = min(requested, max(0., span * width - image_w))
            else:
                align = obj.get('x_align', 0.0 if obj['type'] in ('table', 'cartouche') else .5)
                delta = (span * width - image_w) * (1-align if doc['direction'] == 'rtl' else align)
            x = slot * width + delta
            # Object/object checks follow actual 2D occupied pixels, preserving
            # safe transparent corners. Word boxes remain fully protected.
            collision = False
            # Resolve facing at the final logical position, after offset clamping.
            if obj['type'] in ('clipart', 'image'):
                current_flip = _logical_auto_flip(obj, x, image_w, page_width,
                                                  margins, doc['direction'], papyrus)
                if doc['direction'] == 'rtl':
                    current_flip = ('normal' if current_flip == 'mirror' else 'mirror')
            else:
                current_flip = 'mirror' if doc['direction'] == 'rtl' else 'normal'
            for obstacle in earlier:
                kind, px, py, pw, ph = obstacle[:5]
                if (px + pw + clearance <= x or x + image_w + clearance <= px or
                        py + ph + clearance <= image_y or
                        image_y + image_h + clearance <= py):
                    continue
                if kind == 'object':
                    previous_mask, previous_flip, previous_artwork = obstacle[5:8]
                    if silhouettes_collide(
                        {'x': px, 'y': py, 'width': pw, 'height': ph,
                         'mask': previous_mask, 'flip': previous_flip,
                         'artwork_id': previous_artwork},
                        {'x': x, 'y': image_y, 'width': image_w,
                         'height': image_h, 'mask': mask, 'flip': current_flip,
                         'artwork_id': obj.get('artwork_id')}, clearance):
                        collision = True
                        break
                    continue
                sectors = free_sectors(obj.get('artwork_id'),
                    bands=obj.get('bands'),mask=mask, image_width=image_w,
                    image_height=image_h,x_offset=x,slot_left=px,
                    slot_right=px+pw, top=py,bottom=py+ph,
                    clearance=clearance, flip=current_flip,
                    image_top=image_y)
                if not any(a <= py + 1e-6 and b >= py + ph - 1e-6
                           for a,b in sectors):
                    collision = True
                    break
            if not collision:
                return
            columns.append({'placements': [], 'text_top': page_top,
                            'text_bottom': page_top, 'span': 1, 'kind': 'words'})
        raise DocumentError('Unable to reserve safe multi-object layout space')

    def prior_object_obstacles():
        """Read all already placed object contours in page-local reading space.

        This shared projection is used for both look-behind and continuation;
        when a new object recomposes old word sectors, it MUST also preserve
        clearances created by earlier objects on the same sheet.
        """
        slot = 0
        obstacles = []
        for seed in columns:
            occupied = seed.get('span', 1)
            if page_capacity is not None and (seed.get('break_before') or
                    (slot and slot + occupied > page_capacity)):
                slot = 0
                obstacles = []
            if seed.get('kind') in ('clipart', 'cartouche', 'table') and seed['placements']:
                pl = seed['placements'][0]
                aid = _placement_id(pl)
                owner = all_objects[aid]
                if compact:
                    iw, ih, iy = pl[3], pl[2], pl[1]
                else:
                    iw, ih, iy = pl['width_mm'], pl['height'], pl['y']
                lead = seed.get('float_offset', owner.get('x_offset_mm', 0.0))
                if lead < 0:
                    delta = lead
                elif lead > 0:
                    delta = min(lead, max(0., occupied * width - iw))
                else:
                    align = owner.get('x_align', 0.0 if owner['type'] in ('table','cartouche') else .5)
                    delta = (occupied * width - iw) * (1-align if doc['direction']=='rtl' else align)
                ix = slot * width + delta
                if seed['kind'] == 'clipart':
                    flip = _logical_auto_flip(owner, ix, iw, page_width, margins,
                                              doc['direction'], papyrus)
                    if doc['direction'] == 'rtl':
                        flip = 'mirror' if flip == 'normal' else 'normal'
                    mask = owner.get('mask')
                else:
                    flip = 'mirror' if doc['direction'] == 'rtl' else 'normal'
                    mask = nested_masks.get(aid)
                obstacles.append((owner.get('artwork_id'), owner.get('bands'), mask,
                                  iw, ih, ix, flip, iy))
            slot += occupied
        return slot, obstacles

    def wrap_before_clipart(obj:dict, image_w:float, image_h:float,
                            image_y:float, span:int, *, mask_override:str|None=None,
                            flip_override:str|None=None) -> tuple[deque, float]:
        """Reflow preceding columns touched by a backward floating artwork.

        The source stream is never changed. Only complete, contiguous word
        columns on this same page can be borrowed, preventing a float from
        reaching into an earlier page or an unrelated object group. Any words
        displaced from those columns go to the front of the *following* flow;
        they can never disappear or be reordered behind later document words.
        """
        requested=float(obj.get('x_offset_mm',0.0))
        occupied=0
        for seed in columns:
            slots=seed.get('span',1)
            if page_capacity is not None and occupied and occupied+slots>page_capacity:
                occupied=0
            occupied+=slots
        if page_capacity is not None and occupied+span>page_capacity:
            # This art starts on the next page; previous-page text is off-limits.
            return deque(), 0.0
        available=0
        for seed in reversed(columns):
            if (seed.get('kind')!='words' or seed.get('span')!=1
                    or seed.get('slot_offset') is not None or not seed['placements']):
                break
            available+=1
            if page_capacity is not None and available>=occupied:break
        # A silhouette can violate the preceding column's clearance even with
        # ZERO offset: its mask begins exactly at the shared column boundary.
        # Plan actual x proximity, rather than checking negative floats only.
        # Unlike page geometry, all values here are logical reading-axis slots.
        maximum=max(0.0,available*width-1e-7)
        shift=min(max(0.0,-requested),maximum)
        if requested < 0 and shift<=1e-6:
            return deque(), 0.0
        dx=(-shift if requested<0 else
            requested if requested>0 else
            (span*width-image_w) *
            (1-obj.get('x_align',0.0 if obj['type'] in ('table','cartouche') else 0.5)
                 if doc['direction']=='rtl' else
             obj.get('x_align',0.0 if obj['type'] in ('table','cartouche') else 0.5)))
        # Expanded silhouette reaches into preceding slot(s) only when the
        # occupied object actually approaches that side of its reservation.
        clearance=object_clearance_mm(width)
        overlap=clearance-dx
        if overlap<=1e-8 or available==0:
            return deque(), (-shift if requested<0 else requested)
        touched=min(available,ceil((overlap-1e-8)/width))
        affected=columns[-touched:]
        preceding=deque()
        by_id={entry['id']:entry for entry in doc['items'] if entry['type']=='word'}
        for seed in affected:
            preceding.extend(by_id[_placement_id(pl)] for pl in seed['placements'])
        # Put the image at its derived reading-axis position relative to the
        # next slot. RTL reflection of x and image is applied during packing.
        image_start=occupied*width+dx
        reflection=flip_override or _logical_auto_flip(obj,image_start,image_w,page_width,margins,
                                       doc['direction'],papyrus)
        # The mask x axis is in logical reading order, reversed on RTL pages.
        if flip_override is None and doc['direction']=='rtl':
            reflection='mirror' if reflection=='normal' else 'normal'
        replacement=[]
        for j in range(touched):
            left=(occupied-touched+j)*width
            sectors=[(page_top,page_bottom)]
            _, older_obstacles = prior_object_obstacles()
            for aid,bands,old_mask,iw,ih,ix,old_flip,iy in older_obstacles:
                remaining=[]
                for top,bottom in sectors:
                    remaining.extend(free_sectors(aid,bands=bands,mask=old_mask,
                        image_width=iw,image_height=ih,x_offset=ix,
                        slot_left=left,slot_right=left+width,
                        top=top,bottom=bottom,clearance=object_clearance_mm(width),
                        flip=old_flip,image_top=iy))
                sectors=remaining
                if not sectors:break
            remaining=[]
            for top,bottom in sectors:
                remaining.extend(free_sectors(obj.get('artwork_id'),
                    bands=obj.get('bands'),
                    mask=mask_override if mask_override is not None else obj.get('mask'),
                    image_width=image_w,image_height=image_h,x_offset=image_start,
                    slot_left=left,slot_right=left+width,top=top,bottom=bottom,
                    clearance=object_clearance_mm(width),flip=reflection,image_top=image_y))
            sectors=remaining
            # An empty placeholder keeps the original physical slot. The
            # zero-span sectors paint geometry inside that same slot.
            replacement.append({'placements':[], 'text_top':page_top,
                'text_bottom':page_top, 'span':1,'kind':'words'})
            for top,bottom in sectors:
                if bottom-top < .75*width: continue
                segment=[]
                length=0.0
                while preceding:
                    entry=preceding[0]
                    q=quadrat_for(tuple(entry['signs']))
                    need=q.height+(gap if segment else 0)
                    if length+need>bottom-top+1e-8:break
                    segment.append((preceding.popleft(),q))
                    length+=need
                if segment:
                    replacement.append(wrapped_sector(segment,top,bottom,-1))
        columns[-touched:]=replacement
        if requested>=0 and preceding:
            # At zero/forward offset the object is *after* these words in the
            # logical stream. If the safe sectors cannot hold all of them,
            # append additional predecessor columns BEFORE placing the object.
            # Moving displaced old words behind the object breaks reading order.
            while preceding:
                chunk=[];used_h=0.0
                while preceding:
                    item=preceding[0];q=quadrat_for(tuple(item['signs']))
                    cost=q.height+(gap if chunk else 0.0)
                    if chunk and used_h+cost>usable_height+1e-8:break
                    chunk.append((preceding.popleft(),q));used_h+=cost
                columns.append(wrapped_sector(chunk,page_top,page_bottom,0))
                # An ordinary full slot, not a zero-span overlay.
                columns[-1].update(span=1)
                columns[-1].pop('slot_offset',None)
                columns[-1].pop('slot_width',None)
            # The overflow words were composed BEFORE the object existed at
            # this newly advanced anchor. Give them a real clearance slot;
            # otherwise proportional equalization may stretch their final
            # quadrat back into the obstacle's protected y range.
            columns.append({'placements':[], 'text_top':page_top,
                'text_bottom':page_top, 'span':1, 'kind':'words'})
        return preceding, (-shift if requested<0 else requested)

    def wrap_after_clipart(obj:dict, image_w:float, image_h:float, span:int,
                           start:int, preceding:deque | None = None,
                           *, following_below:bool=False) -> int:
        """Fill silhouette-free vertical sectors using following ordered words.

        Remaining words automatically continue in ordinary columns. No word
        ever splits across sectors. Next clip-art anchors begin a new band.
        """
        clear=object_clearance_mm(width)
        cursor=start
        preceding = preceding if preceding is not None else deque()
        had_lookbehind = bool(preceding)
        slot_position, obstacles = prior_object_obstacles()
        # Current image is the last obstacle. Find its start in slot space.
        image_start=slot_position-span
        image_y=obstacles[-1][-1] if obstacles else page_top
        for slot_index in range(span):
            left=(image_start+slot_index)*width
            right=left+width
            sectors=[(page_top,page_bottom)]
            for aid,bands,mask,iw,ih,ix,reflection,iy in obstacles:
                remaining=[]
                for top,bottom in sectors:
                    remaining.extend(free_sectors(aid,bands=bands,mask=mask,image_width=iw,
                        image_height=ih,x_offset=ix,slot_left=left,slot_right=right,
                        top=top,bottom=bottom,clearance=clear,flip=reflection,
                        image_top=iy))
                sectors=remaining
                if not sectors:break
            for top,bottom in sectors:
                if following_below:
                    top=max(top,image_y+image_h+clear)
                if bottom-top<.75*width:continue  # reject dead channels
                segment=[]
                length=0.
                while preceding or (cursor<len(doc['items']) and doc['items'][cursor]['type']=='word'):
                    ob=preceding[0] if preceding else doc['items'][cursor]
                    q=quadrat_for(tuple(ob['signs']))
                    needed=q.height+(gap if segment else 0)
                    if length+needed > bottom-top+1e-8:break
                    segment.append((ob,q));length+=needed
                    if preceding:preceding.popleft()
                    else:cursor+=1
                if segment:
                    columns.append(wrapped_sector(segment,top,bottom,
                                                    -span+slot_index))
        # The edge of a reserved object band is ALSO an internal border.
        # The first ordinary word column after it must respect the contour:
        # otherwise zero-offset rectangles/cartouches can touch following ink.
        # Reserve at most one edge column, and only when its clearance is
        # actually obstructed. The page's normal full-width column is restored
        # immediately after that narrow window.
        next_left=slot_position*width
        more_words=(preceding or (cursor<len(doc['items']) and
                                   doc['items'][cursor]['type']=='word'))
        if more_words and (page_capacity is None or
                           next_left < page_capacity*width-1e-8):
            safe=[(page_top,page_bottom)]
            for aid,bands,mask,iw,ih,ix,reflection,iy in obstacles:
                updated=[]
                for top,bottom in safe:
                    updated.extend(free_sectors(aid,bands=bands,mask=mask,
                        image_width=iw,image_height=ih,x_offset=ix,
                        slot_left=next_left,slot_right=next_left+width,
                        top=top,bottom=bottom,clearance=clear,flip=reflection,
                        image_top=iy))
                safe=updated
                if not safe:break
            # No new reservation is needed when the edge is completely clear.
            if safe!=[(page_top,page_bottom)]:
                columns.append({'placements':[], 'text_top':page_top,
                    'text_bottom':page_top,'span':1,'kind':'words'})
                for top,bottom in safe:
                    if following_below:
                        top=max(top,image_y+image_h+clear)
                    if bottom-top<.75*width:continue
                    part=[];height=0.0
                    while preceding or (cursor<len(doc['items']) and
                                        doc['items'][cursor]['type']=='word'):
                        ob=preceding[0] if preceding else doc['items'][cursor]
                        q=quadrat_for(tuple(ob['signs']))
                        required=q.height+(gap if part else 0.0)
                        if height+required>bottom-top+1e-8:break
                        part.append((ob,q));height+=required
                        if preceding:preceding.popleft()
                        else:cursor+=1
                    if part:
                        columns.append(wrapped_sector(part,top,bottom,-1))
        # Keep earlier silhouette-safe word sectors intact even when another
        # graphical object follows. Rewinding these already composed words
        # back into an ordinary full-width column silently discards the first
        # object's clearance and can make ink cross its boundary.
        return cursor

    def wrap_after_table(table_bottom: float, span: int, cursor: int) -> int:
        """A table is an opaque internal border, not an empty column band.

        Table top is the sector boundary above its body; its bottom starts an
        independent lower writing sector in every occupied column. The table
        stays one logical document object, even when later words flow beneath
        it. A table with no available lower space consumes its original slots.
        """
        bottom = page_bottom
        top = table_bottom+object_clearance_mm(width)
        if bottom-top < .75*width:
            return cursor
        for slot_index in range(span):
            if cursor >= len(doc['items']) or doc['items'][cursor]['type'] != 'word':
                break
            items=[]
            length=0.0
            while cursor<len(doc['items']) and doc['items'][cursor]['type']=='word':
                ob=doc['items'][cursor]
                q=quadrat_for(tuple(ob['signs']))
                needed=q.height+(gap if items else 0)
                if length+needed>bottom-top+1e-8:
                    break
                items.append((ob,q));length+=needed;cursor+=1
            if items:
                columns.append(wrapped_sector(items,top,bottom,-span+slot_index))
        return cursor

    def preceding_nested_sector(top: float, span: int) -> list[dict]:
        """Keep pending preceding words before a nested object, if space permits.

        They are written ABOVE the object in the same reserved column band.
        The object is emitted first as the slot owner; the word sector has
        zero span and a negative slot offset. If the pending stream will not
        fit, retain the old complete-column flow rather than lose any words.
        """
        nonlocal pending, used
        if not pending:
            return []
        if top-page_top < used-1e-8:
            columns.append(finish_column(False))
            return []
        preceding=pending
        pending=[]; used=0.0
        return [wrapped_sector(preceding,page_top,top,-span)]

    i = start_index
    carry=deque()
    while i < len(doc['items']) or carry:
        from_carry=bool(carry)
        obj = carry[0] if from_carry else doc['items'][i]
        if obj['type']=='cartouche':
            try:
                geo=typeset_cartouche(obj,width,
                    usable_width if not papyrus else max(width*48,1000),
                    usable_height,glyph_metrics,doc['direction'])
            except CartoucheError as exc:raise DocumentError(str(exc)) from exc
            natural_span=max(1,ceil((geo['width_mm']-1e-8)/width))
            offset=float(obj.get('x_offset_mm',0.0))
            if page_capacity is not None and offset>0:
                offset=min(offset,max(0.0,page_capacity*width-geo['width_mm']))
            span=max(natural_span,ceil((max(0.0,offset)+geo['width_mm']-1e-8)/width))
            if page_capacity is not None and span>page_capacity:
                raise DocumentError('Cartouche wider than writing frame')
            nested_masks[obj['id']]=cartouche_object_mask(geo['width_mm'],geo['height'],
                geo['orientation'],geo['terminal_end'],geo['stroke_mm'])
            pos_y=round(page_top+(usable_height-geo['height'])*obj.get('y_align',0.0),5)
            if offset<0 and pending:
                # Offer the pending preceding words to the same bounded
                # look-behind used by images. They remain before the cartouche
                # in the logical stream even if their visual sectors change.
                columns.append(finish_column(False))
            above=(preceding_nested_sector(max(page_top,pos_y-object_clearance_mm(width)),span)
                   if offset>=0 else [])
            reserve_shared_object_clearance(obj,geo['width_mm'],geo['height'],
                                            pos_y,span,nested_masks[obj['id']])
            previous_words=deque()
            previous_words,offset=wrap_before_clipart(obj,geo['width_mm'],
                geo['height'],pos_y,span,mask_override=nested_masks[obj['id']],
                flip_override='mirror' if doc['direction']=='rtl' else 'normal')
            if compact:
                pl=(obj['id'],pos_y,geo['height'],geo['width_mm'])
            else:
                pl={'id':obj['id'],'type':'cartouche','y':pos_y,
                    'height':geo['height'],'width_mm':geo['width_mm'],
                    'cartouche':geo}
            columns.append({'placements':[pl], 'text_top':pos_y,
                 'text_bottom':round(pos_y+geo['height'],5),
                 'span':span,'kind':'cartouche','float_offset':offset})
            columns.extend(above)
            stats['computed_columns']+=1
            if from_carry:carry.popleft()
            else:
                i=wrap_after_clipart(obj,geo['width_mm'],geo['height'],span,
                                      i+1,previous_words,
                                      following_below=(abs(offset)<1e-7))
            carry=previous_words
            continue
        if obj['type']=='table':
            ncols=len(obj['rows'][0])
            requested=obj.get('width_mm') or ncols*max(width*1.6,13.0)
            max_w=page_capacity*width if page_capacity is not None else requested
            if max_w<ncols*6:
                raise DocumentError('Table cannot fit the selected page width')
            desired=max(ncols*6,min(requested,max_w))
            natural_span=max(1,ceil((desired-1e-8)/width))
            table_w=natural_span*width
            offset=float(obj.get('x_offset_mm',0.0))
            if page_capacity is not None and offset>0:
                offset=min(offset,max(0.0,page_capacity*width-table_w))
            span=max(natural_span,ceil((max(0.0,offset)+table_w-1e-8)/width))
            try:
                geometry=typeset_table(obj,width,table_w,None,glyph_metrics,doc['direction'])
                fragments=paginate_table(geometry,usable_height)
            except TableError as exc:raise DocumentError(str(exc)) from exc
            if len(fragments)>1:
                # Never borrow columns or float a paginated table: it owns a
                # chain of stable page/column continuations.
                offset=0.0;span=natural_span
            nested_masks[obj['id']]=solid_object_mask()
            pos_y=(round(page_top+(usable_height-fragments[0]['height'])*obj.get('y_align',0.0),5)
                   if len(fragments)==1 else round(page_top,5))
            if offset<0 and pending:
                columns.append(finish_column(False))
            above=(preceding_nested_sector(max(page_top,pos_y-object_clearance_mm(width)),span)
                   if len(fragments)==1 and offset>=0 else [])
            if len(fragments)==1:
                reserve_shared_object_clearance(obj,table_w,fragments[0]['height'],
                                                pos_y,span,nested_masks[obj['id']])
            previous_words=deque()
            if len(fragments)==1:
                previous_words,offset=wrap_before_clipart(obj,table_w,
                    fragments[0]['height'],pos_y,span,
                    mask_override=nested_masks[obj['id']],
                    flip_override='mirror' if doc['direction']=='rtl' else 'normal')
            if len(fragments)>1 and pending:columns.append(finish_column(False))
            for fi,fragment in enumerate(fragments):
                if compact:
                    placement=(obj['id'],pos_y,fragment['height'],fragment['width_mm'])
                else:
                    placement={'id':obj['id'],'type':'table','y':pos_y,
                               'height':fragment['height'],'width_mm':fragment['width_mm'],
                               'table':fragment}
                columns.append({'placements':[placement],'text_top':pos_y,
                                'text_bottom':round(pos_y+fragment['height'],5),
                                'span':span,'kind':'table',
                                'table_fragment_index':fi,
                                'float_offset':offset,
                                **({'break_before':True} if fi else {})})
                stats['computed_columns']+=1
            columns.extend(above)
            if from_carry:carry.popleft()
            else:
                i=(wrap_after_clipart(obj,table_w,fragments[-1]['height'],span,
                                      i+1,previous_words,
                                      following_below=(abs(offset)<1e-7))
                   if len(fragments)==1
                   else wrap_after_table(pos_y+fragments[-1]['height'],span,i+1))
            carry=previous_words
            continue
        if obj['type'] in ('clipart','image'):
            if pending:
                columns.append(finish_column(False))
            asset = artwork_catalog()[obj['artwork_id']] if obj['type']=='clipart' else None
            # Scale isotropically, constrained by usable page height and width.
            target_w = obj['width_mm']
            target_h = target_w * (asset['default_height_mm'] / asset['default_width_mm']
                                   if asset else obj['pixel_height'] / obj['pixel_width'])
            max_w = (page_capacity * width if page_capacity is not None else target_w)
            scale = min(1.0, max_w / target_w, usable_height / target_h)
            image_w, image_h = target_w * scale, target_h * scale
            image_y = page_top + (usable_height-image_h)*obj.get('y_align',0.5)
            # A floating clip-art anchor can span arbitrary subsequent columns.
            # The content order is unchanged. These slots become text sectors,
            # with contour occupancy removing only unsafe vertical intervals.
            lead=max(0.0,float(obj.get('x_offset_mm',0.0)))
            if page_capacity is not None:
                lead=min(lead,max(0.0,page_capacity*width-image_w))
            span = max(1, ceil((lead + image_w - 1e-8) / width))
            # The clipped offset is layout-only. Source documents are immutable.
            if obj.get('x_offset_mm',0.0)>=0 and lead != obj.get('x_offset_mm',0.0):
                obj={**obj,'x_offset_mm':lead}
                artwork_by_id[obj['id']]=obj
            # The complete float reservation participates in the shared
            # column compositor, including neighboring silhouette-free lanes.
            if compact:
                placement = (obj['id'], round(image_y,5), round(image_h,5), round(image_w,5))
            else:
                placement = {'id':obj['id'], 'type':obj['type'],
                             'artwork_id':obj.get('artwork_id'),
                             'width_mm':round(image_w,5), 'height':round(image_h,5),
                             'flip':obj['flip'], 'y':round(image_y,5)}
            reserve_shared_object_clearance(obj,image_w,image_h,image_y,span,
                                            obj.get('mask'))
            prior, effective_offset=wrap_before_clipart(obj,image_w,image_h,image_y,span)
            columns.append({'placements':[placement], 'text_top':round(image_y,5),
                            'text_bottom':round(image_y+image_h,5),
                            'span':span, 'kind':'clipart',
                            'float_offset':effective_offset})
            stats['computed_columns'] += 1
            i = wrap_after_clipart(obj,image_w,image_h,span,i+1,prior)
            # Words before the image that could not fit previous or current
            # silhouette sectors remain before all following document words.
            carry=prior
            continue
        q = quadrat_for(tuple(obj['signs']))
        if q.height > usable_height:
            # The logical document is authoritative. Silently skipping an
            # oversized word desynchronizes the rendered page, selection and
            # logical cursor, and can make insertion appear to erase content.
            # Keep the last coherent render and report the impossible layout.
            raise DocumentError(
                f"Word {obj['id']} exceeds the available column height; "
                "reduce document font size or shorten the word")
        proposed = used + (gap if pending else 0) + q.height
        if pending and proposed > usable_height + 1e-9:
            completed = finish_column(True)
            columns.append(completed)
            # A stable column boundary allows us to reuse ALL following old
            # columns. This works even if page numbering shifts, since pages
            # are packed from canonical column seeds afterward.
            first_id = _placement_id(completed['placements'][0])
            candidate = candidates.get(first_id) if not from_carry else None
            if candidate:
                old_ci, old_start = candidate
                old_col = _seed_from_column(old_columns[old_ci])
                old_end = old_start+len(old_col['placements'])
                if (old_col == completed
                        and doc['items'][i:] == previous_doc['items'][old_end:]
                        and not warnings):
                    suffix = old_columns[old_ci+1:]
                    columns.extend(_seed_from_column(c) for c in suffix)
                    stats['reused_suffix_columns'] = len(suffix)
                    i = len(doc['items'])
                    break
            proposed = q.height
        pending.append((obj, q))
        used = proposed
        if from_carry:carry.popleft()
        else:i += 1
    if pending:
        columns.append(finish_column(False))

    pages = _pack_pages(doc, columns, width, page_width, page_height, page_capacity, compact, nested_masks)
    result = {'document_id': doc['id'], 'revision': doc['revision'],
              'font_size_pt': doc['font_size_pt'], 'direction': doc['direction'],
              'column_width_mm': width, 'surface': surface,
              'margins_mm': margins,
              'pages': pages, 'warnings': warnings}
    return result, stats


def layout_document(doc: dict, glyph_metrics: dict | None = None) -> dict:
    """Full deterministic layout, also used as the parity oracle for tests."""
    return _layout(doc, glyph_metrics, None)[0]


def incremental_layout_document(doc: dict, previous_document: dict | None = None,
                                previous_layout: dict | None = None,
                                glyph_metrics: dict | None = None,
                                previous_metrics: dict | None = None,
                                compact: bool = False) -> tuple[dict, dict]:
    """Reuse completed unaffected columns, then stop at a stable suffix.

    Invalid/missing prior snapshots fall back to full layout. The immutable
    output format is IDENTICAL to layout_document; statistics are separate.
    """
    previous = ((previous_document, previous_layout, previous_metrics)
                if previous_document is not None and previous_layout is not None else None)
    return _layout(doc, glyph_metrics, previous, compact)


class LayoutSession:
    """Bounded, per-worker incremental snapshot owner, not a second engine.

    The sole active document is retained in the layout worker; switching files
    invalidates it. Caller-supplied revision/ticket ensures stale views cannot
    be committed on screen. Only accepted latest revisions update this cache.
    """
    def __init__(self, compact: bool = False):
        self.compact = compact
        self._document = None
        self._layout = None
        self._metrics = None

    def calculate(self, document: dict, metrics: dict | None = None) -> tuple[dict, dict]:
        metrics = metrics or {}
        prior = (self._document, self._layout, self._metrics) if self._document else (None, None, None)
        if self._document is not None and document['revision'] < self._document['revision']:
            # Old job: generate a correct result, but never poison newer state.
            return incremental_layout_document(document, *prior[:2], metrics, prior[2], compact=self.compact)
        result, stats = incremental_layout_document(document, *prior[:2], metrics, prior[2], compact=self.compact)
        self._document, self._layout, self._metrics = document, result, metrics
        return result, stats


def expand_compact_page(page: dict, document_by_id: dict[str, dict],
                        glyph_metrics: dict | None = None,
                        width: float | None = None, direction: str = 'rtl',
                        margins_mm: dict | None = None, surface: str | None = None) -> dict:
    """Materialize an exact legacy page from compact, read-only column records.

    This is a projection, NOT a second typesetting algorithm: row grouping,
    equalization, and positioning are decisions already made by _layout.
    Only visible page requests call this function. It never mutates the cache.
    """
    glyph_metrics = glyph_metrics or {}
    margins_mm = margins_mm or {'top': MARGIN_MM, 'bottom': MARGIN_MM}
    detailed_columns = []
    for column in page['columns']:
        column_width = column['width'] if width is None else width
        placements = []
        for ident, y, height, extra in column['placements']:
            obj = document_by_id[ident]
            if obj['type']=='cartouche':
                geo=typeset_cartouche(obj, width if width is not None else column['width']/max(1,column['span']),
                    column['width'],page['height']-margins_mm['top']-margins_mm['bottom'],
                    glyph_metrics,direction)
                placements.append({'id':ident,'type':'cartouche','x':_art_x(column['x'],column['width'],extra,obj,direction,column.get('float_offset')),
                    'y':y,'height':height,'width_mm':extra,'cartouche':geo})
                continue
            if obj['type']=='table':
                sign_width=width if width is not None else column['width']/max(1,column['span'])
                geometry=typeset_table(obj,sign_width,
                    max(1,round(extra/sign_width))*sign_width,None,glyph_metrics,direction)
                fragments=paginate_table(geometry,page['height']-margins_mm['top']-margins_mm['bottom'])
                fi=column.get('table_fragment_index',0)
                if fi>=len(fragments):raise DocumentError('Outdated table fragment revision')
                placements.append({'id':ident,'type':'table','x':_art_x(column['x'],column['width'],extra,obj,direction,column.get('float_offset')),
                    'y':y,'height':height,'width_mm':extra,'table':fragments[fi]})
                continue
            if obj['type'] in ('clipart','image'):
                image_w = extra  # exact width saved by the authoritative compositor
                px=_art_x(column['x'], column['width'],image_w,
                             obj, direction, column.get('float_offset'))
                placements.append({'id':ident, 'type':obj['type'],
                                   'artwork_id':obj.get('artwork_id'), 'flip':obj['flip'],
                                   'resolved_flip':_physical_auto_flip(obj,px,page['width'],direction,
                                      surface=='papyrus'),
                                   'width_mm':round(image_w,5),
                                   'y':y, 'height':height,'x':px})
                continue
            signs = obj['signs']
            spelling = tuple(signs)
            ratios = tuple(_shape_ratio(sign, glyph_metrics) for sign in spelling)
            quadrat = expand_internal(_cached_quadrat(spelling, column_width, ratios), extra)
            placements.append({'id': ident, 'type': 'word', 'signs': signs,
                               'color': obj.get('color', '#192433'),
                               'bold': obj.get('bold', False),
                               'y': y, 'height': height, 'quadrat': quadrat.payload(),
                               'x': column['x']})
        detailed_columns.append({**column, 'placements': placements})
    return {**page, 'columns': detailed_columns}


def expand_compact_layout(snapshot: dict, document_by_id: dict[str, dict],
                          glyph_metrics: dict | None = None) -> dict:
    """For testing / explicit full-geometry callers only; never retain in worker."""
    return {**snapshot, 'pages': [expand_compact_page(page, document_by_id, glyph_metrics,
                                      width=snapshot['column_width_mm'],
                                      direction=snapshot['direction'],
                                      margins_mm=snapshot.get('margins_mm'),surface=snapshot.get('surface'))
                                  for page in snapshot['pages']]}
