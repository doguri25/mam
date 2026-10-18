"use client";
// 오늘의 마음: 고르기(카드/말) → 살펴보기 → 되묻기 한 번 → 저장
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EMOTION_COLOR, EmotionArt, Flower } from "@/components/Art";
import BuddyLazy from "@/components/BuddyLazy";
import MoodPicker, { type Pick } from "@/components/MoodPicker";
import { useSpeech } from "@/components/useSpeech";
import { api } from "@/lib/api";
import { speak, useLocal } from "@/lib/local";
import { groupOf, type Group, type MoodRecord, type Slot, type VoiceMode } from "@/lib/shared";
import type { VoiceFeatures } from "@/lib/tone";

type Me = {
  no: number; alias: string; className: string; vocab: string[]; voiceMode: VoiceMode; slot: Slot; today: string;
  records: MoodRecord[]; flowers: { date: string; emotion: string }[];
};
type Step = "choose" | "card" | "voice" | "confirm" | "ask" | "done";
type Tone = { tone: string | null; toneWhy: string; toneBy: string | null; voice: VoiceFeatures | null };
type Analyzed = Pick & Tone & { needCard?: boolean; question: string; options: string[]; risk: boolean; skipAsk?: boolean };

const CHEER: Record<Group, string> = {
  joy: "좋은 마음을 나눠 줘서 나도 기뻐!",
  calm: "편안한 마음, 잘 간직하자.",
  sad: "속상한 마음을 말해 줘서 고마워. 선생님도 알고 있을게.",
  angry: "화가 날 만했구나. 말해 준 건 정말 잘한 일이야.",
  fear: "걱정되는 마음을 꺼내 줘서 고마워. 너는 혼자가 아니야.",
};
const SLOT_LABEL: Record<Slot, string> = { am: "아침", pm: "하교 전" };
const NO_TONE: Tone = { tone: null, toneWhy: "", toneBy: null, voice: null };

