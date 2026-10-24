"""Strictly decode AES's published HTML numeric Egyptian hieroglyph notation.

AES serializes Unicode as '&#x131d3;' strings. Only complete hieroglyph
entity sequences are accepted, preserving all signs and excluding damage and
transcription-only fragments. Chronological language-stage validation is separate.
"""
import html
import re

_ENTITY = re.compile(r"&#(?:x[0-9a-fA-F]{4,6}|[0-9]{5,7});")
def is_hieroglyph(char):
    n=ord(char)
    return (0x13000<=n<=0x1342f) or (0x13460<=n<=0x143ff)

def decode_aes_hiero(text):
    if not isinstance(text,str) or not text or len(text)>4096:return None
    pieces=[]
    cursor=0
    for match in _ENTITY.finditer(text):
        if match.start()>cursor:
            fragment=text[cursor:match.start()]
            if not fragment or any(not is_hieroglyph(x) for x in fragment):return None
            pieces.append(fragment)
        try:
            n=int(match.group(0)[3:-1],16) if match.group(0).startswith('&#x') else int(match.group(0)[2:-1],10)
        except ValueError:return None
        if not 0x13000<=n<=0x143ff or not is_hieroglyph(chr(n)):return None
        pieces.append(chr(n))
        cursor=match.end()
    if cursor<len(text):
        tail=text[cursor:]
        if any(not is_hieroglyph(x) for x in tail):return None
        pieces.append(tail)
    joined=''.join(pieces)
    if not joined or len(joined)>256 or any(not is_hieroglyph(x) for x in joined):return None
    return joined
