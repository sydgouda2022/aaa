"""Pure, global-optimum (DP) whole-word sign composition.

No Unicode string is split or reordered. Metrics are dimensions of visible glyph
outlines expressed in common units. Production metric source must be a pinned
hieroglyphic font; normalized measurements may be injected by the rendering
adapter. The fallback metric table is deliberately provisional for milestone 1.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from functools import lru_cache
from typing import Mapping

@dataclass(frozen=True)
class SignBox:
    sign: str
    x: float
    y: float
    width: float
    height: float

@dataclass(frozen=True)
class Quadrat:
    width: float
    height: float
    signs: tuple[SignBox, ...]
    rows: tuple[tuple[int, ...], ...]
    flexible_gaps: tuple[float, ...]

    def payload(self) -> dict:
        return {"width": self.width, "height": self.height,
                "signs": [asdict(s) for s in self.signs],
                "rows": [list(row) for row in self.rows],
                "flexible_gaps": list(self.flexible_gaps)}

# Starter proportions, NOT attested glyph geometry. Replaced by bundled-font
# outline metrics in a dedicated font-integration milestone.
PROVISIONAL_RATIOS = {
    "𓅓": .68, "𓇋": .35, "𓏏": 1.34, "𓈖": 1.26,
    "𓄿": .88, "𓅱": .63, "𓂋": .59, "𓊪": .96,
    "𓏺": .25, "𓎡": 1.0, "𓁹": 1.1,
}


def _shape_ratio(sign: str, glyph_metrics: Mapping[str, object] | None) -> float:
    if glyph_metrics and sign in glyph_metrics:
        m = glyph_metrics[sign]
        if isinstance(m, dict):
            w, h = float(m.get("width", 1)), float(m.get("height", 1))
            return max(.20, min(3.5, w / max(h, .01)))
        return max(.20, min(3.5, float(m)))
    return PROVISIONAL_RATIOS.get(sign, .83)


def compose(signs: list[str], column_width: float,
            glyph_metrics: Mapping[str, object] | None = None) -> Quadrat:
    """DP searches the complete word, with 1 or 2 consecutive signs per row.

    Row pairing incurs a penalty: a single sign per row is preferable unless
    pairing materially reduces total height. Individual glyph sizes vary; no
    aspect ratio changes. Units match column_width (normally millimetres).
    """
    if not signs or column_width <= 0:
        raise ValueError("Nonempty spelling and positive column width required")
    width = float(column_width)
    pad_x = .09 * width
    usable = width - 2 * pad_x
    gap = .055 * width
    base_height = .60 * width
    ratios = [_shape_ratio(s, glyph_metrics) for s in signs]

    def single(i: int):
        h = min(base_height, usable / ratios[i])
        w = ratios[i] * h
        return (h, ((w, h),), 0.0)

    def pair(i: int):
        # Two signs share a line only if each retains a readable fraction of
        # nominal height. Both can be independently sized, never stretched.
        left, right = ratios[i], ratios[i+1]
        max_width = (usable - gap) / 2
        h1 = min(base_height * .88, max_width / left)
        h2 = min(base_height * .88, max_width / right)
        if min(h1, h2) < .30 * width:
            return None
        row_h = max(h1, h2)
        # Visual penalty discourages automatic pairing without spatial benefit.
        penalty = .13 * width + abs(h1 - h2) * .12
        return (row_h, ((left * h1, h1), (right * h2, h2)), penalty)

    @lru_cache(None)
    def best(i: int):
        if i == len(signs):
            return (0.0, ())
        opts = []
        h, wh, penalty = single(i)
        tail_score, tail = best(i+1)
        opts.append((h + penalty + tail_score, ((i,), wh, h) + (tail,)))
        if i+1 < len(signs):
            result = pair(i)
            if result:
                h, wh, penalty = result
                tail_score, tail = best(i+2)
                opts.append((h + penalty + tail_score, ((i, i+1), wh, h) + (tail,)))
        return min(opts, key=lambda v: v[0])

    # Decode nested DP decisions into consecutive rows.
    result = best(0)[1]
    rows: list[tuple[int, ...]] = []
    signboxes: list[SignBox] = []
    rowgap = .13 * width
    y = .11 * width
    while result:
        indices, wh, row_h, result = result
        rows.append(indices)
        total_w = sum(w for w, _ in wh) + gap * (len(wh)-1)
        x = (width - total_w) / 2
        for idx, (w, h) in zip(indices, wh):
            signboxes.append(SignBox(signs[idx], x, y + (row_h-h)/2, w, h))
            x += w + gap
        y += row_h + rowgap
    h = y - rowgap + .11 * width
    return Quadrat(width, h, tuple(signboxes), tuple(rows),
                   tuple([.11 * width] + [rowgap] * max(0, len(rows)-1) + [.11 * width]))


def expand_internal(quadrat: Quadrat, additional_height: float) -> Quadrat:
    """Expand ONLY internal whitespace, never visible sign geometry.

    Proportional weight of each existing gap determines its share. Signs after
    a gap are translated vertically; their width/height are unchanged.
    """
    if additional_height <= 0:
        return quadrat
    gaps = quadrat.flexible_gaps
    total = sum(gaps)
    if total <= 0:
        return quadrat
    increments = [additional_height * g / total for g in gaps]
    translated: list[SignBox] = []
    first_of_row = {}
    for row_no, indices in enumerate(quadrat.rows):
        for idx in indices:
            first_of_row[idx] = row_no
    for i, s in enumerate(quadrat.signs):
        row = first_of_row[i]
        delta = sum(increments[:row+1])
        translated.append(SignBox(s.sign, s.x, s.y + delta, s.width, s.height))
    return Quadrat(quadrat.width, quadrat.height + additional_height,
                   tuple(translated), quadrat.rows,
                   tuple(g+inc for g, inc in zip(gaps, increments)))
