import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, Plus, Search, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { Configuration, Message, Mode, Session } from '../../shared/contracts';
import { getConfiguration, errorMessage } from '../lib/api';
import { loadSessions, mergeSessions, newSession, persistSessions } from '../lib/storage';
import { deleteCloud, loadCloud, saveCloud, supabase } from '../lib/supabase';
import ChatStudio from '../features/chat/ChatStudio';
import VoiceStudio from '../features/voice/VoiceStudio';
import ImageStudio from '../features/images/ImageStudio';
import { Brand } from '../components/Brand';
import { Modal } from '../components/ui/Modal';
import { Notice } from '../components/ui/Notice';
import { StudioBoundary } from './StudioBoundary';
import { modes } from './workspaces';
import { SettingsDialog } from '../features/settings/SettingsDialog';

const disconnected: Configuration = {
  provider: 'Not connected',
  chat: { ready: false, label: 'Connection needed' },
  images: { ready: false, label: 'Connection needed' },
  voice: { ready: false, label: 'Connection needed' },
};
export default function App() {
  return (
    <StudioBoundary>
      <Studio />
    </StudioBoundary>
  );
}
function Studio() {
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [active, setActive] = useState<Session>(() => newSession('voice'));
  const [configuration, setConfiguration] = useState(disconnected);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [settings, setSettings] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [mobile, setMobile] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState('Saved on this device');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [storageScope, setStorageScope] = useState('device');
  const cloudReady = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const queueSave = useCallback(
    (session: Session) => {
      if (!user || !cloudReady.current || !session.messages.length) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      setSyncStatus('Saving to cloud…');
      saveQueue.current = saveQueue.current
        .then(() => saveCloud(session, user.id))
        .then(() => setSyncStatus('Saved to cloud'))
        .catch((e) => {
          setSyncStatus('Saved on this device');
          setNotice(errorMessage(e));
        });
    },
    [user],
  );
  const refresh = useCallback(async () => {
    try {
      setConfiguration(await getConfiguration());
      setConfigLoaded(true);
    } catch {
      setNotice('Connection status is unavailable. Check your connection and try again.');
      setConfigLoaded(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!persistSessions(sessions, storageScope))
      setNotice(
        'Device storage is full or blocked. Copy important text before closing the studio.',
      );
  }, [sessions, storageScope]);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    let currentId: string | null | undefined;
    let generation = 0;
    const handleUser = async (next: User | null) => {
      if (!live || currentId === next?.id) return;
      const id = ++generation;
      const changed = currentId !== undefined;
      currentId = next?.id;
      setUser(next);
      cloudReady.current = false;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      if (next) {
        const local = loadSessions(next.id);
        try {
          const cloud = await loadCloud();
          if (live && id === generation) {
            setSessions(mergeSessions(local, cloud));
            setStorageScope(next.id);
            setActive(newSession('voice'));
            cloudReady.current = true;
            setSyncStatus('Cloud connected');
          }
        } catch (e) {
          if (live && id === generation) {
            setSessions(local);
            setStorageScope(next.id);
            setActive(newSession('voice'));
            setNotice(errorMessage(e));
          }
        }
      } else {
        if (changed) {
          setSessions(loadSessions());
          setStorageScope('device');
          setActive(newSession('voice'));
        }
        setSyncStatus('Saved on this device');
      }
    };
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error && live) setNotice('Your cloud session expired. Sign in again to reconnect.');
      else void handleUser(data.session?.user || null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void handleUser(session?.user || null), 0);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user || !cloudReady.current || !active.messages.length) return;
    syncTimer.current = setTimeout(() => queueSave(active), 1200);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [active, user, queueSave]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  function choose(mode: Mode) {
    if (active.mode !== mode) {
      queueSave(active);
      setActive(newSession(mode));
    }
    setMobile(false);
  }
  function fresh() {
    queueSave(active);
    setActive(newSession(active.mode));
    setMobile(false);
  }
  function updateMessages(messages: Message[]) {
    const old = activeRef.current;
    const first = messages.find((m) => m.role === 'user');
    const session = {
      ...old,
      messages,
      title: first ? first.content.slice(0, 65) : 'Untitled session',
      updatedAt: Date.now(),
    };
    setActive(session);
    if (messages.length) setSessions((s) => mergeSessions(s, [session]));
    else setSessions((s) => s.filter((x) => x.id !== old.id));
  }
  function openSession(s: Session) {
    queueSave(active);
    setActive(s);
    setSearch(false);
    setMobile(false);
  }
  async function remove() {
    if (!deleteId) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    try {
      await saveQueue.current;
      if (user) await deleteCloud(deleteId);
      setSessions((s) => s.filter((x) => x.id !== deleteId));
      if (active.id === deleteId) setActive(newSession(active.mode));
      setDeleteId(null);
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: location.origin },
      });
      if (error)
        throw new Error(
          'The sign-in link couldn’t be sent. Check the email and Supabase email settings.',
        );
      setAuthMessage('Check your inbox. Your sign-in link is on its way.');
    } catch (e) {
      setAuthMessage(errorMessage(e));
    } finally {
      setAuthBusy(false);
    }
  }
  const currentMode = modes.find((m) => m.id === active.mode)!;
  const ready = configuration[active.mode].ready;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'open' : ''}`} aria-label="Studio navigation">
        <a
          href="#"
          className="brand-link"
          onClick={(e) => {
            e.preventDefault();
            choose('voice');
          }}
          aria-label="CallMissed home"
        >
          <Brand />
        </a>
        <div className="sidebar-kicker">
          PERSONAL AI STUDIO <span> / 01</span>
        </div>
        <div className="sidebar-actions">
          <button className="new-session" onClick={fresh}>
            <Plus size={17} /> New session <span>↗</span>
          </button>
          <button
            className="search-button"
            onClick={() => setSearch(true)}
            aria-label="Search sessions"
          >
            <Search size={17} />
          </button>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {modes.map((m) => (
            <button
              key={m.id}
              className={`nav-item ${active.mode === m.id ? 'active' : ''}`}
              aria-current={active.mode === m.id ? 'page' : undefined}
              onClick={() => choose(m.id)}
            >
              <m.icon size={19} strokeWidth={1.7} />
              <span>
                <strong>{m.label}</strong>
                <small>{m.description}</small>
              </span>
              <span className="nav-number">{m.number}</span>
            </button>
          ))}
        </nav>
        <div className="recent-heading">
          <span className="nav-label">RECENT SESSIONS</span>
          <span>{sessions.length.toString().padStart(2, '0')}</span>
        </div>
        <div className="recent-list">
          {sessions.length ? (
            sessions.slice(0, 7).map((s) => {
              const Icon = modes.find((m) => m.id === s.mode)!.icon;
              return (
                <div key={s.id} className={`recent-row ${active.id === s.id ? 'selected' : ''}`}>
                  <button onClick={() => openSession(s)} title={s.title}>
                    <Icon size={14} />
                    <span>{s.title}</span>
                  </button>
                  <button
                    className="delete-session"
                    aria-label={`Delete ${s.title}`}
                    onClick={() => setDeleteId(s.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="recent-empty">
              <span className="empty-dash" />
              <p>
                Your sessions will
                <br />
                appear here.
              </p>
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="studio-note">
            <div className="note-spark" aria-hidden="true">
              ↗
            </div>
            <p>
              One space.
              <br />
              <em>Three ways in.</em>
            </p>
            <span>VOICE / CHAT / IMAGE</span>
          </div>
          <button className="profile-button" onClick={() => setSettings(true)}>
            <span className="avatar">{user?.email?.[0]?.toUpperCase() || 'Y'}</span>
            <span>
              <strong>Your studio</strong>
              <small>{user ? 'Cloud connected' : 'Local workspace'}</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{currentMode.label} studio</strong>
          </div>
          <div className="topbar-right">
            <button
              className={`connection-indicator ${ready ? 'connected' : ''}`}
              onClick={() => setSettings(true)}
            >
              <span className="status-dot" />
              {!configLoaded
                ? 'Checking connection'
                : ready
                  ? 'Connected'
                  : 'Awaiting AI connection'}
            </button>
            <button
              className="settings-top icon-button"
              aria-label="Studio settings"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={17} />
            </button>
          </div>
        </header>
        <main id="workspace" tabIndex={-1}>
          <div className="workspace-toolbar">
            <span className="edition">
              STUDIO <span>/</span> {currentMode.label.toUpperCase()}
            </span>
            <button className="text-button" onClick={fresh}>
              <Plus size={14} /> Fresh start
            </button>
          </div>
          {notice && <Notice onDismiss={() => setNotice('')}>{notice}</Notice>}
          {active.mode === 'voice' ? (
            <VoiceStudio
              key={active.id}
              session={active}
              onMessages={updateMessages}
              ready={ready}
              onConnect={() => setSettings(true)}
              onChat={() => choose('chat')}
            />
          ) : active.mode === 'chat' ? (
            <ChatStudio
              key={active.id}
              session={active}
              onMessages={updateMessages}
              ready={ready}
              onConnect={() => setSettings(true)}
            />
          ) : (
            <ImageStudio
              key={active.id}
              session={active}
              onMessages={updateMessages}
              ready={ready}
              onConnect={() => setSettings(true)}
            />
          )}
          <footer className="workspace-footer">
            <span>
              CALLMISSED <span className="footer-divider">/</span> YOUR PERSONAL AI WORKSPACE
            </span>
            <span>
              <ShieldCheck size={13} /> {syncStatus}
            </span>
          </footer>
        </main>
      </div>
      {settings && (
        <SettingsDialog
          configuration={configuration}
          ready={ready}
          user={user}
          email={email}
          setEmail={setEmail}
          authBusy={authBusy}
          authMessage={authMessage}
          setAuthMessage={setAuthMessage}
          signIn={signIn}
          onRefresh={() => void refresh()}
          onClose={() => setSettings(false)}
        />
      )}
      {search && (
        <Modal title="Pick up a thought." onClose={() => setSearch(false)}>
          <div className="session-search">
            <Search size={18} />
            <input
              aria-label="Search your sessions"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a conversation or an idea…"
            />
          </div>
          <div className="search-results">
            {sessions
              .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
              .map((s) => (
                <button key={s.id} onClick={() => openSession(s)}>
                  <span>
                    <small>{s.mode.toUpperCase()}</small>
                    {s.title}
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            {!sessions.some((s) => s.title.toLowerCase().includes(query.toLowerCase())) && (
              <p className="settings-note">
                {sessions.length
                  ? 'No matching thoughts yet. Try a different word.'
                  : 'A fresh notebook. Your sessions will appear here.'}
              </p>
            )}
          </div>
          <div className="search-hint">Open this anytime with Ctrl / ⌘ + K.</div>
        </Modal>
      )}
      {deleteId && (
        <Modal title="Let this thought go?" onClose={() => setDeleteId(null)}>
          <p className="modal-description">
            This deletes the session from this device{user ? ' and your cloud history' : ''}. It
            can’t be undone.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDeleteId(null)}>
              Keep it
            </button>
            <button className="primary" onClick={() => void remove()}>
              <Trash2 size={15} /> Delete session
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
