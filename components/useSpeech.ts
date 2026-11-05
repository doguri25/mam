"use client";
// 브라우저 음성 인식(크롬·엣지·사파리) + 말투 재기(VoiceMeter).
// 받아쓰기는 글자만 받고, 말투는 숫자만 잰다. Gemini 모드일 때만 녹음을 잠깐 만들어 보낸다.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { VoiceFeatures } from "@/lib/tone";
import { VoiceMeter } from "@/lib/voice";

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: (e: { error: string }) => void;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

const ctor = () => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
const noop = () => () => {};

export interface VoiceResult {
  features: VoiceFeatures;
  wav?: string;
}

export function useSpeech(onText: (text: string) => void, opts: { measure?: boolean; record?: boolean; lang?: string } = {}) {
  const supported = useSyncExternalStore(noop, () => !!ctor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);
  const meter = useRef<VoiceMeter | null>(null);
  const text = useRef("");
  const voice = useRef<Promise<VoiceResult | null> | null>(null);
  const shown = useRef(true); // 이 화면이 보이는 중(숨겨지면 듣기를 시작하지 않는다)

  // 화면이 숨겨지거나(다른 작은 화면으로 감, Next.js Activity) 사라지면 받아쓰기와 마이크를 멈춘다
  // → 숨은 화면이 계속 듣고 글을 바꾸거나 마이크를 켜 두지 않게. 늦게 오는 받아쓰기 결과는 버린다.
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
      const r = rec.current;
      rec.current = null;
      if (r) {
        r.onresult = () => {};
        r.onend = () => {};
        r.onerror = () => {};
        try {
          if (r.abort) r.abort();
          else r.stop();
        } catch {
          // 이미 멈췄다
        }
      }
      const m = meter.current;
      meter.current = null;
      voice.current = null;
      m?.stop("").catch(() => {});
      setListening(false);
    };
  }, []);

  function finishMeter() {
    const m = meter.current;
    meter.current = null;
    if (m) voice.current = m.stop(text.current).catch(() => null);
  }

  async function start() {
    const C = ctor();
    if (!C) return;
    setError("");
    text.current = "";
    voice.current = null;
    if (opts.measure) {
      try {
        const m = new VoiceMeter();
        await m.start(!!opts.record);
        if (!shown.current) {
          m.stop("").catch(() => {}); // 마이크를 여는 사이 화면이 숨겨졌다
          return;
        }
        meter.current = m;
      } catch {
        meter.current = null; // 마이크를 함께 못 쓰는 기기면 말투 없이 받아쓰기만
      }
    }
    if (!shown.current) return;
    const r = new C();
    r.lang = opts.lang ?? "ko-KR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      text.current = Array.from(e.results, (x) => x[0].transcript).join("");
      onText(text.current);
    };
    r.onend = () => {
      setListening(false);
      finishMeter();
    };
    r.onerror = (e) => {
      setListening(false);
      finishMeter();
      setError(e.error === "not-allowed" ? "micDenied" : e.error === "no-speech" ? "noSpeech" : "speechFail"); // 화면에서 학생 언어로 바꿔 보여 준다
    };
    r.start();
    rec.current = r;
    setListening(true);
  }

  return {
    supported,
    listening,
    error,
    start,
    stop: () => rec.current?.stop(),
    // 마지막으로 말한 것의 말투(재지 않았으면 null)
    takeVoice: async () => {
      if (meter.current) finishMeter(); // 받아쓰기가 아직 안 끝났어도 여기서 멈춘다
      const v = (await voice.current) ?? null;
      voice.current = null;
      return v;
    },
  };
}
