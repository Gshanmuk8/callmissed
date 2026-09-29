# CallMissed Studio

[Try the app](https://callmissed-studio.callmissed-studio-0eed1e53.workers.dev) · [Code](https://github.com/Gshanmuk8/callmissed)

This is my submission for the CallMissed full-stack internship assignment. The brief was to build a web app with chat, image generation and a voice agent, using a stack of my choice.

I wanted someone opening the link to be able to try it straight away. There is no signup step in the demo: pick a workspace, ask something, and the conversation stays on your device. I also wanted the app to feel at home next to CallMissed's website, so I used its font pairing and warm colours as my starting point.

The voice screen is my favourite part. The orange orb responds to microphone volume, and the transcript stays beside it. Getting a reply is only part of that experience; cancelling a recording, switching screens and stopping playback all need to make sense too. Those details shaped quite a bit of the implementation.

## A quick look

Chat streams replies and remembers the conversation. You can stop an answer, start a fresh session or search earlier ones. Images start with a prompt and a visual direction, then give you a result you can download. Voice records a short message, transcribes it, works out a reply and reads it back.

I used React, TypeScript and Vite for the frontend, with a Cloudflare Worker handling the API. The live version uses Workers AI. I wanted to keep the project within free allowances, so requests have daily limits and there are no automatic inference retries. Supabase support is included for optional account history; the public demo uses local history.

## Run it yourself

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://127.0.0.1:5173). This starts the interface without an AI connection. To try real responses with your own Cloudflare account:

```sh
npx wrangler login
npm run dev:live
```

Live requests use your account's allowance. For a different provider, start with `.dev.vars.example`. For optional Supabase history, use `.env.example`. The actual environment files stay out of Git. I wrote the full steps in [setup](docs/SETUP.md).

## Finding your way around

```text
src/
  app/          App shell, navigation and error boundary
  features/     Chat, images, voice and settings
  components/   Shared controls and branding
  lib/          API client, local storage and Supabase
  styles/       Fonts, colours and layout
worker/         API routes, providers and daily quotas
shared/         Types, validation, audio and stream helpers
supabase/       Optional database migration
tests/          Unit/API tests and browser journeys
scripts/        Development and verification helpers
docs/           Notes on setup, design, architecture and testing
```

## Checking the work

```sh
npm run check
npm run test:e2e
npm run format:check
```

The browser tests use Edge on Windows. On Linux or macOS, install Chromium with `npx playwright install chromium` first. Tests use sample responses and a simulated microphone, so they don't spend AI credits. [Testing notes](docs/TESTING.md) explain the live checks separately.

## What I would improve next

The deployed chat, image and voice pipeline have passed live checks. Voice is still one turn at a time: record, send, listen, with a 15-second recording limit. Smoother turn-taking would be my next improvement.

I haven't verified the supplied CallMissed API with this app; the demo runs on Cloudflare's models. The hosted voice check used a synthesized recording and verified the returned audio could be decoded. A real microphone/speaker check and physical phone testing are still on the list. Optional Supabase history also needs a live account test.

I'm happy with how the three workspaces fit together. There is more to do, but this version gives someone a working app to try and a codebase they can run and inspect.

[Setup](docs/SETUP.md) · [How it works](docs/ARCHITECTURE.md) · [Design choices](docs/DESIGN.md) · [Testing notes](docs/TESTING.md)
