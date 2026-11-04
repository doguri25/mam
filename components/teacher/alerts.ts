// 「바로 살펴봐 주세요」에 모아 보여 줄 위험 표현: 마음 기록 · 마치지 않은 기록 · 한 주 돌아보기 · 허락 기다리는 쪽지.
// 마음 지도 알림과 메뉴의 빨간 수가 같은 목록을 쓴다.
import type { MoodRecord, PrevVersion } from "@/lib/shared";
import type { OverviewRaw } from "./types";
import { kday } from "./when";

export type RiskAlert =
  | { kind: "record"; id: string; no: number; date: string; slot: "am" | "pm"; at: string; rec: MoodRecord }
  | { kind: "draft"; id: string; no: number; date: string; slot: "am" | "pm"; at: string; text: string; hits: string[] }
  | { kind: "reflect"; id: string; no: number; date: string; at: string; text: string; lang?: string }
  | { kind: "letter"; id: string; no: number; to: number; date: string; at: string; text: string };

export function riskAlerts(data: Pick<OverviewRaw, "records" | "reflects" | "letters"> & { riskDrafts?: OverviewRaw["riskDrafts"] }): RiskAlert[] {
  const out: RiskAlert[] = [];
  for (const r of data.records) if (r.risk && !r.riskChecked) out.push({ kind: "record", id: r.id, no: r.no, date: r.date, slot: r.slot, at: r.createdAt, rec: r });
  // 마치지 않은 위험 표현: 그 칸을 저장하면 서버가 지우므로, 남아 있으면 그 칸에 앞서 남긴 기록이 있어도 따로 보여 준다
  for (const d of data.riskDrafts ?? [])
    if (!d.checked) out.push({ kind: "draft", id: `draft:${d.id}`, no: d.no, date: d.date, slot: d.slot, at: d.at, text: d.summaryKo ? `${d.summaryKo} (원문: ${d.text})` : d.text, hits: d.hits });
  for (const x of data.reflects)
    if (x.risk && !x.riskChecked) out.push({ kind: "reflect", id: `reflect:${x.id}`, no: x.no, date: kday(x.createdAt), at: x.createdAt, text: x.text, lang: x.lang });
  for (const l of data.letters)
    if (l.risk && l.status === "wait") out.push({ kind: "letter", id: l.id, no: l.from, to: l.to, date: kday(l.createdAt), at: l.createdAt, text: l.text });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export const riskAlertCount = (data: Parameters<typeof riskAlerts>[0]) => riskAlerts(data).length;

// 이 기록이 한 번이라도 위험 표현이었나(지금 글 또는 고치기 전 글)
export const everRisk = (r: MoodRecord) => r.risk || !!r.prev?.some((p) => p.risk);

// 위험 표현이 있던 글: 지금 글이 아니면 고치기 전 글 중 위험했던 것(가장 최근)
export function riskySource(r: MoodRecord): { text: string; hits: string[]; prev: PrevVersion | null } {
  const now = (r.riskSelf ?? r.risk) ? r : null;
  const p = now ? null : [...(r.prev ?? [])].reverse().find((x) => x.risk) ?? null;
  const src = now ?? p;
  const text = src ? [src.summaryKo ? `${src.summaryKo} (원문: ${src.summary})` : src.summary, src.answer].filter(Boolean).join(" / ") : "";
  return { text, hits: src?.riskHits ?? r.riskHits, prev: p };
}
