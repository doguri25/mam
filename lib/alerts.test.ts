// 위험 표현 알림 이어 가기: 살펴본 마치지 않은 글로 마친 기록(이어받기·조치 기록 옮기기) · 늦게 온 앞 기록이 다시 연 알림의 글(riskSrc)
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { MoodRecord, PrevVersion, RiskAction, RiskDraft } from "./shared.ts";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-alerts-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const D = await import("./data.ts");
const { riskySource, riskSrcOf } = await import("../components/teacher/alerts.ts");

const draft = (id: string, text: string, extra: Partial<RiskDraft> = {}): RiskDraft =>
  ({ id, no: 1, date: "2026-11-05", slot: "am", text, hits: ["죽고 싶"], lang: "ko", at: "2026-11-05T00:00:00.000Z", checked: "2026-11-05T00:10:00.000Z", ...extra });
const saved = (summary: string, answer = "", over: Partial<Parameters<typeof D.seenDraft>[0]> = {}) => ({
  summary, answer, hits: ["죽고 싶"], summaryHits: summary.includes("죽고") ? ["죽고 싶"] : [], answerHits: [], aiRisk: false, ...over,
});

test("살펴본 마치지 않은 글과 같은 글로 마친 기록은 이어받고, 새로 위험한 글이 있으면 다시 알린다", () => {
  const X = "학교 가기 싫어 죽고 싶어";
  const am = draft("1_2026-11-05_am", X);
  assert.equal(D.seenDraft(saved(X), [am], "1_2026-11-05_am"), am);
  // 정오를 넘겨 다른 칸에 저장해도 같은 날 다른 칸의 살펴본 글로
  assert.equal(D.seenDraft(saved(X), [am], "1_2026-11-05_pm"), am);
  // 살펴보지 않은 글이면 이어받지 않는다(지금처럼 알림)
  assert.equal(D.seenDraft(saved(X), [{ ...am, checked: null }], "1_2026-11-05_am"), null);
  // 되묻기 답에 새로 위험한 말 → 다시 알림
  assert.equal(D.seenDraft(saved(X, "집에서 맞아", { hits: ["죽고 싶", "맞아"], answerHits: ["맞아"] }), [am], "1_2026-11-05_am"), null);
  // 살펴본 글보다 더 쓴 글(살펴본 글이 기록의 일부일 뿐) → 다시 알림
  assert.equal(D.seenDraft(saved(`${X} 아빠가 때려`), [am], "1_2026-11-05_am"), null);
  // 두 칸을 이어 붙여야 걸리는 말(어느 칸에도 없던 말) → 다시 알림
  assert.equal(D.seenDraft(saved(X, "", { hits: ["죽고 싶", "싶어 사라"] }), [am], "1_2026-11-05_am"), null);
  // 글 없이 AI만 위험하다고 본 카드 기록 → 이어받지 않음
  assert.equal(D.seenDraft(saved("", "", { hits: [], summaryHits: [], aiRisk: true }), [am], "1_2026-11-05_am"), null);
  // 앞서 쓴 글(earlier)에 있던 글도 선생님이 본 글
  const two = draft("1_2026-11-05_am", "사라지고 싶어", { earlier: [{ text: X, hits: ["죽고 싶"], at: "2026-11-04T23:59:00.000Z" }] });
  assert.equal(D.seenDraft(saved(X), [two], "1_2026-11-05_am"), two);
  // 같은 칸 것을 먼저
  const pm = draft("1_2026-11-05_pm", X, { slot: "pm" });
  assert.equal(D.seenDraft(saved(X), [am, pm], "1_2026-11-05_pm"), pm);
  // 지워도 되나: 그 글의 글이 모두 기록에 담겼을 때만
  assert.equal(D.draftKept(am, X, ""), true);
  assert.equal(D.draftKept(two, X, ""), false);
});