function Say({ text }: { text: string }) {
  return (
    <button type="button" onClick={() => speak(text, true)} className="ml-2 inline-grid size-8 place-items-center rounded-full bg-leaf-soft align-middle text-base" aria-label="소리로 듣기">
      🔊
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
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [readAloud, setReadAloud] = useLocal("mb_read");
  const measure = !!me && me.voiceMode !== "off";
  const speech = useSpeech((t) => { setText(t); setSpoke(true); }, { measure, record: me?.voiceMode === "gemini" });
  const answerSpeech = useSpeech(setAnswer);

  useEffect(() => {
    api<Me>("student", "me").then(
      (m) => {
        setMe(m);
        setSlot(m.slot);
      },
      () => router.replace("/"),
    );
  }, [router]);

  useEffect(() => {
    if (step === "ask") speak(qa.question);
  }, [step, qa.question]);

  if (!me) return <main className="grid min-h-dvh place-items-center text-soft">불러오는 중…</main>;

  const done = me.records.find((r) => r.slot === slot);
  const complete = !!(pick.emotion && pick.intensity && pick.reason);

  function reset(next: Step = "choose") {
    setPick({});
    setText("");
    setSpoke(false);
    setAnswer("");
    setNote("");
    setTone(NO_TONE);
    setQa({ question: "", options: [], aiRisk: false, skip: false });
    setStep(next);
  }

  const toQa = (r: Analyzed) => ({ question: r.question, options: r.options, aiRisk: r.risk, skip: !!r.skipAsk });
  const toTone = (r: Analyzed): Tone => ({ tone: r.tone ?? null, toneWhy: r.toneWhy ?? "", toneBy: r.toneBy ?? null, voice: r.voice ?? null });

  async function fromCard() {
    setBusy("마음 친구가 생각하는 중…");
    try {
      // 말하기에서 카드로 넘어온 경우 그 문장도 함께 보내 위험 표현을 놓치지 않게
      const r = await api<Analyzed>("student", "analyze", { card: pick, ...(method === "voice" && text ? { text, voice: tone.voice } : {}) });
      const q = toQa(r);
      setQa(q);
      if (method === "voice") setTone(toTone(r));
      if (q.skip) return save("", q, toTone(r));
      setStep("ask");
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy("");
  }

  async function fromText() {
    speech.stop();
    setBusy("마음 친구가 듣고 정리하는 중…");
    try {
      const v = spoke ? await speech.takeVoice() : null;
      const r = await api<Analyzed>("student", "analyze", { text, voice: v?.features, audio: v?.wav });
      setTone(toTone(r));
      if (r.needCard) {
        setNote("마음 친구가 잘 못 알아들었어. 카드로 골라 줄래?");
        setStep("card");
      } else {
        setPick({ emotion: r.emotion, intensity: r.intensity, reason: r.reason });
        setQa(toQa(r));
        setStep("confirm");
      }
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy("");
  }

  async function save(ans: string, q = qa, t = tone) {
    answerSpeech.stop();
    setBusy("마음을 담는 중…");
    try {
      const { record } = await api<{ record: MoodRecord }>("student", "save", {
        record: { ...pick, slot, method, summary: method === "voice" ? text : "", question: q.question, answer: ans, aiRisk: q.aiRisk, ...t },
      });
      const today = me!.today;
      setMe({
        ...me!,
        records: [...me!.records.filter((r) => r.slot !== slot), record],
        flowers: [...me!.flowers.filter((f) => f.date !== today), { date: today, emotion: record.emotion }],
      });
      setStep("done");
      speak("마음을 담았어요");
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy("");
  }

  async function nextFriend() {
    await api("student", "logout");
    router.replace("/");
  }

  const group = pick.emotion ? groupOf(pick.emotion) : null;
  const buddyLine =
    step === "done" && qa.skip ? qa.question // 위험한 마음: 감정별 문장 대신 고맙다는 말만
    : step === "done" && group ? CHEER[group]
    : step === "ask" ? "천천히 생각해도 돼."
    : pick.emotion ? `「${pick.emotion}」를 골랐구나.`
    : `안녕, ${me.alias}! 오늘 마음은 어때?`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-soft">{me.className} · {me.no}번</p>
          <h1 className="font-display text-3xl">{me.alias}의 오늘의 마음</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="기록 시점" className="flex rounded-2xl border border-line bg-card p-1">
            {(["am", "pm"] as Slot[]).map((s) => (
              <button
                key={s}
                aria-pressed={slot === s}
                onClick={() => {
                  setSlot(s);
                  if (step === "done") reset();
                }}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${slot === s ? "bg-leaf text-white" : "text-soft"}`}
              >
                {s === "am" ? "☀️ 아침" : "🌇 하교 전"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setReadAloud(readAloud === "1" ? "" : "1")}
            aria-pressed={readAloud === "1"}
            className={`btn-sub min-h-10 px-3 text-sm ${readAloud === "1" ? "border-leaf bg-leaf-soft" : ""}`}
          >
            🔊 읽어 주기 {readAloud === "1" ? "켬" : "끔"}
          </button>
          <button onClick={nextFriend} className="btn-sub min-h-10 px-3 text-sm">다음 친구 차례</button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="card min-h-[420px] sm:p-7">
          {busy ? (
            <p className="grid h-80 place-items-center font-display text-2xl text-leaf">{busy}</p>
          ) : step === "choose" ? (
            <div className="space-y-5">
              <h2 className="font-display text-2xl">{SLOT_LABEL[slot]} 마음을 어떻게 남길까요?<Say text={`${SLOT_LABEL[slot]} 마음을 어떻게 남길까요? 카드로 골라요, 또는 말로 해요.`} /></h2>
              {done && (
                <p className="flex items-center gap-2 rounded-2xl bg-leaf-soft p-3 text-sm">
                  <EmotionArt name={done.emotion} size={28} />
                  {SLOT_LABEL[slot]} 마음은 이미 남겼어요({done.emotion}). 다시 남기면 새로 바뀌어요.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <button onClick={() => { setMethod("card"); setStep("card"); speak("카드로 골라요"); }} className="chip flex flex-col items-center gap-3 p-7 hover:border-leaf">
                  <span className="flex -space-x-3">
                    <EmotionArt name="기뻐요" size={52} />
                    <EmotionArt name="슬퍼요" size={52} />
                    <EmotionArt name="화나요" size={52} />
                  </span>
                  <span className="font-display text-2xl">카드로 골라요</span>
                  <span className="text-sm text-soft">그림을 눌러서 골라요</span>
                </button>
                <button onClick={() => { setMethod("voice"); setStep("voice"); speak("말로 해요"); }} className="chip flex flex-col items-center gap-3 p-7 hover:border-leaf">
                  <span className="grid size-[52px] place-items-center rounded-full bg-leaf text-2xl text-white">🎙️</span>
                  <span className="font-display text-2xl">말로 해요</span>
                  <span className="text-sm text-soft">한 문장으로 말하거나 적어요</span>
                </button>
              </div>
              <p className="text-center text-sm text-soft">마음에는 정답이 없어요. 말하고 싶지 않으면 안 해도 괜찮아요.</p>
            </div>
          ) : step === "card" || step === "confirm" ? (
            <div className="space-y-5">
              {step === "confirm" ? (
                <div className="rounded-2xl bg-leaf-soft p-4">
                  <p className="text-sm text-soft">네가 한 말</p>
                  <p className="mt-1 text-lg">“{text}”</p>
                  <p className="mt-2 font-bold">마음 친구는 이렇게 들었어. 다르면 바꿔도 돼!<Say text="마음 친구는 이렇게 들었어. 다르면 바꿔도 돼." /></p>
                </div>
              ) : (
                note && <p className="rounded-2xl bg-leaf-soft p-3">{note}</p>
              )}
              <MoodPicker value={pick} onChange={setPick} vocab={me.vocab} />
              <div className="flex justify-between gap-3 pt-2">
                <button onClick={() => reset()} className="btn-sub">처음으로</button>
                <button
                  onClick={() => (step !== "confirm" ? fromCard() : qa.skip ? save("") : setStep("ask"))}
                  disabled={!complete}
                  className="btn-main px-8 text-lg"
                >
                  {step === "confirm" ? "맞아요, 다음" : complete ? "다음" : "세 가지를 골라 주세요"}
                </button>
              </div>
            </div>
          ) : step === "voice" ? (
            <div className="space-y-5">
              <h2 className="font-display text-2xl">하고 싶은 말을 한 문장으로 해 봐요<Say text="하고 싶은 말을 한 문장으로 해 봐요. 마이크를 누르고 말해요." /></h2>
              {speech.supported && (
                <button
                  onClick={speech.listening ? speech.stop : speech.start}
                  className={`mx-auto grid size-28 place-items-center rounded-full text-5xl text-white shadow-lg ${speech.listening ? "animate-pulse bg-alert" : "bg-leaf"}`}
                  aria-label={speech.listening ? "그만 듣기" : "말하기 시작"}
                >
                  {speech.listening ? "■" : "🎙️"}
                </button>
              )}
              <p className="text-center text-sm text-soft">
                {speech.listening ? "듣고 있어요… 다 말하면 ■를 눌러요." : speech.supported ? "마이크를 누르고 말하거나, 아래에 적어요." : "아래에 적어 주세요."}
              </p>
              {speech.error && <p className="text-center text-alert">{speech.error}</p>}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 180))}
                rows={3}
                className="field text-lg"
                placeholder="예) 체육 시간에 내 차례를 친구가 가져갔어요"
              />
              {me.vocab.length > 0 && (
                <p className="text-sm text-soft">
                  배운 마음 단어:{" "}
                  {me.vocab.map((w) => (
                    <button key={w} onClick={() => setText((t) => `${t}${t ? " " : ""}${w}`)} className="mr-1 rounded-full bg-leaf-soft px-2 py-0.5 text-ink">
                      {w}
                    </button>
                  ))}
                </p>
              )}
              {note && <p className="text-alert">{note}</p>}
              <div className="flex justify-between gap-3">
                <button onClick={() => { speech.stop(); setMethod("card"); setStep("card"); }} className="btn-sub">카드로 바꾸기</button>
                <button onClick={fromText} disabled={text.trim().length < 2 || speech.listening} className="btn-main px-8 text-lg">마음 정리하기</button>
              </div>
            </div>
          ) : step === "ask" ? (
            <div className="space-y-5">
              <p className="text-sm font-bold text-leaf">마음 친구가 한 번만 더 물어볼게</p>
              <h2 className="font-display text-3xl leading-snug">{qa.question}<Say text={qa.question} /></h2>
              <p className="text-soft">대답하지 않아도 괜찮아요.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {qa.options.map((o) => (
                  <button key={o} onClick={() => save(o === "말하기 싫어요" ? "" : o)} className="chip px-4 py-4 text-lg font-bold hover:border-leaf">
                    {o}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={answer} onChange={(e) => setAnswer(e.target.value.slice(0, 120))} className="field" placeholder="직접 말하거나 적어도 돼요" />
                {answerSpeech.supported && (
                  <button onClick={answerSpeech.listening ? answerSpeech.stop : answerSpeech.start} className="btn-sub shrink-0" aria-label="말로 답하기">
                    {answerSpeech.listening ? "■" : "🎙️"}
                  </button>
                )}
              </div>
              {note && <p className="text-alert">{note}</p>}
              <div className="flex justify-between gap-3">
                <button onClick={() => save("")} className="btn-sub">건너뛰고 저장</button>
                <button onClick={() => save(answer)} disabled={!answer.trim()} className="btn-main px-8">답하고 저장</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="rounded-full bg-leaf-soft px-4 py-1 text-sm font-bold text-leaf">✓ 마음을 담았어요</p>
              <h2 className="font-display text-3xl">마음을 나눠 줘서 고마워, {me.alias}!</h2>
              {pick.emotion && <EmotionArt name={pick.emotion} size={110} />}
              <p className="text-lg">{SLOT_LABEL[slot]} · {pick.emotion} · {pick.reason}</p>
              <p className="flex items-center gap-1 text-sm text-soft"><Flower color={EMOTION_COLOR[pick.emotion ?? ""] ?? "#ffc23c"} size={24} /> 오늘의 마음 꽃이 피었어요</p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Link href="/me/calendar" className="btn-sub">📅 내 마음 달력</Link>
                <button onClick={nextFriend} className="btn-main">다음 친구 차례</button>
              </div>
            </div>
          )}
        </section>

        <aside className="card flex flex-col items-center gap-3 self-start text-center lg:sticky lg:top-5">
          <BuddyLazy emotion={pick.emotion} intensity={pick.intensity} size={220} />
          <p className="text-sm text-soft">마음 친구</p>
          <p className="font-display text-xl" style={{ color: pick.emotion ? EMOTION_COLOR[pick.emotion] : undefined }}>{buddyLine}</p>
          <div className="mt-2 w-full space-y-1 border-t border-line pt-3 text-left text-sm">
            <p className="font-bold">오늘 남긴 마음</p>
            {(["am", "pm"] as Slot[]).map((s) => {
              const r = me.records.find((x) => x.slot === s);
              return (
                <p key={s} className="flex items-center gap-1.5 text-soft">
                  {SLOT_LABEL[s]}: {r ? <><EmotionArt name={r.emotion} size={22} /> {r.emotion}</> : "아직이에요"}
                </p>
              );
            })}
          </div>
          <div className="w-full border-t border-line pt-3 text-left text-sm">
            <p className="font-bold">이번 달 마음 꽃밭</p>
            {me.flowers.length ? (
              <div className="mt-1 flex flex-wrap" aria-label={`마음 꽃 ${me.flowers.length}송이`}>
                {me.flowers.map((f) => <Flower key={f.date} color={EMOTION_COLOR[f.emotion] ?? "#ffc23c"} size={26} />)}
              </div>
            ) : (
              <p className="text-soft">마음을 남긴 날마다 꽃이 한 송이씩 피어요.</p>
            )}
            <Link href="/me/calendar" className="mt-2 inline-block text-leaf underline underline-offset-4">내 마음 달력 보기</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
