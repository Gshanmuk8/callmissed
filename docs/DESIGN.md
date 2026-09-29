# Design notes

The reference is [CallMissed's website](https://www.callmissed.com/), inspected on 29 September 2026. The studio uses the same font pairing and main palette, adapted to a workspace with three modes.

| Token             | Value         |
| ----------------- | ------------- |
| Headings          | Clash Display |
| Body and controls | Figtree       |
| Background        | `#f6f5f3`     |
| Cards             | `#fbfaf9`     |
| Ink               | `#111111`     |
| Coral             | `#e8400d`     |
| Strong coral      | `#c8360b`     |
| Peach             | `#f0dfc7`     |
| Linen             | `#ede9e2`     |
| Border            | `#dcdbda`     |

Strong coral is used for small text and solid buttons to keep contrast readable. Headings carry the brand; body text and controls stay quieter. Fonts are served locally.

The voice orb and image studies are SVG components. The orb responds to measured microphone volume; its idle motion is decorative. The image studies are labelled as illustrations so they aren't confused with generated results.

Desktop voice uses a side-by-side stage and transcript. On smaller screens these stack, and the navigation moves into a drawer. The three modes share navigation, controls and session history, with a different working area for each task.

Keyboard focus, dialog focus containment, reduced motion and text contrast are covered by the browser checks. Physical phone testing is still pending.

## API references

- [Chat completion](https://docs.callmissed.com/docs/chat-completion)
- [Image generation](https://docs.callmissed.com/docs/image-generation)
- [Voice agents](https://docs.callmissed.com/docs/voice-agent)

The compatible adapter follows the chat and image request families. The current voice implementation records one turn at a time; it does not implement CallMissed's continuous WebRTC session protocol.
