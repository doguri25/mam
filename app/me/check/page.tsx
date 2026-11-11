"use client";
// 마음 점검(학급 역량 진단): 선생님이 연 회차에만 보인다. 한 화면에 한 문장씩 5단계(전혀 그렇지 않아요 ~ 매우 그래요)로 고르고,
// 32문장(4개 마당 × 8)을 다 고르면 보낸다. 회차가 열려 있는 동안은 다시 골라 고칠 수 있다.
// 점수·수준은 보여 주지 않고, 마당마다 나에게 맞는 이야기와 해 볼 일만 보인다. 선생님이 보낸 말이 있으면 맨 위에 보인다.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Doodle from "@/components/Doodle";
import BuddyLazy from "@/components/BuddyLazy";
import StudentFrame, { Loading, useRetry, useStudent } from "@/components/StudentFrame";
import { api, isOtherStudent } from "@/lib/api";
import { errText, t, type Lang } from "@/lib/i18n";
import { speak } from "@/lib/local";
import { DOMAINS, PER, SELF_ITEMS, SELF_SCALE, STUDENT_GUIDE, domainOfItem, type Tier } from "@/lib/selfcheck";
import { backToMe, useBackSteps } from "@/lib/back";

type Open = {
  round: { id: string; title: string; open: boolean } | null;
  answers: number[] | null;
  tiers: Tier[] | null;
  feedback: { text: string; at: string } | null;
};
const N = SELF_ITEMS.length;
const DOT = ["size-3.5 bg-leaf/10", "size-5 bg-leaf/25", "size-6 bg-leaf/45", "size-7 bg-leaf/70", "size-8 bg-leaf"]; // 1~5: 클수록 「그래요」

// 읽어 주기 단추: 보이는 동그라미는 40px 그대로, 누르는 곳은 48px(위아래 여백을 줄여 줄 높이는 그대로)
function SayBtn({ text, lang }: { text: string; lang: Lang }) {
  return (
    <button type="button" onClick={() => speak(text, true, lang)} className="-my-1 ml-1 inline-grid size-12 shrink-0 place-items-center rounded-full align-middle" aria-label={t(lang, "sayIt")}>
      <span className="grid size-10 place-items-center rounded-full bg-leaf-soft"><Doodle name="speaker" size={24} /></span>
    </button>
  );
}

