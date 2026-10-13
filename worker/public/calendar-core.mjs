// Egyptian Alexandrian solar calendar, using an explicitly conventional year numbering.
// 1 Thout 6282 == 2026-09-11 Gregorian; the associated Coptic year is 1743.
// This module deliberately contains no event / ICS logic.
export const EPOCH_YEAR = 6282;
const EPOCH_UTC = Date.UTC(2026, 8, 11);
const DAY = 86400000;
export const OFFSET_TO_COPTIC_YEAR = 4539;
export const MONTHS = {
  ar: ['توت','بابه','هاتور','كيهك','طوبة','أمشير','برمهات','برمودة','بشنس','بؤونة','أبيب','مسرى','النسيء'],
  en: ['Thout','Paopi','Hathor','Koiak','Tobi','Meshir','Paremhat','Parmoute','Pashons','Paoni','Epip','Mesori','Epagomenal days'],
  cop: ['Ⲑⲱⲟⲩⲧ','Ⲡⲁⲱⲡⲉ','Ⲁⲑⲱⲣ','Ⲭⲟⲓⲁⲕ','Ⲧⲱⲃⲉ','Ⲙⲉϣⲓⲣ','Ⲡⲁⲣⲉⲙϩⲁⲧ','Ⲡⲁⲣⲙⲟⲩⲧⲉ','Ⲡⲁϣⲟⲛⲥ','Ⲡⲁⲱⲛⲉ','Ⲉⲡⲏⲡ','Ⲙⲉⲥⲱⲣⲏ','Ⲡⲓⲕⲟⲩϫⲓ ⲛ̀ⲁⲃⲟⲧ']
};
export const SEASONS = {
  ar: ['أخت','برت','شمو'],
  en: ['Akhet','Peret','Shemu'],
  cop: ['Ⲁⲭⲉⲧ','Ⲡⲉⲣⲉⲧ','Ⲥⲏⲙⲟⲩ'],
  egy: ['𓈌','𓊪𓂋𓏏','𓈙𓅓𓅱']
};
const COPTIC_UNITS = ['','ⲁ','ⲃ','ⲅ','ⲇ','ⲉ','ⲋ','ⲍ','ⲏ','ⲑ'];
const COPTIC_TENS = ['','ⲓ','ⲕ','ⲗ','ⲙ','ⲛ','ⲝ','ⲟ','ⲡ','ϥ'];
const COPTIC_HUNDREDS = ['','ⲣ','ⲥ','ⲧ','ⲩ','ⲫ','ⲭ','ⲯ','ⲱ','ⳁ'];

export function leap(year) {
  // Coptic leap: coptic year congruent to 3 modulo 4. 6282 - 4539 = 1743.
  return ((year - EPOCH_YEAR) % 4 + 4) % 4 === 0;
}
export function daysInMonth(year, month) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 13)
    throw new RangeError('Invalid Egyptian year or month');
  return month === 13 ? (leap(year) ? 6 : 5) : 30;
}
export function yearStartUtc(year) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new RangeError('Invalid Egyptian year');
  let sum = 0;
  if (year >= EPOCH_YEAR) {
    for (let n = EPOCH_YEAR; n < year; n++) sum += leap(n) ? 366 : 365;
  } else {
    for (let n = year; n < EPOCH_YEAR; n++) sum -= leap(n) ? 366 : 365;
  }
  return EPOCH_UTC + sum * DAY;
}
export function toGregorian(year, month, day) {
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month))
    throw new RangeError('Invalid Egyptian day');
  return new Date(yearStartUtc(year) + ((month - 1) * 30 + day - 1) * DAY);
}
export function fromGregorian(input) {
  const date = new Date(input);
  if (!Number.isFinite(date.valueOf())) throw new RangeError('Invalid Gregorian date');
  const utcDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  let year = EPOCH_YEAR + date.getUTCFullYear() - 2026;
  year = Math.max(1, Math.min(9999, year));
  while (year > 1 && yearStartUtc(year) > utcDay) year--;
  while (year < 9999 && yearStartUtc(year + 1) <= utcDay) year++;
  const idx = Math.round((utcDay - yearStartUtc(year)) / DAY);
  if (idx < 0 || idx >= (leap(year) ? 366 : 365)) throw new RangeError('Gregorian date outside supported range');
  const month = Math.min(13, Math.floor(idx / 30) + 1);
  const day = month === 13 ? idx - 359 : (idx % 30) + 1;
  return {
    year, month, day, season: month === 13 ? null : Math.floor((month - 1) / 4),
    decade: month === 13 ? null : Math.floor((day - 1) / 10) + 1
  };
}
export function localTodayUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
export function addUtcDays(d, n) { return new Date(d.getTime() + n * DAY); }
export function gregorianIso(d) {
  return String(d.getUTCFullYear()).padStart(4, '0') + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0');
}
export function nextMonth(year, month, step = 1) {
  let y = year, m = month + step;
  while (m > 13) { m -= 13; y++; }
  while (m < 1) { m += 13; y--; }
  if (y < 1 || y > 9999) return {year,month};
  return {year:y,month:m};
}
export function arabicDigits(n) { return String(n).replace(/[0-9]/g, x => '٠١٢٣٤٥٦٧٨٩'[Number(x)]); }
export function hieroNumber(n) {
  if (!Number.isInteger(n) || n < 1 || n > 9999) return String(n);
  let out = '';
  for (const [unit, glyph] of [[1000,'𓆼'],[100,'𓍢'],[10,'𓎆'],[1,'𓏺']]) {
    out += glyph.repeat(Math.floor(n / unit));
    n %= unit;
  }
  return out;
}
export function copticNumber(n) {
  if (!Number.isInteger(n) || n < 1 || n > 9999) return String(n);
  let out = '';
  const thousands = Math.floor(n / 1000);
  if (thousands) out = '͵' + COPTIC_UNITS[thousands] + '̅';
  n %= 1000;
  for (const [unit, table] of [[100,COPTIC_HUNDREDS],[10,COPTIC_TENS],[1,COPTIC_UNITS]]) {
    const count = Math.floor(n / unit);
    if (count) out += table[count] + '̅';
    n %= unit;
  }
  return out;
}
export function digits(n, language) {
  return language === 'ar' ? arabicDigits(n) :
    language === 'cop' ? copticNumber(n) :
    language === 'egy' ? hieroNumber(n) : String(n);
}
export function monthName(month, language) {
  if (language === 'egy') {
    if (month === 13) return '𓇳 𓏺𓏺𓏺𓏺𓏺';
    return '𓇹 ' + hieroNumber(((month - 1) % 4) + 1) + '  ' + SEASONS.egy[Math.floor((month - 1) / 4)];
  }
  return MONTHS[language][month - 1];
}
export function dateLabel(d, language) {
  return digits(d.day, language) + ' ' + monthName(d.month, language) + ' ' + digits(d.year, language);
}
