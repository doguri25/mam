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
  // 마이크를 여는 데(태블릿에서 0.3초쯤) 걸리는 사이 다시 누르면 받아쓰기·마이크가 둘 생겨, 하나가 켜진 채 남았다.
  // opening: 지금 마이크를 여는 차례(0 = 없음). turn: 시작·그만두기·숨김마다 하나씩 → 늦게 끝난 앞 시작은 연 마이크를 닫고 물러난다.
  const opening = useRef(0);
  const turn = useRef(0);

  // 화면이 숨겨지거나(다른 작은 화면으로 감, Next.js Activity) 사라지면 받아쓰기와 마이크를 멈춘다
  // → 숨은 화면이 계속 듣고 글을 바꾸거나 마이크를 켜 두지 않게. 늦게 오는 받아쓰기 결과는 버린다.
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
      turn.current += 1; // 마이크를 여는 중이었으면 열리는 대로 닫는다(다시 보여도 저절로 듣지 않게)
      opening.current = 0;
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
    if (!C || opening.current || rec.current) return; // 마이크를 여는 중이거나 이미 듣는 중: 두 번 눌러도 하나만
    const my = ++turn.current;
    opening.current = my;
    setError("");
    text.current = "";
    voice.current = null;
    setListening(true); // 마이크를 여는 사이에도 듣는 모습(■)으로(그사이 다시 누른 것은 toggle이 넘기고, 카드로 바꾸기 등은 stop이 물린다)
    let m: VoiceMeter | null = null;
    if (opts.measure) {
      m = new VoiceMeter();
      try {
        await m.start(!!opts.record);
      } catch {
        m.stop("").catch(() => {}); // 반쯤 열린 마이크도 닫는다
        m = null; // 마이크를 함께 못 쓰는 기기면 말투 없이 받아쓰기만
      }
    }
    if (opening.current === my) opening.current = 0;
    if (turn.current !== my || !shown.current) {
      m?.stop("").catch(() => {}); // 마이크를 여는 사이 그만두기를 눌렀거나 화면이 숨겨졌다
      return;
    }
    meter.current?.stop("").catch(() => {}); // 앞에서 쓰고 남은 것이 있으면 닫는다(마이크가 켜진 채 남지 않게)
    meter.current = m;
    const r = new C();
    r.lang = opts.lang ?? "ko-KR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      text.current = Array.from(e.results, (x) => x[0].transcript).join("");
      onText(text.current);
    };
    r.onend = () => {
      if (rec.current === r) rec.current = null;
      setListening(false);
      finishMeter();
    };
    r.onerror = (e) => {
      if (rec.current === r) rec.current = null;
      setListening(false);
      finishMeter();
      setError(e.error === "not-allowed" ? "micDenied" : e.error === "no-speech" ? "noSpeech" : "speechFail"); // 화면에서 학생 언어로 바꿔 보여 준다
    };
    rec.current = r;
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
      finishMeter();
      setError("speechFail");
    }
  }

  // 그만 듣기(카드로 바꾸기·정리하기·저장할 때도). 마이크를 여는 중이면 그 시작을 물린다(열리는 대로 닫힘)
  function stop() {
    if (opening.current) {
      turn.current += 1;
      opening.current = 0;
      setListening(false);
      return;
    }
    rec.current?.stop();
  }

  // 마이크 단추 하나로 듣기·그만 듣기. 마이크를 여는 사이 다시 누른 것은 두 번 누름으로 보고 넘긴다(아이들은 두 번 톡톡 누른다)
  function toggle() {
    if (opening.current) return;
    if (rec.current) stop();
    else start();
  }

  return {
    supported,
    listening,
    error,
    start,
    stop,
    toggle,
    // 마지막으로 말한 것의 말투(재지 않았으면 null)
    takeVoice: async () => {
      if (meter.current) finishMeter(); // 받아쓰기가 아직 안 끝났어도 여기서 멈춘다
      const v = (await voice.current) ?? null;
      voice.current = null;
      return v;
    },
  };
}