export default function CheckPage() {
  const { me, lang, tt } = useStudent();
  const [open, setOpen] = useState<Open | null>(null);
  const [step, setStep] = useState(-1); // -1 첫 화면, 0~31 문장, 32 보냄
  const [answers, setAnswers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [changed, setChanged] = useState(false); // 답하는 사이 선생님이 새 회차를 열었다(처음 화면에 안내)
  const [cheer, setCheer] = useState(0);
  const lock = useRef(false); // 두 번 눌러 다음 문장까지 같은 답으로 넘어가지 않게 잠깐 잠근다

  // 와이파이가 잠깐 끊긴 것을 「지금은 점검하는 때가 아니에요」로 보이지 않게, 받을 때까지 다시 묻는다
  useRetry(() => api<Open>("student", "selfCheck"), setOpen);
  const asking = step >= 0 && step < N;
  const line = asking ? SELF_ITEMS[step][lang] : "";
  useEffect(() => { if (line) speak(line, false, lang); }, [line, lang]); // 「읽어 주기」를 켠 학생에게만
  // 브라우저 뒤로 가기 = 앞 문장으로(첫 문장이면 시작 화면으로). 다 보낸 뒤에는 마음 점검을 나간다.
  useBackSteps(asking ? step + 1 : 0, () => setStep((n) => n - 1), "check");

  if (!me || !open) return <Loading lang={me ? lang : undefined} />;
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
    if (step < N - 1) return setStep(step + 1);
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ tiers: Tier[] }>("student", "selfSave", { round: open!.round!.id, answers: next });
      setOpen({ ...open!, answers: next, tiers: r.tiers });
      setStep(N);
      setCheer((n) => n + 1);
      speak(tt("checkThanks"), false, lang);
    } catch (e) {
      if ((e as { status?: number }).status === 409 && !isOtherStudent(e)) {
        // 답하는 사이 회차가 바뀌었거나 닫혔다: 새 회차를 다시 읽어 처음 화면으로(앞 회차 답을 새 회차에 넣지 않는다)
        try {
          const fresh = await api<Open>("student", "selfCheck");
          setOpen(fresh);
          setAnswers([]);
          setChanged(!!fresh.round?.open);
          setStep(-1);
          setBusy(false);
          return;
        } catch {
          // 다시 읽지 못하면 아래처럼 안내만
        }
      }
      setErr(errText(lang, (e as Error).message));
    }
    setBusy(false);
  }

  const frameTitle = `${title} · ${open.round.title}`;
  if (!asking) {
    const done = !!open.tiers;
    // 닫힌 회차에서 선생님 말만 온 때(답 없이)는 「선생님이 보낸 말」을 제목으로
    const head = step >= N ? tt("checkThanks") : done ? tt("checkDone") : open.round.open ? tt("checkIntro") : tt("checkLetter");
    return (
      <StudentFrame title={frameTitle} lang={lang} root="check">
        <div className="space-y-4">
          <div className="card flex flex-col items-center gap-4 py-6 text-center">
            <BuddyLazy look={me.look} emotion={done ? "뿌듯해요" : "반가워요"} cheer={cheer} size={200} className="size-40 sm:size-[200px]" scene />
            {changed && !done && <p role="status" className="max-w-xl rounded-2xl bg-[#fff8e1] px-4 py-2">{tt("checkChanged")}</p>}
            <p className="max-w-xl font-display text-2xl leading-snug">{head}<SayBtn lang={lang} text={head} /></p>
            <div className="flex flex-wrap justify-center gap-2">
              {open.round.open && (done
                ? <button onClick={() => { setAnswers(open.answers ?? []); setStep(0); }} className="btn-sub">{tt("checkRedo")}</button>
                : <button onClick={() => { setAnswers([]); setChanged(false); setStep(0); }} className="btn-main px-10 text-xl">{tt("checkStart")}</button>)}
              {(done || !open.round.open) && <Link href="/me" onClick={backToMe} className="btn-main px-8">{tt("buddyBack")}</Link>}
            </div>
          </div>
          {open.feedback && (
            <section className="card space-y-2 border-2 border-sun" aria-labelledby="letter-head">
              <h2 id="letter-head" className="flex items-center gap-2 font-display text-xl"><Doodle name="letter" size={30} /> {tt("checkLetter")}</h2>
              <p className="whitespace-pre-line text-lg leading-relaxed" lang="ko">{open.feedback.text}<SayBtn lang="ko" text={open.feedback.text} /></p>
            </section>
          )}
          {open.tiers && <Stories tiers={open.tiers} lang={lang} tt={tt} />}
        </div>
      </StudentFrame>
    );
  }

  const d = domainOfItem(step);
  const dom = DOMAINS[d];
  return (
    <StudentFrame title={frameTitle} lang={lang} root="check">
      <div className="card space-y-5 py-6">
        <div className="grid grid-cols-4 gap-1.5" aria-label={`${step + 1} / ${N}`}>
          {DOMAINS.map((x, i) => {
            const fill = Math.max(0, Math.min(PER, step + 1 - i * PER)) / PER;
            return <span key={x.key} className="h-2.5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full transition-[width]" style={{ width: `${fill * 100}%`, background: x.color }} /></span>;
          })}
        </div>
        <p className="flex items-center justify-center gap-2 text-sm font-bold" style={{ color: dom.color }}>
          <Doodle name={dom.icon} size={22} /> {dom.text[lang]} <span className="font-normal text-soft">· {step + 1} / {N}</span>
        </p>
        <h2 className="text-center font-display text-2xl leading-snug sm:text-3xl" aria-live="polite">{line}<SayBtn lang={lang} text={line} /></h2>
        <div className="grid gap-2 sm:grid-cols-5 sm:gap-3" role="group" aria-label={line}>
          {SELF_SCALE.map((lbl, i) => {
            const v = i + 1, on = answers[step] === v;
            return (
              <button key={v} onClick={() => choose(v)} disabled={busy} aria-pressed={on}
                className={`chip flex min-h-14 items-center gap-3 px-4 py-3 text-left text-lg font-bold hover:border-leaf sm:min-h-32 sm:flex-col sm:justify-center sm:gap-3 sm:px-2 sm:text-center ${on ? "border-leaf bg-leaf-soft" : ""}`}>
                <span className="grid size-9 shrink-0 place-items-center" aria-hidden><span className={`rounded-full border-2 border-leaf ${DOT[i]}`} /></span>
                <span className="leading-tight">{lbl[lang]}</span>
              </button>
            );
          })}
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

// 마당마다 나에게 맞는 이야기와 해 볼 일(점수·수준 이름 없이)
function Stories({ tiers, lang, tt }: { tiers: Tier[]; lang: Lang; tt: (k: "checkStory" | "checkStoryHint" | "checkTry") => string }) {
  return (
    <section className="space-y-3" aria-labelledby="story-head">
      <div className="px-1">
        <h2 id="story-head" className="font-display text-2xl">{tt("checkStory")}</h2>
        <p className="text-soft">{tt("checkStoryHint")}</p>
      </div>
      {DOMAINS.map((d, i) => {
        const g = STUDENT_GUIDE[i][tiers[i] ?? "mid"];
        const say = [g.desc[lang], tt("checkTry"), ...g.tips.map((x) => x[lang])].join(" ");
        return (
          <article key={d.key} className="card space-y-3" style={{ borderTop: `6px solid ${d.color}` }}>
            <h3 className="flex items-center gap-2 font-display text-xl" style={{ color: d.color }}>
              <span className="grid size-11 place-items-center rounded-full" style={{ background: `${d.color}1a` }}><Doodle name={d.icon} size={28} /></span>
              <span className="flex-1">{d.text[lang]}</span>
              <SayBtn lang={lang} text={say} />
            </h3>
            <p className="text-lg leading-relaxed">{g.desc[lang]}</p>
            <div className="rounded-2xl p-3" style={{ background: `${d.color}12` }}>
              <p className="mb-1 font-bold" style={{ color: d.color }}>{tt("checkTry")}</p>
              <ul className="list-disc space-y-1 pl-5">{g.tips.map((x, k) => <li key={k}>{x[lang]}</li>)}</ul>
            </div>
          </article>
        );
      })}
    </section>
  );
}
