// 화면 API 도우미: 늦은 답은 timeout으로, 화면이 그만두면 aborted로, 끊김·서버 오류는 예전처럼
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { OTHER_KEY, OTHER_STUDENT, api, isAborted, isOtherStudent, isTimeout, setStudentScreen, studentScreen } from "./api.ts";

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

// 시험용 브라우저 흉내: 첫 화면으로 간 주소와 이 탭에만 남기는 값(sessionStorage)
function fakeTab(pathname: string) {
  const went: string[] = [];
  const store = new Map<string, string>();
  const g = globalThis as unknown as { window?: unknown; sessionStorage?: unknown };
  g.window = { location: { replace: (u: string) => went.push(u), pathname } };
  g.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
  const close = () => {
    setStudentScreen(null);
    delete g.window;
    delete g.sessionStorage;
  };
  return { went, store, close };
}
// 동작마다 답을 정하는 서버. 보낸 몸은 sent에
function server(answer: (action: string) => [number, unknown]) {
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sent.push(b);
    const [status, body] = answer(String(b.action));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return sent;
}

// 같은 기기 두 탭(QR을 찍으면 새 탭): 이 화면의 학생(번호·학급 공간)을 학생 요청마다 싣고, 다른 친구가 들어왔으면 첫 화면으로
test("이 화면의 학생을 실어 보낸다(login·me·logout·saveQueued·선생님 요청에는 없음), 서버가 다른 친구라고 하면 첫 화면으로", async () => {
  let answer: (action: string) => [number, unknown] = (a) => (a === "me" ? [200, { no: 9, space: "s1", alias: "구" }] : [200, { ok: true }]);
  const sent = server((a) => answer(a));
  const tab = fakeTab("/me");
  try {
    setStudentScreen(null);
    // 처음 받은 me가 이 화면의 학생이 된다. me 자체에는 싣지 않는다
    await api("student", "me");
    assert.equal(sent.at(-1)!.screenNo, undefined);
    assert.deepEqual(studentScreen(), { no: 9, space: "s1" });
    await api("student", "save", { record: { emotion: "기뻐요" } });
    assert.equal(sent.at(-1)!.screenNo, 9);
    assert.equal(sent.at(-1)!.screenSpace, "s1");
    await api("student", "letters");
    assert.deepEqual([sent.at(-1)!.screenNo, sent.at(-1)!.screenSpace], [9, "s1"]);
    await api("student", "saveQueued", { qtoken: "q" });
    assert.equal(sent.at(-1)!.screenNo, undefined);
    await api("teacher", "overview");
    assert.equal(sent.at(-1)!.screenNo, undefined);
    // 같은 학생 me는 그대로 넘긴다
    assert.deepEqual(await api("student", "me"), { no: 9, space: "s1", alias: "구" });
    assert.equal(tab.went.length, 0);
    // 서버가 다른 친구라고 막으면: 늘 같은 한국어 안내 + code, 첫 화면으로(앞 학생을 남겨 둠), 그 뒤 학생 요청은 보내지 않는다
    answer = () => [409, { error: "Another student", code: "otherStudent" }];
    const e = await api("student", "save", {}).then(() => null, (x) => x);
    assert.ok(isOtherStudent(e));
    assert.equal((e as { status?: number }).status, 409);
    assert.equal((e as Error).message, OTHER_STUDENT);
    assert.deepEqual(tab.went, ["/"]);
    assert.deepEqual(JSON.parse(tab.store.get(OTHER_KEY)!), { no: 9, space: "s1" });
    const n = sent.length;
    assert.ok(isOtherStudent(await api("student", "letters").then(() => null, (x) => x)));
    assert.equal(sent.length, n);
    // 다른 409(마음 점검 회차가 바뀜)는 예전처럼 서버 글 그대로(이 탭에서 다시 들어온 뒤)
    setStudentScreen(null);
    tab.store.delete(OTHER_KEY);
    answer = () => [409, { error: "마음 점검이 새로 열렸어요." }];
    const other = await api("student", "selfSave").then(() => null, (x) => x);
    assert.ok(!isOtherStudent(other));
    assert.equal((other as Error).message, "마음 점검이 새로 열렸어요.");
  } finally {
    tab.close();
  }
});

