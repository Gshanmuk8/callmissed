# Testing

## Automated checks

```sh
npm ci
npm run check
npm run test:e2e
npm run format:check
```

`check` runs TypeScript, unit/API tests, a production build, and the Worker runtime checks. CI runs the same checks and the browser suite without AI credentials.

On Windows the browser suite uses installed Microsoft Edge. Elsewhere, run `npx playwright install chromium` first. CI uses `npx playwright install --with-deps chromium`.

| Suite          | What it covers                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Unit/API       | Request validation, WAV encoding, SSE framing, provider responses, errors and quotas                         |
| Worker runtime | The production bundle in workerd, SQLite quota transactions, origin checks and duplicate requests            |
| Browser        | Navigation, streaming chat, history/search, image download, dialogs, failure recovery and microphone cleanup |
| Accessibility  | Serious/critical axe findings in the three workspaces on desktop and emulated mobile                         |

Browser tests use fixture AI responses and a simulated microphone. Passing them does not prove live output quality, hardware audio or iPhone Safari support.

For screenshots, start `npm run dev`, then run `npm run screenshots`. Images and failure traces go into ignored `test-results/`. The mobile project uses a phone-sized Chromium viewport.

## Local verification

After the repository cleanup on 29 September 2026, TypeScript, all 25 unit/API tests, the production build, Worker runtime checks and formatting passed. All 20 browser cases passed in one run with `--workers=1`, covering desktop and emulated mobile. The CSS reorganisation also preserved computed styles across 390, 768 and 1440 px layouts.

Live Cloudflare checks on the same date:

- Chat streamed a real reply and recalled a project name in a follow-up.
- FLUX returned a valid 1024 × 1024 JPEG matching a prompt with a red mug, yellow lemon and blue tablecloth.
- A 5.155-second synthesized WAV completed transcription, a contextual reply and speech synthesis. Edge decoded the returned audio successfully.

These checks used the local REST development connection. The production native binding, physical microphone/speakers and optional Supabase history remain unverified.

## Manual acceptance

### Chat

Ask an unseen question, then a follow-up that depends on the first answer. Confirm that text streams and context is retained. Stop a reply and start another; the old reply must not appear in the new session. Reload and search the saved session.

### Images

Describe three concrete elements, generate an image, and check the result against the prompt. Download it and open it in another viewer. Check cancellation, a failed request, and whether the prompt remains available to retry.

### Voice

Use a real microphone and headphones. Say “My project is Cedar. Suggest one short tagline.” Listen to the reply, then ask “What is my project's name?” Check both the transcript and audible answer.

Deny microphone permission, cancel a pending permission request, discard a recording, switch modes and hide the tab. The microphone indicator should turn off each time. Try silence, background noise and the 15-second limit. Record any transcription or playback problems.

### Device layouts

Check desktop Edge/Chrome, Android Chrome and actual iPhone Safari when available. Check keyboard navigation, visible focus, dialog closing, long replies, long session names and the mobile drawer. Record actual devices tested; emulation is not a substitute.

### Optional Supabase

Only required when cloud history is enabled. Run the migration, sign in, create a session and reload it in a second browser. Confirm deletion persists. Use a second account to verify it cannot read, edit or delete the first account's rows, including direct REST requests. Sign out and confirm guest history returns without leaking account history.

### Before deployment

Check the account's free allowance and model access. Repeat chat, image download and two voice turns on the hosted HTTPS URL. Inspect the browser bundle for credentials, verify any Auth redirects, and check Worker CPU usage. Use fixtures for quota/error cases rather than exhausting live credits.

Keep the commit, URL, browser/device, configured models and results with the release notes. Never include tokens, keys or raw private recordings in test evidence.
