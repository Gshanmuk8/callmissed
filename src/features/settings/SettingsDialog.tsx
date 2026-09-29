import type { FormEvent, Dispatch, SetStateAction } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, Check, Cloud, ShieldCheck } from 'lucide-react';
import type { Configuration } from '../../../shared/contracts';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import { modes } from '../../app/workspaces';

interface Props {
  configuration: Configuration;
  ready: boolean;
  user: User | null;
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  authBusy: boolean;
  authMessage: string;
  setAuthMessage: Dispatch<SetStateAction<string>>;
  signIn: (event: FormEvent) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export function SettingsDialog({
  configuration,
  ready,
  user,
  email,
  setEmail,
  authBusy,
  authMessage,
  setAuthMessage,
  signIn,
  onRefresh,
  onClose,
}: Props) {
  return (
    <Modal title="Make yourself at home." onClose={() => onClose()}>
      <p className="modal-description">Your connections, your history, your space.</p>
      <div className="settings-section">
        <div className="settings-section-title">
          <span>AI CONNECTION</span>
          <button className="text-button" onClick={() => onRefresh()}>
            Refresh status ↻
          </button>
        </div>
        {modes.map((m) => (
          <div className="connection-row" key={m.id}>
            <m.icon size={18} />
            <span>{m.label}</span>
            <span className={configuration[m.id].ready ? 'ready-pill' : 'pending-pill'}>
              {configuration[m.id].ready ? (
                <>
                  <Check size={12} /> Connected
                </>
              ) : (
                'Pending'
              )}
            </span>
          </div>
        ))}
        {!ready && (
          <p className="settings-note">
            The interface is ready to explore. Chat, image generation, and spoken answers will
            become available when the studio’s AI connection is configured.
          </p>
        )}
      </div>
      <div className="settings-section">
        <div className="settings-section-title">
          <span>
            <Cloud size={14} /> KEEP YOUR THOUGHTS CLOSE
          </span>
        </div>
        {user ? (
          <>
            <p className="settings-note">
              Signed in as <strong>{user.email}</strong>. New sessions save to your private cloud
              history.
            </p>
            <button
              className="secondary"
              onClick={async () => {
                const { error } = await supabase!.auth.signOut();
                if (error) setAuthMessage('Sign out failed. Please try again.');
              }}
            >
              Sign out
            </button>
          </>
        ) : supabase ? (
          <form onSubmit={signIn}>
            <label htmlFor="email">Save sessions across devices</label>
            <div className="email-form">
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="primary" disabled={authBusy}>
                {authBusy ? 'Sending…' : 'Email me a link'}
              </button>
            </div>
            <p className="settings-note">
              No password to remember. We’ll send you a secure sign-in link.
            </p>
          </form>
        ) : (
          <p className="settings-note">
            Sessions are saved on this device. Cloud history will be available once Supabase is
            connected. You can use the studio without an account.
          </p>
        )}
        {authMessage && (
          <p className="auth-message" role="status">
            {authMessage}
          </p>
        )}
      </div>
      <div className="privacy-note">
        <ShieldCheck size={18} />
        <p>
          Recordings are processed for your reply and are never saved by this app. Text history
          stays on your device, and syncs to your account when signed in. AI providers process your
          prompts and audio under their own policies.
        </p>
      </div>
      <button className="primary wide" onClick={() => onClose()}>
        Back to the studio <ArrowUpRight size={16} />
      </button>
    </Modal>
  );
}
