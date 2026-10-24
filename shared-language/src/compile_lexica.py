#!/usr/bin/env python3
"""Reproducible, conservative Egyptian/Coptic lexical compilers.

External sources are acquired at BUILD TIME only. Published PWA assets never
fetch a live third-party service. Both modes write authoritative SQLite and
compact prediction JSON derived from the *same imported records*.

Completeness is intentionally FALSE: no source provides every attested form.
"""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import unicodedata
import xml.etree.ElementTree as ET

TEI='{http://www.tei-c.org/ns/1.0}'
XML='{http://www.w3.org/XML/1998/namespace}'


def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda:f.read(1<<20), b''):
            h.update(chunk)
    return h.hexdigest()


def hieroglyphic(s):
    return isinstance(s,str) and bool(s) and all(0x13000<=ord(c)<=0x1345F for c in s) and any(0x13000<=ord(c)<=0x1342F for c in s)


def coptic(s):
    return isinstance(s,str) and bool(s) and any(0x2C80<=ord(c)<=0x2CFF or 0x03E2<=ord(c)<=0x03EF or 0x0370<=ord(c)<=0x03FF or 0x1F00<=ord(c)<=0x1FFF for c in s)


def xml_entries(path):
    for _event,el in ET.iterparse(path,events=('end',)):
        if el.tag==TEI+'entry':
            yield el
            el.clear()


def aed_metadata(path):
    results={}
    for e in xml_entries(path):
        label=e.get(XML+'id','')
        if not label.startswith('tla') or not label[3:].isdigit():
            continue
        head=e.find('.//'+TEI+'form/'+TEI+'orth')
        gram=e.find('.//'+TEI+'gramGrp/'+TEI+'term')
        gloss=None
        for cit in e.findall('.//'+TEI+'sense/'+TEI+'cit'):
            if cit.get(XML+'lang')=='en' and cit.get('type')=='translation':
                gloss=' '.join(''.join(cit.itertext()).split());break
        results[label[3:]]={
            'headword': ''.join(head.itertext()).strip() if head is not None else '',
            'pos': ''.join(gram.itertext()).strip() if gram is not None else '',
            'gloss':gloss or '',
            'aed_ref':label,
        }
    return results


def source_rows(path):
    """Each whitespace-delimited Unicode hieroglyph cluster is an attested token.

    Link lemma IDs only if the complete token/lemma alignment is unambiguous.
    Unicode words with unavailable nonstandard glyph notation are excluded,
    rather than pretending a partial sign sequence is complete.
    """
    counts=collections.Counter()
    evidence=collections.defaultdict(list)
    stats=collections.Counter()
    with Path(path).open(encoding='utf-8-sig') as stream:
        for line_number,line in enumerate(stream,1):
            if not line.strip():continue
            stats['sentences']+=1
            row=json.loads(line)
            surface_tokens=(row.get('hieroglyphs') or '').split()
            lemma_tokens=(row.get('lemmatization') or '').split()
            mapped=[]
            for fragment in lemma_tokens:
                m=re.fullmatch(r'(\d+)\|(.+)',fragment)
                if not m:break
                mapped.append(m.group(1))
            aligned=len(mapped)==len(surface_tokens)==len(lemma_tokens)
            if aligned:stats['aligned_sentences']+=1
            for i,spelling in enumerate(surface_tokens):
                if not hieroglyphic(spelling):
                    stats['unencoded_word_tokens']+=1
                    continue
                lemma=(mapped[i] if aligned else 'unresolved')
                key=(lemma,unicodedata.normalize('NFC',spelling))
                counts[key]+=1
                # Bound evidence per spelling so corpus references remain compact.
                if len(evidence[key])<24:evidence[key].append(line_number)
                stats['encoded_word_tokens']+=1
    return counts,evidence,stats


def db_connect(path):
    dest=Path(path)
    if dest.exists():raise FileExistsError('Refuse accidental overwrite: '+str(dest))
    dest.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(str(dest))
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA journal_mode=DELETE')
    db.executescript('''
      CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE lemma(id TEXT PRIMARY KEY,headword TEXT,pos TEXT,gloss TEXT);
      CREATE TABLE spelling(id TEXT PRIMARY KEY,lemma_id TEXT NOT NULL REFERENCES lemma(id),
        native_form TEXT NOT NULL,dialect_mask INTEGER NOT NULL DEFAULT 0,
        frequency INTEGER NOT NULL DEFAULT 0,
        UNIQUE(lemma_id,native_form,dialect_mask));
      CREATE TABLE attestation(id TEXT PRIMARY KEY,spelling_id TEXT NOT NULL REFERENCES spelling(id),
        source TEXT NOT NULL,original_ref TEXT NOT NULL,source_sha256 TEXT NOT NULL);
      CREATE INDEX idx_spelling_native ON spelling(native_form);
      CREATE INDEX idx_attestation_word ON attestation(spelling_id);
    ''')
    return db


def persist_json(path, payload):
    Path(path).parent.mkdir(parents=True,exist_ok=True)
    Path(path).write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')


