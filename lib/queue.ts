"use client";
// 와이파이가 잠깐 끊겼을 때: 학생 기록을 이 기기에 담아 두었다가 연결되면 보낸다.
// 기록마다 그 학생의 「그날 표(qtoken)」를 함께 담아, 다음 친구가 들어온 뒤에도 원래 학생 기록으로 저장된다.
const PENDING = "mb_pending";
const TOKEN = "mb_qtoken";
type Item = { token: string; record: Record<string, unknown>; at: number };

const read = <T,>(key: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return d;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // 저장 공간이 없으면 담아 둘 수 없다(화면에서 다시 해 달라고 안내)
  }
};

export const rememberToken = (no: number, token: string) => write(TOKEN, { no, token });
export const pendingCount = () => read<Item[]>(PENDING, []).length;

// 담아 두었으면 true(그 학생의 표가 없으면 담지 못함)
export function queueRecord(no: number, record: Record<string, unknown>) {
  const t = read<{ no: number; token: string } | null>(TOKEN, null);
  if (!t || t.no !== no) return false;
  write(PENDING, [...read<Item[]>(PENDING, []), { token: t.token, record, at: Date.now() }]);
  return true;
}

// 보낸 개수를 돌려준다. 서버가 받지 않는 기록(날짜가 지남 등)은 버리고, 아직 끊겨 있으면 남겨 둔다.
export async function flushQueue() {
  const items = read<Item[]>(PENDING, []);
  if (!items.length) return 0;
  const left: Item[] = [];
  let sent = 0;
  for (const it of items) {
    try {
      const res = await fetch("/api/student", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "saveQueued", qtoken: it.token, record: it.record }),
      });
      if (res.ok) sent++;
      else if (res.status >= 500) left.push(it);
    } catch {
      left.push(it);
    }
  }
  write(PENDING, left);
  return sent;
}
