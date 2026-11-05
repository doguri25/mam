// 「바로 살펴봐 주세요」에 모아 보여 줄 위험 표현: 마음 기록 · 마치지 않은 기록 · 한 주 돌아보기 · 허락 기다리는 쪽지.
// 마음 지도 알림과 메뉴의 빨간 수가 같은 목록을 쓴다.
// seen: 「살펴봤어요」 때 서버에 알리는 「선생님이 본 판」 — 그사이 학생이 고쳐 썼으면 서버가 닫지 않는다(409).
// 교사·학생 API(조치 기록에 남길 글 고르기)와 node 시험(lib/alerts.test.ts)도 이 파일을 쓴다 — 확장자까지 적은 상대 경로로(node가 바로 찾게)
import { matchRisk } from "../../lib/rules.ts";
import type { Letter, MoodRecord, PrevVersion, Reflect, RiskAction, RiskDraft } from "../../lib/shared.ts";
import type { OverviewRaw } from "./types.ts";
import { kday, ktime } from "./when.ts";

export type RiskAlert =
  | { kind: "record"; id: string; no: number; date: string; slot: "am" | "pm"; at: string; seen: string; rec: MoodRecord }
  | { kind: "draft"; id: string; no: number; date: string; slot: "am" | "pm"; at: string; seen: string; text: string; hits: string[]; draft: RiskDraft }
  | { kind: "reflect"; id: string; no: number; date: string; at: string; seen: string; text: string; lang?: string; ref: Reflect }
  | { kind: "letter"; id: string; no: number; to: number; date: string; at: string; seen: string; text: string; letter: Letter };

// 마치지 않은 기록의 글: 한국어가 아니면 한국어 정리와 원문을 함께
export const draftText = (d: Pick<RiskDraft, "text" | "summaryKo">) => (d.summaryKo ? `${d.summaryKo} (원문: ${d.text})` : d.text);
// 마음 기록의 「살펴봤어요」 판: 위험 내용이 마지막으로 바뀐 때(없으면 만든 때)
export const recordSeen = (r: MoodRecord) => r.riskAt ?? r.createdAt;

