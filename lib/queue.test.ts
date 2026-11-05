// 기기에 담아 두기: 저장마다 새 saveId, 담아 둔 기록은 몇 번을 다시 보내도(답을 잃어도) 같은 saveId
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { flushQueue, isSaveId, newSaveId, onQueueSent, pendingCount, pendingIds, queueRecord, rememberToken } from "./queue.ts";

const g = globalThis as Record<string, unknown>;
const realFetch = globalThis.fetch;
const realCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto")!;
beforeEach(() => {
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  g.window = new EventTarget();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.defineProperty(globalThis, "crypto", realCrypto);
  delete g.localStorage;
  delete g.window;
});

test("saveId: 저장마다 새 이름, 영문·숫자·-_ 40자 안(randomUUID·난수가 없는 오래된 태블릿에서도)", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 200; i++) ids.add(newSaveId());
  assert.equal(ids.size, 200);
  for (const id of ids) assert.ok(isSaveId(id), id);
  for (const c of [{ getRandomValues: realCrypto.get!.call(globalThis).getRandomValues.bind(realCrypto.get!.call(globalThis)) }, undefined]) {
    Object.defineProperty(globalThis, "crypto", { value: c, configurable: true });
    const a = newSaveId(), b = newSaveId();
    assert.ok(isSaveId(a) && isSaveId(b) && a !== b, `${a} ${b}`);
  }
  assert.ok(!isSaveId("") && !isSaveId("a b") && !isSaveId("x".repeat(41)) && !isSaveId(3));
});

test("담아 둔 기록: 받은 saveId 그대로(없으면 붙임), 답을 잃어 남은 기록은 다음에도 같은 saveId로 보내고, 보내면 알린다", async () => {
  rememberToken(3, "tok3");
  assert.equal(queueRecord(4, { emotion: "기뻐요" }), false); // 다른 학생의 표
  assert.ok(queueRecord(3, { emotion: "기뻐요", saveId: "abc-1" }));
  assert.ok(queueRecord(3, { emotion: "슬퍼요" }));
  const ids = [...pendingIds()];
  assert.equal(ids.length, 2);
  assert.equal(ids[0], "abc-1");
  assert.ok(isSaveId(ids[1]));

  const seen: string[] = [];
  let ok = false;
  globalThis.fetch = (async (_u: string, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body));
    assert.equal(b.action, "saveQueued");
    seen.push(b.record.saveId);
    if (!ok) throw new TypeError("Failed to fetch"); // 서버에는 갔는데 답만 잃음
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  let told = 0;
  const off = onQueueSent(() => told++);
  assert.deepEqual(await flushQueue(), { sent: 0, dropped: 0 });
  assert.equal(pendingCount(), 2);
  assert.deepEqual([...pendingIds()], ids);
  assert.equal(told, 0);
  ok = true;
  assert.deepEqual(await flushQueue(), { sent: 2, dropped: 0 });
  assert.deepEqual(seen, [...ids, ...ids]); // 다시 보내도 같은 이름
  assert.equal(pendingCount(), 0);
  assert.equal(told, 1);

  // 서버가 받지 않아 버린 기록도 「담아 둔 기록이 줄었다」고 알린다(화면이 그 기록을 붙들고 있지 않게)
  queueRecord(3, { emotion: "화나요" });
  globalThis.fetch = (async () => new Response("{}", { status: 410 })) as typeof fetch;
  assert.deepEqual(await flushQueue(), { sent: 0, dropped: 1 });
  assert.equal(told, 2);
  off();
});
