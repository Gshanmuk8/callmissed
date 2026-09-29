import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import assert from 'node:assert/strict';
import path from 'node:path';

// Execute the production bundle in workerd with real SQLite Durable Object storage.
// No AI binding or provider credential is provisioned in this runtime.
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        modules: true,
        scriptPath: path.resolve('dist/callmissed_studio/index.js'),
        compatibilityDate: '2026-03-01',
        compatibilityFlags: ['nodejs_compat'],
        bindings: { AI_PROVIDER: 'none' },
        durableObjects: { QUOTAS: { className: 'QuotaLedger', useSQLite: true } },
      },
    ],
  }),
);
try {
  const health = await runtime.dispatchFetch('https://studio.example/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const blocked = await runtime.dispatchFetch('https://studio.example/api/session', {
    method: 'POST',
    headers: { Origin: 'https://other.example' },
  });
  assert.equal(blocked.status, 403);
  const namespace = await runtime.getDurableObjectNamespace('QUOTAS');
  const id = namespace.idFromName('runtime-verification');
  const reserve = (visitor, requestId) =>
    namespace.get(id).fetch('https://quota/reserve', {
      method: 'POST',
      body: JSON.stringify({ visitor, requestId, mode: 'images' }),
    });
  const concurrent = await Promise.all(
    Array.from({ length: 10 }, (_, i) => reserve('one', `one-${i}`)),
  );
  assert.equal(concurrent.filter((r) => r.status === 200).length, 3);
  assert.equal(concurrent.filter((r) => r.status === 429).length, 7);
  assert.equal((await reserve('one', 'one-0')).status, 409);
  const otherVisitors = await Promise.all(
    Array.from({ length: 12 }, (_, i) => reserve(`visitor-${i}`, `id-${i}`)),
  );
  assert.equal(otherVisitors.filter((r) => r.status === 200).length, 7);
  assert.equal(otherVisitors.filter((r) => r.status === 429).length, 5);
  console.log(
    'PASS: production Worker health, origin boundary, concurrent visitor cap, duplicate rejection, and global cap in workerd + SQLite.',
  );
} finally {
  await runtime.dispose();
}
