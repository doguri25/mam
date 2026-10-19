"use client";
// 오늘의 마음: 고르기(카드/말) → 살펴보기 → 되묻기 한 번 → 저장. 학생이 고른 언어로 보여 준다(기록은 한국어 감정 이름).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EMOTION_COLOR, EmotionArt, Flower } from "@/components/Art";
import CalmBox from "@/components/CalmBox";
import BuddyLazy from "@/components/BuddyLazy";
import MoodPicker, { type Pick } from "@/components/MoodPicker";
import { useSpeech } from "@/components/useSpeech";
import { api } from "@/lib/api";
import { CHEER, LANGS, isLang, langOf, t, w, type Lang, type UIKey } from "@/lib/i18n";
import { speak, useLocal } from "@/lib/local";
import { groupOf, type BuddyLook, type CalmTool, type Felt, type MoodRecord, type Slot, type VoiceMode } from "@/lib/shared";
import type { VoiceFeatures } from "@/lib/tone";

type Me = {
  no: number; alias: string; className: string; vocab: string[]; voiceMode: VoiceMode; slot: Slot; today: string;
  records: MoodRecord[]; flowers: { date: string; emotion: string }[]; look: BuddyLook;
};
type Step = "choose" | "card" | "voice" | "confirm" | "ask" | "done";
type Tone = { tone: string | null; toneWhy: string; toneBy: string | null; voice: VoiceFeatures | null };
type Analyzed = Pick & Tone & { needCard?: boolean; question: string; options: string[]; risk: boolean; skipAsk?: boolean; summary?: string };

const SLOT_KO: Record<Slot, string> = { am: "아침", pm: "하교 전" };
const NO_TONE: Tone = { tone: null, toneWhy: "", toneBy: null, voice: null };

