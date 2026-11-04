// 기록 보관 기한: 기한이 지난 학생 기록은 선생님 화면에 「정리할 기록」으로 알리고, 선생님이 내려받은 뒤 눌러 지운다(자동으로 지우지 않음).
// year = 학년도가 끝나면(3월 1일부터 지난 학년도 기록이 정리 대상) · 12m·24m = 그만큼 지난 기록.
export const RETENTIONS = ["year", "12m", "24m"] as const;
export type Retention = (typeof RETENTIONS)[number];
export const RETENTION_KO: Record<Retention, string> = {
  year: "학년도가 끝나면 (다음 해 3월 1일부터)",
  "12m": "남긴 날부터 1년이 지나면",
  "24m": "남긴 날부터 2년이 지나면",
};
// 보호자 안내문에 쓰는 짧은 말
export const RETENTION_LETTER: Record<Retention, string> = {
  year: "이번 학년도가 끝날 때까지(다음 해 2월 말까지)",
  "12m": "남긴 날부터 1년 동안",
  "24m": "남긴 날부터 2년 동안",
};
export const isRetention = (v: unknown): v is Retention => RETENTIONS.includes(v as Retention);

// 이 날짜(YYYY-MM-DD)보다 앞선 기록이 정리 대상
export function cutoffOf(ret: Retention, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  if (ret === "year") return `${m >= 3 ? y : y - 1}-03-01`;
  const back = ret === "12m" ? 1 : 2;
  // 2월 29일 → 평년이면 2월 28일
  const day = Math.min(d, new Date(Date.UTC(y - back, m, 0)).getUTCDate());
  return `${y - back}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface PurgeLog { at: string; cutoff: string; counts: Record<string, number> }
// 정리할 것들의 이름(선생님 화면에 보이는 순서)
export const PURGE_KO: Record<string, string> = {
  records: "마음 기록", cheers: "응원 한마디", notes: "면담 메모", letters: "공감 쪽지", reflects: "한 주 돌아보기",
  sheets: "활동지 피드백", self: "학생 자기진단 답", risk: "위험 표현 조치 기록",
};
