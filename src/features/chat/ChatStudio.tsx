import { useEffect, useRef, useState } from 'react';
import { ArrowUp, CornerDownLeft, Feather, Lightbulb, Square, WandSparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, Session } from '../../../shared/contracts';
import { errorMessage, streamChat } from '../../lib/api';
import { Brand } from '../../components/Brand';
import { CopyButton } from '../../components/ui/CopyButton';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Notice } from '../../components/ui/Notice';
type Props = {
  session: Session;
  onMessages: (messages: Message[]) => void;
  ready: boolean;
  onConnect: () => void;
};
const prompts = [
  {
    icon: Lightbulb,
    title: 'Find the starting point',
    text: 'Help me turn a rough idea into a simple, actionable plan. Start by asking what I have in mind.',
  },
  {
    icon: Feather,
    title: 'Make the words work',
    text: 'Help me write something that sounds like me. Ask what I’m writing and who it’s for.',
  },
  {
    icon: WandSparkles,
    title: 'Look at it differently',
    text: 'I’m stuck on a creative problem. Help me explore three unexpected angles. Ask me about the problem first.',
  },
];
export default function ChatStudio({ session, onMessages, ready, onConnect }: Props) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const run = useRef(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      run.current++;
      abort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, [session.messages]);
  const stop = () => {
    abort.current?.abort();
  };
  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    if (!ready) {
      onConnect();
      return;
    }
    const epoch = ++run.current;
    const controller = new AbortController();
    abort.current = controller;
    const history = session.messages.filter((m) => m.content);
    const user: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const answer: Message = { id: crypto.randomUUID(), role: 'assistant', content: '' };
    let content = '';
    setDraft('');
    setBusy(true);
    setError('');
    onMessages([...history, user, answer]);
    try {
      await streamChat([...history, user], controller.signal, (delta) => {
        if (run.current !== epoch) return;
        content += delta;
        onMessages([...history, user, { ...answer, content }]);
      });
    } catch (e) {
      if (run.current !== epoch) return;
      const stopped = controller.signal.aborted;
      if (content) onMessages([...history, user, { ...answer, content, incomplete: true }]);
      else {
        onMessages(history);
        setDraft(text);
      }
      if (!stopped) setError(errorMessage(e));
    } finally {
      if (run.current === epoch) {
        setBusy(false);
        textarea.current?.focus();
      }
    }
  }
  return (
    <section className="chat-studio" aria-label="Chat workspace">
      <div className="workspace-intro">
        <Eyebrow>
          <span className="tiny-line" /> 02 / CHAT
        </Eyebrow>
        <h1>
          Space to think.
          <br />
          <em>A way forward.</em>
        </h1>
        <p>Ask a question, work through a problem, or start with an idea.</p>
      </div>
      {session.messages.length === 0 ? (
        <div className="chat-starters">
          <div className="starter-heading">
            <span>START A CONVERSATION</span>
            <span>CHOOSE A STARTING POINT ↘</span>
          </div>
          <div className="prompt-cards">
            {prompts.map((p) => (
              <button
                key={p.title}
                onClick={() => {
                  setDraft(p.text);
                  textarea.current?.focus();
                }}
                className="prompt-card"
              >
                <p.icon size={22} strokeWidth={1.4} />
                <strong>{p.title}</strong>
                <span>{p.text.split('. ')[0]}.</span>
                <span className="card-arrow">↗</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="messages" aria-label="Conversation">
          {session.messages.map((m) => (
            <article className={`message ${m.role}`} key={m.id}>
              <div className="message-avatar">
                {m.role === 'assistant' ? <Brand small /> : <span>YOU</span>}
              </div>
              <div className="message-body">
                <div className="message-label">
                  {m.role === 'assistant' ? 'CallMissed' : 'You'}
                  {m.incomplete && <span className="incomplete">Interrupted</span>}
                </div>
                {m.content ? (
                  <div className="markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="typing" aria-label="Writing an answer">
                    <i />
                    <i />
                    <i />
                  </div>
                )}
                {m.role === 'assistant' && m.content && <CopyButton text={m.content} />}
              </div>
            </article>
          ))}
          <div ref={bottom} />
        </div>
      )}
      <div className="composer-dock">
        {error && <Notice onDismiss={() => setError('')}>{error}</Notice>}
        <form
          className={`composer ${busy ? 'busy' : ''}`}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="chat-prompt">
            Your message
          </label>
          <textarea
            ref={textarea}
            id="chat-prompt"
            rows={2}
            maxLength={6000}
            placeholder="What’s on your mind?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="composer-bottom">
            <span>
              <span className="status-dot" />
              {busy ? 'Putting a thought together…' : 'A little curiosity goes a long way.'}
            </span>
            {busy ? (
              <button
                type="button"
                className="send-button"
                aria-label="Stop response"
                onClick={stop}
              >
                <Square size={16} />
              </button>
            ) : (
              <button className="send-button" disabled={!draft.trim()} aria-label="Send message">
                <ArrowUp size={20} />
              </button>
            )}
          </div>
        </form>
        <div className="composer-foot">
          <span>AI can get things wrong. Keep your own perspective.</span>
          <span>
            <CornerDownLeft size={12} /> Send · Shift + Enter for a new line
          </span>
        </div>
      </div>
    </section>
  );
}
