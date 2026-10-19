"use client";
// 마음 친구 꾸미기: 몸 색 · 모양 · 눈 · 볼 · 무늬 · 팔다리 · 꾸미개 · 이름. 고르는 대로 3D 친구가 바로 바뀐다(움직이지 않고).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BuddyFace from "@/components/BuddyFace";
import BuddyLazy from "@/components/BuddyLazy";
import { api } from "@/lib/api";
import { isLang, t, type Lang, type UIKey } from "@/lib/i18n";
import { useLocal } from "@/lib/local";
import {
  BUDDY_ACCS, BUDDY_CHEEKS, BUDDY_COLORS, BUDDY_EYES, BUDDY_LIMBS, BUDDY_PATTERNS, BUDDY_SHAPES, GROUPS, type BuddyLook, type MoodRecord,
} from "@/lib/shared";

type Me = { no: number; alias: string; look: BuddyLook; records: MoodRecord[] };
type Part = "shape" | "eyes" | "cheek" | "pattern" | "limbs" | "acc";

// 고르는 칸: 제목 · 고를 것 · 칸 수(넓은 화면)
const PARTS: [Part, UIKey, readonly string[], string][] = [
  ["shape", "buddyShape", BUDDY_SHAPES, "sm:grid-cols-3"],
  ["eyes", "buddyEyes", BUDDY_EYES, "sm:grid-cols-3"],
  ["cheek", "buddyCheek", BUDDY_CHEEKS, "sm:grid-cols-3"],
  ["pattern", "buddyPattern", BUDDY_PATTERNS, "sm:grid-cols-3"],
  ["limbs", "buddyLimbs", BUDDY_LIMBS, "sm:grid-cols-3"],
  ["acc", "buddyAcc", BUDDY_ACCS, "sm:grid-cols-5"],
];

export default function BuddyPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [look, setLook] = useState<BuddyLook | null>(null);
  const [cheer, setCheer] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [langRaw] = useLocal(`mb_lang_${me?.no ?? 0}`);
  const lang: Lang = isLang(langRaw) ? langRaw : "ko";
  const tt = (k: UIKey) => t(lang, k);

  useEffect(() => {
    api<Me>("student", "me").then((m) => { setMe(m); setLook(m.look); }, () => router.replace("/"));
  }, [router]);

  if (!me || !look) return <main className="grid min-h-dvh place-items-center text-soft">…</main>;
  // 미리보기 표정: 오늘 마지막으로 남긴 마음(없으면 기쁨)
  const emotion = me.records.at(-1)?.emotion ?? "기뻐요";
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6" lang={lang}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/me" className="btn-sub min-h-10 shrink-0 whitespace-nowrap px-3 text-sm">← {tt("buddyBack")}</Link>
        <h1 className="font-display text-xl sm:text-3xl">{tt("buddyEdit")}</h1>
        <span className="hidden w-20 sm:block" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <section className="card flex flex-col items-center gap-2 self-start lg:sticky lg:top-5">
          <BuddyLazy emotion={emotion} look={look} cheer={cheer} size={280} className="size-56 sm:size-[280px]" />
          <p className="font-display text-2xl text-leaf">{saved ? tt("buddySaved") : look.name || tt("buddy")}</p>
        </section>

        <section className="card space-y-6">
          <div>
            <h2 className="mb-2 font-bold">{tt("buddyColor")}</h2>
            <div className="flex flex-wrap gap-2">
              {BUDDY_COLORS.map((c) => (
                <button
                  key={c || "mood"}
                  onClick={() => set({ color: c })}
                  aria-pressed={look.color === c}
                  aria-label={c || tt("buddyFollow")}
                  className={`grid size-14 place-items-center rounded-full border-4 text-[10px] font-bold leading-tight text-white ${look.color === c ? "border-ink" : "border-card"}`}
                  style={{ background: c || `conic-gradient(${Object.values(GROUPS).map((g) => g.color).join(",")}, ${GROUPS.joy.color})` }}
                >
                  {!c && <span className="rounded bg-ink/60 px-1">{tt("buddyFollow")}</span>}
                </button>
              ))}
            </div>
          </div>

          {PARTS.map(([part, title, options, cols]) => (
            <div key={part}>
              <h2 className="mb-2 font-bold">{tt(title)}</h2>
              <div className={`grid grid-cols-3 gap-2 ${cols}`}>
                {options.map((o) => (
                  <button key={o} onClick={() => set({ [part]: o })} aria-pressed={look[part] === o} className={chip(look[part] === o)}>
                    <BuddyFace look={{ ...look, [part]: o }} emotion={emotion} size={60} />
                    {tt((o === "none" ? "acc_none" : `${part}_${o}`) as UIKey)}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <label className="block">
            <span className="font-bold">{tt("buddyName")}</span>
            <input value={look.name} onChange={(e) => setLook({ ...look, name: e.target.value.slice(0, 8) })} className="field mt-2 text-lg" maxLength={8} />
            <span className="mt-1 block text-sm text-soft">{tt("buddyNameHint")}</span>
          </label>

          {err && <p className="text-alert">{err}</p>}
          <div className="flex justify-end">
            <button onClick={save} disabled={busy} className="btn-main px-8 text-lg">{tt("buddySave")}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
