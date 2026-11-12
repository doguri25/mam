"use client";
// 선생님 도우미 화면 조각: AI 답 글(간단한 목록·굵은 글씨만), 위기 대응 안내 카드
import { Fragment, type ReactNode } from "react";
import Doodle from "@/components/Doodle";
import { CHECKED, crisisById, type CrisisId } from "@/lib/crisis";
import type { Contact } from "@/lib/assist";

// **굵게**만 살린다(HTML은 그대로 글자로)
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>,
  );
}

// 줄마다: 「- 」「• 」는 점 목록, 「1. 」은 번호 목록, 「#」 머리는 굵은 줄, 나머지는 문단
export function Md({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={out.length} className={`my-1 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"}`}>
        {list.items.map((t, i) => <li key={i}>{inline(t)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const head = /^#{1,4}\s+(.*)$/.exec(line);
    out.push(head ? <p key={out.length} className="mt-2 font-bold">{inline(head[1])}</p> : <p key={out.length} className="my-1">{inline(line)}</p>);
  }
  flush();
  return <div className="break-words leading-relaxed">{out}</div>;
}

const TONE: Record<CrisisId, { icon: "siren" | "warning" | "heart"; ring: string; bg: string }> = {
  violence: { icon: "siren", ring: "border-[#f0b4ae]", bg: "bg-[#fff4f2]" },
  abuse: { icon: "warning", ring: "border-[#f3cf8a]", bg: "bg-[#fff8e8]" },
  suicide: { icon: "heart", ring: "border-[#c9b8ef]", bg: "bg-[#f6f2ff]" },
};

// 고정 안내(AI 없이). compact면 처음 할 일과 연락처만 먼저 보이고 단계는 펼쳐서
export function CrisisCard({ id, contacts = [], compact = false }: { id: CrisisId; contacts?: Contact[]; compact?: boolean }) {
  const g = crisisById(id);
  if (!g) return null;
  const tone = TONE[id];
  const steps = (
    <>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-white/70 p-3"><p className="font-bold text-leaf">이렇게 말해요</p><ul className="mt-1 space-y-0.5">{g.say.map((s) => <li key={s}>“{s}”</li>)}</ul></div>
        <div className="rounded-xl bg-white/70 p-3"><p className="font-bold text-alert">이 말은 피해요</p><ul className="mt-1 space-y-0.5">{g.avoid.map((s) => <li key={s}>“{s}”</li>)}</ul></div>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-soft">{g.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      <p className="mt-2 text-xs text-soft">출처: {g.src.join(" · ")} (기준 {CHECKED}). 실제 사안은 학교 계획과 교육청 최신 지침을 함께 따라 주세요.</p>
    </>
  );
  return (
    <section className={`rounded-2xl border-2 ${tone.ring} ${tone.bg} p-4`} aria-label={g.title}>
      <h4 className="flex items-center gap-2 font-display text-lg"><Doodle name={tone.icon} size={24} />{g.title}</h4>
      <p className="mt-1 font-bold">{g.first}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {g.calls.map((c) => (
          /^\d/.test(c.num) ? (
            <a key={c.label} href={`tel:${c.num.split(/[\s·]/)[0]}`} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-bold">
              <Doodle name="phone" size={18} />{c.label} {c.num}{c.note ? <span className="font-normal text-soft">({c.note})</span> : null}
            </a>
          ) : (
            <span key={c.label} className="inline-flex min-h-10 items-center rounded-full border border-dashed border-line bg-white/60 px-3 text-sm text-soft">{c.label}: {c.num}</span>
          )
        ))}
        {contacts.map((c) => (
          <a key={c.label} href={`tel:${c.num.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-leaf bg-leaf-soft px-3 text-sm font-bold">
            <Doodle name="phone" size={18} />{c.label} {c.num}
          </a>
        ))}
      </div>
      {compact ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-bold text-leaf">단계별 안내 펼치기</summary>
          {steps}
        </details>
      ) : steps}
    </section>
  );
}
