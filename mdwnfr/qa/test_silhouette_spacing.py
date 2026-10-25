"""Silhouette layout invariants across real shipped Egyptian font profiles."""
import json,math,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'core'))
from mdwnfr.quadrat import compose,expand_internal,glyph_geometry

C=20.0
def near(test,left,right):
    test.assertTrue(math.isclose(left,right,rel_tol=1e-8,abs_tol=1e-8),
                    f'{left} != {right}')

class VisibleInkComposition(unittest.TestCase):
    def test_one_font_one_catalogue(self):
        data=json.loads((ROOT/'core/mdwnfr/data/glyph_geometry.json').read_text())
        self.assertEqual(data['format'],'mdwnfr-glyph-ink-v1')
        self.assertEqual(len(glyph_geometry()),1072)
        self.assertEqual(data['font_sha256'],
                         'b792accc6207ca9caa59fc67f53926b6985a99d255dd432d7c68b68a6dfd62f8')

    def test_owl_uses_one_row_and_half_width_margins(self):
        q=compose(list('𓅓'),C)
        self.assertEqual(q.rows,((0,),))
        s=q.signs[0]
        near(self,s.width,C/2)
        near(self,s.x,s.width/2)
        near(self,C-s.x-s.width,s.width/2)
        near(self,s.y,s.height/2)
        near(self,q.height-s.y-s.height,s.height/2)

    def test_two_slender_glyphs_share_row_and_gap_is_half_width(self):
        q=compose(list('𓇋𓇋'),C)
        self.assertEqual(q.rows,((0,1),))
        a,b=q.signs
        near(self,a.height,b.height)
        near(self,b.x-a.x-a.width,(a.width+b.width)/4)
        near(self,a.y,a.height/2)
        near(self,q.height-(a.y+a.height),a.height/2)
        for g in (a,b):
            near(self,g.width/g.height,0.244/1.001)

    def test_mixed_slender_signs_use_taller_row(self):
        q=compose(list('𓇋𓇄'),C)
        self.assertEqual(q.rows,((0,1),))
        a,b=q.signs
        taller=max(a.height,b.height)
        near(self,q.height,2*taller)
        near(self,a.y+a.height/2,b.y+b.height/2)
        near(self,q.flexible_gaps[0],taller/2)
        near(self,q.flexible_gaps[-1],taller/2)

    def test_owl_does_not_share_row_with_narrow_reed(self):
        q=compose(list('𓇋𓅓'),C)
        self.assertEqual(q.rows,((0,),(1,)))
        a,b=q.signs
        near(self,b.y-(a.y+a.height),(a.height+b.height)/2)

    def test_flat_signs_preserve_silhouette_ratio(self):
        for sign in '𓈖𓏏':
            q=compose([sign],C)
            g=q.signs[0]
            box=glyph_geometry()[sign]
            near(self,g.width/g.height,(box[2]-box[0])/(box[3]-box[1]))
            near(self,g.width,C/2)
            near(self,q.height,2*g.height)

    def test_ultranarrow_stroke_has_bounded_height(self):
        q=compose(list('𓏺'),C)
        self.assertEqual(q.rows,((0,),))
        self.assertLessEqual(q.signs[0].height,C+1e-8)
        near(self,q.height,2*q.signs[0].height)
        self.assertGreaterEqual(q.signs[0].x,0)
        self.assertLessEqual(q.signs[0].x+q.signs[0].width,C+1e-8)

    def test_svg_bearing_coordinates_match_ink_rectangle(self):
        for sign in '𓅓𓇋𓏏𓈖𓏺':
            g=compose([sign],C).signs[0]
            left,bottom,right,top=glyph_geometry()[sign]
            near(self,g.text_x+left*g.font_size,g.x)
            near(self,g.text_x+right*g.font_size,g.x+g.width)
            near(self,g.text_y-top*g.font_size,g.y)
            near(self,g.text_y-bottom*g.font_size,g.y+g.height)

    def test_justification_changes_only_whitespace(self):
        q=compose(list('𓅓𓇋𓏏'),C)
        other=expand_internal(q,11)
        near(self,other.height,q.height+11)
        self.assertEqual(q.rows,other.rows)
        for old,new in zip(q.signs,other.signs):
            near(self,old.x,new.x)
            near(self,old.width,new.width)
            near(self,old.height,new.height)
            near(self,old.font_size,new.font_size)
            near(self,new.text_y-old.text_y,new.y-old.y)

if __name__=='__main__':unittest.main()
