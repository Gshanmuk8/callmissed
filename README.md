# CallMissed Studio

[Open the live app](https://callmissed-studio.callmissed-studio-0eed1e53.workers.dev)

I built this for the CallMissed full-stack internship assignment: a web app where you can chat, generate images, and talk to an AI assistant.

I wanted it to feel like one small, useful workspace. The voice screen is my favourite part—the orange orb reacts to the microphone, and the transcript stays beside it so you can come back to the conversation.

## What it does

- Streams chat replies with conversation history and a stop button.
- Generates images from a prompt, with four visual directions and a download option.
- Records a short voice message, transcribes it, and plays the assistant's reply.
- Saves sessions on the device. Supabase can be added for private account history.

Built with React, TypeScript, Vite and Cloudflare Workers. The design follows CallMissed's typography and colour palette.

## Run it

You need Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://127.0.0.1:5173). Without credentials, you can explore the interface; AI actions show that a connection is needed.

For live AI with a Cloudflare account:

```sh
npx wrangler login
npm run dev:live
```

This runs the app locally and sends inference requests to Cloudflare. Calls use your account's allowance, so free usage has limits.

For another compatible provider, copy `.dev.vars.example` to `.dev.vars` and fill in your own values. Supabase is optional; its browser settings go in `.env`, using `.env.example` as a starting point. Both real files are ignored by Git. See [setup](docs/SETUP.md) for the details.

## Project layout

```text
src/
  app/          App shell and error boundary
  features/     Chat, images and voice, each in its own folder
  components/   Shared UI and branding
  lib/          Browser API client, storage and Supabase
  styles/       Fonts, design tokens and application styles
worker/         HTTP routes, AI provider adapter and quota storage
shared/         Validation, types, audio encoding and stream parsing
supabase/       Optional database migration
tests/          Unit/API tests and browser journeys
scripts/        Local development, runtime checks and screenshots
docs/           Setup, architecture, design and testing notes
```

## Check it

```sh
npm run check
npm run test:e2e
npm run format:check
```

Browser tests use Edge on Windows. On Linux or macOS, run `npx playwright install chromium` first. The tests use fixtures and a simulated microphone; they don't spend AI credits.

## Where it stands

The app is deployed on Cloudflare Workers. Chat, image generation and the voice pipeline have passed live checks on the hosted URL using the native Workers AI binding. Voice is record → send → listen, with a 15-second limit per turn. It isn't a continuous WebRTC call yet.

The supplied CallMissed API hasn't been verified with this app. Real microphone/speaker checks are still pending; the hosted voice check used a synthesized recording and verified that the reply audio decodes. I'd like to improve the voice turn-taking next; it is the biggest gap between this version and a natural conversation.

[Setup](docs/SETUP.md) · [Architecture](docs/ARCHITECTURE.md) · [Design](docs/DESIGN.md) · [Testing](docs/TESTING.md)
