// 한 학생을 보는 곳(학생 고르기·최근 2주·응원·의견서·누적 위험 표현)에는 지금 그 번호 학생의 것만 보인다.
// 이 번호를 새 학생에게 줬으면(since) 그 앞에 이 번호로 남은 것은 앞 학생 것 — 반 전체를 보는 곳(위험 표현 알림·쪽지 목록·CSV)에
// 「앞 학생 ○○」으로 남고, 여기에는 넣지 않는다.
import { ownBy } from "../../lib/shared.ts";
import type { RiskSources } from "./RiskActions";
import type { Overview } from "./types";

type Students = Pick<Overview, "students">;

export const ownerOf = (data: Students, no: number) => {
  const st = data.students.find((s) => s.no === no);
  return (at?: string) => ownBy(st, at);
};

export function mine<T>(data: Students, no: number, xs: T[], noOf: (x: T) => number, at: (x: T) => string | undefined): T[] {
  const own = ownerOf(data, no);
  return xs.filter((x) => noOf(x) === no && own(at(x)));
}

export const myRecords = (data: Pick<Overview, "students" | "records">, no: number) => mine(data, no, data.records, (r) => r.no, (r) => r.createdAt);
export const myReflects = (data: Pick<Overview, "students" | "reflects">, no: number) => mine(data, no, data.reflects, (r) => r.no, (r) => r.createdAt);
export const myNotes = (data: Pick<Overview, "students" | "notes">, no: number) => mine(data, no, data.notes, (n) => n.no, (n) => n.createdAt);

// 한 학생의 위험 표현(마음 기록·마치지 않은 기록·돌아보기·보낸 쪽지)과 조치 기록.
// 조치 기록은 가리키는 글이 지금 학생 것일 때만(글이 이 화면에 없으면 그 기록 날짜로 가린다)
export function riskSourcesOf(data: Overview, no: number): RiskSources {
  const own = ownerOf(data, no);
  const records = data.records.filter((r) => r.no === no);
  const drafts = (data.riskDrafts ?? []).filter((d) => d.no === no);
  const reflects = data.reflects.filter((x) => x.no === no);
  const letters = data.letters.filter((l) => l.from === no);
  const r2 = records.filter((r) => own(r.createdAt));
  const d2 = drafts.filter((d) => own(d.at));
  const x2 = reflects.filter((x) => own(x.createdAt));
  const l2 = letters.filter((l) => own(l.createdAt));
  const ids = new Set([...r2.map((r) => r.id), ...d2.map((d) => `draft:${d.id}`), ...x2.map((x) => `reflect:${x.id}`), ...l2.map((l) => `letter:${l.id}`)]);
  const known = new Set([...records.map((r) => r.id), ...drafts.map((d) => `draft:${d.id}`), ...reflects.map((x) => `reflect:${x.id}`), ...letters.map((l) => `letter:${l.id}`)]);
  const actions = data.riskActions.filter((a) => a.no === no && (ids.has(a.recordId) || (!known.has(a.recordId) && own(a.recordDate || a.date))));
  return { records: r2, actions, drafts: d2, reflects: x2, letters: l2, words: data.settings.riskWords };
}