def build_egyptian(tla_path,aed_path,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    counts,evidence,stats=source_rows(tla_path)
    aed=aed_metadata(aed_path) if aed_path else {}
    sha_tla=digest(tla_path)
    sha_aed=digest(aed_path) if aed_path else None
    db=db_connect(out/'lexicon.sqlite3')
    db.execute('INSERT INTO metadata VALUES (?,?)',('language','egy'))
    db.execute('INSERT INTO metadata VALUES (?,?)',('stage','Late Egyptian'))
    db.execute('INSERT INTO metadata VALUES (?,?)',('tla_sha256',sha_tla))
    if sha_aed:db.execute('INSERT INTO metadata VALUES (?,?)',('aed_sha256',sha_aed))
    entries=[]
    for (lemma,form),frequency in sorted(counts.items()):
        lexical_id=('tla19:'+lemma if lemma!='unresolved' else 'unresolved:'+hashlib.sha256(form.encode()).hexdigest()[:12])
        a=aed.get(lemma,{})
        db.execute('INSERT OR IGNORE INTO lemma VALUES (?,?,?,?)',(lexical_id,a.get('headword',''),a.get('pos',''),a.get('gloss','')))
        record_id='tla19:'+hashlib.sha256((lexical_id+'|'+form).encode()).hexdigest()[:20]
        db.execute('INSERT INTO spelling(id,lemma_id,native_form,frequency) VALUES (?,?,?,?)',
                   (record_id,lexical_id,form,frequency))
        for at in evidence[(lemma,form)]:
            ref='line:'+str(at)
            att_id=hashlib.sha256((record_id+ref).encode()).hexdigest()[:24]
            db.execute('INSERT OR IGNORE INTO attestation VALUES (?,?,?,?,?)',(att_id,record_id,'TLA-LE19',ref,sha_tla))
        entries.append({'ref':record_id,'signs':form,'lemma':lexical_id,
                        'source':'TLA-LE19','primary':True,'attestations':frequency})
    db.commit()
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    match_count=db.execute("SELECT COUNT(*) FROM lemma WHERE headword != ''").fetchone()[0]
    db.close()
    payload={'format':'mdwnfr-predict-v1',
        'metadata':{'name':'Late Egyptian Attested Unicode Lexicon','complete':False,
                    'stage':'Late Egyptian', 'lexemes':len({x['lemma'] for x in entries}),
                    'spelling_records':len(entries),
                    'source_corpus':'TLA Late Egyptian v19 premium; AED lexical crosswalk',
                    'tla_sha256':sha_tla,'aed_sha256':sha_aed,
                    'aed_matched_lemmas':match_count,
                    'evidence_status':'source-filtered-not-exhaustive'},'entries':entries}
    persist_json(out/'lexicon.json',payload)
    report={'language':'egy','stage':'Late Egyptian','unique_spellings':len(entries),
            'distinct_lemmas':len({x['lemma'] for x in entries}),
            'aed_dictionary_entries':len(aed),'aed_matched_lemmas':match_count,**stats,
            'sources':{'TLA-LE19':sha_tla,'AED-TEI':sha_aed},
            'claim':'Entire downloaded Late Egyptian filtered release processed; not all known Late Egyptian text'}
    persist_json(out/'coverage.json',report)
    return report


def geo_mask(labels):
    mask=0
    for label in labels:
        x=' '.join(label.split()).upper()
        if x in ('S','SAHIDIC'): mask|=1
        if x in ('B','BOHAIRIC'):mask|=2
    return mask


def coptic_tei_forms(path):
    """Preserve entries' morphology/senses separately from surface prediction."""
    evidence=[]
    stats=collections.Counter()
    for e in xml_entries(path):
        lemma=e.get(XML+'id') or 'unidentified'
        stats['entries']+=1
        pos=e.find('./'+TEI+'gramGrp/'+TEI+'pos')
        gloss=None
        for q in e.findall('.//'+TEI+'sense/'+TEI+'cit'):
            if q.get('type')!='translation':continue
            for de in q:
                if de.get(XML+'lang')=='en' and de.tag in (TEI+'def',TEI+'quote'):
                    gloss=' '.join(''.join(de.itertext()).split())
                    break
            if gloss:break
        for form in e.findall('./'+TEI+'form'):
            fm=form.get(XML+'id','')
            labels=[''.join(x.itertext()) for x in form.findall('./'+TEI+'usg') if x.get('type')=='geo']
            mask=geo_mask(labels)
            for orth in form.findall('./'+TEI+'orth'):
                s=unicodedata.normalize('NFC',''.join(orth.itertext()).strip())
                if not coptic(s):
                    stats['skipped_non_coptic']+=1;continue
                evidence.append((lemma,fm,s,mask,
                                 ''.join(pos.itertext()).strip() if pos is not None else '',gloss or ''))
                stats['written_forms']+=1
    return evidence,stats


def build_coptic(tei_path,forms_path,popular_path,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    core=json.loads(Path(forms_path).read_text(encoding='utf-8'))
    extra=json.loads(Path(popular_path).read_text(encoding='utf-8'))
    if core.get('dialects')!=['Sahidic','Bohairic']:
        raise ValueError('Unknown existing Coptic dialect inventory')
    merger={}
    for word,mask in core['rows']:
        if coptic(word) and isinstance(mask,int):merger[word]=merger.get(word,0)|mask
    supplement={}
    for word,n in extra['rows']:
        if coptic(word) and isinstance(n,int) and n>=0:
            merger.setdefault(word,0)
            supplement[word]=max(supplement.get(word,0),n)
    tei_evidence,stats=coptic_tei_forms(tei_path)
    for lemma,form_ref,word,mask,pos,gloss in tei_evidence:
        merger[word]=merger.get(word,0)|mask
    db=db_connect(out/'lexicon.sqlite3')
    source_hashes={
        'KELLIA-TEI':digest(tei_path),
        'SCRIPTORIUM-FORMS':digest(forms_path),
        'KELLIA-SUPPLEMENT':digest(popular_path)}
    db.execute('INSERT INTO metadata VALUES (?,?)',('language','cop'))
    for key,value in source_hashes.items():db.execute('INSERT INTO metadata VALUES (?,?)',(key,value))
    lemmas=set(); forms_inserted=set()
    for lemma,form_ref,word,mask,pos,gloss in tei_evidence:
        lid='kellia:'+lemma
        if lid not in lemmas:
            db.execute('INSERT INTO lemma VALUES (?,?,?,?)',(lid,word,pos,gloss))
            lemmas.add(lid)
        # row IDs resolve word+source lemma so homographs can coexist.
        sid='coptic:'+hashlib.sha256((lid+'|'+word).encode()).hexdigest()[:20]
        if sid not in forms_inserted:
            db.execute('INSERT INTO spelling(id,lemma_id,native_form,dialect_mask,frequency) VALUES (?,?,?,?,?)',
                (sid,lid,word,mask,supplement.get(word,0)))
            forms_inserted.add(sid)
        eid=hashlib.sha256((sid+form_ref).encode()).hexdigest()[:24]
        db.execute('INSERT OR IGNORE INTO attestation VALUES (?,?,?,?,?)',
                   (eid,sid,'KELLIA-TEI',lemma+'/'+form_ref,source_hashes['KELLIA-TEI']))
    for word,mask in sorted(merger.items()):
        # Words without matching TEI lemmas remain marked as unlinked, not fabricated.
        lid='unlinked:'+hashlib.sha256(word.encode()).hexdigest()[:20]
        db.execute('INSERT OR IGNORE INTO lemma VALUES (?,?,?,?)',(lid,word,'',''))
        sid='coptic:'+hashlib.sha256((lid+'|'+word).encode()).hexdigest()[:20]
        db.execute('INSERT OR IGNORE INTO spelling(id,lemma_id,native_form,dialect_mask,frequency) VALUES (?,?,?,?,?)',
                   (sid,lid,word,mask,supplement.get(word,0)))
    db.commit()
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    master_forms=db.execute('SELECT COUNT(*) FROM spelling').fetchone()[0]
    db.close()
    rows=[[word,mask] for word,mask in sorted(merger.items())]
    payload={'format':'coptic-predict-v1','language':'cop','dialects':['Sahidic','Bohairic'],
        'rows':rows,'popularity':dict(sorted(supplement.items())),
        'metadata':{'spelling_records':len(rows),'complete':False,
                    'source_editions':[{'source':k,'sha256':v} for k,v in sorted(source_hashes.items())],
                    'source_tei_lemmas':stats['entries'],
                    'source_tei_forms':stats['written_forms'],
                    'coverage':'all-eligible-downloaded-TEI-forms-not-all-possible-Coptic'}}
    persist_json(out/'lexicon.json',payload)
    report={'language':'cop','unique_written_forms':len(rows),'sqlite_spelling_records':master_forms,
            'tei_lemmas':stats['entries'],'tei_forms':stats['written_forms'],
            'S_only':sum(m==1 for m in merger.values()),
            'B_only':sum(m==2 for m in merger.values()),
            'S_and_B':sum(m==3 for m in merger.values()),
            'dialect_unassigned':sum(m==0 for m in merger.values()),
            'sources':source_hashes,'claim':'Imported full licensed TEI edition; completeness beyond these sources not established'}
    persist_json(out/'coverage.json',report)
    return report


def main():
    p=argparse.ArgumentParser()
    sub=p.add_subparsers(dest='language',required=True)
    e=sub.add_parser('egyptian');e.add_argument('--tla',type=Path,required=True);e.add_argument('--aed',type=Path,required=True);e.add_argument('--out',type=Path,required=True)
    c=sub.add_parser('coptic');c.add_argument('--tei',type=Path,required=True);c.add_argument('--forms',type=Path,required=True);c.add_argument('--popular',type=Path,required=True);c.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    if args.language=='egyptian': report=build_egyptian(args.tla,args.aed,args.out)
    else:report=build_coptic(args.tei,args.forms,args.popular,args.out)
    print(json.dumps(report,ensure_ascii=False,sort_keys=True))

if __name__=='__main__':main()
