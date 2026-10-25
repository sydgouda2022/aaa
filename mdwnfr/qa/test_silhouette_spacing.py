"""Silhouette layout invariants across real shipped Egyptian font profiles."""
import json,math,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'core'))
from mdwnfr.quadrat import compose,expand_internal,expand_to_ink_bottom,glyph_geometry,glyph_scanlines,_silhouette_advance
from mdwnfr.layout import fixed_page_column_grid, layout_document, column_width_mm

C=20.0
def near(test,left,right):
    test.assertTrue(math.isclose(left,right,rel_tol=1e-8,abs_tol=1e-8),
                    f'{left} != {right}')

class VisibleInkComposition(unittest.TestCase):
    def test_one_font_one_catalogue(self):
        data=json.loads((ROOT/'core/mdwnfr/data/glyph_geometry.json').read_text())
        self.assertEqual(data['format'],'mdwnfr-glyph-ink-v2')
        self.assertEqual(data['resolution'],64)
        self.assertEqual(len(glyph_scanlines()),1072)
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
        near(self,s.y,0.0)
        near(self,q.height-s.y-s.height,s.height/2)
        near(self,q.height,1.5*s.height)
        self.assertEqual(len(q.flexible_gaps),1)

    def test_real_silhouette_profiles_reduce_unused_gap(self):
        # Complementary half-width ink contours may have overlapping
        # rectangular boxes while their actual ink remains well separated.
        a=[[0,32] for _ in range(64)]
        b=[[32,64] for _ in range(64)]
        gap=_silhouette_advance(a,b,2.0,4.0,2.0,4.0)
        self.assertGreater(gap,1.0)  # includes the quarter-sum-width ink gap
        self.assertLess(gap,3.0)    # bounding-rectangle gap would be 3.0
        for row_a,row_b in zip(a,b):
            free=(gap+row_b[0]*2/64)-(row_a[1]*2/64)
            self.assertGreaterEqual(free,(2+2)/4)

    def test_each_glyph_has_nonempty_bounded_silhouette(self):
        for sign,rows in glyph_scanlines().items():
            self.assertEqual(len(rows),64,sign)
            self.assertTrue(any(r is not None for r in rows),sign)
            for r in rows:
                if r is not None:self.assertTrue(0<=r[0]<r[1]<=64,sign)

    def test_two_slender_glyphs_share_row_and_gap_is_half_width(self):
        q=compose(list('𓇋𓇋'),C)
        self.assertEqual(q.rows,((0,1),))
        a,b=q.signs
        near(self,a.height,b.height)
        near(self,b.x-a.x-a.width,(a.width+b.width)/4)
        near(self,a.y,0.0)
        near(self,q.height-(a.y+a.height),a.height/2)
        near(self,q.height,1.5*a.height)
        for g in (a,b):
            box=glyph_geometry()[g.sign]
            near(self,g.width/g.height,(box[2]-box[0])/(box[3]-box[1]))

    def test_mixed_slender_signs_use_taller_row(self):
        q=compose(list('𓇋𓇄'),C)
        self.assertEqual(q.rows,((0,1),))
        a,b=q.signs
        taller=max(a.height,b.height)
        near(self,q.height,1.5*taller)
        near(self,a.y+a.height/2,b.y+b.height/2)
        near(self,q.flexible_gaps[0],taller/2)
        self.assertEqual(len(q.flexible_gaps),1)

    def test_owl_does_not_share_row_with_narrow_reed(self):
        q=compose(list('𓇋𓅓'),C)
        self.assertEqual(q.rows,((0,),(1,)))
        a,b=q.signs
        near(self,b.y-(a.y+a.height),a.height/2)
        near(self,a.y,0.0)

    def test_flat_signs_preserve_silhouette_ratio(self):
        for sign in '𓈖𓏏':
            q=compose([sign],C)
            g=q.signs[0]
            box=glyph_geometry()[sign]
            near(self,g.width/g.height,(box[2]-box[0])/(box[3]-box[1]))
            ratio=(box[2]-box[0])/(box[3]-box[1])
            target=min(3*C/4,max(C/2,ratio*C/4))
            near(self,g.width,target)
            self.assertGreaterEqual(g.width,C/2)
            self.assertLessEqual(g.width,3*C/4)
            near(self,q.height,1.5*g.height)

    def test_ultranarrow_stroke_has_bounded_height(self):
        q=compose(list('𓏺'),C)
        self.assertEqual(q.rows,((0,),))
        self.assertLessEqual(q.signs[0].height,C+1e-8)
        near(self,q.height,1.5*q.signs[0].height)
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

    def test_independent_words_share_exact_silhouette_row_spacing(self):
        from mdwnfr.document import new_document,transaction
        from mdwnfr.layout import layout_document
        doc=new_document('Measured column spacing')
        doc=transaction(doc,{'op':'insert_word','index':0,'signs':['𓅓']})
        doc=transaction(doc,{'op':'insert_word','index':1,'signs':['𓈖']})
        result=layout_document(doc)
        placements=[item for page in result['pages'] for col in page['columns']
                    for item in col['placements'] if item.get('type')=='word']
        self.assertGreaterEqual(len(placements),2)
        first,second=placements[:2]
        a=first['quadrat']['signs'][0]
        b=second['quadrat']['signs'][0]
        bottom=first['y']+a['y']+a['height']
        top=second['y']+b['y']
        # Document placements are rounded to 5 decimal places in millimetres.
        self.assertAlmostEqual(top-bottom,a['height']/2,places=4)

    def test_asymmetric_neighbors_have_one_preceding_half_height_gap(self):
        for sequence in ('𓅓𓈖', '𓈖𓅓', '𓅓𓅓', '𓈖𓈖'):
            q=compose(list(sequence),C)
            self.assertEqual(q.rows,((0,),(1,)))
            first,next_sign=q.signs
            near(self,first.y,0.0)
            near(self,next_sign.y-first.y-first.height,first.height/2)
            near(self,q.height-next_sign.y-next_sign.height,next_sign.height/2)
            near(self,q.height,1.5*(first.height+next_sign.height))
            self.assertEqual(len(q.flexible_gaps),2)

    def test_several_rows_have_only_one_trailing_half_height_gap(self):
        for sequence in ('𓅓𓏏𓈖𓇋', '𓇋𓇋𓅓𓏏', '𓏏𓅓𓅓'):
            q=compose(list(sequence),C)
            self.assertEqual(len(q.rows),len(q.flexible_gaps))
            heights=[max(q.signs[i].height for i in row) for row in q.rows]
            near(self,q.height,1.5*sum(heights))
            for index,row in enumerate(q.rows):
                top=min(q.signs[i].y for i in row)
                if index==0:near(self,top,0.0)
                else:
                    preceding=q.rows[index-1]
                    bottom=max(q.signs[i].y+q.signs[i].height for i in preceding)
                    near(self,top-bottom,heights[index-1]/2)
                near(self,q.flexible_gaps[index],heights[index]/2)

    def test_fixed_paper_shares_remaining_width_and_papyrus_keeps_nominal(self):
        count,width=fixed_page_column_grid(310,15)
        self.assertEqual(count,20)
        near(self,width,15.5)
        near(self,count*width,310)
        # A4 uses the SAME uniform width for every occupied column slot.
        from mdwnfr.document import new_document
        from mdwnfr.document import SURFACES,validated_margins
        doc=new_document('Fixed paper width')
        frame=SURFACES[doc['surface']][0]-sum(validated_margins(doc)[s]
                                              for s in ('left','right'))
        expected_n,expected_width=fixed_page_column_grid(
            frame,column_width_mm(doc['font_size_pt']))
        result=layout_document(doc)
        near(self,result['column_width_mm'],expected_width)
        near(self,expected_n*result['column_width_mm'],frame)
        papyrus={**doc,'surface':'papyrus'}
        papyrus_result=layout_document(papyrus)
        near(self,papyrus_result['column_width_mm'],
             column_width_mm(doc['font_size_pt']))

    def test_equal_justification_shares_per_sign_and_not_per_word(self):
        q=compose(list('𓇋𓇋𓅓𓏏'),C)
        self.assertEqual(q.rows[0],(0,1))
        remainder=10
        adjusted=expand_internal(q,remainder)
        self.assertEqual(len(q.signs),4)
        near(self,adjusted.height-q.height,remainder)
        old_gaps=q.flexible_gaps
        new_gaps=adjusted.flexible_gaps
        for index,group in enumerate(q.rows):
            near(self,new_gaps[index]-old_gaps[index],
                 remainder*len(group)/len(q.signs))
        for before,after in zip(q.signs,adjusted.signs):
            near(self,before.height,after.height)
            near(self,before.width,after.width)
            near(self,before.font_size,after.font_size)
            near(self,before.x,after.x)

    def test_completed_page_column_expands_each_word_equally(self):
        from mdwnfr.document import new_document,transaction,validated_margins,SURFACES
        doc=new_document('Fit the remaining column')
        for i in range(34):
            doc=transaction(doc,{'op':'insert_word','index':i,'signs':['𓅓']})
        result=layout_document(doc)
        first=[col for page in result['pages'] for col in page['columns']
               if col['kind']=='words' and col['placements']][0]
        word_positions=first['placements']
        self.assertGreaterEqual(len(word_positions),3)
        top=validated_margins(doc)['top']
        bottom=SURFACES[doc['surface']][1]-validated_margins(doc)['bottom']
        last=word_positions[-1]
        self.assertAlmostEqual(last['y']+last['height'],bottom,places=4)
        self.assertAlmostEqual(word_positions[0]['y'],top,places=4)
        natural=compose(['𓅓'],result['column_width_mm'])
        expected=(bottom-top-len(word_positions)*natural.height)/len(word_positions)
        self.assertGreater(expected,0.0)
        for entry in word_positions:
            self.assertAlmostEqual(entry['height']-natural.height,expected,places=4)
        for left,right in zip(word_positions,word_positions[1:]):
            self.assertAlmostEqual(right['y']-(left['y']+left['height']),0,places=4)

    def test_completed_column_balances_first_and_last_visible_ink(self):
        from mdwnfr.document import new_document,transaction,validated_margins,SURFACES
        from mdwnfr.layout import incremental_layout_document,expand_compact_layout
        doc=new_document('Page edge ink')
        for i in range(34):
            doc=transaction(doc,{'op':'insert_word','index':i,
                                 'signs':['𓅓'] if i%3 else ['𓈖']})
        full=layout_document(doc)
        ink_cols=[col for p in full['pages'] for col in p['columns']
                  if col['kind']=='words' and col.get('ink_bottom_aligned')]
        self.assertTrue(ink_cols,'Expected at least one full justified column')
        margins=validated_margins(doc)
        bottom=SURFACES[doc['surface']][1]-margins['bottom']
        for col in ink_cols:
            words=col['placements']
            first=words[0]
            last=words[-1]
            first_ink=first['y']+min(s['y'] for s in first['quadrat']['signs'])
            last_ink=last['y']+max(s['y']+s['height'] for s in last['quadrat']['signs'])
            self.assertAlmostEqual(first_ink,margins['top'],places=4)
            self.assertAlmostEqual(last_ink,bottom,places=4)
            self.assertAlmostEqual(last['y']+last['height'],bottom,places=4)
            self.assertAlmostEqual(last['quadrat']['flexible_gaps'][-1],0,places=7)
        compact,_=incremental_layout_document(doc,compact=True)
        detailed=expand_compact_layout(compact,{o['id']:o for o in doc['items']})
        compact_cols=[col for p in detailed['pages'] for col in p['columns']
                      if col['kind']=='words' and col.get('ink_bottom_aligned')]
        self.assertEqual(len(ink_cols),len(compact_cols))
        for original,derived in zip(ink_cols,compact_cols):
            self.assertEqual([p['id'] for p in original['placements']],
                             [p['id'] for p in derived['placements']])
            for a,b in zip(original['placements'],derived['placements']):
                self.assertAlmostEqual(a['y'],b['y'],places=5)
                for a_sign,b_sign in zip(a['quadrat']['signs'],b['quadrat']['signs']):
                    self.assertAlmostEqual(a_sign['y'],b_sign['y'],places=7)
                    self.assertAlmostEqual(a_sign['height'],b_sign['height'],places=7)

    def test_final_edge_redistribution_does_not_stretch_ink(self):
        q=compose(list('𓅓𓇋𓈖'),C)
        share=3.0
        tail=q.flexible_gaps[-1]
        eligible=sum(len(row) for row in q.rows[:-1])
        expected_extra=share*eligible-tail
        result=expand_to_ink_bottom(q,expected_extra)
        near(self,result.height,q.height+expected_extra)
        near(self,result.flexible_gaps[-1],0.0)
        for index,row in enumerate(q.rows[:-1]):
            near(self,result.flexible_gaps[index]-q.flexible_gaps[index],
                 share*len(row))
        for original,changed in zip(q.signs,result.signs):
            near(self,original.width,changed.width)
            near(self,original.height,changed.height)
            near(self,original.font_size,changed.font_size)
            near(self,original.x,changed.x)

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
