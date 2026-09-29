export function encodeWav(samples: Float32Array, sampleRate = 16000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, buffer.byteLength - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((n, i) =>
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, n)) * (n < 0 ? 32768 : 32767), true),
  );
  return buffer;
}
export function validateWav(buffer: ArrayBuffer) {
  if (buffer.byteLength < 46 || buffer.byteLength > 480044) return false;
  const v = new DataView(buffer);
  const text = (o: number, n: number) => String.fromCharCode(...new Uint8Array(buffer, o, n));
  return (
    text(0, 4) === 'RIFF' &&
    text(8, 4) === 'WAVE' &&
    text(12, 4) === 'fmt ' &&
    text(36, 4) === 'data' &&
    v.getUint32(4, true) === buffer.byteLength - 8 &&
    v.getUint32(16, true) === 16 &&
    v.getUint16(20, true) === 1 &&
    v.getUint16(22, true) === 1 &&
    v.getUint32(24, true) === 16000 &&
    v.getUint32(28, true) === 32000 &&
    v.getUint16(32, true) === 2 &&
    v.getUint16(34, true) === 16 &&
    v.getUint32(40, true) === buffer.byteLength - 44 &&
    (buffer.byteLength - 44) % 2 === 0
  );
}
