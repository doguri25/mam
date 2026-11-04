"use client";
// 오늘의 마음: 고르기(카드/말) → 살펴보기 → 되묻기 한 번 → 저장. 학생이 고른 언어로 보여 준다(기록은 한국어 감정 이름).
// 학생은 주로 태블릿: 가로(넓은) 화면이면 오른쪽에 마음 친구·오늘 기록, 아래에 「더 해 보기」 한 줄.
// 세로면 위에 마음 친구 띠·아래에 「더 해 보기」. 단추는 손가락 크기(48px 이상).
// 와이파이가 끊기면 기록을 이 기기에 담아 두었다가 연결되면 보낸다(lib/queue).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Doodle, { type DoodleName } from "@/components/Doodle";
import { flushQueue, forgetToken, queueRecord, rememberToken } from "@/lib/queue";
import { EMOTION_COLOR, EmotionArt, Flower } from "@/components/Art";
import CalmBox from "@/components/CalmBox";
import BuddyLazy from "@/components/BuddyLazy";
import MoodPicker, { STEP_START, stepBack, stepDepth, type Pick, type StepNav } from "@/components/MoodPicker";
import { atMe, leftMe, useBackGuard, useBackSteps } from "@/lib/back";
import { useSpeech } from "@/components/useSpeech";
import { slotNow, today as kToday } from "@/lib/date";
import { api } from "@/lib/api";
import { CHEER, CHEER_TIRED, LANGS, RISK_REPLY, errText, isLang, langOf, t, w, type Lang, type UIKey } from "@/lib/i18n";
import { speak, useLocal } from "@/lib/local";
import { useStudentLang } from "@/components/StudentFrame";
import { ACC_UNLOCK, groupOf, type BuddyLook, type CalmTool, type Felt, type MoodRecord, type Slot, type VoiceMode } from "@/lib/shared";
import type { VoiceFeatures } from "@/lib/tone";

type Me = {
  no: number; alias: string; className: string; vocab: string[]; voiceMode: VoiceMode; slot: Slot; today: string;
  records: MoodRecord[]; flowers: { date: string; emotion: string }[]; look: BuddyLook;
  words: string[]; unread: number; reflected: boolean; demo: boolean; qtoken?: string;
  space?: string; // 학급(공간): 이 기기에 학생마다 남기는 값(언어)을 반마다 따로
  selfCheck: { id: string; title: string; done: boolean } | null; // 선생님이 연 마음 점검
};
type Step = "choose" | "card" | "voice" | "confirm" | "ask" | "done";
type Tone = { tone: string | null; toneWhy: string; toneBy: string | null; voice: VoiceFeatures | null };
type Analyzed = Pick & Tone & { needCard?: boolean; question: string; options: string[]; risk: boolean; skipAsk?: boolean; summary?: string };

const SLOT_KO: Record<Slot, string> = { am: "아침", pm: "하교 전" };
// 기기 시계가 서버와 어긋나 있을 때(하루 앞섬 등) 같은 경계로 다시 묻는 간격: 처음 답 뒤 1분·4분·15분, 그 뒤로는 다음 경계까지 묻지 않는다
const RETRY = [0, 1, 4, 15].map((m) => m * 60_000 - 5_000);
const NO_TONE: Tone = { tone: null, toneWhy: "", toneBy: null, voice: null };

function SayBtn({ text, lang }: { text: string; lang: Lang }) {
  return (
    <button type="button" onClick={() => speak(text, true, lang)} className="ml-2 inline-grid size-9 place-items-center rounded-full bg-leaf-soft align-middle" aria-label={t(lang, "sayIt")}>
      <Doodle name="speaker" size={22} />
    </button>
  );
}

