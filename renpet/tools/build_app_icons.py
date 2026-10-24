"""Build Renpet's Khepri PWA icons from its canonical two-color SVG.

Pure Python standard library; no Cairo, Pillow, imagemagick or fonts needed.
The SVG artwork remains flat gold (#EDBC40) on Egyptian blue (#04458D).
"""
from __future__ import annotations
import math
import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "web/assets/khepri-scarab.svg"
OUT = ROOT / "web/assets"
MASTER = 1024
BLUE = (4, 69, 141)
GOLD = (237, 188, 64)


def contours():
    svg = SVG.read_text(encoding="utf-8")
    path = re.search(r'<path\s+fill="#EDBC40"\s+fill-rule="evenodd"\s+d="([^"]+)"', svg)
    if not path:
        raise ValueError("Missing canonical flat gold Khepri silhouette")
    return [[(int(x), int(y)) for x, y in re.findall(r'(\d+),(\d+)', p)]
            for p in re.findall(r'M([^Z]+)Z', path.group(1))]


def raster(paths, scale=1.0):
    polygons = [[((x - 256)*scale + 256, (y - 256)*scale + 256)
                 for x, y in pts] for pts in paths]
    mask = bytearray(MASTER*MASTER)
    for row in range(MASTER):
        y = (row+.5)*512/MASTER
        crossings = []
        for polygon in polygons:
            for (x1,y1),(x2,y2) in zip(polygon, polygon[1:]+polygon[:1]):
                if (y1 <= y < y2) or (y2 <= y < y1):
                    crossings.append(x1+(y-y1)*(x2-x1)/(y2-y1))
        crossings.sort()
        if len(crossings) % 2:
            raise ValueError(f"Open scarab silhouette at row {row}")
        for a,b in zip(crossings[::2], crossings[1::2]):
            left = max(0,min(MASTER,math.ceil(a*MASTER/512-.5)))
            right = max(0,min(MASTER,math.ceil(b*MASTER/512-.5)))
            if right > left:
                mask[row*MASTER+left:row*MASTER+right] = b'\x01'*(right-left)
    return mask


def chunk(kind, payload):
    return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload))


def png(size,mask):
    scanlines=[]
    for y in range(size):
        y0=y*MASTER//size
        y1=(y+1)*MASTER//size
        line=bytearray(b'\x00')
        for x in range(size):
            x0=x*MASTER//size
            x1=(x+1)*MASTER//size
            coverage=sum(sum(mask[j*MASTER+x0:j*MASTER+x1]) for j in range(y0,y1))
            total=(x1-x0)*(y1-y0)
            line.extend((BLUE[k]*(total-coverage)+GOLD[k]*coverage+total//2)//total
                        for k in range(3))
        scanlines.append(line)
    ihdr=struct.pack('>IIBBBBB',size,size,8,2,0,0,0)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',ihdr)+chunk(b'IDAT',zlib.compress(b''.join(scanlines),9))+chunk(b'IEND',b'')


def main():
    polygons=contours()
    if len(polygons)<5:
        raise ValueError("Khepri silhouette incomplete")
    regular=raster(polygons)
    # Android adaptive/maskable crops the icon into a circle: inset the glyph.
    maskable=raster(polygons,.74)
    icons=[('favicon-32.png',32,regular),('icon-180.png',180,regular),
           ('icon-192.png',192,regular),('icon-512.png',512,regular),
           ('icon-maskable-512.png',512,maskable)]
    for name,size,mask in icons:
        path=OUT/name
        path.write_bytes(png(size,mask))
        print(f'{name}: {size}x{size}, {path.stat().st_size} bytes')


if __name__ == '__main__':
    main()
