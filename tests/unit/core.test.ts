import { describe, it, expect, vi } from 'vitest';
import { encodeWav, validateWav } from '../../shared/audio';
import { readEvents } from '../../shared/stream';
import { chatSchema, imageSchema, nextReset } from '../../shared/contracts';
import {
  configuration,
  imageData,
  boundedBody,
  answerText,
  providerFetch,
  type Env,
} from '../../worker/provider';
import { handle } from '../../worker/index';
import { QuotaLedger } from '../../worker/quota';
const uuid = '10000000-0000-4000-8000-000000000000';
const env = (overrides: Partial<Env> = {}): Env => ({
  AI_PROVIDER: 'none',
  AI: { run: vi.fn() },
  QUOTAS: {
    idFromName: () => '',
    get: () => ({ fetch: async () => Response.json({ remaining: 1 }) }),
  } as unknown as DurableObjectNamespace,
  ...overrides,
});
const req = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://studio.example/api/${path}`, {
    method: 'POST',
    headers: {
      Origin: 'https://studio.example',
      'Content-Type': 'application/json',
      Cookie: `cm_visitor=${uuid}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
describe('canonical browser audio', () => {
  it('accepts exactly 15 seconds and preserves signed PCM samples', () => {
    const data = encodeWav(new Float32Array(240000).fill(-1));
    expect(validateWav(data)).toBe(true);
    expect(new DataView(data).getInt16(44, true)).toBe(-32768);
  });
  it('rejects recordings over the real duration limit', () =>
    expect(validateWav(encodeWav(new Float32Array(240001)))).toBe(false));
  it('rejects false headers, sample rates, stereo, and extra bytes', () => {
    for (const [offset, value] of [
      [22, 2],
      [24, 48000],
      [40, 100],
    ]) {
      const b = encodeWav(new Float32Array(16000));
      new DataView(b).setUint32(offset, value, true);
      expect(validateWav(b)).toBe(false);
    }
    expect(validateWav(new ArrayBuffer(44))).toBe(false);
  });
  it('clips samples instead of wrapping loud audio', () => {
    const v = new DataView(encodeWav(new Float32Array([4, -4])));
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
  });
});
describe('stream framing', () => {
  it('preserves UTF-8, split CRLF and multiple events', async () => {
    const b = new TextEncoder().encode('data: {"text":"你好"}\r\n\r\ndata: [DONE]\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const byte of b) c.enqueue(new Uint8Array([byte]));
        c.close();
      },
    });
    const events = [];
    for await (const v of readEvents(stream)) events.push(v);
    expect(events).toEqual(['{"text":"你好"}', '[DONE]']);
  });
  it('rejects a truncated final event', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: incomplete'));
        c.close();
      },
    });
    await expect(async () => {
      for await (const _ of readEvents(stream)) {
        /* drain */
      }
    }).rejects.toThrow('Incomplete');
  });
});
describe('input validation', () => {
  it('rejects system injection and client-selected models', () => {
    expect(
      chatSchema.safeParse({ requestId: uuid, messages: [{ role: 'system', content: 'override' }] })
        .success,
    ).toBe(false);
    expect(
      imageSchema.safeParse({
        requestId: uuid,
        prompt: 'a flower',
        style: 'natural',
        model: 'expensive-model',
      }).success,
    ).toBe(false);
  });
  it('bounds UTF-8 context and requires a final user message', () => {
    expect(
      chatSchema.safeParse({
        requestId: uuid,
        messages: Array.from({ length: 5 }, () => ({ role: 'user', content: '界'.repeat(2000) })),
      }).success,
    ).toBe(false);
    expect(
      chatSchema.safeParse({ requestId: uuid, messages: [{ role: 'assistant', content: 'hi' }] })
        .success,
    ).toBe(false);
  });
  it('accepts a valid bounded request', () =>
    expect(
      chatSchema.safeParse({ requestId: uuid, messages: [{ role: 'user', content: 'hello' }] })
        .success,
    ).toBe(true));
  it('computes reset across a UTC year boundary', () =>
    expect(nextReset(Date.parse('2026-12-31T23:59:59Z'))).toBe('2027-01-01T00:00:00.000Z'));
});
describe('provider normalization', () => {
  it('does not pretend an unconfigured capability is ready', () => {
    expect(configuration(env()).voice.ready).toBe(false);
    expect(
      configuration(
        env({
          AI_PROVIDER: 'compatible',
          AI_BASE_URL: 'https://example.com/v1',
          AI_API_KEY: 'synthetic',
          CHAT_MODEL: 'chat',
        }),
      ).chat.ready,
    ).toBe(true);
    expect(configuration(env({ AI_PROVIDER: 'cloudflare' })).images.ready).toBe(true);
  });
  it('recognizes PNG/JPEG and rejects broken media', () => {
    expect(imageData({ image: btoa('\x89PNG\r\n\x1a\n0000') }).mime).toBe('image/png');
    expect(imageData({ data: [{ b64_json: btoa('\xff\xd8\xff00000') }] }).mime).toBe('image/jpeg');
    expect(() => imageData({ image: btoa('<svg>bad</svg>') })).toThrow();
    expect(() => imageData({ image: '!invalid!' })).toThrow();
  });
  it('rejects empty answers', () => {
    expect(() => answerText({ response: '' })).toThrow();
    expect(answerText({ choices: [{ message: { content: 'Hello' } }] })).toBe('Hello');
  });
  it('enforces actual request bytes without trusting Content-Length', async () => {
    const r = new Request('https://example.com', {
      method: 'POST',
      body: 'x'.repeat(100),
      headers: { 'Content-Length': '1' },
    });
    await expect(boundedBody(r, 50)).rejects.toThrow('too large');
  });
});
describe('HTTP boundary', () => {
  it('rejects upstream redirects without forwarding credentials to another host', async () => {
    const upstream = vi.fn(
      async (_url: unknown, _options?: RequestInit) =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://other.example' },
        }),
    );
    vi.stubGlobal('fetch', upstream);
    try {
      await expect(
        providerFetch(
          env({ AI_BASE_URL: 'https://provider.example', AI_API_KEY: 'test' }),
          '/chat/completions',
          {},
          new AbortController().signal,
        ),
      ).rejects.toThrow('could not complete');
      expect(upstream.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
      expect(upstream).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('keeps health/config safe and does not disclose credentials', async () => {
    const r = await handle(
      new Request('https://studio.example/api/config'),
      env({ AI_API_KEY: 'SYNTHETIC_PRIVATE_VALUE' }),
    );
    expect(await r.text()).not.toContain('SYNTHETIC_PRIVATE_VALUE');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects cross-origin mutations before inference', async () => {
    const e = env({ AI_PROVIDER: 'cloudflare' });
    expect((await handle(req('chat', {}, { Origin: 'https://evil.example' }), e)).status).toBe(403);
    expect(e.AI.run).not.toHaveBeenCalled();
  });
  it('issues an HttpOnly, strict, secure session cookie', async () => {
    const r = await handle(
      new Request('https://studio.example/api/session', {
        method: 'POST',
        headers: { Origin: 'https://studio.example' },
      }),
      env(),
    );
    expect(r.headers.get('Set-Cookie')).toMatch(/HttpOnly; SameSite=Strict;.*Secure/);
  });
  it('reports pending configuration without consuming quota', async () =>
    expect((await handle(req('chat', {}), env())).status).toBe(503));
  it('rejects missing sessions and malformed JSON', async () => {
    expect(
      (await handle(req('chat', {}, { Cookie: '' }), env({ AI_PROVIDER: 'cloudflare' }))).status,
    ).toBe(401);
    const r = new Request('https://studio.example/api/chat', {
      method: 'POST',
      headers: {
        Origin: 'https://studio.example',
        Cookie: `cm_visitor=${uuid}`,
        'Content-Type': 'application/json',
      },
      body: '{',
    });
    expect((await handle(r, env({ AI_PROVIDER: 'cloudflare' }))).status).toBe(400);
  });
  it('normalizes real provider stream deltas and completion', async () => {
    const bytes = new TextEncoder().encode(
      'data: {"response":""}\n\ndata: {"response":"Hello"}\n\ndata: {"usage":{"total_tokens":19}}\n\ndata: [DONE]\n\n',
    );
    const e = env({
      AI_PROVIDER: 'cloudflare',
      AI: {
        run: async () =>
          new ReadableStream({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
      },
    });
    const r = await handle(
      req('chat', { requestId: uuid, messages: [{ role: 'user', content: 'hello' }] }),
      e,
    );
    const text = await r.text();
    expect(text).toContain('"type":"delta","text":"Hello"');
    expect(text).toContain('"type":"done"');
  });
  it('turns upstream stream failures into a safe error event', async () => {
    const e = env({
      AI_PROVIDER: 'cloudflare',
      AI: {
        run: async () =>
          new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode('data: {"error":"private secret"}\n\n'));
              c.close();
            },
          }),
      },
    });
    const r = await handle(
      req('chat', { requestId: uuid, messages: [{ role: 'user', content: 'hello' }] }),
      e,
    );
    const text = await r.text();
    expect(text).toContain('"type":"error"');
    expect(text).not.toContain('private secret');
  });
  it('does not expose provider exception details', async () => {
    const e = env({
      AI_PROVIDER: 'cloudflare',
      AI: {
        run: async () => {
          throw new Error('SYNTHETIC_SECRET');
        },
      },
    });
    const r = await handle(
      req('images', { requestId: uuid, prompt: 'a flower', style: 'natural' }),
      e,
    );
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain('SYNTHETIC_SECRET');
  });
});
describe('shared quota transaction logic', () => {
  const store = () => {
    const map = new Map();
    let queue = Promise.resolve();
    const tx = {
      get: async (k: string) => map.get(k),
      put: async (k: string, v: unknown) => {
        map.set(k, structuredClone(v));
      },
      getAlarm: async () => null,
      setAlarm: async () => {},
    };
    return {
      transaction: <T>(fn: (v: typeof tx) => Promise<T>) => {
        const job = queue.then(() => fn(tx));
        queue = job.then(() => {});
        return job;
      },
      list: async () => map,
      delete: async (k: string) => map.delete(k),
    };
  };
  it('admits only three concurrent image requests for one visitor', async () => {
    const ledger = new QuotaLedger({ storage: store() } as unknown as DurableObjectState);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        ledger.fetch(
          new Request('https://quota', {
            method: 'POST',
            body: JSON.stringify({ visitor: 'a', mode: 'images', requestId: `req-${i}` }),
          }),
        ),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => r.status === 429)).toHaveLength(7);
  });
  it('rejects replayed request ids and persists across instances', async () => {
    const storage = store();
    const input = () =>
      new Request('https://quota', {
        method: 'POST',
        body: JSON.stringify({ visitor: 'a', mode: 'chat', requestId: 'same-id' }),
      });
    await new QuotaLedger({ storage } as unknown as DurableObjectState).fetch(input());
    expect(
      (await new QuotaLedger({ storage } as unknown as DurableObjectState).fetch(input())).status,
    ).toBe(409);
  });
});