export default function MePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [slot, setSlot] = useState<Slot>("am");
  const [step, setStep] = useState<Step>("choose");
  const [method, setMethod] = useState<"card" | "voice">("card");
  const [pick, setPick] = useState<Pick>({});
  const [text, setText] = useState("");
  const [spoke, setSpoke] = useState(false);
  const [qa, setQa] = useState({ question: "", options: [] as string[], aiRisk: false, skip: false });
  const [tone, setTone] = useState<Tone>(NO_TONE);
  const [summaryKo, setSummaryKo] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<UIKey | "">("");
  const [note, setNote] = useState<UIKey | string>("");
  const [cheer, setCheer] = useState(0); // 저장하면 마음 친구가 한 번 인사
  const [calm, setCalm] = useState<"off" | "offer" | "open">("off"); // 마음 다스리기 도구 상자
  const [unlocked, setUnlocked] = useState(false); // 새 감정 단어로 꾸미개가 열렸나
  const [offline, setOffline] = useState(false); // 이번 기록을 기기에 담아 뒀나
  const [flushed, setFlushed] = useState(0);
  const [dropped, setDropped] = useState(0); // 너무 오래돼 보내지 못한 담아 둔 기록
  const [loadFail, setLoadFail] = useState(false); // 학생 정보를 못 받음(와이파이 끊김)
  const [loadTry, setLoadTry] = useState(0);
  const [leaving, setLeaving] = useState(false); // 「다음 친구 차례」를 눌러 나가는 중
  const lastNo = useRef<number | null>(null);
  const lastServer = useRef<{ slot: Slot; today: string } | null>(null); // 서버가 마지막으로 알려 준 시간(아침·하교 전)과 날짜
  const stepNow = useRef<Step>("choose");
  const calmNow = useRef<"off" | "offer" | "open">("off");
  const busyNow = useRef<UIKey | "">("");
  useEffect(() => {
    stepNow.current = step;
    calmNow.current = calm;
    busyNow.current = busy;
  });
  const manual = useRef(false); // 학생이 아침·하교 전을 손수 바꿨나(그러면 시계를 따라 바꾸지 않는다)
  const flowStale = useRef(false); // 서버에 시간을 다시 묻는 사이에 고르기를 시작했나(답이 오면 이번 기록의 시간을 바로잡는다)
  // 브라우저 뒤로 가기 = 화면 안 한 단계 앞으로: 감정 카드 질문 위치, 되묻기 앞 화면, 도구 상자 안 단계
  const [pickNav, setPickNav] = useState<StepNav>(STEP_START);
  const [askFrom, setAskFrom] = useState<"card" | "confirm">("card");
  const [calmStep, setCalmStep] = useState<{ depth: number; back: () => void }>({ depth: 0, back: () => {} });
  const onCalmStep = useCallback((depth: number, back: () => void) => setCalmStep({ depth, back }), []);
  const [backHint, setBackHint] = useState(false);
  const [readAloud, setReadAloud] = useLocal("mb_read");
  const [lang, setLang] = useStudentLang(me); // 같은 태블릿을 돌려 써도 학생마다(반마다) 따로
  const speech = useSpeech((x) => { setText(x); setSpoke(true); }, { measure: !!me && me.voiceMode !== "off", record: me?.voiceMode === "gemini", lang: langOf(lang).speech });
  const answerSpeech = useSpeech(setAnswer, { lang: langOf(lang).speech });
  const say = (x: string) => speak(x, false, lang);

  // 고르던 것·쓰던 글·안내를 모두 비우고 고르기 화면으로
  const clearAll = useCallback(() => {
    setStep("choose");
    setMethod("card");
    setPick({});
    setText("");
    setSpoke(false);
    setAnswer("");
    setNote("");
    setTone(NO_TONE);
    setSummaryKo("");
    setQa({ question: "", options: [], aiRisk: false, skip: false });
    setCalm("off");
    setPickNav(STEP_START);
    setOffline(false);
    setUnlocked(false);
    setFlushed(0);
    setDropped(0);
    setBusy("");
  }, []);

  // 이 화면은 다른 화면에 갔다 와도(숨겨졌다 다시 보여도) 상태가 남는다(Next.js Activity).
  // 다른 학생으로 바뀌었거나 날짜가 바뀌었으면 고르던 것·쓰던 글을 모두 비운다.
  // 같은 학생·같은 날이면 학생이 고른 아침·하교 전을 그대로 두되, 서버 시간이 아침→하교 전으로 넘어갔으면
  // 고르는 중이 아닐 때(고르기·저장한 뒤 화면) 모두 비우고 따라간다 → 켜 둔 태블릿에서 오후 마음이 아침 칸을 덮어쓰지 않게,
  // 아침에 고른 카드·되묻기가 오후 기록에 딸려 가지 않게. 학생이 손수 바꾼 시간은 그대로 둔다.
  // 시간을 다시 묻는 사이에 고르기를 막 시작했으면(자고 깬 태블릿) 고른 것은 두고 이번 기록의 시간만 바로잡는다.
  const asking = useRef(false);
  const asked = useRef({ key: "", n: 0, at: 0 }); // 시계만 보고 다시 물은 경계(기기 시간)와 횟수
  const forcedAt = useRef(0); // 기다리지 않고 물은 때(깨어남·카드로·말로)
  const ask = useCallback(() => {
    if (asking.current) return;
    asking.current = true;
    api<Me>("student", "me").then(
      (m) => {
        asking.current = false;
        if (m.qtoken) rememberToken(m.no, m.qtoken); // 쿠키로 바로 들어온 날에도 끊김 대비 표를 새로
        const prev = lastServer.current;
        lastServer.current = { slot: m.slot, today: m.today };
        if (lastNo.current !== m.no || (prev && prev.today !== m.today)) {
          lastNo.current = m.no;
          manual.current = false;
          clearAll();
          setSlot(m.slot);
        } else if (prev && prev.slot !== m.slot && !manual.current && !busyNow.current) {
          if ((stepNow.current === "choose" || stepNow.current === "done") && calmNow.current !== "open") {
            clearAll();
            setSlot(m.slot);
          } else if (flowStale.current) setSlot(m.slot);
        }
        flowStale.current = false;
        setNote((n) => (n === "logoutFail" ? "" : n)); // 서버에 닿았으니 「인터넷이 연결되면 다시 눌러」 안내는 내린다
        // 기기 시계가 서버와 다르면 이 답을 그 경계의 첫 물음으로 센다(아래 recheck가 몇 번만 더 묻게)
        const key = `${slotNow()}|${kToday()}`;
        if (key !== `${m.slot}|${m.today}` && asked.current.key !== key) asked.current = { key, n: 1, at: Date.now() };
        setMe(m);
      },
      (e) => {
        asking.current = false;
        forcedAt.current = 0; // 깨자마자 와이파이가 아직 안 붙었으면, 붙자마자(online)·누르자마자 다시 물을 수 있게
        if ((e as { status?: number }).status === 401) router.replace("/");
        else setLoadFail(true);
      },
    );
  }, [router, clearAll]);

  useEffect(() => {
    atMe(); // 작은 화면에서 돌아왔다
    ask();
  }, [ask, loadTry]);

  // 기기 시계로 정오·자정을 넘겼으면(서버가 마지막으로 알려 준 것과 다르면) 서버에 다시 묻는다.
  // 기기 시계가 서버와 어긋나 있으면 같은 경계로는 몇 번만(RETRY). force(깨어남·연결 돌아옴·카드로·말로)는 기다리지 않고 묻되 15초에 한 번까지.
  const recheck = useCallback((force: boolean) => {
    const last = lastServer.current;
    if (!last || asking.current) return;
    const key = `${slotNow()}|${kToday()}`;
    if (key === `${last.slot}|${last.today}`) return;
    const now = Date.now();
    const a = asked.current;
    if (force) {
      if (now - forcedAt.current < 15_000) return;
      forcedAt.current = now;
    } else if (a.key === key && (a.n >= RETRY.length || now - a.at < RETRY[a.n])) return;
    asked.current = a.key === key ? { key, n: a.n + 1, at: now } : { key, n: 1, at: now };
    ask();
  }, [ask]);

  // 화면을 켜 둔 채 정오·자정을 넘기면 위의 규칙대로 따라간다(1분마다 시계만 본다)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") recheck(false);
    }, 60_000);
    return () => clearInterval(id);
  }, [recheck]);
  // 잠자던 태블릿이 깨어나거나 다른 앱에서 돌아오거나 와이파이가 다시 붙으면 1분을 기다리지 않고 바로 본다
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible") recheck(true);
    };
    const on = ["pageshow", "focus", "online"] as const;
    document.addEventListener("visibilitychange", wake);
    for (const ev of on) window.addEventListener(ev, wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      for (const ev of on) window.removeEventListener(ev, wake);
    };
  }, [recheck]);

  useEffect(() => {
    if (step === "ask") speak(qa.question, false, lang);
  }, [step, qa.question, lang]);

  // 담아 둔 기록이 있으면 들어올 때와 연결이 돌아올 때 보낸다.
  // 연결이 돌아오면 「인터넷이 연결되면 다시 눌러 주세요」(다음 친구 차례를 못 했을 때) 안내도 내린다.
  useEffect(() => {
    const send = () => flushQueue().then(({ sent, dropped: d }) => {
      if (sent) setFlushed(sent);
      if (d) setDropped(d);
    }, () => {});
    const online = () => {
      setNote((n) => (n === "logoutFail" ? "" : n));
      send();
    };
    send();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);

  // 단계가 바뀌거나 안내(위험한 말에 고맙다는 말 등)가 나왔는데 카드 머리가 위로 밀려 안 보이면 화면 안으로(360px 휴대폰)
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = panel.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step, note, calm]);

  const flowDepth =
    step === "card" ? 1 + stepDepth(pickNav, pick.emotion)
    : step === "voice" || step === "done" ? 1
    : step === "confirm" ? 2
    : step === "ask" ? (askFrom === "card" ? 1 + stepDepth(pickNav, pick.emotion) : 2) + 1
    : 0;
  const depth = flowDepth + (calm === "open" ? 1 + calmStep.depth : 0);
  useBackSteps(depth, () => {
    if (busy) return;
    if (calm === "open") return calmStep.depth ? calmStep.back() : setCalm("off");
    if (step === "card") {
      const prev = stepBack(pickNav, pick.emotion);
      return prev ? setPickNav(prev) : reset();
    }
    if (step === "confirm") return setStep("voice");
    if (step === "ask") return setStep(askFrom);
    reset(); // 고르기 화면으로(말하기·저장한 뒤)
  }, "me");
  // 첫 화면에서 뒤로 가기를 눌러도 앱 밖으로 나가지 않고, 나가는 방법을 알려 준다
  useBackGuard(() => {
    setBackHint(true);
    setTimeout(() => setBackHint(false), 4000);
  }, "me");

  if (!me) {
    const guess: Lang = typeof navigator !== "undefined" && isLang(navigator.language.slice(0, 2)) ? (navigator.language.slice(0, 2) as Lang) : "ko";
    return (
      <main data-back-root="me" className="grid min-h-dvh place-items-center px-5 text-center text-soft">
        {loadFail ? (
          <div className="card space-y-4">
            <p className="text-lg text-ink">{t(guess, "loadFail")}</p>
            <button onClick={() => { setLoadFail(false); setLoadTry((n) => n + 1); }} className="btn-main px-8">{t(guess, "retry")}</button>
          </div>
        ) : "…"}
      </main>
    );
  }

  const tt = (key: UIKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const slotName = (s: Slot) => w(lang, SLOT_KO[s]);
  const msg = (x: string) =>
    x === "riskReply" ? RISK_REPLY[lang]
    : x in { micDenied: 1, noSpeech: 1, speechFail: 1, notUnderstood: 1, loadFail: 1, logoutFail: 1 } ? tt(x as UIKey) : errText(lang, x);
  const done = me.records.find((r) => r.slot === slot);
  const complete = !!(pick.emotion && pick.intensity && pick.reason);

  function reset(next: Step = "choose") {
    setPick({});
    setText("");
    setSpoke(false);
    setAnswer("");
    setNote("");
    setTone(NO_TONE);
    setSummaryKo("");
    setQa({ question: "", options: [], aiRisk: false, skip: false });
    setCalm("off");
    setPickNav(STEP_START);
    setStep(next);
  }

  const toQa = (r: Analyzed) => ({ question: r.question, options: r.options, aiRisk: r.risk, skip: !!r.skipAsk });
  const toTone = (r: Analyzed): Tone => ({ tone: r.tone ?? null, toneWhy: r.toneWhy ?? "", toneBy: r.toneBy ?? null, voice: r.voice ?? null });

  async function fromCard(p: Pick = pick) {
    setPick(p);
    setBusy("thinking");
    try {
      // 말하기에서 카드로 넘어온 경우 그 문장도 함께 보내 위험 표현을 놓치지 않게
      const r = await api<Analyzed>("student", "analyze", { card: p, lang, slot, ...(method === "voice" && text ? { text, voice: tone.voice } : {}) });
      const q = toQa(r);
      setQa(q);
      if (method === "voice") {
        setTone(toTone(r));
        if (lang !== "ko" && r.summary) setSummaryKo(r.summary);
      }
      if (q.skip) return save("", q, toTone(r), p);
      setAskFrom("card");
      setStep("ask");
    } catch (e) {
      // 와이파이가 끊겼으면 되묻기 없이 바로 기기에 담는다
      if (!(e as { status?: number }).status) return save("", { question: "", options: [], aiRisk: false, skip: false }, tone, p);
      setNote((e as Error).message);
    }
    setBusy("");
  }

  async function fromText() {
    speech.stop();
    setBusy("listeningSort");
    try {
      const v = spoke ? await speech.takeVoice() : null;
      const r = await api<Analyzed>("student", "analyze", { text, lang, slot, voice: v?.features, audio: v?.wav });
      setTone(toTone(r));
      if (r.needCard) {
        // 위험한 말이 있었으면 「못 알아들었어」 대신 고맙다는 말(선생님께는 이미 알렸다). 카드를 고르면 기록이 마저 저장된다.
        setNote(r.risk ? "riskReply" : "notUnderstood");
        setPickNav(STEP_START);
        setStep("card");
      } else {
        setPick({ emotion: r.emotion, intensity: r.intensity, reason: r.reason, word: r.word || undefined });
        if (lang !== "ko" && r.summary) setSummaryKo(r.summary);
        setQa(toQa(r));
        setStep("confirm");
      }
    } catch (e) {
      if (!(e as { status?: number }).status) {
        // 와이파이가 끊겨 정리할 수 없으면 카드로 고르게 한다(쓴 문장은 그대로 함께 담아 둠)
        setNote("loadFail");
        setPickNav(STEP_START);
        setStep("card");
      } else setNote((e as Error).message);
    }
    setBusy("");
  }

  async function save(ans: string, q = qa, tn = tone, p: Pick = pick) {
    answerSpeech.stop();
    setBusy("saving");
    const payload = { ...p, slot, method, summary: method === "voice" ? text : "", question: q.question, answer: ans, aiRisk: q.aiRisk, lang, summaryKo, ...tn };
    try {
      let record: MoodRecord;
      try {
        record = (await api<{ record: MoodRecord }>("student", "save", { record: payload })).record;
        setOffline(false);
      } catch (e) {
        // 서버까지 못 갔으면(와이파이 끊김) 이 기기에 담아 두고, 화면은 저장된 것처럼 이어 간다
        if ((e as { status?: number }).status || !queueRecord(me!.no, payload)) throw e;
        record = { ...payload, id: `${me!.no}_${me!.today}_${slot}`, no: me!.no, date: me!.today, createdAt: "" } as unknown as MoodRecord;
        setOffline(true);
      }
      const today = me!.today;
      // 마음 친구 성장: 처음 써 본 감정 단어로 꾸미개가 새로 열렸는지
      const words = record.word && !me!.words.includes(record.word) ? [...me!.words, record.word] : me!.words;
      setUnlocked(words.length > me!.words.length && Object.values(ACC_UNLOCK).includes(words.length));
      setMe({
        ...me!,
        words,
        records: [...me!.records.filter((r) => r.slot !== slot), record],
        flowers: [...me!.flowers.filter((f) => f.date !== today), { date: today, emotion: record.emotion }],
      });
      setStep("done");
      manual.current = false; // 손수 고른 시간은 이번 기록으로 다 썼다(정오가 지나면 다시 시계를 따라감)
      flowStale.current = false;
      setCheer((n) => n + 1);
      // 힘든 마음(슬픔·화남·불안)이면 마음 다스리기 도구 상자를 권한다
      setCalm(["sad", "angry", "fear"].includes(groupOf(record.emotion)) ? "offer" : "off");
      say(tt("saved").replace("✓ ", ""));
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy("");
  }

  // 되묻기 칸에 써 둔 말은 어느 단추로 저장하든 함께 보낸다(건너뛰기·고르는 답을 눌러도 버리지 않고, 서버가 위험한 말을 살피게)
  function withTyped(preset: string) {
    const typed = answer.trim();
    if (!typed || typed === preset) return preset;
    const both = preset ? `${preset} · ${typed}` : typed;
    return both.length > 120 ? typed : both;
  }

  // 카드로·말로: 기기 시계가 서버가 마지막으로 알려 준 시간을 지났으면(자고 깬 태블릿 등) 서버에 다시 묻고,
  // 그 답이 오면 이번 기록의 시간(아침·하교 전)을 바로잡는다(학생이 손수 고른 시간은 그대로)
  function begin(m: "card" | "voice") {
    recheck(true);
    flowStale.current = !manual.current && asking.current;
    setNote("");
    setMethod(m);
    setStep(m);
    say(tt(m));
  }

  // 도구를 써 본 느낌은 이 시간(아침·하교 전)에 남긴 기록에 붙인다. 아직 기록이 없으면 남기지 않는다.
  async function sendCalm(tool: CalmTool, felt: Felt) {
    if (!me!.records.some((r) => r.slot === slot)) return;
    try {
      const { record } = await api<{ record: MoodRecord }>("student", "calm", { slot, tool, felt });
      setMe((m) => (m ? { ...m, records: [...m.records.filter((r) => r.slot !== slot), record] } : m));
    } catch {
      // 느낌을 못 남겨도 학생 화면은 그대로 둔다
    }
  }

  // 다음 친구 차례: 화면을 새로 불러 이 학생의 기록·고르던 카드가 다음 친구에게 남지 않게 한다
  // (Next.js는 지나온 화면을 숨겨 두고 상태를 그대로 살려 두므로, 같은 태블릿을 돌려 쓸 때는 통째로 비운다)
  // 나가기를 서버에 알리지 못하면(와이파이 끊김) 그대로 머문다. 그냥 넘어가면 다음 친구가 이 학생으로 들어오게 된다.
  async function nextFriend() {
    if (busy || leaving) return; // 저장하는 중에 나가면 그 기록이 어디로 갔는지 모르게 된다
    setLeaving(true);
    try {
      await api("student", "logout");
      forgetToken(); // 담아 둔 기록은 저마다 표를 들고 있으니, 이 학생의 새 표만 지운다
    } catch {
      setNote("logoutFail");
      setBackHint(false);
      setLeaving(false);
      return;
    }
    window.location.replace("/");
  }

  const group = pick.emotion ? groupOf(pick.emotion) : null;
  const shown = pick.word ? w(lang, pick.word) : pick.emotion ? w(lang, pick.emotion) : "";
  const buddyLine =
    step === "done" && qa.skip ? qa.question // 위험한 마음: 감정별 문장 대신 고맙다는 말만
    : step === "done" && group ? (pick.emotion === "피곤해요" ? CHEER_TIRED[lang] : CHEER[lang][group])
    : step === "ask" ? tt("slow")
    : pick.emotion ? tt("picked", { emotion: shown })
    : tt("hello", { alias: me.alias });

  const friday = new Date(`${me.today}T00:00:00Z`).getUTCDay() >= 5 || new Date(`${me.today}T00:00:00Z`).getUTCDay() === 0;
  const tiles: { href?: string; onClick?: () => void; icon: DoodleName; label: string; badge?: string }[] = [
    // 선생님이 마음 점검을 열었을 때만 맨 앞에(아직 안 했으면 「!」)
    ...(me.selfCheck ? [{ href: "/me/check", icon: "clipboard" as DoodleName, label: tt("tileCheck"), badge: me.selfCheck.done ? undefined : "!" }] : []),
    { href: "/me/week", icon: "memo", label: tt("tileWeek"), badge: friday && !me.reflected ? "!" : undefined },
    { href: "/me/game", icon: "dice", label: tt("tileGame") },
    { href: "/me/words", icon: "bookOpen", label: tt("tileWords") },
    { href: "/me/letters", icon: "letter", label: tt("tileLetters"), badge: me.unread ? tt("unreadBadge", { n: me.unread }) : undefined },
    { href: "/me/buddy", icon: "palette", label: tt("buddyEdit") },
    { onClick: () => setCalm("open"), icon: "calm", label: tt("calmOpen") },
    { href: "/me/calendar", icon: "calendar", label: tt("calendar") },
  ];
  const tileClass = "chip relative flex min-h-24 flex-col items-center justify-center gap-1 p-2 text-center text-sm font-bold leading-tight hover:border-leaf";

  return (
    <main data-back-root="me" className="mx-auto max-w-6xl px-3 py-3 sm:px-5 sm:py-5" lang={lang}>
      {me.demo && (
        <p className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-sun bg-[#fff8e1] px-4 py-2 text-sm">
          <span><Doodle name="flask" /> 체험용 반이에요(가짜 학생·기록).</span> <Link href="/try" className="font-bold underline">체험 안내로</Link>
        </p>
      )}
      {flushed > 0 && <p className="mb-3 rounded-2xl bg-leaf-soft px-4 py-2 text-sm"><Doodle name="signal" /> {tt("offlineSent", { n: flushed })}</p>}
      {dropped > 0 && <p className="mb-3 rounded-2xl bg-[#fff8e1] px-4 py-2 text-sm"><Doodle name="signal" /> {tt("offlineDropped", { n: dropped })}</p>}
      {note === "logoutFail" && (step === "choose" || step === "done") && <p role="alert" className="mb-3 rounded-2xl bg-[#fff8e1] px-4 py-2 text-sm"><Doodle name="signal" /> {tt("logoutFail")}</p>}
      {backHint && <p role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-2xl bg-ink px-5 py-3 text-center text-white shadow-lg">{tt("backHint")}</p>}
      <header className="mb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-soft">{me.className} · {me.no} {me.alias}</p>
            <h1 className="line-clamp-2 font-display text-2xl break-keep sm:text-3xl">{tt("title", { alias: me.alias })}</h1>
          </div>
          <button onClick={nextFriend} disabled={!!busy || leaving} className="btn-sub min-h-12 shrink-0 px-4">{tt("next")}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={`${slotName("am")} / ${slotName("pm")}`} className="flex rounded-2xl border border-line bg-card p-1">
            {(["am", "pm"] as Slot[]).map((s) => (
              <button
                key={s}
                aria-pressed={slot === s}
                onClick={() => {
                  if (s !== slot) manual.current = true;
                  setSlot(s);
                  if (step === "done") reset();
                }}
                className={`flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-base font-bold ${slot === s ? "bg-leaf text-white" : "text-soft"}`}
              >
                <Doodle name={s === "am" ? "sun" : "sunset"} size={24} /> {slotName(s)}
              </button>
            ))}
          </div>
          {/* 읽어 주기·언어는 그림 단추 하나씩으로 작게 */}
          <button
            onClick={() => setReadAloud(readAloud === "1" ? "" : "1")}
            aria-pressed={readAloud === "1"}
            aria-label={readAloud === "1" ? tt("readOn") : tt("readOff")}
            title={readAloud === "1" ? tt("readOn") : tt("readOff")}
            className={`btn-sub min-h-12 px-3 ${readAloud === "1" ? "border-leaf bg-leaf-soft" : ""}`}
          >
            <Doodle name={readAloud === "1" ? "speaker" : "speakerOff"} size={28} />
          </button>
          <label className="flex min-h-12 items-center gap-1 rounded-2xl border border-line bg-card px-2 text-base" title="Language">
            <Doodle name="globe" size={26} />
            <select value={lang} onChange={(e) => setLang(isLang(e.target.value) ? e.target.value : "ko")} className="h-11 max-w-28 bg-transparent font-bold outline-none" aria-label="Language">
              {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:grid-rows-[auto_1fr_auto] lg:gap-5">
        <section ref={panel} className="card min-h-[420px] scroll-mt-3 sm:p-7 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
          {busy ? (
            <p className="grid h-80 place-items-center font-display text-2xl text-leaf">{tt(busy)}</p>
          ) : calm === "open" ? (
            <CalmBox look={me.look} emotion={pick.word ?? pick.emotion ?? done?.word ?? done?.emotion} lang={lang} onFelt={sendCalm} onClose={() => setCalm("off")} onStep={onCalmStep} />
          ) : step === "choose" ? (
            <div className="space-y-5">
              <h2 className="font-display text-2xl">{tt("how", { slot: slotName(slot) })}<SayBtn lang={lang} text={`${tt("how", { slot: slotName(slot) })} ${tt("card")}, ${tt("voice")}`} /></h2>
              {done && (
                <p className="flex items-center gap-2 rounded-2xl bg-leaf-soft p-3 text-sm">
                  <EmotionArt name={done.word || done.emotion} size={32} />
                  {tt("already", { slot: slotName(slot), emotion: w(lang, done.word || done.emotion) })}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <button onClick={() => begin("card")} className="chip flex flex-col items-center gap-3 p-7 hover:border-leaf">
                  <span className="flex -space-x-3">
                    <EmotionArt name="기뻐요" size={52} />
                    <EmotionArt name="슬퍼요" size={52} />
                    <EmotionArt name="화나요" size={52} />
                  </span>
                  <span className="font-display text-2xl">{tt("card")}</span>
                  <span className="text-sm text-soft">{tt("cardSub")}</span>
                </button>
                <button onClick={() => begin("voice")} className="chip flex flex-col items-center gap-3 p-7 hover:border-leaf">
                  <span className="grid size-[60px] place-items-center rounded-full bg-leaf-soft"><Doodle name="mic" size={42} /></span>
                  <span className="font-display text-2xl">{tt("voice")}</span>
                  <span className="text-sm text-soft">{tt("voiceSub")}</span>
                </button>
              </div>
              <p className="text-center text-sm text-soft">{tt("noAnswer")}</p>
            </div>
          ) : step === "card" || step === "confirm" ? (
            <div className="space-y-5">
              {step === "confirm" ? (
                <div className="rounded-2xl bg-leaf-soft p-4">
                  <p className="text-sm text-soft">{tt("youSaid")}</p>
                  <p className="mt-1 text-lg">“{text}”</p>
                  <p className="mt-2 font-bold">{tt("heard")}<SayBtn lang={lang} text={tt("heard")} /></p>
                </div>
              ) : (
                note && <p className="rounded-2xl bg-leaf-soft p-3">{msg(note)}</p>
              )}
              {/* 카드로 고를 때는 한 화면에 질문 하나씩(누르면 다음으로), 말로 한 뒤에는 세 가지를 한눈에 고쳐 보기 */}
              <MoodPicker value={pick} onChange={setPick} vocab={me.vocab} lang={lang} stepwise={step === "card"} onDone={(v) => fromCard(v)} onBack={() => reset()} nav={pickNav} onNav={setPickNav} />
              {step === "confirm" && (
                <div className="flex justify-between gap-3 pt-2">
                  <button onClick={() => reset()} className="btn-sub">{tt("restart")}</button>
                  <button onClick={() => { if (qa.skip) return save(""); setAskFrom("confirm"); setStep("ask"); }} disabled={!complete} className="btn-main px-8 text-lg">
                    {complete ? tt("yesNext") : tt("pick3")}
                  </button>
                </div>
              )}
            </div>
          ) : step === "voice" ? (
            <div className="space-y-5">
              <h2 className="font-display text-2xl">{tt("sayOne")}<SayBtn lang={lang} text={tt("sayOne")} /></h2>
              {speech.supported && (
                <button
                  onClick={speech.listening ? speech.stop : speech.start}
                  className={`mx-auto grid size-28 place-items-center rounded-full text-5xl text-white shadow-lg ${speech.listening ? "animate-pulse bg-alert" : "bg-leaf-soft ring-4 ring-leaf"}`}
                  aria-label={speech.listening ? "■" : tt("voice")}
                >
                  {speech.listening ? "■" : <Doodle name="mic" size={72} />}
                </button>
              )}
              <p className="text-center text-sm text-soft">{speech.listening ? tt("listening") : speech.supported ? tt("micHint") : tt("typeHint")}</p>
              {speech.error && <p className="text-center text-alert">{msg(speech.error)}</p>}
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 180))} rows={3} className="field text-lg" placeholder={tt("example")} />
              {me.vocab.length > 0 && (
                <p className="text-sm text-soft">
                  {tt("classWords")}:{" "}
                  {me.vocab.map((x) => (
                    <button key={x} onClick={() => setText((v) => `${v}${v ? " " : ""}${w(lang, x)}`)} className="mr-1 rounded-full bg-leaf-soft px-2 py-0.5 text-ink">
                      {w(lang, x)}
                    </button>
                  ))}
                </p>
              )}
              {note && <p className="text-alert">{msg(note)}</p>}
              <div className="flex justify-between gap-3">
                <button onClick={() => { speech.stop(); if (!text.trim()) setMethod("card"); setPickNav(STEP_START); setStep("card"); }} className="btn-sub">{tt("toCard")}</button>
                <button onClick={fromText} disabled={text.trim().length < 2 || speech.listening} className="btn-main px-8 text-lg">{tt("organize")}</button>
              </div>
            </div>
          ) : step === "ask" ? (
            <div className="space-y-5">
              <p className="text-sm font-bold text-leaf">{tt("askOnce")}</p>
              <h2 className="font-display text-3xl leading-snug">{qa.question}<SayBtn lang={lang} text={qa.question} /></h2>
              <p className="text-soft">{tt("okNoAnswer")}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {qa.options.map((o, i) => (
                  <button key={o} onClick={() => save(withTyped(i === qa.options.length - 1 ? "" : o))} className="chip px-4 py-4 text-lg font-bold hover:border-leaf">
                    {o}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={answer} onChange={(e) => setAnswer(e.target.value.slice(0, 120))} className="field" placeholder={tt("ownAnswer")} />
                {answerSpeech.supported && (
                  <button onClick={answerSpeech.listening ? answerSpeech.stop : answerSpeech.start} className="btn-sub shrink-0" aria-label={tt("voice")}>
                    {answerSpeech.listening ? "■" : <Doodle name="mic" size={26} />}
                  </button>
                )}
              </div>
              {note && <p className="text-alert">{msg(note)}</p>}
              <div className="flex justify-between gap-3">
                <button onClick={() => save(withTyped(""))} className="btn-sub">{tt("skipSave")}</button>
                <button onClick={() => save(answer)} disabled={!answer.trim()} className="btn-main px-8">{tt("answerSave")}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="rounded-full bg-leaf-soft px-4 py-1 text-sm font-bold text-leaf">{tt("saved")}</p>
              {offline && <p className="rounded-2xl bg-[#fff8e1] p-3 text-sm"><Doodle name="signal" /> {tt("offlineSaved")}</p>}
              {unlocked && <Link href="/me/buddy" onClick={leftMe} className="flex items-center gap-2 rounded-2xl bg-sun/30 px-4 py-2 font-bold"><Doodle name="gift" size={28} />{tt("newUnlock")}</Link>}
              <h2 className="font-display text-3xl">{tt("thanks", { alias: me.alias })}</h2>
              {pick.emotion && <EmotionArt name={pick.word || pick.emotion} size={110} />}
              <p className="text-lg">
                {slotName(slot)} · <b>{w(lang, pick.emotion ?? "")}</b>
                {pick.word && <> · <b style={{ color: EMOTION_COLOR[pick.emotion ?? ""] }}>{w(lang, pick.word)}</b></>} · {w(lang, pick.reason ?? "")}
              </p>
              <p className="flex items-center gap-1 text-sm text-soft"><Flower color={EMOTION_COLOR[pick.emotion ?? ""] ?? "#ffc23c"} size={24} /> {tt("flowerToday")}</p>
              {calm === "offer" && (
                <div className="w-full max-w-md rounded-2xl bg-leaf-soft p-4">
                  <p className="font-display text-xl">{tt("calmAsk")}<SayBtn lang={lang} text={tt("calmAsk")} /></p>
                  <div className="mt-3 flex justify-center gap-2">
                    <button onClick={() => setCalm("open")} className="btn-main"><Doodle name="calm" size={26} />{tt("calmOpen")}</button>
                    <button onClick={() => setCalm("off")} className="btn-sub">{tt("calmLater")}</button>
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Link href="/me/calendar" onClick={leftMe} className="btn-sub min-h-12"><Doodle name="calendar" size={24} />{tt("calendar")}</Link>
                <button onClick={nextFriend} disabled={leaving} className="btn-main min-h-12 px-8">{tt("next")}</button>
              </div>
            </div>
          )}
        </section>

        {/* 마음 친구: 세로 태블릿·휴대폰에서는 맨 위 가로 띠, 가로(넓은) 화면에서는 오른쪽 위 */}
        <aside className="card order-first flex items-center gap-4 p-3 lg:order-none lg:col-start-2 lg:row-start-1 lg:flex-col lg:gap-2 lg:self-start lg:p-4 lg:text-center">
          <BuddyLazy emotion={pick.word ?? pick.emotion} intensity={pick.intensity} look={me.look} cheer={cheer} size={170} className="size-24 shrink-0 sm:size-32 lg:size-[170px]" />
          <div>
            <p className="text-xs text-soft lg:text-sm">{me.look.name || tt("buddy")}</p>
            <p className="font-display text-lg sm:text-xl" style={{ color: pick.emotion ? EMOTION_COLOR[pick.emotion] : undefined }}>{buddyLine}</p>
          </div>
        </aside>

        {/* 더 해 보기: 세로 태블릿·휴대폰에서는 기록 아래 3~4칸, 넓은 화면(PC·가로 태블릿)에서는 맨 아래 가로 한 줄 7칸 */}
        <nav aria-label={tt("hubMore")} className="card p-3 lg:col-span-2 lg:col-start-1 lg:row-start-3 lg:p-4">
          <p className="mb-2 font-bold">{tt("hubMore")}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {tiles.map((x) =>
              x.href ? (
                <Link key={x.label} href={x.href} onClick={leftMe} className={tileClass}>
                  <Doodle name={x.icon} size={40} />{x.label}
                  {x.badge && <span className="absolute -right-1 -top-1 rounded-full bg-alert px-2 text-xs text-white">{x.badge}</span>}
                </Link>
              ) : (
                <button key={x.label} onClick={x.onClick} className={tileClass}>
                  <Doodle name={x.icon} size={40} />{x.label}
                </button>
              ),
            )}
          </div>
        </nav>

        <aside className="card space-y-3 self-start lg:col-start-2 lg:row-start-2">
          <div className="space-y-1 text-left text-sm">
            <p className="font-bold">{tt("todayRec")}</p>
            {(["am", "pm"] as Slot[]).map((s) => {
              const r = me.records.find((x) => x.slot === s);
              return (
                <p key={s} className="flex items-center gap-1.5 text-soft">
                  {slotName(s)}: {r ? <><EmotionArt name={r.word || r.emotion} size={24} /> {w(lang, r.word || r.emotion)}</> : tt("notYet")}
                </p>
              );
            })}
          </div>
          <div className="border-t border-line pt-3 text-left text-sm">
            <p className="font-bold">{tt("garden")}</p>
            {me.flowers.length ? (
              <div className="mt-1 flex flex-wrap" aria-label={`${tt("garden")} ${me.flowers.length}`}>
                {me.flowers.map((f) => <Flower key={f.date} color={EMOTION_COLOR[f.emotion] ?? "#ffc23c"} size={26} />)}
              </div>
            ) : (
              <p className="text-soft">{tt("gardenEmpty")}</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
