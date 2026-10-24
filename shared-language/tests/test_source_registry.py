import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'src'))
from source_registry import read_registry, validate_registry, verified_source_manifest

class SourceRegistryTests(unittest.TestCase):
    def setUp(self): self.registry=read_registry()
    def test_all_source_editions_present_and_prioritized(self):
        self.assertEqual([s['id'] for s in self.registry['sources']],
                         ['TLA-C20','TLA-LE19','RAMSES','AED','AES','ORAEC','LESKO-2ED'])
    def test_four_source_families_and_shared_lineage(self):
        self.assertEqual(validate_registry(self.registry)['source_families'],4)
        ss={x['id']:x for x in self.registry['sources']}
        self.assertEqual(ss['AED']['independence_group'],ss['AES']['independence_group'])
        self.assertEqual(ss['AES']['independence_group'],ss['ORAEC']['independence_group'])
    def test_restricted_sources_never_auto_publish(self):
        for sid in ('RAMSES','LESKO-2ED','TLA-C20'):
            with self.subTest(sid=sid),self.assertRaises(PermissionError):
                verified_source_manifest(self.registry,{sid:dict(path='/tmp/any',version='v',sha256='0'*64,license='x',attribution='a')})
    def test_actual_file_pin_required(self):
        with tempfile.TemporaryDirectory() as t:
            path=Path(t)/'data.jsonl';path.write_bytes(b'{"x":1}\n')
            good=dict(path=str(path),version='pin-1',sha256=hashlib.sha256(path.read_bytes()).hexdigest(),license='CC-BY-SA-4.0',attribution='Authors and editors')
            manifest=verified_source_manifest(self.registry,{'AES':good})
            self.assertEqual(manifest['sources'][0]['id'],'AES')
            self.assertEqual(manifest['sources'][0]['lineage'],'BBAW-2018-EXTRACT')
            bad={**good,'sha256':'0'*64}
            with self.assertRaisesRegex(ValueError,'SHA-256'):
                verified_source_manifest(self.registry,{'AES':bad})
    def test_unrecognized_or_incompatible_license_fails(self):
        with tempfile.TemporaryDirectory() as t:
            path=Path(t)/'data';path.write_bytes(b'x')
            info=dict(path=str(path),version='v1',sha256=hashlib.sha256(b'x').hexdigest(),license='copyrighted',attribution='Author')
            with self.assertRaisesRegex(ValueError,'License mismatch'):
                verified_source_manifest(self.registry,{'AED':info})
    def test_policy_does_not_let_restricted_switch_publishable(self):
        reg=copy.deepcopy(self.registry)
        next(x for x in reg['sources'] if x['id']=='LESKO-2ED')['publishable']=True
        with self.assertRaisesRegex(ValueError,'Restricted'):
            validate_registry(reg)

if __name__ == '__main__':unittest.main()