function SayBtn({ text, lang }: { text: string; lang: Lang }) {
  return (
    <button type="button" onClick={() => speak(text, true, lang)} className="ml-2 inline-grid size-8 place-items-center rounded-full bg-leaf-soft align-middle text-base" aria-label="🔊">
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
  const [summaryKo, setSummaryKo] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<UIKey | "">("");
  const [note, setNote] = useState<UIKey | string>("");
  const [cheer, setCheer] = useState(0); // 저장하면 마음 친구가 한 번 인사
  const [calm, setCalm] = useState<"off" | "offer" | "open">("off"); // 마음 다스리기 도구 상자
  const [readAloud, setReadAloud] = useLocal("mb_read");
  const [langRaw, setLang] = useLocal(`mb_lang_${me?.no ?? 0}`); // 같은 태블릿을 돌려 써도 학생마다 따로
  const lang: Lang = isLang(langRaw) ? langRaw : "ko";
  const speech = useSpeech((x) => { setText(x); setSpoke(true); }, { measure: !!me && me.voiceMode !== "off", record: me?.voiceMode === "gemini", lang: langOf(lang).speech });
  const answerSpeech = useSpeech(setAnswer, { lang: langOf(lang).speech });
  const say = (x: string) => speak(x, false, lang);

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
    if (step === "ask") speak(qa.question, false, lang);
  }, [step, qa.question, lang]);

  if (!me) return <main className="grid min-h-dvh place-items-center text-soft">…</main>;

  const tt = (key: UIKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const slotName = (s: Slot) => w(lang, SLOT_KO[s]);
  const msg = (x: string) => (x in { micDenied: 1, noSpeech: 1, speechFail: 1, notUnderstood: 1 } ? tt(x as UIKey) : x);
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
    setStep(next);
  }

  const toQa = (r: Analyzed) => ({ question: r.question, options: r.options, aiRisk: r.risk, skip: !!r.skipAsk });
  const toTone = (r: Analyzed): Tone => ({ tone: r.tone ?? null, toneWhy: r.toneWhy ?? "", toneBy: r.toneBy ?? null, voice: r.voice ?? null });

  async function fromCard() {
    setBusy("thinking");
    try {
      // 말하기에서 카드로 넘어온 경우 그 문장도 함께 보내 위험 표현을 놓치지 않게
      const r = await api<Analyzed>("student", "analyze", { card: pick, lang, ...(method === "voice" && text ? { text, voice: tone.voice } : {}) });
      const q = toQa(r);
      setQa(q);
      if (method === "voice") {
        setTone(toTone(r));
        if (lang !== "ko" && r.summary) setSummaryKo(r.summary);
      }
      if (q.skip) return save("", q, toTone(r));
      setStep("ask");
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy("");
  }

  async function fromText() {
    speech.stop();
    setBusy("listeningSort");
    try {
      const v = spoke ? await speech.takeVoice() : null;
      const r = await api<Analyzed>("student", "analyze", { text, lang, voice: v?.features, audio: v?.wav });
      setTone(toTone(r));
      if (r.needCard) {
        setNote("notUnderstood");
        setStep("card");
      } else {
        setPick({ emotion: r.emotion, intensity: r.intensity, reason: r.reason, word: r.word || undefined });
        if (lang !== "ko" && r.summary) setSummaryKo(r.summary);
        setQa(toQa(r));
        setStep("confirm");
      }
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy("");
  }

  async function save(ans: string, q = qa, tn = tone) {
    answerSpeech.stop();
    setBusy("saving");
    try {
      const { record } = await api<{ record: MoodRecord }>("student", "save", {
        record: { ...pick, slot, method, summary: method === "voice" ? text : "", question: q.question, answer: ans, aiRisk: q.aiRisk, lang, summaryKo, ...tn },
      });
      const today = me!.today;
      setMe({
        ...me!,
        records: [...me!.records.filter((r) => r.slot !== slot), record],
        flowers: [...me!.flowers.filter((f) => f.date !== today), { date: today, emotion: record.emotion }],
      });
      setStep("done");
      setCheer((n) => n + 1);
      // 힘든 마음(슬픔·화남·불안)이면 마음 다스리기 도구 상자를 권한다
      setCalm(["sad", "angry", "fear"].includes(groupOf(record.emotion)) ? "offer" : "off");
      say(tt("saved").replace("✓ ", ""));
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy("");
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

  async function nextFriend() {
    await api("student", "logout");
    router.replace("/");
  }

  const group = pick.emotion ? groupOf(pick.emotion) : null;
  const shown = pick.word ? w(lang, pick.word) : pick.emotion ? w(lang, pick.emotion) : "";
  const buddyLine =
    step === "done" && qa.skip ? qa.question // 위험한 마음: 감정별 문장 대신 고맙다는 말만
    : step === "done" && group ? CHEER[lang][group]
    : step === "ask" ? tt("slow")
    : pick.emotion ? tt("picked", { emotion: shown })
    : tt("hello", { alias: me.alias });

  return (
    <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6" lang={lang}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-soft">{me.className} · {me.no}</p>
          <h1 className="font-display text-3xl">{tt("title", { alias: me.alias })}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 rounded-2xl border border-line bg-card px-2 text-sm">
            <span aria-hidden>🌐</span>
            <select value={lang} onChange={(e) => setLang(e.target.value === "ko" ? "" : e.target.value)} className="h-10 bg-transparent font-bold outline-none" aria-label="Language">
              {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <div role="group" aria-label={tt("lang")} className="flex rounded-2xl border border-line bg-card p-1">
            {(["am", "pm"] as Slot[]).map((s) => (
              <button
                key={s}
                aria-pressed={slot === s}
                onClick={() => {
                  setSlot(s);
                  if (step === "done") reset();
                }}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${slot === s ? "bg-leaf text-white" : "text-soft"}`}
              >
                {s === "am" ? "☀️" : "🌇"} {slotName(s)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setReadAloud(readAloud === "1" ? "" : "1")}
            aria-pressed={readAloud === "1"}
            className={`btn-sub min-h-10 px-3 text-sm ${readAloud === "1" ? "border-leaf bg-leaf-soft" : ""}`}
          >
            {readAloud === "1" ? tt("readOn") : tt("readOff")}
          </button>
          <button onClick={nextFriend} className="btn-sub min-h-10 px-3 text-sm">{tt("next")}</button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px] lg:grid-rows-[auto_1fr]">
        <section className="card min-h-[420px] sm:p-7 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {busy ? (
            <p className="grid h-80 place-items-center font-display text-2xl text-leaf">{tt(busy)}</p>
          ) : calm === "open" ? (
            <CalmBox look={me.look} emotion={pick.emotion ?? done?.emotion} lang={lang} onFelt={sendCalm} onClose={() => setCalm("off")} />
          ) : step === "choose" ? (
            <div className="space-y-5">
              <h2 className="font-display text-2xl">{tt("how", { slot: slotName(slot) })}<SayBtn lang={lang} text={`${tt("how", { slot: slotName(slot) })} ${tt("card")}, ${tt("voice")}`} /></h2>
              {done && (
                <p className="flex items-center gap-2 rounded-2xl bg-leaf-soft p-3 text-sm">
                  <EmotionArt name={done.emotion} size={28} />
                  {tt("already", { slot: slotName(slot), emotion: w(lang, done.word || done.emotion) })}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <button onClick={() => { setMethod("card"); setStep("card"); say(tt("card")); }} className="chip flex flex-col items-center gap-3 p-7 hover:border-leaf">
                  <span className="flex -space-x-3">
                    <EmotionArt name="기뻐요" size={52} />
                    <EmotionArt name="슬퍼요" size={52} />
                    <EmotionArt name="화나요" size={52} />
                  </span>
                  <span className="font-display text-2xl">{tt("card")}</span>
                  <span className="text-sm text-soft">{tt("cardSub")}</span>
                </button>
                <button onClick={() => { setMethod("voice"); setStep("voice"); say(tt("voice")); }} className="chip flex flex-col items-center gap-3 p-7 hover:border-leaf">
                  <span className="grid size-[52px] place-items-center rounded-full bg-leaf text-2xl text-white">🎙️</span>
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
              <MoodPicker value={pick} onChange={setPick} vocab={me.vocab} lang={lang} />
              <div className="flex justify-between gap-3 pt-2">
                <button onClick={() => reset()} className="btn-sub">{tt("restart")}</button>
                <button
                  onClick={() => (step !== "confirm" ? fromCard() : qa.skip ? save("") : setStep("ask"))}
                  disabled={!complete}
                  className="btn-main px-8 text-lg"
                >
                  {step === "confirm" ? tt("yesNext") : complete ? tt("nextBtn") : tt("pick3")}
                </button>
              </div>
            </div>
          ) : step === "voice" ? (
            <div className="space-y-5">
              <h2 className="font-display text-2xl">{tt("sayOne")}<SayBtn lang={lang} text={tt("sayOne")} /></h2>
              {speech.supported && (
                <button
                  onClick={speech.listening ? speech.stop : speech.start}
                  className={`mx-auto grid size-28 place-items-center rounded-full text-5xl text-white shadow-lg ${speech.listening ? "animate-pulse bg-alert" : "bg-leaf"}`}
                  aria-label={speech.listening ? "■" : "🎙️"}
                >
                  {speech.listening ? "■" : "🎙️"}
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
                <button onClick={() => { speech.stop(); setMethod("card"); setStep("card"); }} className="btn-sub">{tt("toCard")}</button>
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
                  <button key={o} onClick={() => save(i === qa.options.length - 1 ? "" : o)} className="chip px-4 py-4 text-lg font-bold hover:border-leaf">
                    {o}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={answer} onChange={(e) => setAnswer(e.target.value.slice(0, 120))} className="field" placeholder={tt("ownAnswer")} />
                {answerSpeech.supported && (
                  <button onClick={answerSpeech.listening ? answerSpeech.stop : answerSpeech.start} className="btn-sub shrink-0" aria-label="🎙️">
                    {answerSpeech.listening ? "■" : "🎙️"}
                  </button>
                )}
              </div>
              {note && <p className="text-alert">{msg(note)}</p>}
              <div className="flex justify-between gap-3">
                <button onClick={() => save("")} className="btn-sub">{tt("skipSave")}</button>
                <button onClick={() => save(answer)} disabled={!answer.trim()} className="btn-main px-8">{tt("answerSave")}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="rounded-full bg-leaf-soft px-4 py-1 text-sm font-bold text-leaf">{tt("saved")}</p>
              <h2 className="font-display text-3xl">{tt("thanks", { alias: me.alias })}</h2>
              {pick.emotion && <EmotionArt name={pick.emotion} size={110} />}
              <p className="text-lg">
                {slotName(slot)} · <b>{w(lang, pick.emotion ?? "")}</b>
                {pick.word && <> · <b style={{ color: EMOTION_COLOR[pick.emotion ?? ""] }}>{w(lang, pick.word)}</b></>} · {w(lang, pick.reason ?? "")}
              </p>
              <p className="flex items-center gap-1 text-sm text-soft"><Flower color={EMOTION_COLOR[pick.emotion ?? ""] ?? "#ffc23c"} size={24} /> {tt("flowerToday")}</p>
              {calm === "offer" && (
                <div className="w-full max-w-md rounded-2xl bg-leaf-soft p-4">
                  <p className="font-display text-xl">{tt("calmAsk")}<SayBtn lang={lang} text={tt("calmAsk")} /></p>
                  <div className="mt-3 flex justify-center gap-2">
                    <button onClick={() => setCalm("open")} className="btn-main">{tt("calmOpen")}</button>
                    <button onClick={() => setCalm("off")} className="btn-sub">{tt("calmLater")}</button>
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Link href="/me/calendar" className="btn-sub">{tt("calendar")}</Link>
                <button onClick={nextFriend} className="btn-main">{tt("next")}</button>
              </div>
            </div>
          )}
        </section>

        {/* 마음 친구: 태블릿 세로·휴대폰에서는 맨 위 가로 띠, 넓은 화면에서는 오른쪽 위 */}
        <aside className="card order-first flex items-center gap-4 p-3 lg:sticky lg:top-5 lg:order-none lg:col-start-2 lg:row-start-1 lg:flex-col lg:gap-3 lg:self-start lg:p-5 lg:text-center">
          <BuddyLazy emotion={pick.emotion} intensity={pick.intensity} look={me.look} cheer={cheer} size={220} className="size-24 shrink-0 sm:size-28 lg:size-[220px]" />
          <div>
            <p className="text-xs text-soft lg:text-sm">{me.look.name || tt("buddy")}</p>
            <p className="font-display text-lg sm:text-xl" style={{ color: pick.emotion ? EMOTION_COLOR[pick.emotion] : undefined }}>{buddyLine}</p>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm lg:justify-center">
              <Link href="/me/buddy" className="text-leaf underline underline-offset-4">{tt("buddyEdit")}</Link>
              <button onClick={() => setCalm("open")} className="text-leaf underline underline-offset-4">{tt("calmOpen")}</button>
            </span>
          </div>
        </aside>

        <aside className="card space-y-3 self-start lg:col-start-2 lg:row-start-2">
          <div className="space-y-1 text-left text-sm">
            <p className="font-bold">{tt("todayRec")}</p>
            {(["am", "pm"] as Slot[]).map((s) => {
              const r = me.records.find((x) => x.slot === s);
              return (
                <p key={s} className="flex items-center gap-1.5 text-soft">
                  {slotName(s)}: {r ? <><EmotionArt name={r.emotion} size={22} /> {w(lang, r.word || r.emotion)}</> : tt("notYet")}
                </p>
              );
            })}
          </div>
          <div className="border-t border-line pt-3 text-left text-sm">
            <p className="font-bold">{tt("garden")}</p>
            {me.flowers.length ? (
              <div className="mt-1 flex flex-wrap" aria-label={`🌸 ${me.flowers.length}`}>
                {me.flowers.map((f) => <Flower key={f.date} color={EMOTION_COLOR[f.emotion] ?? "#ffc23c"} size={26} />)}
              </div>
            ) : (
              <p className="text-soft">{tt("gardenEmpty")}</p>
            )}
            <Link href="/me/calendar" className="mt-2 inline-block text-leaf underline underline-offset-4">{tt("calendarLink")}</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
