// 목소리 기운 판단: 그 학생의 평소 목소리(이전 말하기 기록 가운데값)와 비교한다.
// 기기·마이크마다 소리 크기가 달라서, 절대 숫자보다 「평소보다」가 더 믿을 만하다.

export interface VoiceFeatures {
  seconds: number; // 소리가 난 시간(초)
  loud: number; // 말할 때 평균 크기(RMS, 0~1)
  pitch: number; // 목소리 높이 가운데값(Hz), 못 재면 0
  pitchVar: number; // 높낮이 변화(반음 표준편차)
  rate: number; // 1초에 말한 글자 수
}

export type DeviceTone = "들떠 있음" | "차분함" | "가라앉음";

const median = (xs: number[]) => {
  const s = xs.filter((x) => x > 0).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function baseline(history: VoiceFeatures[]): VoiceFeatures | null {
  if (history.length < 3) return null; // 3번은 모여야 「평소」라고 본다
  return {
    seconds: median(history.map((h) => h.seconds)),
    loud: median(history.map((h) => h.loud)),
    pitch: median(history.map((h) => h.pitch)),
    pitchVar: median(history.map((h) => h.pitchVar)),
    rate: median(history.map((h) => h.rate)),
  };
}

// ponytail: 문턱값은 TTS 목소리로 맞춘 대략값. 실제 3학년 목소리로 1~2주 모아 다시 맞출 것.
export function toneOf(f: VoiceFeatures, base: VoiceFeatures | null): { tone: DeviceTone; why: string } | null {
  if (f.seconds < 0.6 || f.loud <= 0) return null;
  const why: string[] = [];
  let s = 0;
  const vote = (dir: number, word: string) => {
    s += dir;
    why.push(word);
  };
  if (base) {
    const loud = f.loud / base.loud;
    if (loud < 0.7) vote(-1, "평소보다 작게");
    else if (loud > 1.4) vote(1, "평소보다 크게");
    if (f.pitch && base.pitch) {
      const semis = 12 * Math.log2(f.pitch / base.pitch);
      if (semis < -1.5) vote(-1, "평소보다 낮게");
      else if (semis > 2) vote(1, "평소보다 높게");
    }
    if (f.rate && base.rate) {
      const rate = f.rate / base.rate;
      if (rate < 0.8) vote(-0.5, "평소보다 느리게");
      else if (rate > 1.25) vote(0.5, "평소보다 빠르게");
    }
  } else {
    if (f.loud < 0.05) vote(-1, "작게");
    else if (f.loud > 0.15) vote(1, "크게");
    if (f.pitchVar && f.pitchVar < 1.6) vote(-1, "높낮이 없이");
    else if (f.pitchVar > 3.4) vote(1, "높낮이 크게");
    if (f.rate && f.rate < 3.2) vote(-0.5, "느리게");
    else if (f.rate > 5.6) vote(0.5, "빠르게");
  }
  // 빠르기는 받아쓰기 글자 수에 기대어 덜 믿을 만해서 반 표만 준다
  const tone: DeviceTone = s >= 1.5 ? "들떠 있음" : s <= -1.5 ? "가라앉음" : "차분함";
  return { tone, why: why.join(", ") || "평소와 비슷하게" };
}

// 클라이언트가 보낸 숫자를 그대로 믿지 않고 범위를 자른다
export function cleanFeatures(v: unknown): VoiceFeatures | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (k: string, max: number) => Math.min(max, Math.max(0, Number(o[k]) || 0));
  const f = { seconds: n("seconds", 60), loud: n("loud", 1), pitch: n("pitch", 1000), pitchVar: n("pitchVar", 24), rate: n("rate", 20) };
  return f.seconds > 0 ? f : null;
}
