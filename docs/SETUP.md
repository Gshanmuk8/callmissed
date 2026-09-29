# Running the project

These are the steps I use to run the app. You can start with just the interface, then connect AI when you're ready.

## Start locally

Use Node.js 24:

```sh
npm ci
npm run dev
```

Open [127.0.0.1:5173](http://127.0.0.1:5173). The local provider defaults to `none`, so this works without credentials. AI actions will explain that a connection is needed. Restart the server after changing environment files.

## Connect Cloudflare AI

```sh
npx wrangler login
npm run dev:live
```

The launcher uses your existing Wrangler OAuth login and passes its token to the development Worker in memory. If you have several Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID` in your shell. Restart the command if the login expires.

I used the REST API for local development because the native remote binding failed in the initial setup. This command runs locally; it doesn't deploy anything. Production uses the native AI binding successfully.

The models are Llama 3.1 8B FP8 for chat, FLUX.1 schnell for images, Whisper large v3 turbo for transcription and MeloTTS for English speech. Live calls use the account's allowance. Check [Cloudflare's current pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) before using your own account.

To try the native binding locally, set `AI_PROVIDER=cloudflare` in `.dev.vars`, set `CF_REMOTE_AI=1` in your shell and run `npm run dev`. That local path still needs verification.

## Use another provider

Copy `.dev.vars.example` to `.dev.vars`, set `AI_PROVIDER=compatible` and fill in your provider details. Include the version prefix in the base URL, such as `https://api.callmissed.com/v1`.

| Setting                               | What to put there                                 |
| ------------------------------------- | ------------------------------------------------- |
| `AI_BASE_URL`, `AI_API_KEY`           | Default provider URL and server key               |
| `CHAT_MODEL`                          | Model for chat and the text part of voice replies |
| `IMAGE_MODEL`                         | Image model                                       |
| `STT_MODEL`, `TTS_MODEL`, `TTS_VOICE` | Speech models and voice                           |
| `IMAGE_BASE_URL`, `IMAGE_API_KEY`     | Optional separate image provider                  |
| `SPEECH_BASE_URL`, `SPEECH_API_KEY`   | Optional separate speech provider                 |

The adapter expects streaming SSE from `/chat/completions`, base64 PNG/JPEG from `/images/generations`, multipart WAV input at `/audio/transcriptions` and MP3 output from `/audio/speech`. Check your provider's models and response formats against those expectations. I haven't verified the CallMissed integration live.

Keep provider credentials in the Worker. Anything prefixed with `VITE_` ends up in the browser bundle, so never use it for an AI secret or service-role key. The committed example files contain placeholders only.

## Add Supabase history if you want it

The demo works without accounts. If you want private history across devices:

- Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A legacy anon key also works. You don't need a service-role key, pooler or database connection string.
- Run `supabase/migrations/001_studio.sql` once in Supabase's SQL editor. It creates the session table and row-level security policies.
- Enable email authentication. For local work, set the Auth Site URL and an allowed Redirect URL to `http://127.0.0.1:5173`.
- Restart Vite and sign in from studio settings. For deployment, use the live HTTPS URL in Supabase's Auth settings too. Check [email delivery limits](https://supabase.com/docs/guides/auth/auth-smtp) before inviting other users.

Signing in doesn't upload existing guest sessions. Account history and guest history stay separate. Recordings and generated image files aren't saved to Supabase; download images you want to keep.

## Keeping the demo affordable

I added daily limits so sharing the link doesn't leave inference usage open-ended.

| Per day     | Per visitor | Whole studio |
| ----------- | ----------: | -----------: |
| Chat        |          20 |           50 |
| Images      |           3 |           10 |
| Voice turns |           6 |           20 |

They reset at midnight UTC. A failed request still uses its reservation, and requests aren't retried automatically. Provider limits also apply. The visitor cookie is a basic abuse control; the global cap is the overall boundary.

## Deploying

[The live app](https://callmissed-studio.callmissed-studio-0eed1e53.workers.dev) uses `AI_PROVIDER=cloudflare` with the native Workers AI binding. Supabase is not enabled there; sessions stay on the visitor's device.

After signing in to Wrangler and running the [checks](TESTING.md):

```sh
npm run deploy
```

GitHub Actions runs checks only. Pushing a commit doesn't deploy the app.

To change providers, put `AI_PROVIDER` and nonsecret model settings in `wrangler.jsonc`. Use `npx wrangler secret put AI_API_KEY` for the default provider key, and the matching image/speech secret names if needed. Local `.dev.vars` files don't configure production. Optional public Supabase settings must be available when the frontend is built.

After deployment I check the HTTPS page, all three AI flows, account allowance and Worker CPU usage. The local OAuth launcher is never part of production.
