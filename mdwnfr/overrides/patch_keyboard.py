"""Patch the pinned MdwNfr Python keyboard and browser display in CI."""
from pathlib import Path
import sys

def substitute(path,old,new):
    text=path.read_text(encoding='utf-8')
    if text.count(old)!=1:
        raise RuntimeError('Keyboard patch anchor mismatch: '+str(path)+' '+repr(old[:65]))
    path.write_text(text.replace(old,new),encoding='utf-8')

def patch(root):
    root=Path(root)
    lex=root/'core/mdwnfr/lexicon.py'
    substitute(lex,"        self.metadata['spelling_records']=len(self.entries)\n",
"""        expected=self.metadata.get('spelling_records')
        if expected is not None and expected!=len(self.entries):
            raise ValueError('Verified dictionary spelling count mismatch')
        self.metadata['spelling_records']=len(self.entries)
        self.metadata['unique_native_surfaces']=len({x['signs'] for x in self.entries})
""")
    substitute(lex,
"""        # Small-index fuzzy matching: a spelling must share at least one actual sign.
        candidate_ids=set().union(*(self.by_sign.get(s,set()) for s in typed))
        for idx in candidate_ids:
""",
"""        # Prefer contiguous native SIGN PREFIXES in the 41k form lexicon.
        # Shared-sign fuzzy search is only a fallback when no prefix exists.
        candidate_ids={i for i in self.by_first.get(typed[0],())
                       if self.entries[i]['signs'].startswith(pattern)}
        if not candidate_ids:
            candidate_ids=set().union(*(self.by_sign.get(s,set()) for s in typed))
        for idx in candidate_ids:
""")
    substitute(lex,
"""            score+=_choice_bonus(value,global_choices,document_choices)
            # Verified primary is tie-break only; never allows nonprefix above prefix.
""",
"""            score+=_choice_bonus(value,global_choices,document_choices)
            is_rtc=record.get('lexical_identity_verified') is False or (
                record.get('source')=='RAMSES-WORD-MODEL-2023')
            n=record.get('attestations',0)
            if isinstance(n,(int,float)) and not isinstance(n,bool) and n>0:
                score+=min(85,round(12*math.log1p(n)))
            if not is_rtc:score+=18
            # Verified primary is tie-break only; never allows nonprefix above prefix.
""")
    substitute(lex,
"""            unique.append({'signs':list(value),'source':source,'lexicon_ref':ref if source=='lexicon' else None})
""",
"""            is_rtc=(source=='lexicon' and (
                record.get('lexical_identity_verified') is False or
                record.get('source')=='RAMSES-WORD-MODEL-2023'))
            unique.append({'signs':list(value),'source':source,
                           'lexicon_ref':ref if source=='lexicon' else None,
                           'source_tier':'ramses_corpus' if is_rtc else
                                  ('lemma_linked' if source=='lexicon' else 'personal'),
                           'lexical_identity_verified':source=='lexicon' and not is_rtc})
""")
    substitute(lex,
"""                'exact_attested':pattern in self._exact_set()}
""",
"""                'exact_attested':pattern in self._exact_set(),
                'dictionary_spelling_records':self.metadata['spelling_records']}
""")
    app=root/'web/app.js'
    original=app.read_text(encoding='utf-8')
    first=original.index("  $('lexicon-status').textContent=")
    last=original.index("  // No implicit 'Untitled' document",first)
    if "const notice=$('lexicon-notice');" not in original[first:last]:
        raise RuntimeError('Source keyboard status layout unexpectedly changed')
    replacement="""  // This verified JSON is the same source the Python worker indexes.
  // The master SQLite lives in CI; it is NOT a missing PWA requirement.
  const nativeForms=lexiconMeta.unique_native_surfaces||lexiconMeta.spelling_records;
  $('lexicon-status').textContent='Late Egyptian · '+nativeForms.toLocaleString()+
    ' native forms · '+lexiconMeta.spelling_records.toLocaleString()+
    ' spelling records · '+lexiconMeta.lexemes.toLocaleString()+' linked lemmata';
  const notice=$('lexicon-notice');
  notice.hidden=true;
  notice.textContent='';
"""
    app.write_text(original[:first]+replacement+original[last:],encoding='utf-8')
    substitute(app,
""" if(candidate.source==='personal')button.classList.add('personal-choice');
 button.setAttribute('aria-label',(candidate.source==='user'?'Use own spelling ':candidate.source==='personal'?'Use personal spelling ':'Choose spelling ')+candidate.signs.join(''));
 button.title=candidate.source==='user'?'Your exact input':candidate.source==='personal'?'Personal dictionary spelling':'Published lexicon spelling';
 button.onclick=()=>commit(candidate);
""",
""" if(candidate.source==='personal')button.classList.add('personal-choice');
 const rtc=candidate.source_tier==='ramses_corpus';
 if(rtc){
  button.classList.add('ramses-choice');
  const tag=document.createElement('small');
  tag.className='evidence-tag';tag.textContent='RTC';button.append(tag);
 }
 button.setAttribute('aria-label',(candidate.source==='user'?'Use own spelling ':candidate.source==='personal'?'Use personal spelling ':rtc?'Use Ramses corpus spelling ':'Choose lemma-linked spelling ')+candidate.signs.join(''));
 button.title=candidate.source==='user'?'Your exact input':candidate.source==='personal'?'Personal dictionary spelling':rtc?'Ramses Late Egyptian corpus · sign sequence verified, lemma identity not verified':'TLA/AES Late Egyptian spelling with verified lemma source';
 button.onclick=()=>commit(candidate);
""")
    css=root/'web/style.css'
    css.write_text(css.read_text(encoding='utf-8')+
""" 
/* Compact word-source label, without changing logical word placement. */
.keyboard-panel .suggestions button.ramses-choice,.expanded-grid button.ramses-choice{position:relative;padding-right:30px}
.suggestions .evidence-tag,.expanded-grid .evidence-tag{position:absolute;right:4px;bottom:2px;font:600 9px system-ui,sans-serif;color:#426582;background:#e8f1f5;padding:1px 3px;border-radius:3px}
""",encoding='utf-8')
    print('Patched source-aware 41k Python keyboard')

if __name__=='__main__':
    patch(sys.argv[1] if len(sys.argv)>1 else 'mdwnfr')
