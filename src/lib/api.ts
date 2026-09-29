import { readEvents } from '../../shared/stream';
import type { Message, Configuration } from '../../shared/contracts';
import { boundedContext } from '../../shared/context';
export class StudioError extends Error {
  constructor(
    message: string,
    public code = 'UNKNOWN',
  ) {
    super(message);
  }
}
async function check(r: Response) {
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new StudioError(
      body.message || 'The studio couldn’t connect. Please try again.',
      body.code,
    );
  }
  return r;
}
let session: Promise<void> | undefined;
async function ensureSession() {
  session ??= fetch('/api/session', { method: 'POST' })
    .then(check)
    .then(() => {})
    .catch((e) => {
      session = undefined;
      throw e;
    });
  await session;
}
export async function getConfiguration(): Promise<Configuration> {
  return (await check(await fetch('/api/config'))).json();
}
export async function streamChat(
  messages: Message[],
  signal: AbortSignal,
  onDelta: (text: string) => void,
) {
  await ensureSession();
  const r = await check(
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: boundedContext(messages),
        requestId: crypto.randomUUID(),
      }),
      signal,
    }),
  );
  if (!r.body) throw new StudioError('No response arrived. Please try again.');
  let done = false;
  for await (const raw of readEvents(r.body)) {
    const event = JSON.parse(raw);
    if (event.type === 'delta') onDelta(event.text);
    else if (event.type === 'error') throw new StudioError(event.message);
    else if (event.type === 'done') done = true;
  }
  if (!done) throw new StudioError('The answer was interrupted. You can try again.');
}
export async function generateImage(
  prompt: string,
  style: string,
  signal: AbortSignal,
): Promise<{ dataUrl: string; mime: string }> {
  await ensureSession();
  const result = (await (
    await check(
      await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, requestId: crypto.randomUUID() }),
        signal,
      }),
    )
  ).json()) as { dataUrl: string; mime: string };
  if (!/^data:image\/(png|jpeg);base64,/.test(result.dataUrl))
    throw new StudioError('The image format could not be displayed. Please try again.');
  const image = new Image();
  image.src = result.dataUrl;
  try {
    await image.decode();
  } catch {
    throw new StudioError('The generated image could not be opened. Your prompt is still here.');
  }
  signal.throwIfAborted();
  return result;
}
export async function voiceTurn(
  audio: Blob,
  history: Message[],
  signal: AbortSignal,
): Promise<{ transcript: string; answer: string; audioUrl: string | null; audioError?: string }> {
  await ensureSession();
  const form = new FormData();
  form.set('audio', audio, 'recording.wav');
  form.set('history', JSON.stringify(boundedContext(history, 8, 12000)));
  form.set('requestId', crypto.randomUUID());
  return (await check(await fetch('/api/voice', { method: 'POST', body: form, signal }))).json();
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
