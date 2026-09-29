import type { Message } from './contracts';

export function boundedContext(messages: Message[], maxMessages = 12, maxBytes = 24000) {
  const selected: Pick<Message, 'role' | 'content'>[] = [];
  let bytes = 0;
  for (const message of messages.slice().reverse()) {
    if (!message.content.trim()) continue;
    const size = new TextEncoder().encode(message.content).length;
    if (selected.length >= maxMessages || bytes + size > maxBytes) break;
    selected.unshift({ role: message.role, content: message.content });
    bytes += size;
  }
  while (selected[0]?.role === 'assistant') selected.shift();
  return selected;
}
