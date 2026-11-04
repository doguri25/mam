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
export const forgetToken = () => {
  try {
    localStorage.removeItem(TOKEN);
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다
  }
};
export const pendingCount = () => read<Item[]>(PENDING, []).length;

// 담아 두었으면 true(그 학생의 표가 없으면 담지 못함)
export function queueRecord(no: number, record: Record<string, unknown>) {
  const t = read<{ no: number; token: string } | null>(TOKEN, null);
  if (!t || t.no !== no) return false;
  write(PENDING, [...read<Item[]>(PENDING, []), { token: t.token, record, at: Date.now() }]);
  return true;
}

// 보낸 개수와 받지 못한 개수를 돌려준다. 서버가 받지 않는 기록(사흘이 지남·코드가 바뀜)은 버리고, 아직 끊겨 있으면 남겨 둔다.
// 담아 둔 날짜로 저장되므로 다음 날 연결돼도 보낼 수 있다.
let flushing: Promise<{ sent: number; dropped: number }> | null = null;
export function flushQueue() {
  // 연결이 돌아온 순간과 화면에 들어온 순간이 겹쳐도 한 번만 보낸다(같은 기록을 두 번 보내지 않게)
  flushing ??= send().finally(() => { flushing = null; });
  return flushing;
}
async function send() {
  const items = read<Item[]>(PENDING, []);
  if (!items.length) return { sent: 0, dropped: 0 };
  const left: Item[] = [];
  let sent = 0, dropped = 0;
  for (const it of items) {
    try {
      const res = await fetch("/api/student", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "saveQueued", qtoken: it.token, record: it.record, madeAt: new Date(it.at).toISOString() }),
      });
      if (res.ok) sent++;
      else if (res.status >= 500 || res.status === 429) left.push(it);
      else dropped++;
    } catch {
      left.push(it);
    }
  }
  // 보내는 사이에 새로 담긴 기록은 남긴다
  const added = read<Item[]>(PENDING, []).filter((x) => !items.some((y) => y.at === x.at && y.token === x.token));
  write(PENDING, [...left, ...added]);
  return { sent, dropped };
}
