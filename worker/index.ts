import { chatSchema, imageSchema, voiceHistorySchema, type Mode } from '../shared/contracts';
import { validateWav } from '../shared/audio';
import { readEvents } from '../shared/stream';
import {
  ApiError,
  configuration,
  chat,
  answerText,
  generateImage,
  transcribe,
  speak,
  boundedBody,
  type Env,
} from './provider';
export { QuotaLedger } from './quota';
const secureHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
};
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: secureHeaders });
export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (request.method === 'GET' && url.pathname === '/api/config') return json(configuration(env));
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ status: 'ok' });
    if (request.method !== 'POST') return json({ message: 'Not found' }, 404);
    if (request.headers.get('Origin') !== url.origin)
      throw new ApiError(403, 'ORIGIN', 'This request must come from the studio.');
    if (url.pathname === '/api/session') {
      const response = json({ ok: true });
      if (!getVisitor(request))
        response.headers.set(
          'Set-Cookie',
          `cm_visitor=${crypto.randomUUID()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${url.protocol === 'https:' ? '; Secure' : ''}`,
        );
      return response;
    }
    const mode: Mode | undefined =
      url.pathname === '/api/chat'
        ? 'chat'
        : url.pathname === '/api/images'
          ? 'images'
          : url.pathname === '/api/voice'
            ? 'voice'
            : undefined;
    if (!mode) return json({ message: 'Not found' }, 404);
    if (!configuration(env)[mode].ready)
      throw new ApiError(
        503,
        'NOT_CONFIGURED',
        'The studio is ready. Its AI connection is still being set up.',
      );
    const visitor = getVisitor(request);
    if (!visitor) throw new ApiError(401, 'SESSION', 'Please refresh the studio and try again.');
    const timeout = AbortSignal.timeout(mode === 'images' ? 90_000 : 60_000);
    const signal = AbortSignal.any([request.signal, timeout]);
    if (mode === 'chat' || mode === 'images') {
      if (!request.headers.get('Content-Type')?.includes('application/json'))
        throw new ApiError(415, 'CONTENT_TYPE', 'Send a JSON request.');
      const body = JSON.parse(new TextDecoder().decode(await boundedBody(request, 32000)));
      if (mode === 'images') {
        const input = imageSchema.parse(body);
        await reserve(env, visitor, mode, input.requestId);
        return json(await generateImage(env, input.prompt, input.style, signal));
      }
      const input = chatSchema.parse(body);
      await reserve(env, visitor, mode, input.requestId);
      const upstream = await chat(env, input.messages, signal);
      if (!(upstream instanceof ReadableStream))
        throw new ApiError(
          502,
          'INVALID_STREAM',
          'The provider did not return a streaming answer.',
        );
      const events = readEvents(upstream, signal)[Symbol.asyncIterator]();
      const encoder = new TextEncoder();
      let ended = false;
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            // Provider usage/role events may contain no text. Keep reading until
            // this pull produces output, otherwise the consumer can stall.
            while (true) {
              const { done, value } = await events.next();
              if (done) {
                if (!ended)
                  controller.enqueue(
                    encoder.encode(
                      'data: {"type":"error","message":"The answer ended unexpectedly. Please try again."}\n\n',
                    ),
                  );
                controller.close();
                return;
              }
              if (value === '[DONE]') {
                ended = true;
                controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                controller.close();
                await events.return?.();
                return;
              }
              const data = JSON.parse(value);
              if (data.error) throw new Error('Provider stream error');
              const delta = data.response ?? data.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`),
                );
                return;
              }
            }
          } catch {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"error","message":"The answer was interrupted. Please try again."}\n\n',
              ),
            );
            controller.close();
            await events.return?.();
          }
        },
        async cancel() {
          await events.return?.();
        },
      });
      return new Response(stream, {
        headers: { ...secureHeaders, 'Content-Type': 'text/event-stream; charset=utf-8' },
      });
    }
    const raw = await boundedBody(request, 510000);
    const form = await new Response(raw, {
      headers: { 'Content-Type': request.headers.get('Content-Type') || '' },
    }).formData();
    const audio = form.get('audio');
    const requestId = form.get('requestId');
    if (
      !(audio instanceof File) ||
      typeof requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    )
      throw new ApiError(400, 'INVALID_AUDIO', 'Please record a new voice note.');
    const wav = await audio.arrayBuffer();
    if (!validateWav(wav))
      throw new ApiError(400, 'INVALID_AUDIO', 'Record up to 15 seconds of audio and try again.');
    const history = voiceHistorySchema.parse(JSON.parse(String(form.get('history') || '[]')));
    await reserve(env, visitor, mode, requestId);
    const transcript = await transcribe(env, wav, signal);
    const answer = answerText(
      await chat(env, [...history, { role: 'user', content: transcript }], signal, false, true),
    );
    try {
      const audioUrl = await speak(env, answer, signal);
      return json({ transcript, answer, audioUrl });
    } catch {
      return json({
        transcript,
        answer,
        audioUrl: null,
        audioError: 'Your answer is ready, but speech is unavailable. You can read it below.',
      });
    }
  } catch (error) {
    if (error instanceof ApiError)
      return json({ code: error.code, message: error.message }, error.status);
    if (error instanceof Error && (error.name === 'ZodError' || error instanceof SyntaxError))
      return json(
        { code: 'INVALID_REQUEST', message: 'Please check your input and try again.' },
        400,
      );
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
      return json(
        { code: 'TIMEOUT', message: 'That took too long. Your input is still here; try again.' },
        504,
      );
    return json(
      { code: 'UNAVAILABLE', message: 'Something interrupted the request. Please try again.' },
      502,
    );
  }
}
function getVisitor(r: Request) {
  return r.headers.get('Cookie')?.match(/(?:^|;\s*)cm_visitor=([a-f0-9-]{36})(?:;|$)/)?.[1];
}
async function reserve(e: Env, visitor: string, mode: Mode, requestId: string) {
  const id = e.QUOTAS.idFromName('studio-global-v1');
  const r = await e.QUOTAS.get(id).fetch('https://quota/reserve', {
    method: 'POST',
    body: JSON.stringify({ visitor, mode, requestId }),
  });
  if (!r.ok) {
    const err = (await r.json()) as { code: string; message: string };
    throw new ApiError(r.status, err.code, err.message);
  }
}
export default { fetch: handle };
