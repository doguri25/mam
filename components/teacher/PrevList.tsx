// 고치기 전 기록: 학생이 같은 칸(아침·하교 전)에 다시 남기면 앞 기록은 record.prev에 남는다(오래된 것부터, 선생님만 봄).
// 평소에는 「고치기 전 기록 N개」만 작게 보이고, 누르면 시각·감정 카드·한 줄·답·위험 표현이 펼쳐진다.
import { EmotionArt, EMOTION_COLOR } from "../Art";
import { ktime } from "./when";
import type { PrevVersion } from "@/lib/shared";

export default function PrevList({ prev, now, className = "" }: { prev?: PrevVersion[]; now?: string; className?: string }) {
  if (!prev?.length) return null;
  const risky = prev.some((p) => p.risk);
  return (
    <details className={`group mt-1 text-xs ${className}`}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-line bg-paper px-2 py-0.5 font-bold text-soft hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">▸</span>
        고치기 전 기록 {prev.length}개
        {risky && <span className="rounded bg-alert px-1 font-normal text-white">위험 표현</span>}
      </summary>
      <ol className="mt-1.5 space-y-1.5 border-l-2 border-line pl-2.5">
        {prev.map((p, i) => {
          const said = p.summaryKo || p.summary;
          return (
            <li key={`${p.createdAt}-${i}`} className="flex items-start gap-1.5">
              <EmotionArt name={p.emotion} size={22} className="shrink-0" />
              <span className="min-w-0">
                {ktime(p.createdAt) && <span className="mr-1 tabular-nums text-soft">{ktime(p.createdAt)}</span>}
                <b style={{ color: EMOTION_COLOR[p.emotion] }}>{p.emotion}{p.word && ` · ${p.word}`}</b>
                <span className="text-soft"> · {p.intensity} · {p.reason}</span>
                {p.risk && <span className="ml-1 whitespace-nowrap rounded bg-alert px-1.5 text-white">위험 표현</span>}
                {said && <span className="block">“{said}”{p.summaryKo && p.summary && p.summary !== p.summaryKo && <span className="text-soft"> · 원문: {p.summary}</span>}</span>}
                {p.answer && <span className="block text-soft">↳ {p.question} — {p.answer}</span>}
                {p.risk && <span className="block text-soft">{p.riskHits?.length ? `걸린 말: ${p.riskHits.join(", ")}` : "AI가 위험 내용으로 판단"}</span>}
              </span>
            </li>
          );
        })}
        {now && ktime(now) && <li className="text-soft">→ 지금 기록 <span className="tabular-nums">{ktime(now)}</span></li>}
      </ol>
    </details>
  );
}
