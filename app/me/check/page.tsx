"use client";
// 마음 점검(학생 자기진단): 선생님이 연 회차에만 보인다. 한 화면에 한 문장씩 「그래요 · 가끔 그래요 · 아니에요」를
// 내 마음 친구 얼굴로 고르고, 10문장을 다 고르면 보낸다. 회차가 열려 있는 동안은 다시 골라 고칠 수 있다. 점수는 보여 주지 않는다.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Doodle from "@/components/Doodle";
import BuddyFace from "@/components/BuddyFace";
import BuddyLazy from "@/components/BuddyLazy";
import StudentFrame, { Loading, useStudent } from "@/components/StudentFrame";
import { api } from "@/lib/api";
import { errText, t, type Lang } from "@/lib/i18n";
import { speak } from "@/lib/local";
import { SELF_ANSWER, SELF_ITEMS, SELF_SCALE } from "@/lib/selfcheck";
import { backToMe, useBackSteps } from "@/lib/back";

type Open = { round: { id: string; title: string } | null; answers: number[] | null };

function SayBtn({ text, lang }: { text: string; lang: Lang }) {
  return (
    <button type="button" onClick={() => speak(text, true, lang)} className="ml-2 inline-grid size-10 place-items-center rounded-full bg-leaf-soft align-middle" aria-label={t(lang, "sayIt")}>
      <Doodle name="speaker" size={24} />
    </button>
  );
}

export default function CheckPage() {
  const { me, lang, tt } = useStudent();
  const [open, setOpen] = useState<Open | null>(null);
  const [step, setStep] = useState(-1); // -1 첫 화면, 0~9 문장, 10 보냄
  const [answers, setAnswers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cheer, setCheer] = useState(0);
  const lock = useRef(false); // 두 번 눌러 다음 문장까지 같은 답으로 넘어가지 않게 잠깐 잠근다

  useEffect(() => {
    api<Open>("student", "selfCheck").then(setOpen, () => setOpen({ round: null, answers: null }));
  }, []);
  const item = step >= 0 && step < SELF_ITEMS.length ? SELF_ITEMS[step] : null;
  const line = item ? item.text[lang] : "";
  useEffect(() => { if (line) speak(line, false, lang); }, [line, lang]); // 「읽어 주기」를 켠 학생에게만
  // 브라우저 뒤로 가기 = 앞 문장으로(첫 문장이면 시작 화면으로). 다 보낸 뒤에는 마음 점검을 나간다.
  useBackSteps(step >= 0 && step < SELF_ITEMS.length ? step + 1 : 0, () => setStep((n) => n - 1), "check");

  if (!me || !open) return <Loading />;
  const title = tt("tileCheck");

  if (!open.round)
    return (
      <StudentFrame title={title} lang={lang} root="check">
        <div className="card flex flex-col items-center gap-4 py-8 text-center">
          <BuddyLazy look={me.look} size={160} />
          <p className="text-lg">{tt("checkClosed")}</p>
          <Link href="/me" onClick={backToMe} className="btn-main px-8">{tt("buddyBack")}</Link>
        </div>
      </StudentFrame>
    );

  async function choose(v: number) {
    if (lock.current) return;
    lock.current = true;
    setTimeout(() => { lock.current = false; }, 350);
    const next = [...answers];
    next[step] = v;
    setAnswers(next);
    if (step < SELF_ITEMS.length - 1) return setStep(step + 1);
    setBusy(true);
    setErr("");
    try {
      await api("student", "selfSave", { round: open!.round!.id, answers: next });
      setOpen({ ...open!, answers: next });
      setStep(SELF_ITEMS.length);
      setCheer((n) => n + 1);
      speak(tt("checkThanks"), false, lang);
    } catch (e) {
      setErr(errText(lang, (e as Error).message));
    }
    setBusy(false);
  }

  if (step < 0 || step >= SELF_ITEMS.length) {
    const done = step >= SELF_ITEMS.length || !!open.answers;
    return (
      <StudentFrame title={`${title} · ${open.round.title}`} lang={lang} root="check">
        <div className="card flex flex-col items-center gap-4 py-6 text-center">
          <BuddyLazy look={me.look} emotion={done ? "뿌듯해요" : "반가워요"} cheer={cheer} size={200} className="size-44 sm:size-[200px]" scene />
          <p className="max-w-xl font-display text-2xl leading-snug">
            {step >= SELF_ITEMS.length ? tt("checkThanks") : done ? tt("checkDone") : tt("checkIntro")}
            <SayBtn lang={lang} text={step >= SELF_ITEMS.length ? tt("checkThanks") : done ? tt("checkDone") : tt("checkIntro")} />
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {done ? (
              <>
                <button onClick={() => { setAnswers(open.answers ?? []); setStep(0); }} className="btn-sub">{tt("checkRedo")}</button>
                <Link href="/me" onClick={backToMe} className="btn-main px-8">{tt("buddyBack")}</Link>
              </>
            ) : (
              <button onClick={() => { setAnswers([]); setStep(0); }} className="btn-main px-10 text-xl">{tt("checkStart")}</button>
            )}
          </div>
        </div>
      </StudentFrame>
    );
  }

  return (
    <StudentFrame title={`${title} · ${open.round.title}`} lang={lang} root="check">
      <div className="card space-y-6 py-6">
        <div className="flex items-center justify-center gap-1.5" aria-label={`${step + 1} / ${SELF_ITEMS.length}`}>
          {SELF_ITEMS.map((_, i) => <span key={i} className={`h-2.5 w-6 rounded-full sm:w-8 ${i <= step ? "bg-leaf" : "bg-line"}`} />)}
        </div>
        <p className="text-center text-sm text-soft">{step + 1} / {SELF_ITEMS.length}</p>
        <h2 className="text-center font-display text-3xl leading-snug" aria-live="polite">{line}<SayBtn lang={lang} text={line} /></h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {SELF_SCALE.map((v) => (
            <button key={v} onClick={() => choose(v)} disabled={busy} aria-pressed={answers[step] === v}
              className={`chip flex flex-col items-center gap-2 px-1 py-4 text-lg font-bold hover:border-leaf sm:text-xl ${answers[step] === v ? "border-leaf bg-leaf-soft" : ""}`}>
              <BuddyFace look={me.look} emotion={SELF_ANSWER[v].face} size={84} />
              {SELF_ANSWER[v][lang]}
            </button>
          ))}
        </div>
        {err && <p role="alert" className="text-center text-alert">{err}</p>}
        {busy && <p className="text-center text-soft">{tt("checkSending")}</p>}
        <div className="flex justify-start">
          <button onClick={() => setStep(step - 1)} disabled={busy} className="btn-sub">← {tt("checkPrev")}</button>
        </div>
      </div>
    </StudentFrame>
  );
}
