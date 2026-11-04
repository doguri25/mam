"use client";
// 마음 친구 꾸미기: 몸 색 · 모양 · 눈 · 볼 · 무늬 · 팔다리 · 꾸미개 · 이름. 고르는 대로 마음 친구가 바로 바뀐다(인사는 저장할 때만).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Doodle, { type DoodleName } from "@/components/Doodle";
import BuddyFace from "@/components/BuddyFace";
import BuddyLazy from "@/components/BuddyLazy";
import { api } from "@/lib/api";
import { isLang, t, type Lang, type UIKey } from "@/lib/i18n";
import { useLocal } from "@/lib/local";
import {
  ACC_UNLOCK, BUDDY_ACCS, BUDDY_CHEEKS, BUDDY_COLORS, BUDDY_EYES, BUDDY_LIMBS, BUDDY_PATTERNS, BUDDY_SHAPES, GROUPS, type BuddyAcc, type BuddyLook, type MoodRecord,
} from "@/lib/shared";

type Me = { no: number; alias: string; look: BuddyLook; records: MoodRecord[]; words: string[] };
type Part = "shape" | "eyes" | "cheek" | "pattern" | "limbs" | "acc";

// 고르는 칸: 제목 · 고를 것 · 칸 수(넓은 화면)
const PARTS: [Part, UIKey, readonly string[], string][] = [
  ["shape", "buddyShape", BUDDY_SHAPES, "sm:grid-cols-3 xl:grid-cols-5"],
  ["eyes", "buddyEyes", BUDDY_EYES, "sm:grid-cols-3"],
  ["cheek", "buddyCheek", BUDDY_CHEEKS, "sm:grid-cols-3"],
  ["pattern", "buddyPattern", BUDDY_PATTERNS, "sm:grid-cols-3"],
  ["limbs", "buddyLimbs", BUDDY_LIMBS, "sm:grid-cols-3"],
  ["acc", "buddyAcc", BUDDY_ACCS, "sm:grid-cols-4 xl:grid-cols-5"],
];

// 고르는 칸 묶음(그림 단추): 색 · 모양 · 눈 · 볼 · 무늬 · 팔다리 · 꾸미개 · 이름
type Tab = "color" | Part | "name";
const TABS: [Tab, DoodleName, UIKey][] = [
  ["shape", "bubble", "buddyShape"], ["color", "palette", "buddyColor"], ["eyes", "eyes", "buddyEyes"], ["cheek", "cheek", "buddyCheek"],
  ["pattern", "spots", "buddyPattern"], ["limbs", "hand", "buddyLimbs"], ["acc", "ribbon", "buddyAcc"], ["name", "tag", "tabName"],
];

