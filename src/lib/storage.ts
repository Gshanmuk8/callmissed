import type { Session } from '../../shared/contracts';
const KEY = 'callmissed.sessions.v1';
export function loadSessions(scope = 'device'): Session[] {
  try {
    const v = JSON.parse(localStorage.getItem(`${KEY}.${scope}`) || '[]');
    return Array.isArray(v)
      ? v
          .filter(
            (s) =>
              typeof s.id === 'string' &&
              ['chat', 'voice', 'images'].includes(s.mode) &&
              Array.isArray(s.messages) &&
              typeof s.title === 'string' &&
              s.messages.every(
                (m: MessageLike) =>
                  ['user', 'assistant'].includes(m.role) && typeof m.content === 'string',
              ),
          )
          .slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
type MessageLike = { role: string; content: string };
export function persistSessions(sessions: Session[], scope = 'device') {
  try {
    localStorage.setItem(
      `${KEY}.${scope}`,
      JSON.stringify(
        sessions
          .slice(0, 30)
          .map((s) => ({ ...s, messages: s.messages.filter((m) => m.content).slice(-100) })),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
export function newSession(mode: Session['mode']): Session {
  return {
    id: crypto.randomUUID(),
    mode,
    title: 'Untitled session',
    messages: [],
    updatedAt: Date.now(),
  };
}
export function mergeSessions(a: Session[], b: Session[]) {
  const map = new Map<string, Session>();
  for (const s of [...a, ...b])
    if (!map.has(s.id) || map.get(s.id)!.updatedAt < s.updatedAt) map.set(s.id, s);
  return [...map.values()].sort((x, y) => y.updatedAt - x.updatedAt).slice(0, 30);
}
