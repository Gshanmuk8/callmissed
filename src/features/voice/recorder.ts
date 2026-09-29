import { encodeWav } from '../../../shared/audio';
export class Recorder {
  private stream?: MediaStream;
  private context?: AudioContext;
  private node?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private cancelled = false;
  private chunks: Float32Array[] = [];
  private samples = 0;
  private finish?: () => void;
  async start(onLevel: (level: number) => void) {
    this.cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Microphone access needs HTTPS and a supported browser.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    if (this.cancelled) {
      stream.getTracks().forEach((t) => t.stop());
      throw new DOMException('Cancelled', 'AbortError');
    }
    this.stream = stream;
    try {
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      await context.audioWorklet.addModule('/recorder-worklet.js');
      if (this.cancelled) throw new DOMException('Cancelled', 'AbortError');
      this.source = context.createMediaStreamSource(stream);
      this.node = new AudioWorkletNode(context, 'studio-recorder');
      const gain = context.createGain();
      gain.gain.value = 0;
      this.node.port.onmessage = (e) => {
        if (e.data.done) {
          this.finish?.();
          return;
        }
        const data = e.data.samples as Float32Array;
        if (!data || this.cancelled) return;
        const remaining = Math.max(0, context.sampleRate * 15 - this.samples);
        const chunk = data.slice(0, remaining);
        if (chunk.length) {
          this.chunks.push(chunk);
          this.samples += chunk.length;
          let sum = 0;
          for (const n of chunk) sum += n * n;
          onLevel(Math.min(1, Math.sqrt(sum / chunk.length) * 5));
        }
      };
      this.source.connect(this.node);
      this.node.connect(gain);
      gain.connect(context.destination);
    } catch (e) {
      this.cancel();
      throw e;
    }
  }
  async stop(): Promise<Blob> {
    if (!this.context || !this.node) throw new Error('The microphone is not recording.');
    const rate = this.context.sampleRate;
    await new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      this.finish = () => {
        clearTimeout(timer);
        resolve();
      };
      timer = setTimeout(resolve, 250);
      this.node!.port.postMessage('stop');
    });
    this.cleanup();
    if (this.samples < rate * 0.15)
      throw new Error('That was a little short. Record at least a moment of speech.');
    const source = new Float32Array(this.samples);
    let o = 0;
    for (const c of this.chunks) {
      source.set(c, o);
      o += c.length;
    }
    const offline = new OfflineAudioContext(
      1,
      Math.min(240000, Math.ceil((source.length * 16000) / rate)),
      16000,
    );
    const buffer = offline.createBuffer(1, source.length, rate);
    buffer.copyToChannel(source, 0);
    const node = offline.createBufferSource();
    node.buffer = buffer;
    node.connect(offline.destination);
    node.start();
    const rendered = await offline.startRendering();
    this.chunks = [];
    return new Blob([encodeWav(rendered.getChannelData(0))], { type: 'audio/wav' });
  }
  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    this.source?.disconnect();
    void this.context?.close().catch(() => {});
    this.stream = undefined;
    this.node = undefined;
    this.context = undefined;
  }
  cancel() {
    this.cancelled = true;
    this.finish?.();
    this.cleanup();
    this.chunks = [];
    this.samples = 0;
  }
}
