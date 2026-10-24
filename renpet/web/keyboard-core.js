import {nativeNumber} from './calendar.js';

export const COPTIC_LETTERS=[...'ⲁⲃⲅⲇⲉⲋⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱϣϥϧϩϫϭϯ'];
export const EGY_NUMBERS=[
 ...Array.from({length:9},(_,i)=>({value:i+1,text:'𓏺'.repeat(i+1)})),
 ...[[10,'𓎆'],[100,'𓍢'],[1000,'𓆼'],[10000,'𓂭'],[100000,'𓆐'],[1000000,'𓁨']].map(([value,text])=>({value,text}))
];
export const COP_NUMBERS=[...Array.from({length:9},(_,i)=>i+1),10,100,1000].map(value=>({value,text:nativeNumber(value,'cop')}));
const cop=/[\p{Script=Coptic}\p{Script=Greek}\p{Mark}]+$/u;
const egy=/[\u{13000}-\u{1345f}]+$/u;
export function wordRange(input, caret, lang){
 const left=input.slice(0,caret);
 const matched=left.match(lang==='cop'?cop:egy);
 return {start:caret-(matched?.[0].length||0),end:caret,raw:matched?.[0]||''};
}
export function suggestions(raw,language,lexicon,learned={},limit=4){
 if(!raw)return [];
 // Canonicalize Coptic combining overbars/accents for searching, never for
 // insertion: the inserted candidate retains its attested original spelling.
 const fold=s=>s.normalize('NFD').toLocaleLowerCase().replace(/[\u0300-\u036f]/g,'');
 const query=language==='cop'?fold(raw):raw;
 const candidates=[];
 if(language==='cop'){
  for(const [form,mask] of lexicon?.rows||[]){
   if(form!==raw&&fold(form).startsWith(query))
    candidates.push({text:form,dialects:mask,frequency:lexicon?.popularity?.[form]||0});
  }
 }else if(language==='egy'){
  for(const [text,frequency,lemma] of lexicon?.rows||[]){
   if(text!==raw&&text.startsWith(raw))
    candidates.push({text,dialects:0,frequency:frequency||0,lemma,source:'TLA18'});
  }
 }
 for(const [key,count] of Object.entries(learned)){
  const prefix=language+':';
  if(key.startsWith(prefix)){
   const text=key.slice(prefix.length);
   const match=language==='cop'?fold(text).startsWith(query):text.startsWith(raw);
   if(text!==raw&&match&&!candidates.some(v=>v.text===text))
    candidates.push({text,dialects:0,frequency:0,personal:true});
  }
 }
 const score=c=>(learned[language+':'+c.text]||0)*100
  +Math.log1p(Math.max(0,c.frequency||0))*8
  +(c.dialects===3?3:0)+(c.text.length===raw.length+1?2:0)-c.text.length*.04;
 candidates.sort((a,b)=>score(b)-score(a)||a.text.localeCompare(b.text));
 if(language==='cop'){
  const choose=[],seen=new Set();
  for(const mask of [1,2,3]){
   const c=candidates.find(x=>x.dialects===mask&&!seen.has(x.text));
   if(c){choose.push(c);seen.add(c.text);}
  }
  for(const c of candidates){if(choose.length>=limit-1)break;if(!seen.has(c.text)){choose.push(c);seen.add(c.text);}}
  return [{text:raw,raw:true},...choose.slice(0,limit-1)];
 }
 return [{text:raw,raw:true},...candidates.slice(0,limit-1)];
}
export function deleteGrapheme(value,start,end){
 if(start!==end)return {start,end,text:''};
 if(start===0)return {start:0,end:0,text:''};
 const s=value.slice(0,start);
 if(typeof Intl!=='undefined'&&Intl.Segmenter){
  let last=0;for(const t of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(s))last=t.index;
  return {start:last,end:start,text:''};
 }
 return {start:start-[...s].at(-1).length,end:start,text:''};
}
