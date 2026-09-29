import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  Headphones,
  Mic,
  Play,
  Square,
  Volume2,
} from 'lucide-react';
import type { Message, Session } from '../../../shared/contracts';
import { errorMessage, voiceTurn } from '../../lib/api';
import { Recorder } from './recorder';
import { CopyButton } from '../../components/ui/CopyButton';
import { VoiceOrb } from './VoiceOrb';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Notice } from '../../components/ui/Notice';
type Stage = 'idle' | 'permission' | 'recording' | 'thinking' | 'speaking';
const labels = {
  idle: 'Ready to listen.',
  permission: 'Waiting for your microphone…',
  recording: 'I’m listening. Take your time.',
  thinking: 'Let me think about that…',
  speaking: 'A thought, coming your way.',
};
export default function VoiceStudio({
  session,
  onMessages,
  ready,
  onConnect,
  onChat,
}: {
  session: Session;
  onMessages: (m: Message[]) => void;
  ready: boolean;
  onConnect: () => void;
  onChat: () => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const recorder = useRef<Recorder | null>(null);
  const controller = useRef<AbortController | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const epoch = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const clearTimers = () => {
    if (timeout.current) clearTimeout(timeout.current);
    if (interval.current) clearInterval(interval.current);
  };
  const stop = () => {
    epoch.current++;
    clearTimers();
    recorder.current?.cancel();
    controller.current?.abort();
    if (player.current) {
      player.current.pause();
      player.current.src = '';
      player.current = null;
    }
    setStage('idle');
    setLevel(0);
  };
  useEffect(
    () => () => {
      epoch.current++;
      clearTimers();
      recorder.current?.cancel();
      controller.current?.abort();
      if (player.current) {
        player.current.pause();
        player.current.src = '';
      }
    },
    [],
  );
  useEffect(() => {
    const blur = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', blur);
    return () => document.removeEventListener('visibilitychange', blur);
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, [session.messages]);
  async function play(url: string, id = epoch.current) {
    if (player.current) player.current.pause();
    const audio = new Audio(url);
    player.current = audio;
    audio.muted = muted;
    audio.onended = () => {
      if (epoch.current === id) setStage('idle');
    };
    audio.onerror = () => {
      if (epoch.current === id) {
        setStage('idle');
        setError('The audio couldn’t play. Your answer is still in the transcript.');
      }
    };
    try {
      setStage('speaking');
      await audio.play();
      if (epoch.current !== id) audio.pause();
    } catch {
      if (epoch.current === id) {
        setStage('idle');
        setError('Your browser paused playback. Press “Play answer” to listen.');
      }
    }
  }
  async function finish(id = epoch.current) {
    if (id !== epoch.current || !recorder.current) return;
    clearTimers();
    setStage('thinking');
    setLevel(0);
    const abort = new AbortController();
    controller.current = abort;
    const currentRecorder = recorder.current;
    try {
      const blob = await currentRecorder.stop();
      if (id !== epoch.current) return;
      const result = await voiceTurn(blob, session.messages, abort.signal);
      if (id !== epoch.current) return;
      onMessages([
        ...session.messages,
        { id: crypto.randomUUID(), role: 'user', content: result.transcript },
        { id: crypto.randomUUID(), role: 'assistant', content: result.answer },
      ]);
      setAudioUrl(result.audioUrl);
      if (result.audioUrl && !muted) await play(result.audioUrl, id);
      else {
        setStage('idle');
        if (result.audioError) setError(result.audioError);
      }
    } catch (e) {
      if (epoch.current === id) {
        setStage('idle');
        if (!abort.signal.aborted) setError(errorMessage(e));
      }
    } finally {
      currentRecorder.cancel();
    }
  }
  async function start() {
    if (!ready) {
      onConnect();
      return;
    }
    stop();
    const id = ++epoch.current;
    setError('');
    setSeconds(0);
    setStage('permission');
    const mic = new Recorder();
    recorder.current = mic;
    try {
      await mic.start((v) => {
        if (epoch.current === id) setLevel(v);
      });
      if (epoch.current !== id) {
        mic.cancel();
        return;
      }
      setStage('recording');
      interval.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      timeout.current = setTimeout(() => {
        void finish(id);
      }, 15000);
    } catch (e) {
      if (epoch.current === id) {
        setStage('idle');
        const name = e instanceof Error ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Microphone permission is off. Allow it in your browser’s site settings, then try again.'
            : name === 'NotFoundError'
              ? 'No microphone found. Connect one, or switch to chat.'
              : errorMessage(e),
        );
      }
    }
  }
  const active = stage !== 'idle';
  return (
    <section className="voice-studio" aria-label="Voice workspace">
      <div className="workspace-intro voice-intro">
        <div>
          <Eyebrow>
            <span className="tiny-line" /> 01 / VOICE
          </Eyebrow>
          <h1>
            Think <em>out loud.</em>
          </h1>
          <p>Talk through an idea. Get a fresh perspective. Keep the conversation moving.</p>
        </div>
        <span className="mode-note">
          <Headphones size={15} /> A conversation at your pace
        </span>
      </div>
      <div className="voice-layout">
        <div className={`voice-stage ${stage}`}>
          <div className="stage-top">
            <span className="live-label">
              <span className={`status-dot ${stage === 'recording' ? 'red' : ''}`} />
              {stage === 'recording'
                ? 'MICROPHONE ON'
                : stage === 'thinking'
                  ? 'FINDING THE WORDS'
                  : stage === 'speaking'
                    ? 'SPEAKING'
                    : 'VOICE STUDIO'}
            </span>
            <button
              className={`icon-button ${muted ? 'muted' : ''}`}
              aria-label={muted ? 'Enable spoken replies' : 'Mute spoken replies'}
              aria-pressed={muted}
              onClick={() => {
                setMuted(!muted);
                if (player.current) player.current.muted = !muted;
              }}
            >
              <Volume2 size={17} />
              {muted && <span className="mute-slash" />}
            </button>
          </div>
          <VoiceOrb active={stage === 'recording' || stage === 'speaking'} level={level} />
          <div className="voice-prompt">
            <h2 aria-live="polite">{labels[stage]}</h2>
            <p>
              {stage === 'recording'
                ? `${String(seconds).padStart(2, '0')} / 15 seconds · finish whenever you’re ready`
                : stage === 'permission'
                  ? 'Allow access in your browser. You can cancel anytime.'
                  : stage === 'thinking'
                    ? 'Turning your voice into a useful next thought.'
                    : stage === 'speaking'
                      ? 'You can stop the reply whenever you like.'
                      : 'Start recording, speak naturally, then send your message.'}
            </p>
          </div>
          <div className="voice-actions">
            {stage === 'recording' ? (
              <button className="primary record-button" onClick={() => void finish()}>
                <Square size={15} fill="currentColor" /> Finish & send
              </button>
            ) : active ? (
              <button className="primary record-button" onClick={stop}>
                <Square size={15} /> {stage === 'permission' ? 'Cancel' : 'Stop'}
              </button>
            ) : (
              <button className="primary record-button" onClick={() => void start()}>
                <Mic size={18} />{' '}
                {session.messages.length ? 'Record next thought' : 'Start a conversation'}
                <ArrowUpRight size={17} />
              </button>
            )}
            {stage === 'recording' && (
              <button className="text-button" onClick={stop}>
                Discard
              </button>
            )}
          </div>
          <div className="stage-bottom">
            <span>
              <span className="mini-wave">▂▅▃▆▂</span> YOUR VOICE. YOUR PACE.
            </span>
            <span>15s per turn</span>
          </div>
        </div>
        <div className="transcript-panel">
          <div className="transcript-head">
            <span>CONVERSATION TRANSCRIPT</span>
            <span className="count-tag">
              {Math.floor(session.messages.length / 2)
                .toString()
                .padStart(2, '0')}{' '}
              turns
            </span>
          </div>
          {session.messages.length ? (
            <div className="transcript-messages">
              {session.messages.map((m) => (
                <article className={`transcript-message ${m.role}`} key={m.id}>
                  <span className="message-label">{m.role === 'user' ? 'YOU' : 'CALLMISSED'}</span>
                  <p>{m.content}</p>
                  {m.role === 'assistant' && <CopyButton text={m.content} />}
                </article>
              ))}
              <div ref={bottom} />
            </div>
          ) : (
            <div className="transcript-empty">
              <div className="transcript-symbol">
                <AudioLines size={27} strokeWidth={1.25} />
              </div>
              <h3>
                The conversation,
                <br />
                <em>in writing.</em>
              </h3>
              <p>
                Your words and the replies appear here,
                <br />
                ready to revisit or copy.
              </p>
              <span className="vertical-dash" />
              <span className="small-caps">YOUR WORDS + AI REPLIES</span>
            </div>
          )}
          <div className="transcript-foot">
            {audioUrl ? (
              <button
                className="text-button"
                disabled={stage !== 'idle'}
                onClick={() => void play(audioUrl)}
              >
                <Play size={14} /> Play answer
              </button>
            ) : (
              <span>
                <span className="status-dot" /> No audio is saved
              </span>
            )}
            <button className="text-button" onClick={onChat}>
              Prefer typing? <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </div>
      {error && <Notice onDismiss={() => setError('')}>{error}</Notice>}
      <div className="voice-afterword">
        <span className="afterword-number">HOW IT WORKS</span>
        <p>
          Record. Send. Listen.
          <br />
          <em>One thought at a time.</em>
        </p>
        <div>
          <ArrowDown size={16} />
          <span>
            Try “Help me think through an idea”
            <br />
            or “Explain something I’ve always wondered about.”
          </span>
        </div>
      </div>
    </section>
  );
}