test("살펴본 마치지 않은 글의 조치 기록을 마친 마음 기록으로 옮긴다(이름은 via에, 무엇을 살펴봤나는 마음 기록으로)", async () => {
  await inSpace("calerts1", async () => {
    const act = (id: string, recordId: string, extra: Partial<RiskAction> = {}): RiskAction =>
      ({ id, no: 1, recordId, recordDate: "2026-11-05", date: "2026-11-05", kinds: ["talk"], note: id, createdAt: id, ...extra });
    await D.saveRiskActions([act("a1", "draft:1_2026-11-05_am", { kind: "draft", text: "죽고 싶어" }), act("a2", "reflect:1_2026-11-02", { kind: "reflect" })]);
    assert.equal(await D.moveRiskActions("draft:1_2026-11-05_am", "1_2026-11-05_pm", "2026-11-05"), true);
    const items = await D.getRiskActions();
    const a1 = items.find((a) => a.id === "a1")!;
    assert.equal(a1.recordId, "1_2026-11-05_pm");
    assert.equal(a1.via, "draft:1_2026-11-05_am");
    assert.equal(a1.kind, undefined);
    assert.equal(a1.text, "죽고 싶어");
    assert.equal(items.find((a) => a.id === "a2")!.recordId, "reflect:1_2026-11-02");
    // 옮길 것이 없으면 쓰지 않는다
    const before = await db().get("meta", "riskActions");
    assert.equal(await D.moveRiskActions("draft:없음", "x", "2026-11-05"), false);
    assert.deepEqual(await db().get("meta", "riskActions"), before);
  });
});

const ver = (summary: string, createdAt: string, risk: boolean): PrevVersion =>
  ({ method: "voice", emotion: "슬퍼요", intensity: 4, reason: "친구", summary, question: "", answer: "", risk, riskHits: risk ? ["맞고"] : [], createdAt });
const record = (summary: string, extra: Partial<MoodRecord> = {}): MoodRecord => ({
  id: "2_2026-11-05_am", no: 2, date: "2026-11-05", slot: "am", method: "voice", emotion: "화나요", intensity: 4, reason: "친구", summary, question: "", answer: "",
  risk: true, riskSelf: true, riskHits: ["때리고"], riskChecked: null, createdAt: "2026-11-05T00:05:00.000Z", ...extra,
});

test("알림을 연 판(riskSrc): 늦게 온 앞 기록의 글을 보이고, 없으면 지금 글·가장 최근 위험한 앞 글", () => {
  const late = ver("아빠한테 맞고 있어", "2026-11-05T00:04:00.000Z", true);
  // 살펴본 지금 글 뒤에 늦게 온 앞 기록이 알림을 다시 엶 → 그 글
  const r = record("친구를 때리고 싶어", { prev: [late], riskSrc: [late.createdAt] });
  assert.equal(riskySource(r).text, "아빠한테 맞고 있어");
  assert.equal(riskySource(r).prev, late);
  assert.deepEqual(riskySource(r).hits, ["맞고"]);
  // 알림이 열려 있던 때 늦게 옴 → 두 글 모두(만든 차례대로)
  const both = record("친구를 때리고 싶어", { prev: [late], riskSrc: [r.createdAt, late.createdAt] });
  assert.equal(riskySource(both).text, "아빠한테 맞고 있어 / 친구를 때리고 싶어");
  assert.equal(riskySource(both).prev, null);
  // 적어 둔 판이 없으면(예전 기록) 예전처럼
  assert.equal(riskySource(record("친구를 때리고 싶어", { prev: [late] })).text, "친구를 때리고 싶어");
  assert.deepEqual(riskSrcOf(record("친구를 때리고 싶어", { prev: [late] })), [r.createdAt]);
  const calm = record("이제 괜찮아", { riskSelf: false, prev: [late, ver("그냥 그래", "2026-11-05T00:04:30.000Z", false)] });
  assert.equal(riskySource(calm).text, "아빠한테 맞고 있어");
  assert.deepEqual(riskSrcOf(calm), [late.createdAt]);
  assert.deepEqual(riskSrcOf(r), [late.createdAt]);
  // 가리키는 판이 앞 기록 정리로 빠졌으면 예전처럼
  assert.equal(riskySource(record("친구를 때리고 싶어", { riskSrc: ["2020-01-01T00:00:00.000Z"] })).text, "친구를 때리고 싶어");
});
