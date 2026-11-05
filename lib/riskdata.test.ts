// 위험 표현 자료: 마치지 않은 글(같은 글은 다시 열지 않음·살펴보기와 지우기는 그 순간의 글로) · 문서 크기 한도 · 연습 학생에게 간 쪽지 · 체험 모델 이름
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { today } from "./date.ts";
import type { RiskAction, RiskDraft } from "./shared.ts";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-riskdata-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const D = await import("./data.ts");

// 살펴본 것은 40일 지나면 빠지므로 오늘 날짜로
const DAY = today();
const ID = `3_${DAY}_pm`;
const draft = (text: string, at: string, extra: Partial<RiskDraft> = {}): RiskDraft =>
  ({ id: ID, no: 3, date: DAY, slot: "pm", text, hits: ["죽고싶"], lang: "ko", at, checked: null, ...extra });

test("마치지 않은 글: 같은 글을 다시 정리하면 다시 열지 않고(판·살펴본 표시 그대로) false, 다른 글이면 앞 글을 남기고 다시 연다", async () => {
  await inSpace("crisk1", async () => {
    assert.equal(await D.putRiskDraft(draft("죽고싶어", "2026-11-05T05:00:00.000Z")), true);
    assert.equal(await D.checkRiskDraft(ID, "2026-11-05T05:00:00.000Z"), "ok");
    // 말하기 → 카드로 같은 글을 한 번 더 정리(한국어 정리가 더 옴)
    assert.equal(await D.putRiskDraft(draft("죽고싶어", "2026-11-05T05:01:00.000Z", { hits: ["죽고싶어"], summaryKo: "정리" })), false);
    let [d] = await D.getRiskDrafts();
    assert.equal(d.at, "2026-11-05T05:00:00.000Z");
    assert.ok(d.checked, "살펴본 표시는 그대로");
    assert.deepEqual(d.hits, ["죽고싶", "죽고싶어"]);
    assert.equal(d.summaryKo, "정리");
    // 다른 글: 다시 열고 앞 글은 earlier에
    assert.equal(await D.putRiskDraft(draft("사라지고 싶어", "2026-11-05T05:02:00.000Z")), true);
    [d] = await D.getRiskDrafts();
    assert.equal(d.checked, null);
    assert.deepEqual(d.earlier?.map((e) => e.text), ["죽고싶어"]);
  });
});

test("마치지 않은 글에 한국어 정리 덧붙이기: 같은 글이 그대로 있고 정리가 없을 때만(판·살펴본 표시 그대로, 새 글은 덮지 않음)", async () => {
  await inSpace("crisk1b", async () => {
    await D.putRiskDraft(draft("my dad hits me", "2026-11-05T05:00:00.000Z", { lang: "en" }));
    assert.equal(await D.checkRiskDraft(ID, "2026-11-05T05:00:00.000Z"), "ok");
    await D.addRiskDraftSummary(ID, "my dad hits me", "아빠가 나를 때려요");
    let [d] = await D.getRiskDrafts();
    assert.equal(d.summaryKo, "아빠가 나를 때려요");
    assert.equal(d.at, "2026-11-05T05:00:00.000Z");
    assert.ok(d.checked);
    // 이미 정리가 있으면 그대로
    await D.addRiskDraftSummary(ID, "my dad hits me", "다른 정리");
    [d] = await D.getRiskDrafts();
    assert.equal(d.summaryKo, "아빠가 나를 때려요");
    // 그사이 학생이 다른 글을 썼으면 앞 글의 정리를 붙이지 않고, 새 글도 덮지 않는다
    await D.putRiskDraft(draft("they kick me", "2026-11-05T05:02:00.000Z", { lang: "en" }));
    await D.addRiskDraftSummary(ID, "my dad hits me", "아빠가 나를 때려요");
    [d] = await D.getRiskDrafts();
    assert.equal(d.text, "they kick me");
    assert.equal(d.summaryKo, undefined);
  });
});

