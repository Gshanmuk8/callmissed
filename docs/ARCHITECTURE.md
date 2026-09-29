# How I put it together

I kept the frontend and API in one repository. React handles the three workspaces, and a Cloudflare Worker serves the built app and handles AI requests. Having them on the same origin makes local development and deployment easier to follow.

## From a button click to a reply

The browser gets an HTTP-only visitor cookie, then calls `/api/chat`, `/api/images` or `/api/voice`. The Worker checks the input, makes sure that capability is configured and reserves a request from the daily allowance. Only then does it call the provider.

The quotas live in one SQLite Durable Object so simultaneous requests share the same counter. If that store is unavailable, the request stops. I preferred that behaviour to accidentally letting a broken quota check use up the AI allowance.

Provider code sits in `worker/provider.ts`. It turns the different responses into the shapes the frontend expects and keeps credentials and private provider errors out of browser responses. Production uses the native Workers AI binding. There is also a compatible HTTP adapter, but that path still needs a live provider check.

## Keeping the frontend understandable

Each workspace has its own folder under `src/features`. Shared buttons, notices and dialogs live under `src/components`; the app shell coordinates navigation and sessions. Validation and audio/stream helpers are in `shared` because both sides need them.

The UI keeps recording, processing and playback separate. Waiting for microphone permission is its own state too. If an old request finishes after a new session starts, operation IDs prevent it from changing the new conversation.

## The voice path

This part needs the most care because a microphone can stay active after the screen that requested it has gone away.

- A user action requests permission. If the user cancels while permission is pending, any tracks returned later are stopped immediately.
- An AudioWorklet collects PCM samples. Its output is silent, so the microphone doesn't feed back through the speakers.
- Finishing a recording flushes the samples, releases the microphone and audio context, resamples the audio and encodes a WAV.
- The Worker checks the WAV's header, size, sample rate, channels and 15-second duration limit independently of the browser.
- Transcription becomes the user's message. The language model gets a bounded conversation history, then speech synthesis reads its reply.

If speech synthesis fails, the text reply is still useful. If the browser blocks autoplay, the user gets a play control. Switching modes, hiding the tab, discarding a recording or leaving the component stops recording/playback. Raw recordings are not saved.

## Where history goes

The demo saves sessions in localStorage. Images are downloaded separately; history keeps their prompts, not the image files.

Optional Supabase history uses browser Auth and row-level security. No service-role key is needed. Guest history and each account's cache have separate namespaces, so signing in doesn't silently upload guest conversations.

Cloud saves are debounced and serialized. Internal navigation flushes them, and deletion waits for pending saves. Closing the browser before a save finishes can still leave the newest changes only on that device. That is a limitation to keep in mind when testing cloud history.

## Choices I would revisit as it grows

Turn-based voice kept this version manageable within the free allowance. Continuous conversation would need a different audio/session flow, including interruptions. One global quota object is enough for this small demo; a much busier app would need another look at that design.

I also avoided automatic inference retries, since one click shouldn't quietly make several paid requests. Models and generation settings are chosen on the server. The browser can't supply arbitrary provider URLs or increase generation steps.

For this assignment I stayed with chat, images and voice. Billing, phone calls, tool execution, uploads and a public gallery are outside this version. The [design notes](DESIGN.md) cover the UI, and the [testing notes](TESTING.md) record what has actually been checked.
