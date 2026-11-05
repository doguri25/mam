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
  const AT = Date.parse("2026-11-05T00:12:00.000Z"); // 그 글을 남기고 12분 뒤에 마침
  const am = draft("1_2026-11-05_am", X);
  assert.equal(D.seenDraft(saved(X), [am], "1_2026-11-05_am", AT), am);
  // 정리하는 사이 정오를 넘겨 하교 전 칸에 저장해도 그 아침 글로
  assert.equal(D.seenDraft(saved(X), [am], "1_2026-11-05_pm", AT), am);
  // 살펴보지 않은 글이면 이어받지 않는다(지금처럼 알림)
  assert.equal(D.seenDraft(saved(X), [{ ...am, checked: null }], "1_2026-11-05_am", AT), null);
  // 되묻기 답에 새로 위험한 말 → 다시 알림
  assert.equal(D.seenDraft(saved(X, "집에서 맞아", { hits: ["죽고 싶", "맞아"], answerHits: ["맞아"] }), [am], "1_2026-11-05_am", AT), null);
  // 살펴본 글보다 더 쓴 글(살펴본 글이 기록의 일부일 뿐) → 다시 알림
  assert.equal(D.seenDraft(saved(`${X} 아빠가 때려`), [am], "1_2026-11-05_am", AT), null);
  // 두 칸을 이어 붙여야 걸리는 말(어느 칸에도 없던 말) → 다시 알림
  assert.equal(D.seenDraft(saved(X, "", { hits: ["죽고 싶", "싶어 사라"] }), [am], "1_2026-11-05_am", AT), null);
  // 글 없이 AI만 위험하다고 본 카드 기록 → 이어받지 않음
  assert.equal(D.seenDraft(saved("", "", { hits: [], summaryHits: [], aiRisk: true }), [am], "1_2026-11-05_am", AT), null);
  // 그 글을 모두 담지 않은 기록(앞서 쓴 글만 담음)은 그 글을 마친 것이 아니다 → 다시 알림
  const two = draft("1_2026-11-05_am", "사라지고 싶어", { earlier: [{ text: X, hits: ["죽고 싶"], at: "2026-11-04T23:59:00.000Z" }] });
  assert.equal(D.seenDraft(saved(X), [two], "1_2026-11-05_am", AT), null);
  // 같은 칸 것을 먼저
  const pm = draft("1_2026-11-05_pm", X, { slot: "pm" });
  assert.equal(D.seenDraft(saved(X), [am, pm], "1_2026-11-05_pm", AT), pm);
  // 지워도 되나: 그 글의 글이 모두 기록에 담겼을 때만
  assert.equal(D.draftKept(am, X, ""), true);
  assert.equal(D.draftKept(two, X, ""), false);
});

test("이어받기는 그 글을 마친 기록만: 같은 칸에 살펴보지 않은 새 글이 있거나, 몇 시간 뒤 따로 쓴 글이면 다시 알린다", () => {
  const am = draft("1_2026-11-05_am", "친구들이 놀려서 죽고 싶어");
  const later = Date.parse("2026-11-05T05:00:00.000Z"); // 다섯 시간 뒤(오후)
  // 오후에 새로 남긴 마치지 않은 글(살펴보지 않음)이 있으면 아침에 살펴본 글이 덮지 않는다
  const pm = draft("1_2026-11-05_pm", "죽고 싶어", { slot: "pm", checked: null, at: "2026-11-05T04:59:00.000Z" });
  assert.equal(D.seenDraft(saved("죽고 싶어"), [am, pm], "1_2026-11-05_pm", later), null);
  // 같은 글이라도 오후에 새로 쓴 것이면(아침 글과 이어지지 않음) 다시 알림
  const amSame = draft("1_2026-11-05_am", "죽고 싶어");
  assert.equal(D.seenDraft(saved("죽고 싶어"), [amSame], "1_2026-11-05_pm", later), null);
  // 카드로 남긴 오후 기록의 되묻기 답 「죽고 싶어」(아침 글의 일부) → 그 글을 마친 것이 아님
  assert.equal(D.seenDraft(saved("", "죽고 싶어", { summaryHits: [], answerHits: ["죽고 싶"] }), [am], "1_2026-11-05_pm", Date.parse("2026-11-05T00:12:00.000Z")), null);
  // 같은 칸이라도 한참 뒤에 마친 기록은 다시 알림
  assert.equal(D.seenDraft(saved("죽고 싶어"), [amSame], "1_2026-11-05_am", Date.parse("2026-11-05T02:00:00.000Z")), null);
  // 하교 전 글은 아침 기록으로 이어지지 않는다(시간은 거꾸로 가지 않음)
  const pmChecked = draft("1_2026-11-05_pm", "죽고 싶어", { slot: "pm" });
  assert.equal(D.seenDraft(saved("죽고 싶어"), [pmChecked], "1_2026-11-05_am", Date.parse("2026-11-05T00:12:00.000Z")), null);
  // 그 무렵인지: 앞뒤 30분 안
  assert.equal(D.recentDraft(amSame, Date.parse("2026-11-05T00:29:00.000Z")), true);
  assert.equal(D.recentDraft(amSame, Date.parse("2026-11-05T00:31:00.000Z")), false);
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
