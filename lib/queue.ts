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
// 적었으면 true. 저장 공간이 없거나 막혀 있으면 담아 둘 수 없다(화면에서 다시 해 달라고 안내)
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

// 저장 한 번(누름 한 번)마다 새 이름(saveId): 저장은 됐는데 답만 잃어 담아 둔 기록을 다시 보내도, 담아 둔 것을 보내다 답을 잃어 또 보내도
// 서버가 같은 저장인 줄 안다(학생이 같은 카드를 정말 다시 남긴 것은 새 이름이라 새 기록). 영문·숫자·-_ 40자 안.
// randomUUID가 없는 오래된 태블릿(또는 https가 아닌 주소)에서는 시각 + 난수로.
const SAVE_ID = /^[A-Za-z0-9_-]{1,40}$/;
export function newSaveId(): string {
  const c = typeof crypto === "undefined" ? undefined : crypto;
  try {
    if (typeof c?.randomUUID === "function") return c.randomUUID();
  } catch {
    // 아래 방법으로
  }
  let r = "";
  try {
    if (typeof c?.getRandomValues === "function") r = Array.from(c.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // 아래 방법으로
  }
  if (!r) r = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${Date.now().toString(36)}-${r}`.slice(0, 40);
}
export const isSaveId = (x: unknown): x is string => typeof x === "string" && SAVE_ID.test(x);

export const rememberToken = (no: number, token: string) => write(TOKEN, { no, token });
export const forgetToken = () => {
  try {
    localStorage.removeItem(TOKEN);
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다
  }
};
export const pendingCount = () => read<Item[]>(PENDING, []).length;
// 아직 이 기기에 담겨 있는(보내지 못한) 기록의 saveId들: 화면이 「아직 서버에 없는 기록」을 그대로 보여 주게
export const pendingIds = () => new Set(read<Item[]>(PENDING, []).map((x) => x.record?.saveId).filter(isSaveId));

// 담아 둔 기록이 줄었으면(서버에 보냈거나, 받지 않아 버렸으면) 알린다: 열려 있는 화면(달력·마음 화면 등)이 기록을 다시 읽게
const SENT = "mb-queue-sent";
export function onQueueSent(f: () => void) {
  window.addEventListener(SENT, f);
  return () => window.removeEventListener(SENT, f);
}

// 정말 담아 두었으면 true(그 학생의 표가 없거나 기기에 적지 못하면 false → 화면이 「저장됐어요」라고 하지 않게)
// 기록에 saveId가 없으면 여기서 붙인다(담아 둔 기록은 몇 번을 다시 보내도 같은 이름)
export function queueRecord(no: number, record: Record<string, unknown>) {
  const t = read<{ no: number; token: string } | null>(TOKEN, null);
  if (!t || t.no !== no) return false;
  const rec = isSaveId(record.saveId) ? record : { ...record, saveId: newSaveId() };
  return write(PENDING, [...read<Item[]>(PENDING, []), { token: t.token, record: rec, at: Date.now() }]);
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
  if (sent || dropped) window.dispatchEvent(new Event(SENT));
  return { sent, dropped };
}
