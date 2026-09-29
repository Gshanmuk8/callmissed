import type { Message, Configuration } from '../shared/contracts';
export interface Env {
  AI: { run(model: string, input: unknown, options?: unknown): Promise<unknown> };
  QUOTAS: DurableObjectNamespace;
  AI_PROVIDER: string;
  CF_LOCAL_API_TOKEN?: string;
  CF_LOCAL_ACCOUNT_ID?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  CHAT_MODEL?: string;
  IMAGE_MODEL?: string;
  STT_MODEL?: string;
  TTS_MODEL?: string;
  TTS_VOICE?: string;
  IMAGE_BASE_URL?: string;
  IMAGE_API_KEY?: string;
  SPEECH_BASE_URL?: string;
  SPEECH_API_KEY?: string;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
async function runAI(e: Env, model: string, input: unknown, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  if (e.CF_LOCAL_API_TOKEN && e.CF_LOCAL_ACCOUNT_ID) {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${e.CF_LOCAL_ACCOUNT_ID}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${e.CF_LOCAL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal,
        redirect: 'manual',
      },
    );
    if (!r.ok)
      throw new ApiError(
        r.status === 429 ? 429 : 502,
        'PROVIDER_UNAVAILABLE',
        r.status === 429
          ? 'The free AI allowance has reached its limit. Try again after it resets.'
          : 'Cloudflare could not complete this request. Please try again.',
      );
    const type = r.headers.get('Content-Type') || '';
    if (type.includes('text/event-stream') || type.startsWith('audio/')) return r.body;
    const body = (await r.json()) as { success?: boolean; result?: unknown };
    if (body.success === false)
      throw new ApiError(
        502,
        'PROVIDER_UNAVAILABLE',
        'Cloudflare could not complete this request.',
      );
    return body.result ?? body;
  }
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason);
    signal.addEventListener('abort', stop, { once: true });
    e.AI.run(model, input)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', stop));
  });
}
export function configuration(e: Env): Configuration {
  const cf = e.AI_PROVIDER === 'cloudflare';
  const compatible = e.AI_PROVIDER === 'compatible';
  const base = !!(e.AI_BASE_URL && e.AI_API_KEY);
  const chat = cf || (compatible && base && !!e.CHAT_MODEL);
  const images =
    cf ||
    (compatible &&
      !!(e.IMAGE_BASE_URL || e.AI_BASE_URL) &&
      !!(e.IMAGE_API_KEY || e.AI_API_KEY) &&
      !!e.IMAGE_MODEL);
  const voice =
    cf ||
    (chat &&
      !!(e.SPEECH_BASE_URL || e.AI_BASE_URL) &&
      !!(e.SPEECH_API_KEY || e.AI_API_KEY) &&
      !!e.STT_MODEL &&
      !!e.TTS_MODEL);
  return {
    provider: cf ? 'Cloudflare Workers AI' : compatible ? 'Connected provider' : 'Not connected',
    chat: { ready: chat, label: chat ? 'Ready' : 'Connection needed' },
    images: { ready: images, label: images ? 'Ready' : 'Connection needed' },
    voice: { ready: voice, label: voice ? 'Ready' : 'Connection needed' },
  };
}
const system =
  'You are Callmissed, a thoughtful creative collaborator. Be useful, clear and concise. Use Markdown when helpful. Never claim to have performed an action outside this conversation.';