export function riskAlerts(data: Pick<OverviewRaw, "records" | "reflects" | "letters"> & { riskDrafts?: OverviewRaw["riskDrafts"] }): RiskAlert[] {
  const out: RiskAlert[] = [];
  for (const r of data.records)
    if (r.risk && !r.riskChecked) out.push({ kind: "record", id: r.id, no: r.no, date: r.date, slot: r.slot, at: r.createdAt, seen: recordSeen(r), rec: r });
  // 마치지 않은 위험 표현: 그 칸을 저장하면 서버가 지우므로, 남아 있으면 그 칸에 앞서 남긴 기록이 있어도 따로 보여 준다
  // (서버는 살펴본 것도 최근 것은 보내 준다 — 주간 리포트·누적 기록용. 알림에는 살펴보지 않은 것만)
  for (const d of data.riskDrafts ?? [])
    if (!d.checked) out.push({ kind: "draft", id: `draft:${d.id}`, no: d.no, date: d.date, slot: d.slot, at: d.at, seen: d.at, text: draftText(d), hits: d.hits, draft: d });
  for (const x of data.reflects)
    if (x.risk && !x.riskChecked) out.push({ kind: "reflect", id: `reflect:${x.id}`, no: x.no, date: kday(x.createdAt), at: x.createdAt, seen: x.createdAt, text: x.text, lang: x.lang, ref: x });
  // 위험 표현 쪽지: 허락을 기다리는 동안, 선생님이 「살펴보고 적기」로 살펴보기 전까지
  for (const l of data.letters)
    if (l.risk && l.status === "wait" && !l.riskChecked)
      out.push({ kind: "letter", id: `letter:${l.id}`, no: l.from, to: l.to, date: kday(l.createdAt), at: l.createdAt, seen: l.createdAt, text: l.text, letter: l });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export const riskAlertCount = (data: Parameters<typeof riskAlerts>[0]) => riskAlerts(data).length;

// 이 기록이 한 번이라도 위험 표현이었나(지금 글 또는 고치기 전 글)
export const everRisk = (r: MoodRecord) => r.risk || !!r.prev?.some((p) => p.risk);

type Ver = Pick<PrevVersion, "summary" | "summaryKo" | "answer" | "riskHits" | "createdAt">;
// 한 판의 글: 한 줄과 되묻기 답은 「 / 」로
const verText = (v: Ver) => [v.summaryKo ? `${v.summaryKo} (원문: ${v.summary})` : v.summary, v.answer].filter(Boolean).join(" / ");

// 위험 표현이 있던 글 한 판: 글·그 글의 걸린 말·쓴 때·지금 글인지(아니면 고치기 전 글)
export interface RiskPart { text: string; hits: string[]; at: string; now: boolean }
// 판이 둘 이상이면 「먼저 쓴 글」「다시 쓴 글」로 나눠 보인다(한 판 안의 「 / 」와 헷갈리지 않게). 한 판이면 고치기 전 글일 때만 이름표.
export const partLabel = (i: number, n: number, now: boolean) => (n > 1 ? (i === 0 ? "먼저 쓴 글" : "다시 쓴 글") : now ? "" : "고치기 전 글");
// 여러 판을 한 줄 글로(조치 기록에 남기는 글·CSV): 판 사이는 「 ‖ 」, 판마다 이름표와 때. 한 판이면 그 글 그대로(예전 조치 기록 글과 같게)
export const PART_SEP = " ‖ ";
export function partsText(parts: RiskPart[]): string {
  if (parts.length < 2) return parts[0]?.text ?? "";
  return parts.map((p, i) => `[${partLabel(i, parts.length, p.now)}${ktime(p.at) ? ` ${ktime(p.at)}` : ""}] ${p.text}`).join(PART_SEP);
}
// 조치 기록에 남은 한 줄 글을 다시 판마다 나눈다(누적 기록에 한 줄씩 보이려고)
export const splitParts = (text: string) => text.split(PART_SEP);
const partOf = (r: MoodRecord, v: MoodRecord | PrevVersion): RiskPart => ({ text: verText(v), hits: v.riskHits ?? [], at: v.createdAt, now: v === r });

// 위험 표현이 있던 글: 지금 글이 아니면 고치기 전 글 중 위험했던 것(가장 최근).
// 알림을 연 판을 따로 적어 둔 기록(riskSrc — 끊겼다가 늦게 온 앞 기록이 살펴본 알림을 다시 열 때 등)은 그 판들의 글(만든 차례대로).
// 화면 알림·누적 기록과 서버가 조치 기록에 남기는 글이 이 함수 하나를 쓴다(선생님이 본 글 = 남는 글).
// parts: 판마다 글·걸린 말(판마다 따로 — 저장은 그 글의 걸린 말만 둔다) · hits: 그 판들의 걸린 말을 모은 것
export function riskySource(r: MoodRecord): { text: string; hits: string[]; prev: PrevVersion | null; parts: RiskPart[] } {
  if (r.riskSrc?.length) {
    const vs: (MoodRecord | PrevVersion)[] = [...(r.prev ?? []), r].filter((v) => r.riskSrc!.includes(v.createdAt) && (v === r ? !!(r.riskSelf ?? r.risk) : v.risk));
    if (vs.length) {
      const last = vs.at(-1)!;
      const parts = vs.map((v) => partOf(r, v));
      return { text: partsText(parts), hits: [...new Set(vs.flatMap((v) => v.riskHits ?? []))], prev: last === r ? null : (last as PrevVersion), parts };
    }
  }
  const now = (r.riskSelf ?? r.risk) ? r : null;
  const p = now ? null : [...(r.prev ?? [])].reverse().find((x) => x.risk) ?? null;
  const src = now ?? p;
  const hits = src?.riskHits ?? r.riskHits;
  return { text: src ? verText(src) : "", hits, prev: p, parts: src ? [{ ...partOf(r, src), hits }] : [] };
}
// 그 칸(같은 날 같은 때)에 위험 표현이 있던 글 모두(만든 차례대로): 누적 기록에서 — 살펴본 뒤 순한 글로 다시 남겨
// 알림이 가리키던 판(riskSrc)이 지워져도 그날 위험했던 글을 하나만 보이지 않게
export function riskyParts(r: MoodRecord): RiskPart[] {
  return [...(r.prev ?? []).filter((p) => p.risk), ...((r.riskSelf ?? r.risk) ? [r] : [])].map((v) => partOf(r, v));
}
// 알림이 가리키는 글의 판(createdAt): riskySource가 고르는 것과 같게 — 저장할 때 열린 알림의 글을 이어 가리키려고
export function riskSrcOf(r: MoodRecord): string[] {
  if (r.riskSrc?.length) return r.riskSrc;
  const at = (r.riskSelf ?? r.risk) ? r.createdAt : [...(r.prev ?? [])].reverse().find((x) => x.risk)?.createdAt;
  return at ? [at] : [];
}

// 한 주 돌아보기도 같은 방식: 지금 글에 위험 표현이 없고(riskSelf가 false) 고쳐 쓰기 전 글에 있었으면 그 글(가장 최근)을 보인다.
// riskSelf가 없는 예전 글은 고쳐 쓰기 전 글에 위험 표시가 있을 때만 지금 글을 위험 단어로 다시 견준다(돌아보기는 단어로만 찾으므로).
export const reflectEverRisk = (x: Reflect) => !!x.risk || !!x.prev?.some((p) => p.risk);
export function reflectSource(x: Reflect, words: string[] = []): { text: string; prev: { text: string; createdAt: string } | null } {
  const earlier = [...(x.prev ?? [])].reverse().find((p) => p.risk) ?? null;
  const self = x.riskSelf ?? (earlier ? matchRisk(x.text, words).length > 0 : !!x.risk);
  if (self || !earlier) return { text: x.text, prev: null };
  return { text: earlier.text, prev: earlier };
}

// 조치 기록의 recordId 앞머리로 무엇을 살펴봤는지
export type RiskKind = NonNullable<RiskAction["kind"]>;
export function kindOfId(id: string): RiskKind {
  return id.startsWith("draft:") ? "draft" : id.startsWith("reflect:") ? "reflect" : id.startsWith("letter:") ? "letter" : "record";
}
export const KIND_KO: Record<RiskKind, string> = { record: "마음 기록", draft: "마치지 않은 기록", reflect: "한 주 돌아보기", letter: "공감 쪽지" };