test("me 답이 이 화면과 다른 학생(번호·학급)이면 그 답을 넘기지 않고 첫 화면으로, 나가기·들어오기는 이 화면의 학생을 비운다", async () => {
  let me: Record<string, unknown> = { no: 9, space: "s1" };
  const sent = server((a) => [200, a === "me" ? me : a === "login" ? { no: 10, qtoken: "q" } : { ok: true }]);
  const tab = fakeTab("/me/letters");
  try {
    setStudentScreen(null);
    await api("student", "me");
    me = { no: 10, space: "s1", alias: "다른 친구" };
    assert.ok(isOtherStudent(await api("student", "me").then(() => null, (x) => x)));
    assert.deepEqual(tab.went, ["/"]);
    // 같은 번호라도 다른 반이면 다른 친구(이 탭에서 다시 들어온 뒤)
    setStudentScreen(null);
    tab.store.delete(OTHER_KEY);
    tab.went.length = 0;
    me = { no: 9, space: "s1" };
    await api("student", "me");
    me = { no: 9, space: "s2" };
    assert.ok(isOtherStudent(await api("student", "me").then(() => null, (x) => x)));
    assert.deepEqual(tab.went, ["/"]);
    // 나가기: 이 화면의 학생을 비운다 → 다음 me가 새 학생
    setStudentScreen(null);
    tab.store.delete(OTHER_KEY);
    tab.went.length = 0;
    me = { no: 9, space: "s1" };
    await api("student", "me");
    await api("student", "logout");
    assert.equal(sent.at(-1)!.screenNo, undefined);
    assert.equal(studentScreen(), null);
    me = { no: 11, space: "s1" };
    await api("student", "me");
    assert.deepEqual(studentScreen(), { no: 11, space: "s1" });
    // 들어오기: 이 화면의 학생과 첫 화면 안내를 비운다
    tab.store.set(OTHER_KEY, JSON.stringify({ no: 11, space: "s1" }));
    await api("student", "login", { code: "ABC234" });
    assert.equal(sent.at(-1)!.screenNo, undefined);
    assert.equal(studentScreen(), null);
    assert.equal(tab.store.has(OTHER_KEY), false);
    assert.equal(tab.went.length, 0);
  } finally {
    tab.close();
  }
});

test("쫓겨난 탭에서 뒤로 가기로 학생 화면을 다시 열어도 코드로 다시 들어오기 전에는 학생 요청을 보내지 않고 첫 화면으로", async () => {
  const sent = server((a) => [200, a === "me" ? { no: 8, space: "s1" } : a === "login" ? { no: 7, qtoken: "q" } : { ok: true }]);
  const tab = fakeTab("/me");
  try {
    setStudentScreen(null);
    tab.store.set(OTHER_KEY, JSON.stringify({ no: 7, space: "s1" }));
    // /me를 다시 연 탭: me(지금 기기의 다른 친구)를 묻지 않고 첫 화면으로
    assert.ok(isOtherStudent(await api("student", "me").then(() => null, (x) => x)));
    assert.equal(sent.length, 0);
    assert.deepEqual(tab.went, ["/"]);
    // 첫 화면에서는 다시 보내지 않는다(되풀이 새로 고침 없음). 나가기도 다른 친구를 내보내므로 막는다
    setStudentScreen(null);
    tab.went.length = 0;
    (globalThis as unknown as { window: { location: { pathname: string } } }).window.location.pathname = "/";
    assert.ok(isOtherStudent(await api("student", "logout").then(() => null, (x) => x)));
    assert.equal(sent.length, 0);
    assert.equal(tab.went.length, 0);
    // 코드로 다시 들어오면 풀린다
    await api("student", "login", { code: "ABC234" });
    assert.equal(tab.store.has(OTHER_KEY), false);
    assert.deepEqual(await api("student", "me"), { no: 8, space: "s1" });
  } finally {
    tab.close();
  }
});
