# The design choices

I used [CallMissed's website](https://www.callmissed.com/) as the reference, checked on 29 September 2026. I wanted this to feel like a workspace that belongs alongside it. The font pairing, warm background and coral accents gave me a clear starting point.

## Type and colour

Clash Display gives headings some character. Figtree keeps conversation text and controls easy to read. Both are served locally, so opening the app doesn't depend on a font CDN.

| Part              | Choice        |
| ----------------- | ------------- |
| Headings          | Clash Display |
| Body and controls | Figtree       |
| Background        | `#f6f5f3`     |
| Cards             | `#fbfaf9`     |
| Ink               | `#111111`     |
| Coral             | `#e8400d`     |
| Darker coral      | `#c8360b`     |
| Peach             | `#f0dfc7`     |
| Linen             | `#ede9e2`     |
| Borders           | `#dcdbda`     |

The darker coral is for small text and solid buttons where contrast matters. I kept most surfaces quiet so the conversation or generated image gets the attention.

## Giving each workspace enough room

Voice has the orange orb beside its transcript on desktop. On a smaller screen they stack, and navigation moves into a drawer. Chat gives most of the space to reading and writing. Images use a larger preview area. They share navigation and session history, but their working areas suit what the user is doing.

The orb is an SVG component. During recording its scale follows measured microphone volume; the idle movement is decorative. The image starter studies are SVG illustrations too, and are labelled that way so nobody mistakes them for generated results.

## Small details I care about

A visible focus ring, a dialog that keeps keyboard focus inside it, a clear error and a reduced-motion option all matter here. Browser checks cover those behaviours and serious/critical axe findings. Actual phone testing is still pending; a narrow browser viewport only tells part of the story.

## References for the API side

I also reviewed the CallMissed docs for [chat](https://docs.callmissed.com/docs/chat-completion), [images](https://docs.callmissed.com/docs/image-generation) and [voice agents](https://docs.callmissed.com/docs/voice-agent).

The compatible adapter follows the chat/image request families. This demo's voice flow records one turn at a time; it doesn't implement CallMissed's continuous WebRTC protocol. The live provider is Cloudflare Workers AI.
