import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from './index.mjs';

const origin = 'https://example.workers.dev';

function fakeDb() {
  const data = new Map();
  return {
    prepare(statement) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() {
          if (!statement.startsWith('SELECT ')) throw Error('Unexpected first() SQL');
          return data.get(values[0]) ?? null;
        },
        async run() {
          if (statement.startsWith('INSERT ')) {
            const [id, hash, language] = values;
            data.set(id, { id, edit_hash: hash, language });
          } else if (statement.startsWith('UPDATE ')) {
            const [language, id] = values;
            assert.ok(data.has(id), 'Calendar must exist');
            data.get(id).language = language;
          } else {
            throw Error('Unexpected run() SQL');
          }
          return { success: true };
        }
      };
    }
  };
}

async function call(env, url, method = 'GET', body = undefined) {
  return worker.fetch(new Request(url, { method, body }), env);
}

test('one URL keeps calendar UID while the owner changes the display language', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const language = new URL(url).pathname.split('/').at(-2);
    const ics = readFileSync(new URL('../calendar/' + language + '/full.ics', import.meta.url));
    return new Response(ics, { status: 200, headers: { 'content-type': 'text/calendar' } });
  };
  try {
    const env = { DB: fakeDb() };
    const home = await call(env, origin + '/');
    assert.equal(home.status, 200);
    const created = await call(env, origin + '/new', 'POST', new URLSearchParams({language:'ar'}));
    assert.equal(created.status, 200);
    const text = await created.text();
    const sub = text.match(/https:\/\/example\.workers\.dev\/calendar\/([a-f0-9-]{36})\.ics/);
    assert.ok(sub, 'A stable subscription link is shown');
    const id = sub[1];
    const key = text.match(/settings\/[a-f0-9-]{36}\?key=([a-f0-9]{48})/)?.[1];
    assert.ok(key, 'A private edit link is shown');
    const url = origin + '/calendar/' + id + '.ics';
    const first = await call(env, url);
    assert.equal(first.status, 200);
    assert.match(first.headers.get('content-type'), /^text\/calendar/);
    const arabic = await first.text();
    assert.match(arabic, /SUMMARY:٣ بابه ٦٢٨٢/);
    const uid = 'UID:egypt-full-20261013@egyptian-calendar';
    assert.ok(arabic.includes(uid));
    const updated = await call(env, origin + '/settings/' + id, 'POST', new URLSearchParams({ key, language:'cop' }));
    assert.equal(updated.status, 303);
    const after = await call(env, url);
    assert.equal(after.status, 200);
    const coptic = await after.text();
    assert.ok(coptic.includes(uid), 'UID is independent of language');
    assert.notEqual(coptic, arabic, 'The feed language has changed without changing URL');
    assert.ok(coptic.includes('Ⲡⲁⲱⲡⲉ'), 'Coptic month name appears');
    const denied = await call(env, origin + '/settings/' + id, 'POST', new URLSearchParams({ key: 'a'.repeat(48), language:'en' }));
    assert.equal(denied.status, 403);
    const third = await call(env, url);
    assert.ok((await third.text()).includes('Ⲡⲁⲱⲡⲉ'), 'Invalid edit token did not alter language');
  } finally {
    globalThis.fetch = realFetch;
  }
});
