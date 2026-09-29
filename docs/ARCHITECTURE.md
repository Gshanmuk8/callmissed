# Architecture and implementation decisions

## Request flow

The browser serves a Vite-built React application. Static assets and an API Worker share the same origin, so no public CORS wildcard is needed. The browser requests an HTTP-only visitor cookie, then submits a bounded request to `/api/chat`, `/api/images`, or `/api/voice`.

Each API route validates input, checks configured capability availability, and reserves capacity through one named SQLite Durable Object. Only admitted requests reach a provider. The quota store fails closed. The provider adapter normalizes responses; private provider errors and credentials are not returned to the client.

Supabase is a separate optional persistence path: browser Auth obtains the user's session and PostgREST enforces row-level security on every session operation. The public browser key is intentionally public; a service-role key is never used. Guest and account caches are kept in separate localStorage namespaces. Cloud saves are debounced and serialized, flushed on internal navigation, and awaited before deletion. Closing a browser before its cloud save completes can leave only the device copy; do not claim guaranteed background delivery.

## UI direction

Clash Display headings and Figtree body text follow CallMissed's website, with warm paper, near-black panels and coral accents. Fonts are bundled locally. SVG components provide the image studies and animated voice orb. The studies are labelled as illustrations, not generated outputs. See [design notes](DESIGN.md) for the palette.

Voice, chat, and image workspaces each have a layout suited to the task. Empty states provide concrete starting actions. Success, pending setup, quota failure, provider failure, permission wait, recording, processing, and playback are distinct states. The microphone figure changes scale with actual measured input volume while recording; idle motion is decorative. Reduced-motion preferences disable animation.

## Audio lifetime

1. A user action requests a microphone. A cancelled late permission result immediately stops its returned tracks.
2. An AudioWorklet collects bounded PCM chunks. A zero-gain output keeps the processing graph running without microphone feedback.
3. Finishing capture flushes the worklet, closes tracks and AudioContext, resamples in OfflineAudioContext, and encodes a canonical WAV.
4. The Worker independently validates the WAV header, length, sample rate, channel count, and 15-second duration bound.
5. STT produces a transcript; the language model sees bounded prior context; TTS creates a short reply.
6. The UI exposes transcript and playback. Synthesis failure preserves useful text. A playback gesture is offered when autoplay is blocked.

Epoch guards prevent prior operations from mutating a new session. Mode changes, stop/discard, unmount, and hidden tabs release capture and stop playback. Raw audio is not persisted. Live hardware quality, background behavior on actual phones, and provider-specific codecs remain acceptance checks.

## Key tradeoffs

- Turn-based voice keeps orchestration understandable and affordable. It does not provide interruption-aware realtime duplex audio.
- Images are downloaded rather than placed in public object storage. The saved session retains the prompt, not the image binary.
- Guest sessions avoid signup friction. Optional account history is scoped with RLS and remains usable across signed-in devices.
- One global quota object is sufficient for a bounded demonstration; this is deliberately not a multi-region high-throughput service.
- No automatic inference retry avoids duplicate charges. A user can deliberately retry with a new request identifier.
- API provider selection stays on the server. The user cannot request arbitrary models, remote image URLs, or higher inference steps.
- Native Cloudflare models and the compatible HTTP adapter are implemented but require live schema/entitlement verification before release.

## Deliberate scope boundaries

There is no billing, public image gallery, external agent tool execution, telephony, document upload, or permanent audio archive. Supabase is optional; the default is device-local guest history. Mock providers are used only in tests.
