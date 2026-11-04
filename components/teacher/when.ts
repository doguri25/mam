// 교사 화면 날짜 도우미. createdAt 같은 시각은 UTC(…Z)로 저장되므로 .slice(0, 10)으로 자르면
// 한국 시간 아침 9시 전에 쓴 글이 전날로 보인다. 늘 한국 날짜로 바꿔서 쓴다.
import { monday, today } from "@/lib/date";

// 시각(ISO) → 한국 날짜 YYYY-MM-DD
export function kday(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : today(d);
}

// 「먼저 살펴볼 학생」의 「살펴봤어요」: 이번 주(월요일부터) 한 번 누르면 그 주 내내 남는다.
// 열쇠는 `${번호}_${그 주 월요일}`. 예전에는 `${번호}_${오늘-6일}`이라 날마다 풀렸으므로,
// 열쇠 모양이 달라도 이번 주 월요일 뒤에 누른 표시(값 = 누른 시각)면 살펴본 것으로 본다.
export const flagKey = (no: number, date: string) => `${no}_${monday(date)}`;
export function flagChecked(checks: Record<string, string>, no: number, date: string): string | undefined {
  const mon = monday(date);
  return checks[flagKey(no, date)] ?? Object.entries(checks).find(([k, at]) => k.startsWith(`${no}_`) && kday(at) >= mon)?.[1];
}
