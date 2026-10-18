// 말투(목소리 기운) 재기: 브라우저 안에서 소리 크기·높낮이·빠르기만 숫자로 잰다.
// 녹음 파일은 Gemini 모드일 때만 잠깐 만들어 보내고 어디에도 저장하지 않는다.

import type { VoiceFeatures } from "./tone.ts";

function pitchOf(buf: Float32Array, rate: number) {
  // 자기상관으로 80~500Hz 사이 가장 닮은 간격을 찾는다
  const minLag = Math.floor(rate / 500);
  const maxLag = Math.floor(rate / 80);
  let best = 0;
  let bestLag = 0;
  let energy = 0;
  for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
  if (!energy) return 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < buf.length; i++) sum += buf[i] * buf[i + lag];
    const c = sum / energy;
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  return best > 0.5 ? rate / bestLag : 0;
}

export class VoiceMeter {
  private ctx?: AudioContext;
  private timer?: ReturnType<typeof setInterval>;
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private louds: number[] = [];
  private pitches: number[] = [];
  private frames = 0;
  stream?: MediaStream;

  async start(record: boolean) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.ctx = new AudioContext();
    await this.ctx.resume();
    const an = this.ctx.createAnalyser();
    an.fftSize = 2048;
    this.ctx.createMediaStreamSource(this.stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    const rate = this.ctx.sampleRate;
    this.timer = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let e = 0;
      for (const v of buf) e += v * v;
      const rms = Math.sqrt(e / buf.length);
      this.frames++;
      if (rms < 0.015) return; // 조용한 틈은 세지 않음
      this.louds.push(rms);
      const p = pitchOf(buf, rate);
      if (p) this.pitches.push(p);
    }, 50);
    if (record && typeof MediaRecorder !== "undefined") {
      this.rec = new MediaRecorder(this.stream);
      this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      this.rec.start();
    }
  }

  // 멈추고 숫자(와 Gemini용 16kHz WAV base64)를 돌려준다
  async stop(transcript: string): Promise<{ features: VoiceFeatures; wav?: string }> {
    clearInterval(this.timer);
    const stopped = this.rec && this.rec.state !== "inactive" ? new Promise((r) => (this.rec!.onstop = r)) : null;
    this.rec?.stop();
    await stopped;
    this.stream?.getTracks().forEach((t) => t.stop());
    const seconds = this.louds.length * 0.05;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const semis = this.pitches.map((p) => 12 * Math.log2(p / 100));
    const m = mean(semis);
    const sorted = [...this.pitches].sort((a, b) => a - b);
    const features: VoiceFeatures = {
      seconds: Math.round(seconds * 10) / 10,
      loud: Math.round(mean(this.louds) * 1000) / 1000,
      pitch: Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0),
      pitchVar: Math.round(Math.sqrt(mean(semis.map((s) => (s - m) ** 2))) * 10) / 10,
      rate: seconds ? Math.round((transcript.replace(/[^가-힣a-zA-Z0-9]/g, "").length / seconds) * 10) / 10 : 0,
    };
    let wav: string | undefined;
    if (this.chunks.length && this.ctx) {
      try {
        wav = await toWav16k(new Blob(this.chunks), this.ctx);
      } catch {
        wav = undefined;
      }
    }
    await this.ctx?.close();
    return { features, wav };
  }
}

// 녹음 조각 → 16kHz 모노 WAV(base64). 최대 15초.
async function toWav16k(blob: Blob, ctx: AudioContext) {
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  const seconds = Math.min(decoded.duration, 15);
  const off = new OfflineAudioContext(1, Math.ceil(seconds * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  out.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVEfmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, 16000, true);
  out.setUint32(28, 32000, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  str(36, "data");
  out.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  const bytes = new Uint8Array(out.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