test("마치지 않은 글 살펴보기: 본 판(at)이 지금 글과 같을 때만 · 그사이 새 글이면 stale · 없어졌으면 missing", async () => {
  await inSpace("crisk2", async () => {
    await D.putRiskDraft(draft("죽고싶어", "2026-11-05T05:00:00.000Z"));
    await D.putRiskDraft(draft("때리고 싶어", "2026-11-05T05:03:00.000Z"));
    assert.equal(await D.checkRiskDraft(ID, "2026-11-05T05:00:00.000Z"), "stale");
    assert.equal((await D.getRiskDrafts())[0].checked, null, "옛 판으로는 닫지 않음");
    assert.equal(await D.checkRiskDraft(ID, "2026-11-05T05:03:00.000Z"), "ok");
    assert.equal(await D.checkRiskDraft(`9_${DAY}_pm`, null), "missing");
  });
});

test("기록을 마치며 마치지 않은 글 지우기: 지우는 그 순간의 글로 견준다(그사이 새로 쓴 위험한 글은 남김)", async () => {
  await inSpace("crisk3", async () => {
    await D.putRiskDraft(draft("죽고싶어", "2026-11-05T05:00:00.000Z"));
    // 학생이 「죽고싶어」로 기록을 마치는 사이 새 글을 씀 → 지우는 때의 글(earlier 포함)이 기록에 다 담기지 않으면 그대로 둔다
    await D.putRiskDraft(draft("다 때려 부수고 싶어", "2026-11-05T05:04:00.000Z"));
    const saved = "죽고싶어";
    const kept = (t: string) => saved.includes(t);
    await D.dropRiskDraft(ID, (d) => !d.checked && [d.text, ...(d.earlier ?? []).map((e) => e.text)].every(kept));
    assert.equal((await D.getRiskDrafts()).length, 1);
    await D.dropRiskDraft(ID, (d) => [d.text, ...(d.earlier ?? []).map((e) => e.text)].every((t) => `${saved} 다 때려 부수고 싶어`.includes(t)));
    assert.equal((await D.getRiskDrafts()).length, 0);
  });
});

const act = (i: number, extra: Partial<RiskAction> = {}): RiskAction => ({
  id: `a${i}`, no: 1, recordId: `r${i}`, recordDate: "2026-10-01", date: "2026-10-01", kinds: ["talk"], note: "메모".repeat(50),
  createdAt: `2026-10-01T00:00:${String(i % 60).padStart(2, "0")}.000Z`, text: "위험한 글".repeat(40), ...extra,
});
const size = (x: unknown) => Buffer.byteLength(JSON.stringify(x));

test("조치 기록 크기 한도: 같은 글 겹침을 먼저 걷고, 보관 기한이 지난 것만 오래된 것부터 빼고, 그래도 넘치면 아무것도 지우지 않고 오류", () => {
  // 같은 위험 표현에 같은 글로 여러 번 적은 것: 처음 것에만 글을 남긴다
  const dup = [act(1, { recordId: "r", createdAt: "2026-10-01T00:00:01.000Z" }), act(2, { recordId: "r", createdAt: "2026-10-02T00:00:01.000Z" })];
  const cap = size({ items: dup }) - 10;
  const out = D.fitRiskActions(dup, cap, "2026-03-01");
  assert.deepEqual(out.map((a) => [a.id, !!a.text]), [["a1", true], ["a2", false]]);
  // 기한(cut) 앞 것만 뺀다
  const items = [act(1, { recordDate: "2026-02-10" }), act(2, { recordDate: "2026-02-20" }), act(3, { recordDate: "2026-04-01" })];
  const cap2 = size({ items }) - 50;
  assert.deepEqual(D.fitRiskActions(items, cap2, "2026-03-01").map((a) => a.id), ["a2", "a3"]);
  // 모두 기한 안: 지우지 않고 오류
  assert.throws(() => D.fitRiskActions(items, cap2, "2026-01-01"), { message: D.DOC_FULL });
  // 한 위험 표현의 조치 기록은 함께 뺀다(글 남긴 처음 것만 빠지고 뒤의 것이 글 없이 남지 않게)
  const group = [act(1, { recordId: "old", recordDate: "2026-02-10", text: "가" }), act(2, { recordId: "old", recordDate: "2026-02-10", text: "나" }), act(3, { recordDate: "2026-04-01" })];
  assert.deepEqual(D.fitRiskActions(group, size({ items: group }) - 10, "2026-03-01").map((a) => a.id), ["a3"]);
  // 이미 한도를 넘은 문서에서 지우기(줄이기)는 된다
  assert.deepEqual(D.fitRiskActions(items.slice(1), cap2 - 2000, "2026-01-01", size({ items })).map((a) => a.id), ["a2", "a3"]);
});

