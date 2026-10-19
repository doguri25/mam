// 학생이 쓴 「한 주 돌아보기」와 마음 친구의 답(이번 주·지난주). 위험 표현이 있으면 빨갛게.
import { label } from "@/lib/date";
import type { Reflect } from "@/lib/shared";

export default function ReflectBox({ reflects, no }: { reflects: Reflect[]; no: number }) {
  const mine = reflects.filter((r) => r.no === no).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  if (!mine.length) return null;
  return (
    <div className="space-y-2">
      {mine.map((r) => (
        <div key={r.id} className={`rounded-2xl p-3 text-sm ${r.risk ? "bg-alert-soft" : "bg-paper"}`}>
          <p className="text-xs font-bold text-soft">
            🗓️ 한 주 돌아보기 · {label(r.weekStart)} 주{r.lang && r.lang !== "ko" && ` · 🌐 ${r.lang}`}
            {r.risk && <span className="ml-1 rounded bg-alert px-1.5 text-white">위험 표현</span>}
          </p>
          <p className="mt-1 text-base">“{r.text}”</p>
          <p className="mt-1 text-soft">↳ 마음 친구: {r.reply}</p>
        </div>
      ))}
    </div>
  );
}
