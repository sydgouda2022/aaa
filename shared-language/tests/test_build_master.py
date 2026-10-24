import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from build_master import build_master

HASH = 'a'*64
MANIFEST={'schema':1,'sources':[
    {'id':'TLA','version':'synthetic','license':'test','sha256':HASH,'lineage':'TLA-line'},
    {'id':'AED','version':'synthetic','license':'test','sha256':'b'*64,'lineage':'BBAW-line'},
    {'id':'AES','version':'synthetic','license':'test','sha256':'c'*64,'lineage':'BBAW-line'}]}

def row(id,source,surface='𓄿',canonical='reviewed-L1',stage='Late Egyptian',lemma='L1',morphology=None):
    return dict(id=id,sourceId=source,sourceRef='text:'+id,language='egy',surface=surface,
                stage=stage,attested=True,lemmaId=lemma,canonicalLemmaId=canonical,
                morphology=morphology or {})

class BuildMasterTests(unittest.TestCase):
    def _build(self,rows):
        t=tempfile.TemporaryDirectory()
        path=Path(t.name)/'lexicon.sqlite3'
        summary=build_master(rows,MANIFEST,path)
        return t,path,summary
    def test_shared_spelling_is_one_form_with_all_source_evidence(self):
        t,path,summary=self._build([row('a','TLA'),row('b','AED'),row('c','AES')])
        try:
            self.assertEqual((summary['lemmas'],summary['spellings'],summary['evidence']),(1,1,3))
            with sqlite3.connect(path) as db:
                self.assertEqual(db.execute('select count(distinct independence_group) from evidence').fetchone()[0],2)
                self.assertEqual(db.execute('select count(*) from source').fetchone()[0],3)
                self.assertEqual(db.execute('select value from metadata where key="build_input_mode"').fetchone()[0],'build_time_only')
                self.assertEqual(db.execute('pragma integrity_check').fetchone()[0],'ok')
        finally:t.cleanup()
    def test_homographs_not_merged_without_explicit_lemma_crosswalk(self):
        a=row('1','TLA',canonical=None,lemma='A')
        b=row('2','AED',canonical=None,lemma='A')
        t,path,summary=self._build([a,b])
        try:self.assertEqual((summary['lemmas'],summary['spellings']),(2,2))
        finally:t.cleanup()
    def test_different_morphology_kept(self):
        t,path,summary=self._build([row('1','TLA'),row('2','AED',morphology={'number':'pl'})])
        try:self.assertEqual(summary['spellings'],2)
        finally:t.cleanup()
    def test_wrong_stage_and_unattested_rejected(self):
        for x in (row('x','TLA',stage='Earlier Egyptian'),{**row('x','TLA'),'attested':False},
                  row('x','TLA',surface='nfr')):
            with self.subTest(x=x),tempfile.TemporaryDirectory() as t:
                output=Path(t)/'db.sqlite3'
                with self.assertRaises(ValueError):build_master([x],MANIFEST,output)
                self.assertFalse(output.exists())
    def test_idempotent_source_repeats_and_safe_no_overwrite(self):
        t,path,summary=self._build([row('1','TLA'),row('1','TLA')])
        try:
            self.assertEqual(summary['evidence'],1)
            with self.assertRaises(FileExistsError):build_master([row('1','TLA')],MANIFEST,path)
        finally:t.cleanup()

if __name__=='__main__':unittest.main()