test("마치지 않은 글 크기 한도: 살펴본 것의 앞 글 → 살펴본 것 순서로만 줄이고 살펴보지 않은 것은 그대로", () => {
  const long = "죽고싶어".repeat(40);
  const earlier = Array.from({ length: 5 }, (_, i) => ({ text: long, hits: ["죽고싶"], at: `2026-11-0${i + 1}T00:00:00.000Z` }));
  const a = draft(long, "x", { id: "a", checked: "2026-11-01T00:00:00.000Z", earlier });
  const b = draft(long, "x", { id: "b", checked: "2026-11-02T00:00:00.000Z", earlier });
  const c = draft(long, "x", { id: "c", earlier }); // 살펴보지 않음
  const all = [a, b, c];
  // 조금 넘침: 먼저 살펴본 a의 앞 글만 뺀다
  const out = D.fitRiskDrafts(all, size({ items: all }) - 100);
  assert.deepEqual(out.map((d) => [d.id, d.earlier?.length ?? 0]), [["a", 0], ["b", 5], ["c", 5]]);
  // 많이 넘침: 살펴본 것을 빼도 살펴보지 않은 c는 그대로
  const out2 = D.fitRiskDrafts(all, size({ items: [c] }) + 10);
  assert.deepEqual(out2.map((d) => [d.id, d.earlier?.length ?? 0]), [["c", 5]]);
  assert.throws(() => D.fitRiskDrafts(all, size({ items: [c] }) - 10), { message: D.DOC_FULL });
});

test("명단을 고쳐 연습 학생 한 명만 실제 학생으로: 그 번호에게 간 연습 쪽지는 지우고, 실제 학생이 보낸 쪽지는 전할 수 없음으로 남긴다", async () => {
  await inSpace("crisk4", async () => {
    await db().set("letters", "p", { id: "p", from: 5, to: 4, demo: true, status: "wait" }); // 연습 학생 5 → 바뀌는 4
    await db().set("letters", "q", { id: "q", from: 5, to: 6, demo: true, status: "wait" }); // 다른 연습 학생끼리(남김)
    await db().set("letters", "r", { id: "r", from: 3, to: 4, status: "wait", risk: true }); // 실제 3 → 바뀌는 4
    await D.purgePractice((no) => no === 4, { onlyThese: true });
    const ls = await db().all<{ id: string; toPractice?: boolean }>("letters");
    assert.deepEqual(ls.map((l) => [l.id, l.toPractice ?? false]).sort(), [["q", false], ["r", true]]);
  });
});

test("체험 반 연습 데이터 다시 만들기: 누가 바꿔 둔 모델 이름도 처음으로(빌려 쓰는 키를 그 모델로 쓰지 않게)", async () => {
  await inSpace("demo", async () => {
    const s = await D.getSettings();
    await D.saveSettings({ ...s, models: { ...s.models, gemini: "gemini-very-expensive" } });
    await D.seedPractice();
    assert.equal((await D.getSettings()).models.gemini, D.defaultSettings().models.gemini);
  });
});
