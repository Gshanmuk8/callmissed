# How I check the app

I split testing into repeatable checks and trying the real provider. That lets me catch regressions without spending the AI allowance on every run.

## The commands

```sh
npm ci
npm run check
npm run test:e2e
npm run format:check
```

`check` runs TypeScript, unit/API tests, a production build and Worker runtime checks. GitHub Actions runs these and the browser suite without AI credentials.

On Windows the browser tests use installed Microsoft Edge. On Linux or macOS, run `npx playwright install chromium` first. CI uses `npx playwright install --with-deps chromium`.

| Check          | What I use it for                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Unit/API       | Input validation, WAV encoding, streamed response parsing, provider errors and quotas                |
| Worker runtime | The built Worker in workerd, SQLite quota transactions, origin checks and duplicate requests         |
| Browser        | Navigation, chat streaming, history/search, image download, dialogs, recovery and microphone cleanup |
| Accessibility  | Serious/critical axe findings across the three workspaces on desktop and emulated mobile             |

The browser suite uses sample AI responses and a simulated microphone. It can't tell me whether an actual microphone sounds good or whether iPhone Safari behaves properly.

For screenshots, start `npm run dev`, then run `npm run screenshots`. Screenshots and failure traces go into ignored `test-results/`. The mobile project is a phone-sized Chromium viewport.

## What has passed so far

After the repository cleanup on 29 September 2026, TypeScript, all 25 unit/API tests, the production build, Worker runtime checks and formatting passed. All 20 browser cases passed together with `--workers=1`. The CSS reorganisation also preserved computed styles at 390, 768 and 1440 px.

The first live checks used the local Cloudflare REST connection. Chat streamed a reply and remembered a project name in a follow-up. FLUX produced a valid 1024 × 1024 JPEG for a prompt containing a red mug, yellow lemon and blue tablecloth. A 5.155-second synthesized recording completed transcription, a reply and speech synthesis; Edge decoded the returned audio.

## Checking the deployed version

The same three capabilities passed live checks on the hosted app on 29 September 2026 using Cloudflare's native AI binding:

- The HTTPS page loaded and reported all three capabilities ready.
- A chat sent through the UI produced a visible answer without an error alert.
- An image sent through the UI returned a valid JPEG, displayed it and included the requested mug, lemon and tablecloth.
- The voice endpoint transcribed the synthesized recording and returned a reply with audio that Edge decoded as 1.641 seconds of mono sound.
- The production files contained no copy of the local Wrangler OAuth token. No provider key was included in the browser bundle.

Current app address: [CallMissed Studio](https://callmissed-studio.callmissed-studio-0eed1e53.workers.dev).

Those were real provider requests. The voice check covered the hosted pipeline and decoded audio. A physical microphone/speaker check, actual phones and optional Supabase history still need testing.

## Things to try by hand

### Chat

Ask a new question, then a follow-up that needs the first answer. Watch the response stream. Stop it and start a new session; the old reply shouldn't appear there. Reload the app and find the saved conversation using search.

### Images

Describe three concrete things and check whether the image includes them. Download it and open it in another viewer. Also try cancelling and a failed request: the prompt should remain available to retry.

### Voice

Use a real microphone and headphones. Say “My project is Cedar. Suggest one short tagline.” Listen to the reply, then ask “What is my project's name?” Check the transcript and the audible answer.

Try denying permission, cancelling while permission is pending, discarding a recording, switching modes and hiding the tab. The microphone indicator should turn off each time. Also try silence, background noise and the 15-second limit. Write down anything that sounds wrong or fails to play.

### Layout and keyboard use

Try desktop Edge/Chrome, Android Chrome and an actual iPhone with Safari when available. Tab through controls, open and close dialogs, check the mobile drawer, and try long replies and session names. Record the real devices used; emulation doesn't cover everything.

### Supabase, if enabled

Run the migration and sign in. Save a conversation and open it in a second browser, then delete it and confirm it stays deleted. Use a second account to check that it cannot read, change or delete the first account's rows, including through direct REST requests. Sign out and make sure guest history returns without exposing account history.

## Before sharing a new deployment

Check model access and the account's remaining allowance. Try chat, an image download and two voice turns on the live HTTPS URL. Check the browser bundle for credentials, any Auth redirect settings and Worker CPU usage. Use sample responses for quota/error tests instead of exhausting live credits.

Keep the commit, URL, browser/device, models and results with the test notes. Don't put tokens, keys or private recordings into test evidence.
