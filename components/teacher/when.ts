// 교사 화면 날짜 도우미. createdAt 같은 시각은 UTC(…Z)로 저장되므로 .slice(0, 10)으로 자르면
// 한국 시간 아침 9시 전에 쓴 글이 전날로 보인다. 늘 한국 날짜로 바꿔서 쓴다.
import { today } from "@/lib/date";

// 시각(ISO) → 한국 날짜 YYYY-MM-DD
export function kday(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : today(d);
}
