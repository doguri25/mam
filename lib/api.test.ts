// 화면 API 도우미: 늦은 답은 timeout으로, 화면이 그만두면 aborted로, 끊김·서버 오류는 예전처럼
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { api, isAborted, isTimeout } from "./api.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// 그만두라는 신호가 올 때까지 답하지 않는 서버(마음 친구가 오래 생각함)
const hang = () => {
  globalThis.fetch = ((_url: string, init?: RequestInit) => new Promise((_, reject) => {
    const no = () => reject(new DOMException("aborted", "AbortError"));
    if (init?.signal?.aborted) no();
    init?.signal?.addEventListener("abort", no);
  })) as typeof fetch;
};
const reply = (status: number, body: unknown) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as typeof fetch;
};

test("답이 너무 늦으면 timeout 오류(끊김·그만둠과 다르게, status 없이)", async () => {
  hang();
  const t0 = Date.now();
  const e = await api("student", "analyze", {}, { timeout: 40 }).then(() => null, (x) => x);
  assert.ok(isTimeout(e) && !isAborted(e));
  assert.equal((e as { status?: number }).status, undefined);
  assert.ok(Date.now() - t0 < 2000);
});

test("화면이 그만두면 aborted 오류(이미 그만둔 신호도)", async () => {
  hang();
  const c = new AbortController();
  const p = api("student", "analyze", {}, { signal: c.signal, timeout: 5000 });
  c.abort();
  const e = await p.then(() => null, (x) => x);
  assert.ok(isAborted(e) && !isTimeout(e));
  const done = new AbortController();
  done.abort();
  assert.ok(isAborted(await api("student", "analyze", {}, { signal: done.signal }).then(() => null, (x) => x)));
});

test("끊김은 한국어 안내(status 없음), 서버 오류는 status와 서버 글, 성공은 답 그대로", async () => {
  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  const off = await api("student", "me").then(() => null, (x) => x);
  assert.equal((off as Error).message, "인터넷 연결을 확인해 주세요.");
  assert.ok(!isTimeout(off) && !isAborted(off) && (off as { status?: number }).status === undefined);
  reply(409, { error: "마음 점검이 새로 열렸어요." });
  const bad = await api("student", "selfSave").then(() => null, (x) => x);
  assert.equal((bad as { status?: number }).status, 409);
  assert.equal((bad as Error).message, "마음 점검이 새로 열렸어요.");
  reply(200, { ok: true, reply: "고마워" });
  assert.deepEqual(await api("student", "save", {}, { timeout: 1000 }), { ok: true, reply: "고마워" });
});
