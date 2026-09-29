class StudioRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.active = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') {
        this.active = false;
        this.flush();
        this.port.postMessage({ done: true });
      }
    };
  }
  flush() {
    if (this.buffer.length) {
      const samples = new Float32Array(this.buffer);
      this.port.postMessage({ samples }, [samples.buffer]);
      this.buffer = [];
    }
  }
  process(inputs) {
    if (!this.active) return false;
    const input = inputs[0]?.[0];
    if (input) {
      this.buffer.push(...input);
      if (this.buffer.length >= 2048) this.flush();
    }
    return true;
  }
}
registerProcessor('studio-recorder', StudioRecorder);
