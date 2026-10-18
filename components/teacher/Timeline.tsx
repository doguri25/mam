// 학생 한 명의 최근 2주: 날마다 아침·하교 전 두 칸
import { EmotionArt, EMOTION_COLOR } from "../Art";
import { addDays, label } from "@/lib/date";
import type { MoodRecord } from "@/lib/shared";

const LANG_KO: Record<string, string> = { en: "영어", zh: "중국어", vi: "베트남어", ja: "일본어" };
const TONE_COLOR: Record<string, string> = { "들떠 있음": "#f2a33a", 차분함: "#6b9e7a", 가라앉음: "#5a7fc0", 떨림: "#9b6bd3" };

function Cell({ r }: { r?: MoodRecord }) {
  if (!r) return <span className="text-line">—</span>;
  return (
    <span className="flex items-start gap-2">
      <EmotionArt name={r.emotion} size={30} className="shrink-0" />
      <span>
        <span className="font-bold" style={{ color: EMOTION_COLOR[r.emotion] }}>{r.emotion}</span>
        {r.word && <span className="font-bold" style={{ color: EMOTION_COLOR[r.emotion] }}> · {r.word}</span>}
        <span className="text-soft"> · {r.intensity} · {r.reason}</span>
        {r.risk && <span className="ml-1 rounded bg-alert px-1.5 text-xs text-white">위험 표현</span>}
        {r.tone && (
          <span className="ml-1 rounded-full px-1.5 text-xs text-white" style={{ background: TONE_COLOR[r.tone] ?? "#888" }} title={r.toneWhy}>
            🎙 {r.tone}{r.toneBy === "gemini" ? "·G" : ""}
          </span>
        )}
        {r.lang && r.lang !== "ko" && <span className="ml-1 rounded-full bg-paper px-1.5 text-xs">🌐 {LANG_KO[r.lang] ?? r.lang}</span>}
        {r.summaryKo && <span className="block text-sm">“{r.summaryKo}”</span>}
        {r.summary && <span className={`block text-sm ${r.summaryKo ? "text-soft" : ""}`}>{r.summaryKo ? `원문: ${r.summary}` : `“${r.summary}”`}</span>}
        {r.answer && <span className="block text-sm text-soft">↳ {r.question} — {r.answer}</span>}
      </span>
    </span>
  );
}

export default function Timeline({ records, today, days = 14 }: { records: MoodRecord[]; today: string; days?: number }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(today, -i)).filter((d) => records.some((r) => r.date === d));
  if (!dates.length) return <p className="text-soft">최근 {days}일 기록이 없어요.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-soft">
        <tr>
          <th className="w-24 py-1 font-normal">날짜</th>
          <th className="py-1 font-normal">☀️ 아침</th>
          <th className="py-1 font-normal">🌇 하교 전</th>
        </tr>
      </thead>
      <tbody>
        {dates.map((d) => (
          <tr key={d} className="border-t border-line align-top">
            <td className="py-2 text-soft">{label(d)}</td>
            <td className="py-2 pr-2"><Cell r={records.find((r) => r.date === d && r.slot === "am")} /></td>
            <td className="py-2"><Cell r={records.find((r) => r.date === d && r.slot === "pm")} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
