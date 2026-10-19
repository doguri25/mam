// 날짜는 모두 한국 시간 YYYY-MM-DD 글자로 다룬다(서버가 UTC여도 같은 날짜)
import type { Slot } from "./shared.ts";

const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" });

export function today(now = new Date()) {
  return fmt.format(now);
}

export function slotNow(now = new Date()): Slot {
  return Number(hourFmt.format(now)) < 12 ? "am" : "pm";
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: string) {
  return "일월화수목금토"[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function label(date: string) {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 (${weekday(date)})`;
}

// 그 주 월요일(학교 한 주의 시작)
export function monday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  return addDays(date, day === 0 ? -6 : 1 - day);
}
