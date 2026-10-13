import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  leap,daysInMonth,toGregorian,fromGregorian,addUtcDays,nextMonth,
  arabicDigits,hieroNumber,copticNumber,monthName,dateLabel
} from '../worker/public/calendar-core.mjs';

const iso=(d)=>d.toISOString().slice(0,10);
test('fixed Egyptian epoch and reported current date',()=>{
  assert.equal(iso(toGregorian(6282,1,1)),'2026-09-11');
  assert.deepEqual(
    Object.values(fromGregorian(new Date('2026-10-13T00:00:00Z'))).slice(0,3),
    [6282,2,3]
  );
  assert.equal(dateLabel(fromGregorian(new Date('2026-10-13T00:00:00Z')),'ar'),'٣ بابه ٦٢٨٢');
});
test('year 6282 has its sixth epagomenal day and next-year rollover',()=>{
  assert.equal(leap(6282),true);
  assert.equal(daysInMonth(6282,13),6);
  assert.equal(iso(toGregorian(6282,13,1)),'2027-09-06');
  assert.equal(iso(toGregorian(6282,13,6)),'2027-09-11');
  assert.equal(iso(toGregorian(6283,1,1)),'2027-09-12');
  assert.equal(daysInMonth(6283,13),5);
  assert.throws(()=>toGregorian(6283,13,6),RangeError);
  assert.equal(iso(toGregorian(6286,13,6)),'2031-09-11');
});
test('Gregorian dates retain exact day across months, leap days and year boundaries',()=>{
  for (const year of [6157,6280,6281,6282,6283,6284,6285,6286,6350]){
    for(let m=1;m<=13;m++)for(const day of [1,daysInMonth(year,m)]){
      const g=toGregorian(year,m,day);
      const e=fromGregorian(g);
      assert.deepEqual([e.year,e.month,e.day],[year,m,day],iso(g));
    }
  }
});
test('Gregorian months and weekdays are aligned by real UTC dates',()=>{
  const jan=new Date('2027-01-01T00:00:00Z');
  assert.equal(fromGregorian(jan).month,4);
  assert.equal(iso(addUtcDays(jan,1)),'2027-01-02');
  assert.deepEqual(nextMonth(6282,13),{year:6283,month:1});
  assert.deepEqual(nextMonth(6283,1,-1),{year:6282,month:13});
});
test('all four languages and numeral systems are represented',()=>{
  assert.equal(arabicDigits(6282),'٦٢٨٢');
  assert.equal(hieroNumber(13),'𓎆𓏺𓏺𓏺');
  assert.ok(copticNumber(13).includes('ⲓ'));
  assert.equal(monthName(2,'cop'),'Ⲡⲁⲱⲡⲉ');
  assert.ok(monthName(2,'egy').includes('𓇹'));
  assert.ok(dateLabel({year:6282,month:2,day:3},'en').includes('Paopi'));
});
test('independent PWA replaces the old event-based UI',()=>{
 const html=readFileSync(new URL('../worker/public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../worker/public/app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../worker/public/sw.js',import.meta.url),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('../worker/public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.match(html,/role="grid"/);
 assert.match(html,/id="days"/);
 assert.match(app,/fromGregorian/);
 assert.match(app,/localStorage/);
 assert.match(sw,/cache.addAll\(APP_SHELL\)/);
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/');
 assert.doesNotMatch(html,/\.ics|BEGIN:VEVENT|Subscribe Calendar/);
});
