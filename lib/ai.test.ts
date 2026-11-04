// AI 답 읽기: 울타리·잘린 JSON·null 항목·영어 오류를 견디고, 되묻기 질문과 보기는 같은 곳에서
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { BAD_JSON, aiError, callJSON, cleanLesson, cleanSheet, cleanWeekly, extractJSON, parseJSON, reflectReply, shape, type AI } from "./ai.ts";
import { SKIP, fallbackFor } from "./i18n.ts";

test("JSON 꺼내기: 울타리·앞뒤 설명 글을 걷어 내고 가장 바깥 객체를", () => {
  assert.deepEqual(parseJSON('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJSON('﻿ {"a":1}\n'), { a: 1 });
  assert.deepEqual(parseJSON('```json\n{"a": {"b": [1, 2]}}\n```'), { a: { b: [1, 2] } });
  assert.deepEqual(parseJSON('여기 있어요:\n```\n{"reply": "좋았구나 {웃음}"}\n```\n도움이 됐길!'), { reply: "좋았구나 {웃음}" });
  assert.deepEqual(parseJSON('[참고] 답은 {"ok": true} 입니다'), { ok: true });
  assert.deepEqual(parseJSON('[{"ok": true}]'), { ok: true }); // 한 개짜리 배열로 감싸 와도
  assert.deepEqual(parseJSON('{"q": "\\"따옴표\\" 안의 } 괄호"}'), { q: '"따옴표" 안의 } 괄호' });
  assert.deepEqual(extractJSON("```json\n[1, 2]\n```"), [1, 2]);
});

test("JSON 꺼내기: 끝이 잘렸거나 없으면 한국어 오류(안쪽 작은 객체를 답으로 고르지 않음)", () => {
  for (const bad of ['{"words": [{"word": "기뻐요"}, {"wo', "```json\n{\"a\":", "죄송해요, 답할 수 없어요.", "", "null", "[1, 2]"]) {
    assert.throws(() => parseJSON(bad), { message: BAD_JSON }, bad);
  }
});

test("SDK·네트워크 오류는 짧은 한국어로, 이미 한국어인 오류는 그대로", () => {
  assert.match(aiError(Object.assign(new Error("401 invalid x-api-key"), { status: 401 })).message, /키가 맞지 않아요/);
  assert.match(aiError(Object.assign(new Error("Rate limit"), { status: 429 })).message, /사용량/);
  assert.match(aiError(Object.assign(new Error("model not found"), { status: 404 })).message, /모델/);
  assert.match(aiError(Object.assign(new Error("Overloaded"), { status: 529 })).message, /\(529\)/);
  assert.match(aiError(new Error("Request timed out.")).message, /너무 늦어요/);
  assert.match(aiError(new DOMException("The operation was aborted", "AbortError")).message, /너무 늦어요/);
  assert.match(aiError(new TypeError("fetch failed")).message, /연결하지 못했어요/);
  assert.match(aiError(new Error("Unexpected token < in JSON")).message, /[가-힣]/);
  const ko = new Error("AI가 이 요청에 답하지 않았어요.");
  assert.equal(aiError(ko), ko);
});

const card = { emotion: "슬퍼요", intensity: 3, reason: "친구" };
const base = { vocab: [], card };

test("되묻기: 질문과 보기가 모두 쓸 만하면 AI 것을", () => {
  const r = shape(base, { question: "속상했구나, 누구랑 있었어?", options: ["친구들이랑", "혼자 있었어"] });
  assert.equal(r.question, "속상했구나, 누구랑 있었어?");
  assert.deepEqual(r.options, ["친구들이랑", "혼자 있었어", SKIP.ko]);
});

test("되묻기: 질문만 쓸 만하고 보기가 없거나 이상하면 둘 다 기본 되묻기로(섞지 않음)", () => {
  const fb = fallbackFor("ko", "친구", false);
  for (const options of [undefined, [], [null, 3], ["", "  "], [SKIP.ko], "친구들이랑"]) {
    const r = shape(base, { question: "속상했구나, 누구랑 있었어?", options });
    assert.equal(r.question, fb.question, JSON.stringify(options));
    assert.deepEqual(r.options, fb.options, JSON.stringify(options));
  }
  // 보기만 있고 질문이 비어도 둘 다 기본
  const r = shape(base, { question: "  ", options: ["친구들이랑", "혼자 있었어"] });
  assert.equal(r.question, fb.question);
  assert.deepEqual(r.options, fb.options);
});

test("되묻기: 다른 언어 학생은 그 언어 기본 되묻기, 보기 겹침은 하나로", () => {
  const en = shape({ ...base, lang: "en" }, { question: "Who were you with?", options: ["Friends", "Friends", SKIP.en] });
  assert.deepEqual(en.options, ["Friends", SKIP.en]);
  const fb = shape({ ...base, lang: "vi" }, { question: "", options: [] });
  assert.deepEqual(fb.options, fallbackFor("vi", "친구", false).options);
});

test("교과서 정리: null·숫자 항목이 섞여 와도 멈추지 않고 걸러 낸다", () => {
  const l = cleanLesson({
    unit: "마음 알기",
    words: [null, 3, "기뻐요", { word: "뿌듯해요", emotion: "기뻐요", meaning: "해낸 일이 자랑스러움" }, { word: null }, { word: "설레요", emotion: "없는 감정" }],
    activities: [null, { title: "감정 카드 놀이", how: "카드를 뽑아요", minutes: "15" }, { title: "" }],
  });
  assert.deepEqual(l.words, [
    { word: "뿌듯해요", emotion: "기뻐요", meaning: "해낸 일이 자랑스러움" },
    { word: "설레요", emotion: "그저 그래요", meaning: "" },
  ]);
  assert.deepEqual(l.activities, [{ title: "감정 카드 놀이", how: "카드를 뽑아요", minutes: 15 }]);
  assert.deepEqual(cleanLesson({ words: null, activities: { a: 1 } }), { unit: "", words: [], activities: [] });
});

test("주간 요약: null 줄·null 활동을 걸러 낸다", () => {
  const w = cleanWeekly({ lines: [null, "기쁜 마음이 많았어요.", 42, ""], activities: [null, { title: "칭찬 릴레이", why: "서로 알아주려고", how: "돌아가며 칭찬해요", minutes: 10 }] });
  assert.deepEqual(w.lines, ["기쁜 마음이 많았어요."]);
  assert.equal(w.activities.length, 1);
  assert.equal(w.activities[0].title, "칭찬 릴레이");
  assert.deepEqual(cleanWeekly({}), { lines: [], activities: [], style: [] });
});

test("활동지 피드백: null 항목이 앞에 와도 뒤의 쓸 만한 항목을 쓴다", () => {
  const s = cleanSheet({ read: "글을 읽었어요", strengths: [null, { area: "관계 인식·관리", point: "친구 마음을 헤아렸어요", evidence: "\"괜찮아?\"" }], grow: [null, { area: "x", point: "다음엔 내 마음도 적어 봐요" }], blank: false });
  assert.equal(s.strengths.length, 1);
  assert.equal(s.strengths[0].area, "관계 인식·관리");
  assert.equal(s.grow.length, 1);
  assert.equal(s.grow[0].area, "자기감정 인식·관리");
});

// ── 실제 호출 길: 전역 fetch를 바꿔 AI 서버 답을 흉내 낸다 ──
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const AI_UP: AI = { provider: "upstage", model: "solar-pro4", key: "up_test" };
function fakeChat(content: string, status = 200) {
  globalThis.fetch = (async () =>
    new Response(
      status === 200
        ? JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] })
        : JSON.stringify({ error: { message: "bad key" } }),
      { status, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
}

test("한 주 돌아보기 답: 평범한 칭찬은 그대로 학생에게 간다(울타리로 감싸 와도)", async () => {
  fakeChat('```json\n{"reply": "친구를 네 일처럼 도와줬구나. 정말 멋져!"}\n```');
  assert.equal(await reflectReply(AI_UP, { lang: "ko", text: "친구를 도와줬다", week: [] }), "친구를 네 일처럼 도와줬구나. 정말 멋져!");
});

test("한 주 돌아보기 답: 횟수·기록을 말하면 버린다", async () => {
  fakeChat('{"reply": "이번 주에 슬픈 기록이 세 번이나 있었구나."}');
  await assert.rejects(reflectReply(AI_UP, { lang: "ko", text: "힘들었다", week: [] }));
});

test("AI 오류는 선생님이 읽을 한국어로", async (t) => {
  t.mock.method(console, "error", () => {}); // 원래 오류는 서버 기록에만
  fakeChat("", 401);
  await assert.rejects(callJSON(AI_UP, "s", "u", "n", {}), /키가 맞지 않아요/);
  fakeChat('{"a": [1, 2');
  await assert.rejects(callJSON(AI_UP, "s", "u", "n", {}), { message: BAD_JSON });
});