export async function providerFetch(
  e: Env,
  path: string,
  body: unknown,
  signal: AbortSignal,
  kind: 'chat' | 'image' | 'speech' = 'chat',
) {
  const base =
    (kind === 'image' ? e.IMAGE_BASE_URL : kind === 'speech' ? e.SPEECH_BASE_URL : undefined) ||
    e.AI_BASE_URL;
  const key =
    (kind === 'image' ? e.IMAGE_API_KEY : kind === 'speech' ? e.SPEECH_API_KEY : undefined) ||
    e.AI_API_KEY;
  if (!base || !key)
    throw new ApiError(503, 'NOT_CONFIGURED', 'This studio is waiting for its AI connection.');
  const url = new URL(base.replace(/\/$/, '') + path);
  if (url.protocol !== 'https:')
    throw new ApiError(503, 'CONFIGURATION', 'The provider connection must use HTTPS.');
  const form = body instanceof FormData;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(!form ? { 'Content-Type': 'application/json' } : {}),
    },
    body: form ? body : JSON.stringify(body),
    signal,
    redirect: 'manual',
  });
  if (!r.ok)
    throw new ApiError(
      r.status === 429 ? 429 : 502,
      'PROVIDER_UNAVAILABLE',
      r.status === 429
        ? 'The AI provider has reached its usage limit. Try again after it resets.'
        : 'The AI provider could not complete this request. Please try again.',
    );
  return r;
}
export async function chat(
  e: Env,
  messages: Pick<Message, 'role' | 'content'>[],
  signal: AbortSignal,
  stream = true,
  voice = false,
) {
  const inputs = {
    messages: [
      {
        role: 'system',
        content: voice
          ? system +
            ' Reply in plain spoken English, in at most three short sentences. No Markdown.'
          : system,
      },
      ...messages,
    ],
    max_tokens: voice ? 120 : 384,
    stream,
  };
  if (e.AI_PROVIDER === 'cloudflare')
    return runAI(e, '@cf/meta/llama-3.1-8b-instruct-fp8', inputs, signal);
  const r = await providerFetch(e, '/chat/completions', { model: e.CHAT_MODEL, ...inputs }, signal);
  return stream ? r.body : r.json();
}
export function answerText(v: unknown): string {
  const o = v as { response?: string; choices?: { message?: { content?: string } }[] };
  const t = o?.response || o?.choices?.[0]?.message?.content;
  if (typeof t !== 'string' || !t.trim())
    throw new ApiError(
      502,
      'INVALID_RESPONSE',
      'The AI returned an empty answer. Please try again.',
    );
  return t;
}
export function imageData(value: unknown) {
  const o = value as { image?: string; data?: { b64_json?: string }[] };
  const b64 = o?.image || o?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string' || b64.length > 12_000_000)
    throw new ApiError(
      502,
      'INVALID_IMAGE',
      'The image provider did not return a supported image.',
    );
  let head: string;
  try {
    head = atob(b64.slice(0, 32));
  } catch {
    throw new ApiError(502, 'INVALID_IMAGE', 'The image data could not be read.');
  }
  const mime = head.startsWith('\x89PNG\r\n\x1a\n')
    ? 'image/png'
    : head.startsWith('\xff\xd8\xff')
      ? 'image/jpeg'
      : null;
  if (!mime || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0)
    throw new ApiError(502, 'INVALID_IMAGE', 'The image format is unsupported.');
  return { dataUrl: `data:${mime};base64,${b64}`, mime };
}
export async function generateImage(e: Env, prompt: string, style: string, signal: AbortSignal) {
  const styles: Record<string, string> = {
    editorial: 'Editorial art direction, considered composition, tactile materials, subtle grain.',
    cinematic: 'Cinematic light, atmospheric composition, beautiful color grading.',
    illustration: 'Expressive illustration, deliberate shapes, beautiful limited palette.',
    natural: 'Natural photography, honest textures, beautiful daylight.',
  };
  const input = { prompt: `${prompt}\nVisual direction: ${styles[style]}` };
  const result =
    e.AI_PROVIDER === 'cloudflare'
      ? await runAI(e, '@cf/black-forest-labs/flux-1-schnell', { ...input, steps: 4 }, signal)
      : await (
          await providerFetch(
            e,
            '/images/generations',
            { model: e.IMAGE_MODEL, ...input, n: 1, response_format: 'b64_json' },
            signal,
            'image',
          )
        ).json();
  return imageData(result);
}
function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export async function transcribe(e: Env, audio: ArrayBuffer, signal: AbortSignal) {
  let result: unknown;
  if (e.AI_PROVIDER === 'cloudflare')
    result = await runAI(
      e,
      '@cf/openai/whisper-large-v3-turbo',
      { audio: toBase64(new Uint8Array(audio)), language: 'en', vad_filter: true },
      signal,
    );
  else {
    const f = new FormData();
    f.set('file', new Blob([audio], { type: 'audio/wav' }), 'recording.wav');
    f.set('model', e.STT_MODEL!);
    f.set('language', 'en');
    result = await (await providerFetch(e, '/audio/transcriptions', f, signal, 'speech')).json();
  }
  const text = (result as { text?: string })?.text;
  if (typeof text !== 'string' || !text.trim())
    throw new ApiError(
      422,
      'NO_SPEECH',
      'I couldn’t hear any words. Try again a little closer to your microphone.',
    );
  return text.trim().slice(0, 3000);
}
export async function speak(e: Env, text: string, signal: AbortSignal): Promise<string> {
  let response: Response;
  if (e.AI_PROVIDER === 'cloudflare') {
    const r = await runAI(
      e,
      '@cf/myshell-ai/melotts',
      { prompt: text.slice(0, 600), lang: 'en' },
      signal,
    );
    if (r instanceof ReadableStream) response = new Response(r);
    else if (r instanceof ArrayBuffer) response = new Response(r);
    else if (r instanceof Uint8Array) response = new Response(new Uint8Array(r).buffer);
    else {
      const audio = (r as { audio?: string })?.audio;
      if (typeof audio === 'string' && audio.length < 3_000_000)
        return `data:audio/mpeg;base64,${audio}`;
      throw new ApiError(
        502,
        'SPEECH_UNAVAILABLE',
        'Your answer is ready, but its audio could not be created.',
      );
    }
  } else
    response = await providerFetch(
      e,
      '/audio/speech',
      {
        model: e.TTS_MODEL,
        voice: e.TTS_VOICE || 'alloy',
        input: text.slice(0, 600),
        response_format: 'mp3',
      },
      signal,
      'speech',
    );
  const bytes = new Uint8Array(await boundedBody(response, 2_000_000));
  if (bytes.length < 4)
    throw new ApiError(502, 'SPEECH_UNAVAILABLE', 'Your answer is ready, but its audio is empty.');
  return `data:audio/mpeg;base64,${toBase64(bytes)}`;
}
export async function boundedBody(r: Request | Response, max: number): Promise<ArrayBuffer> {
  if (!r.body) return new ArrayBuffer(0);
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max)
        throw new ApiError(413, 'TOO_LARGE', 'This request is too large. Try something shorter.');
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    result.set(p, o);
    o += p.length;
  }
  return result.buffer;
}