export default function BuddyPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [look, setLook] = useState<BuddyLook | null>(null);
  const [cheer, setCheer] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("shape");
  const [langRaw] = useLocal(`mb_lang_${me?.no ?? 0}`);
  const lang: Lang = isLang(langRaw) ? langRaw : "ko";
  const tt = (k: UIKey, vars?: Record<string, string | number>) => t(lang, k, vars);

  useEffect(() => {
    api<Me>("student", "me").then((m) => { setMe(m); setLook(m.look); }, () => router.replace("/"));
  }, [router]);

  if (!me || !look) return <main className="grid min-h-dvh place-items-center text-soft">…</main>;
  // 미리보기 표정: 오늘 마지막으로 남긴 마음(없으면 기쁨)
  const emotion = me.records.at(-1)?.word || me.records.at(-1)?.emotion || "기뻐요";
  function set(p: Partial<BuddyLook>) {
    setLook({ ...look!, ...p }); // 고르는 동안에는 움직이지 않고 그대로 보여 준다
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api("student", "look", { look });
      setSaved(true);
      setCheer((n) => n + 1);
      setTimeout(() => router.push("/me"), 1400); // 새 모습으로 한 번 인사하고 돌아가기
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const chip = (on: boolean) => `chip flex flex-col items-center gap-1 p-2 text-sm font-bold ${on ? "border-leaf bg-leaf-soft" : ""}`;
  const lockedAcc = (o: string) => ACC_UNLOCK[o as BuddyAcc] > me.words.length && me.look.acc !== o;
  // 아무거나: 열린 꾸미개 안에서 마구 골라 보기(이름은 그대로)
  function random() {
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
    set({
      color: pick(BUDDY_COLORS), shape: pick(BUDDY_SHAPES), eyes: pick(BUDDY_EYES), cheek: pick(BUDDY_CHEEKS),
      pattern: pick(BUDDY_PATTERNS), limbs: pick(BUDDY_LIMBS), acc: pick(BUDDY_ACCS.filter((a) => !lockedAcc(a))),
    });
  }
  const current = PARTS.find(([p]) => p === tab);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6" lang={lang}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/me" className="btn-sub min-h-12 shrink-0 whitespace-nowrap px-4">← {tt("buddyBack")}</Link>
        <h1 className="flex items-center gap-2 font-display text-xl sm:text-3xl"><Doodle name="palette" size={34} className="hidden shrink-0 sm:block" />{tt("buddyEdit")}</h1>
        <button onClick={random} className="btn-sub min-h-12 shrink-0 px-4"><Doodle name="dice" size={24} />{tt("buddyRandom")}</button>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="card flex flex-col items-center gap-2 self-start lg:sticky lg:top-5">
          <BuddyLazy emotion={emotion} look={look} cheer={cheer} size={280} className="size-56 sm:size-[280px]" scene />
          <p className="font-display text-2xl text-leaf">{saved ? tt("buddySaved") : look.name || tt("buddy")}</p>
        </section>

        <section className="card space-y-4">
          {/* 한 번에 한 가지만: 그림 단추로 고를 것을 바꾼다 */}
          <div role="tablist" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {TABS.map(([id, icon, key]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`flex min-h-16 min-w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 text-xs font-bold ${tab === id ? "border-leaf bg-leaf-soft text-ink" : "border-line bg-card text-soft"}`}>
                <Doodle name={icon} size={30} />{tt(key)}
              </button>
            ))}
          </div>

          {tab === "color" && (
            <div className="flex flex-wrap justify-center gap-3 py-2">
              {BUDDY_COLORS.map((c) => (
                <button
                  key={c || "mood"}
                  onClick={() => set({ color: c })}
                  aria-pressed={look.color === c}
                  aria-label={c || tt("buddyFollow")}
                  className={`grid size-16 place-items-center rounded-full border-4 text-[11px] font-bold leading-tight text-white ${look.color === c ? "border-ink" : "border-card"}`}
                  style={{ background: c || `conic-gradient(${Object.values(GROUPS).map((g) => g.color).join(",")}, ${GROUPS.joy.color})` }}
                >
                  {!c && <span className="rounded bg-ink/60 px-1">{tt("buddyFollow")}</span>}
                </button>
              ))}
            </div>
          )}

          {current && (
            <div>
              {current[0] === "acc" && <p className="mb-2 flex items-center gap-1.5 text-sm text-soft"><Doodle name="sprout" size={22} /> {tt("growWords", { n: me.words.length })}</p>}
              <div className={`grid grid-cols-3 gap-2 ${current[3]}`}>
                {current[2].map((o) => {
                  const part = current[0];
                  // 마음 친구 성장: 꾸미개는 써 본 감정 단어 수만큼 열린다(지금 쓰고 있는 것은 그대로)
                  const need = part === "acc" ? ACC_UNLOCK[o as BuddyAcc] : 0;
                  const locked = part === "acc" && lockedAcc(o);
                  return (
                    <button key={o} onClick={() => !locked && set({ [part]: o })} aria-pressed={look[part] === o} aria-disabled={locked} className={`${chip(look[part] === o)} relative ${locked ? "opacity-60" : ""}`}>
                      <BuddyFace look={{ ...look, [part]: o }} emotion={emotion} size={72} className={locked ? "grayscale" : undefined} />
                      {tt((o === "none" ? "acc_none" : `${part}_${o}`) as UIKey)}
                      {locked && <span className="text-[11px] font-normal leading-tight text-soft"><Doodle name="lock" size={14} /> {tt("lockedHint", { n: need })}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "name" && (
            <label className="block py-2">
              <span className="font-bold">{tt("buddyName")}</span>
              <input value={look.name} onChange={(e) => setLook({ ...look, name: e.target.value.slice(0, 8) })} className="field mt-2 text-xl" maxLength={8} />
              <span className="mt-1 block text-sm text-soft">{tt("buddyNameHint")}</span>
            </label>
          )}
          {err && <p className="text-alert">{err}</p>}
        </section>
      </div>

      {/* 저장은 늘 아래에 크게 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-5xl justify-end">
          <button onClick={save} disabled={busy} className="btn-main min-h-14 w-full px-8 text-xl sm:w-auto">{tt("buddySave")}</button>
        </div>
      </div>
    </main>
  );
}
