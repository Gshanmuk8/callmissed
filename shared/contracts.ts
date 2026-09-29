import { z } from 'zod';
export type Mode = 'voice' | 'chat' | 'images';
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  incomplete?: boolean;
};
export type Session = {
  id: string;
  mode: Mode;
  title: string;
  messages: Message[];
  updatedAt: number;
};
export type Capability = { ready: boolean; label: string };
export type Configuration = {
  provider: string;
  chat: Capability;
  images: Capability;
  voice: Capability;
};
export const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(6000),
});
export const chatSchema = z
  .object({ messages: z.array(messageSchema).min(1).max(12), requestId: z.string().uuid() })
  .strict()
  .refine((v) => v.messages.at(-1)?.role === 'user', 'End with a user message')
  .refine(
    (v) => v.messages.reduce((n, m) => n + new TextEncoder().encode(m.content).length, 0) <= 24000,
    'Conversation is too long',
  );
export const imageSchema = z
  .object({
    prompt: z.string().trim().min(3).max(1200),
    style: z.enum(['editorial', 'cinematic', 'illustration', 'natural']),
    requestId: z.string().uuid(),
  })
  .strict();
export const voiceHistorySchema = z
  .array(messageSchema)
  .max(8)
  .refine((v) => v.reduce((n, m) => n + m.content.length, 0) <= 12000);
export const limits = {
  chat: { global: 50, visitor: 20 },
  images: { global: 10, visitor: 3 },
  voice: { global: 20, visitor: 6 },
} as const;
export function nextReset(now = Date.now()) {
  return new Date(new Date(now).setUTCHours(24, 0, 0, 0)).toISOString();
}
