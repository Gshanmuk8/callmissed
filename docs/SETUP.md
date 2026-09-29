# Setup

## Local interface

Use Node.js 24. Run `npm ci`, then `npm run dev`. Vite serves the app and API at `http://127.0.0.1:5173`.

The default provider is `none`. This lets you work on the interface without credentials or inference costs. Restart the server after changing environment files.

## Cloudflare Workers AI

```sh
npx wrangler login
npm run dev:live
```

The launcher refreshes the existing Wrangler OAuth login and passes its token to the development Worker in memory. It uses Cloudflare's REST API because the native remote binding failed in the initial local setup. It does not deploy the app. Restart the command if the login expires. If your login has several accounts, set `CLOUDFLARE_ACCOUNT_ID` in your shell.

Models: Llama 3.1 8B FP8 (chat), FLUX.1 schnell (images), Whisper large v3 turbo (transcription), and MeloTTS (English speech). Calls consume the account's finite allowance. Check [current pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) before enabling live requests.

To try the native binding instead, put `AI_PROVIDER=cloudflare` in `.dev.vars`, set `CF_REMOTE_AI=1` in your shell, and use `npm run dev`. This path still needs live verification.

## Compatible HTTP providers

Copy `.dev.vars.example` to `.dev.vars`. Set `AI_PROVIDER=compatible` and provide the base URL, API key and model names. Include the version prefix in the base URL, for example `https://api.callmissed.com/v1`.

| Variable                              | Used for                                |
| ------------------------------------- | --------------------------------------- |
| `AI_BASE_URL`, `AI_API_KEY`           | Default server-side provider connection |
| `CHAT_MODEL`                          | Chat and the text reply in voice mode   |
| `IMAGE_MODEL`                         | Image generation                        |
| `STT_MODEL`, `TTS_MODEL`, `TTS_VOICE` | Transcription and spoken replies        |
| `IMAGE_BASE_URL`, `IMAGE_API_KEY`     | Optional image provider override        |
| `SPEECH_BASE_URL`, `SPEECH_API_KEY`   | Optional speech provider override       |

The adapter uses `/chat/completions` with SSE for chat, `/images/generations` with base64 PNG/JPEG output, `/audio/transcriptions` with multipart WAV input, and `/audio/speech` with MP3 output. Check the chosen models and responses against these contracts. CallMissed's live integration has not been verified.

Keep these values on the server. A `VITE_` variable is included in the browser bundle, so it must never contain an AI key or service-role key. The examples contain placeholders only.

## Optional Supabase history

The app works with device-local history and no login. To enable cloud history:

- Copy `.env.example` to `.env` and supply `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A legacy anon key also works. No service-role key or database connection string is needed.
- Run `supabase/migrations/001_studio.sql` once in the Supabase SQL editor. It creates the session table and row-level security policies.
- Enable email authentication. Set the Auth Site URL to `http://127.0.0.1:5173` and add it to Redirect URLs.
- Restart Vite and use the email sign-in form in studio settings. Check [email delivery limits](https://supabase.com/docs/guides/auth/auth-smtp) before opening sign-in to other users.

Guest sessions and account history are separate. Signing in doesn't upload existing guest sessions. Raw recordings and generated image files are not saved; download images you want to keep.

## Request limits

| Per day     | Per visitor | Whole studio |
| ----------- | ----------: | -----------: |
| Chat        |          20 |           50 |
| Images      |           3 |           10 |
| Voice turns |           6 |           20 |

Limits reset at midnight UTC. Failed requests still consume a reservation, and inference isn't retried automatically. Provider limits also apply. The visitor cookie is a basic abuse control; the global cap is the budget boundary.

## Deployment notes

Deployment has not been completed. CI runs checks only.

For a future Cloudflare deployment, set `AI_PROVIDER` and nonsecret model settings in `wrangler.jsonc`. Add compatible-provider keys with `npx wrangler secret put AI_API_KEY` and the relevant image/speech key names. `.dev.vars` does not configure production secrets. Optional public Supabase values must be present at frontend build time.

Run the checks before `npm run deploy`. Verify the native AI binding, account allowance, Worker CPU usage and all three live flows on the HTTPS URL. Add that URL to Supabase Auth redirects if cloud history is enabled. The local OAuth launcher is not used in production.
