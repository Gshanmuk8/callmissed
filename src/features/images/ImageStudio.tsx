import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Download, Expand, ImagePlus, LoaderCircle, Sparkles, X } from 'lucide-react';
import type { Message, Session } from '../../../shared/contracts';
import { generateImage, errorMessage } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { StudyArt } from './StudyArt';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Notice } from '../../components/ui/Notice';
const styles = [
  { id: 'editorial', label: 'Editorial', detail: 'Considered & tactile' },
  { id: 'cinematic', label: 'Cinematic', detail: 'Light & atmosphere' },
  { id: 'illustration', label: 'Illustration', detail: 'Shape & character' },
  { id: 'natural', label: 'Natural', detail: 'Honest & unfiltered' },
];
const studies = [
  {
    kind: 'arch' as const,
    title: 'Somewhere, slower.',
    prompt:
      'A sculptural terracotta arch standing on three shallow steps, sage green background, warm afternoon sun, architectural still life, minimalist composition.',
  },
  {
    kind: 'bloom' as const,
    title: 'An impossible bloom.',
    prompt:
      'An abstract flower made from a folded vermilion ribbon, sculptural organic petals, pale lilac backdrop, delicate shadows, editorial still life.',
  },
];
export default function ImageStudio({
  session,
  onMessages,
  ready,
  onConnect,
}: {
  session: Session;
  onMessages: (m: Message[]) => void;
  ready: boolean;
  onConnect: () => void;
}) {
  const [prompt, setPrompt] = useState(session.messages.at(-1)?.content || '');
  const [style, setStyle] = useState('editorial');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ dataUrl: string; mime: string; prompt: string } | null>(
    null,
  );
  const [expanded, setExpanded] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => () => {
      epoch.current++;
      controller.current?.abort();
    },
    [],
  );
  const cancel = () => {
    epoch.current++;
    controller.current?.abort();
    setBusy(false);
  };
  async function generate() {
    if (busy || prompt.trim().length < 3) return;
    if (!ready) {
      onConnect();
      return;
    }
    const id = ++epoch.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    try {
      const image = await generateImage(prompt.trim(), style, abort.signal);
      if (id !== epoch.current) return;
      setResult({ ...image, prompt: prompt.trim() });
      onMessages([{ id: crypto.randomUUID(), role: 'user', content: prompt.trim() }]);
    } catch (e) {
      if (id === epoch.current && !abort.signal.aborted) setError(errorMessage(e));
    } finally {
      if (id === epoch.current) setBusy(false);
    }
  }
  function download() {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.dataUrl;
    a.download = `callmissed-${Date.now()}.${result.mime === 'image/png' ? 'png' : 'jpg'}`;
    a.click();
  }
  return (
    <section className="image-studio" aria-label="Image workspace">
      <div className="workspace-intro">
        <Eyebrow>
          <span className="tiny-line" /> 03 / IMAGE
        </Eyebrow>
        <h1>
          Give your ideas
          <br />
          <em>a visual form.</em>
        </h1>
        <p>Describe a scene, choose a direction, and create something original.</p>
      </div>
      <div className="image-layout">
        <div className="image-controls">
          <div className="section-label">
            <span>01</span> YOUR PROMPT
          </div>
          <label htmlFor="image-prompt">What do you want to see?</label>
          <textarea
            ref={input}
            id="image-prompt"
            rows={6}
            placeholder="A sunlit room where the walls are made of clouds…"
            value={prompt}
            maxLength={1200}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="field-help">
            <span>Include subject, setting, and light.</span>
            <span>{prompt.length}/1200</span>
          </div>
          <div className="section-label style-heading">
            <span>02</span> VISUAL DIRECTION
          </div>
          <div className="style-options" role="group" aria-label="Image style">
            {styles.map((s) => (
              <button
                className={style === s.id ? 'selected' : ''}
                aria-pressed={style === s.id}
                key={s.id}
                onClick={() => setStyle(s.id)}
              >
                <span className={`style-swatch ${s.id}`} />
                <span>
                  <strong>{s.label}</strong>
                  <small>{s.detail}</small>
                </span>
                <span className="radio-dot" />
              </button>
            ))}
          </div>
          {error && <Notice onDismiss={() => setError('')}>{error}</Notice>}
          <button
            className="primary wide"
            onClick={busy ? cancel : generate}
            disabled={!busy && prompt.trim().length < 3}
          >
            {busy ? (
              <>
                <X size={17} /> Cancel generation
              </>
            ) : (
              <>
                <Sparkles size={17} /> Make it real <ArrowUpRight size={17} />
              </>
            )}
          </button>
          <p className="small-note">
            One original image per generation. <br />
            Download your favorites to keep them.
          </p>
        </div>
        <div className="image-canvas">
          {busy ? (
            <div className="generation-state">
              <div className="developing-art">
                <div />
                <div />
                <div />
              </div>
              <span className="live-label">
                <LoaderCircle className="spin" size={14} /> MAKING ROOM FOR THE UNEXPECTED
              </span>
              <h2>Your idea is taking shape.</h2>
              <p>This can take a minute. Good things need a little space.</p>
            </div>
          ) : result ? (
            <div className="generated-result">
              <div className="image-meta">
                <span>
                  <span className="status-dot" /> YOUR CREATION
                </span>
                <button
                  className="icon-button"
                  aria-label="Expand image"
                  onClick={() => setExpanded(true)}
                >
                  <Expand size={16} />
                </button>
              </div>
              <img src={result.dataUrl} alt={result.prompt} />
              <div className="result-bottom">
                <p>{result.prompt}</p>
                <button className="secondary" onClick={download}>
                  <Download size={16} /> Download
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="canvas-heading">
                <span>START WITH A STUDY</span>
                <span>STUDIES NO. 001—002</span>
              </div>
              <div className="study-grid">
                {studies.map((s, i) => (
                  <button
                    className={`study study-${i}`}
                    key={s.kind}
                    onClick={() => {
                      setPrompt(s.prompt);
                      input.current?.focus();
                    }}
                  >
                    <StudyArt kind={s.kind} />
                    <div className="study-caption">
                      <span>
                        <small>STUDIO STUDY / 00{i + 1}</small>
                        <strong>{s.title}</strong>
                      </span>
                      <ArrowUpRight size={21} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="canvas-note">
                <ImagePlus size={17} />
                <span>
                  Original illustrations for inspiration.
                  <br />
                  Choose one to borrow its prompt, then make it yours.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      {expanded && result && (
        <Modal title="A new perspective." onClose={() => setExpanded(false)}>
          <img className="expanded-image" src={result.dataUrl} alt={result.prompt} />
          <button className="primary wide" onClick={download}>
            <Download size={16} /> Download image
          </button>
        </Modal>
      )}
    </section>
  );
}
