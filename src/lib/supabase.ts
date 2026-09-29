import { createClient } from '@supabase/supabase-js';
import type { Session } from '../../shared/contracts';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
export async function loadCloud(): Promise<Session[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('studio_sessions')
    .select('id,mode,title,messages,updated_at')
    .order('updated_at', { ascending: false })
    .limit(30);
  if (error)
    throw new Error('Your saved sessions couldn’t be loaded. Device history is still available.');
  return (data || []).map((row) => ({
    id: row.id,
    mode: row.mode,
    title: row.title,
    messages: row.messages,
    updatedAt: new Date(row.updated_at).getTime(),
  }));
}
export async function saveCloud(session: Session, userId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('studio_sessions').upsert({
    id: session.id,
    user_id: userId,
    mode: session.mode,
    title: session.title,
    messages: session.messages.slice(-100),
    updated_at: new Date(session.updatedAt).toISOString(),
  });
  if (error) throw new Error('Cloud save paused. This session is still saved on this device.');
}
export async function deleteCloud(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('studio_sessions').delete().eq('id', id);
  if (error) throw new Error('Couldn’t delete the cloud copy. Please try again.');
}
