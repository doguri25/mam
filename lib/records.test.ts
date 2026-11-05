// 학생 기록 저장 합치기(lib/data.ts mergeRecord·saveMoodRecord)와 옮겨 간 조치 기록에 이어 적기(addRiskAction)
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { MoodRecord, RiskAction } from "./shared.ts";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-records-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const D = await import("./data.ts");
const { riskySource } = await import("../components/teacher/alerts.ts");

const T0 = Date.parse("2026-11-05T00:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
const X = "아빠가 때려서 집에 가기 싫어";
// 저장 요청 하나(학생 화면에서 온 기록을 서버가 정리한 모양)
const rec = (summary: string, createdAt: string, risky = summary === X || summary.includes("죽고")): MoodRecord => ({
  id: "1_2026-11-05_am", no: 1, date: "2026-11-05", slot: "am", method: "voice", emotion: "슬퍼요", intensity: 4, reason: "친구", summary,
  question: "", answer: "", risk: risky, riskSelf: risky, riskHits: risky ? ["때려"] : [], riskChecked: null, createdAt,
  tone: null, toneWhy: "", toneBy: null, voice: null, word: "", lang: "ko", summaryKo: "",
});
const save = (r: MoodRecord, queued = false) => ({ rec: r, own: r.risk, alertNew: r.risk, queued });
const open = (r: MoodRecord | null) => !!r && r.risk && !r.riskChecked;

test("같은 칸 저장 둘이 겹치면 나중 것이 앞 것 위에 이어진다(위험한 글이 앞 기록·알림으로 남음)", () => {
  // 위험한 글(담아 둔 기록)이 먼저 쓰이고, 그 전에 읽었던 바로 보낸 평범한 글이 다시 불린다(읽고 고쳐 쓰기가 겹침)
  const risky = D.mergeRecord(null, save(rec(X, at(-1)), true))!;
  const plain = save(rec("오늘은 그냥 그래", at(0)));
  assert.equal(D.mergeRecord(null, plain)!.summary, "오늘은 그냥 그래"); // 첫 시도(아직 아무것도 없다고 읽음)
  const next = D.mergeRecord(risky, plain)!; // 다시 불림: 지금 것 위에
  assert.equal(next.summary, "오늘은 그냥 그래");
  assert.deepEqual(next.prev?.map((p) => p.summary), [X]);
  assert.ok(open(next));
  assert.equal(riskySource(next).text, X);
  // 반대 차례(평범한 글이 먼저, 앞서 만든 위험한 글이 늦게): 앞 기록으로 끼워 넣고 알림을 연다
  const late = D.mergeRecord(D.mergeRecord(null, plain), save(rec(X, at(-1)), true))!;
  assert.equal(late.summary, "오늘은 그냥 그래");
  assert.deepEqual(late.prev?.map((p) => p.summary), [X]);
  assert.ok(open(late));
  assert.equal(riskySource(late).text, X);
});

test("같은 기록이 두 번 오면 그대로 둔다(앞 기록·살펴볼 판을 다시 만들지 않음)", () => {
  const first = D.mergeRecord(null, save(rec(X, at(0))))!;
  const checked = { ...first, riskChecked: at(2) };
  // A: 저장은 됐는데 답을 잃은 화면이 같은 기록을 새 시각으로 담아 보냄(살펴본 뒤)
  assert.equal(D.mergeRecord(checked, save(rec(X, at(1)), true)), null);
  // B: 알림이 열려 있을 때 → 판(riskAt)이 그대로라 선생님이 본 판으로 닫을 수 있다
  assert.equal(D.mergeRecord(first, save(rec(X, at(1)), true)), null);
  // C: 담아 둔 것을 같은 시각으로 다시 보냄 / 기기 시계가 조금 늦어 늦게 온 앞 기록처럼 보여도
  assert.equal(D.mergeRecord(checked, save(rec(X, at(0)), true)), null);
  assert.equal(D.mergeRecord(checked, save(rec(X, at(-3)), true)), null);
  // 바로 보낸 저장은 학생이 정말 다시 남긴 것: 선생님이 닫은 뒤 같은 글을 곧 다시 써도 다시 알린다(앞 기록에 남기고)
  const redo = D.mergeRecord(checked, save(rec(X, at(0.5))))!;
  assert.ok(redo);
  assert.ok(open(redo));
  assert.equal(redo.prev?.length, 1);
  // 그사이 다른 글을 남긴 뒤 늦게 온 같은 기록: 앞 기록에 이미 있으면 그대로
  const after = D.mergeRecord(checked, save(rec("이제 괜찮아", at(3))))!;
  assert.equal(D.mergeRecord(after, save(rec(X, at(0.2)), true)), null);
  // 고른 것이나 글이 하나라도 다르거나, 한참 뒤에 다시 남긴 것이면 새 기록
  assert.ok(D.mergeRecord(checked, save({ ...rec(X, at(1)), intensity: 5 })));
  assert.ok(D.mergeRecord(checked, save({ ...rec(X, at(1)), answer: "응" })));
  assert.ok(D.mergeRecord(checked, save({ ...rec(X, at(1)), word: "서운해요" })));
  const again = D.mergeRecord(checked, save(rec(X, at(30))))!;
  assert.equal(again.prev?.length, 1);
  assert.ok(open(again));
  // 같은 글로 다시 바꾼 것(평범한 글 → 앞의 위험한 글)은 바로 보낸 기록이면 지금 기록이 된다
  assert.equal(D.mergeRecord(after, save(rec(X, at(4))))!.summary, X);
});

test("열린 알림 위에 또 위험한 글을 남기면 알림이 두 글을 모두 가리킨다", () => {
  const a = D.mergeRecord(null, save(rec("친구가 나를 때렸어", at(0), true)))!;
  const b = D.mergeRecord(a, save(rec("죽고 싶어", at(5))))!;
  assert.ok(open(b));
  assert.equal(b.riskAt, at(5));
  assert.deepEqual(b.riskSrc, [at(0), at(5)]);
  assert.equal(riskySource(b).text, "[먼저 쓴 글 09:00] 친구가 나를 때렸어 ‖ [다시 쓴 글 09:05] 죽고 싶어");
  // 살펴본 뒤에 남긴 위험한 글은 그 글만
  const c = D.mergeRecord({ ...a, riskChecked: at(1) }, save(rec("죽고 싶어", at(5))))!;
  assert.equal(c.riskSrc, undefined);
  assert.equal(riskySource(c).text, "죽고 싶어");
});

test("저장 이름(saveId)이 오면 그 이름으로만 같은 저장을 알아본다(이름이 다르면 같은 글도 새로 털어놓은 것)", () => {
  const named = (r: MoodRecord, saveId: string): MoodRecord => ({ ...r, saveId });
  const first = D.mergeRecord(null, save(named(rec(X, at(0)), "s1")))!;
  assert.equal(first.saveId, "s1");
  const checked = { ...first, riskChecked: at(2) };
  // 답을 잃어 담아 두었다가 같은 이름으로 다시 보냄 → 그대로(시각이 한참 달라도)
  assert.equal(D.mergeRecord(checked, save(named(rec(X, at(1)), "s1"), true)), null);
  assert.equal(D.mergeRecord(checked, save(named(rec(X, at(40)), "s1"), true)), null);
  // 선생님이 닫은 뒤 끊긴 채 5분 뒤 같은 카드·같은 말을 다시 남김(새 이름) → 다시 알림
  const again = D.mergeRecord(checked, save(named(rec(X, at(5)), "s2"), true))!;
  assert.ok(open(again));
  assert.equal(again.prev?.length, 1);
  assert.equal(again.prev?.[0].saveId, "s1"); // 앞 기록에도 이름이 남는다
  // 그 뒤 앞 저장(s1)이 또 늦게 옴: 앞 기록에 같은 이름이 있으면 그대로(늦게 온 앞 기록이든 아니든)
  assert.equal(D.mergeRecord(again, save(named(rec(X, at(1)), "s1"), true)), null);
  assert.equal(D.mergeRecord(again, save(named(rec(X, at(9)), "s1"), true)), null);
  // 늦게 온 앞 기록인데 이름이 다르면 글이 같아도 앞 기록으로 끼워 넣는다
  const late = D.mergeRecord(again, save(named(rec(X, at(3)), "s3"), true))!;
  assert.deepEqual(late.prev?.map((p) => p.saveId), ["s1", "s3"]);
  // 바로 보낸 저장은 이름이 같아도 걸러 내지 않는다(학생 화면은 저장마다 새 이름을 단다 — 담아 둔 것만 다시 보냄)
  assert.ok(D.mergeRecord(checked, save(named(rec(X, at(1)), "s1"))));
  // 이름 없는 예전 화면만 글·때로 견준다
  assert.equal(D.mergeRecord(checked, save(rec(X, at(1)), true)), null);
});

test("늦게 온 앞 기록이 열린 알림 밑으로 끼면 알림이 보던 글을 그대로 가리킨다", () => {
  const A = "죽고 싶어", C = "아빠가 때려서 집에 가기 싫어";
  // 9:00 위험한 글(알림 열림) → 9:10 순한 글로 다시 남김(알림은 이어받음)
  const a = D.mergeRecord(null, save(rec(A, at(0))))!;
  const plain = D.mergeRecord(a, save(rec("오늘은 그냥 그래", at(10))))!;
  assert.equal(riskySource(plain).text, A);
  // 9:05에 만든 위험한 글이 늦게 옴 — 선생님이 이미 살펴본 마치지 않은 글이라 새로 알리지 않음(alertNew 없음)
  const seen = D.mergeRecord(plain, { rec: rec(C, at(5)), own: true, alertNew: false, queued: true })!;
  assert.deepEqual(seen.prev?.map((p) => p.summary), [A, C]);
  assert.equal(riskySource(seen).text, A); // 「가장 최근 위험한 앞 글」(C)로 바뀌지 않음
  assert.deepEqual(seen.riskSrc, [at(0)]);
  assert.equal(seen.riskAt, plain.riskAt); // 선생님이 본 판도 그대로(닫기가 409로 막히지 않게)
  // 알림이 닫혀 있었으면 판을 적지 않는다
  const closed = D.mergeRecord({ ...plain, riskChecked: at(11) }, { rec: rec(C, at(5)), own: true, alertNew: false, queued: true })!;
  assert.equal(closed.riskSrc, undefined);
});

test("앞 기록 정리: 위험한 앞 기록이 이미 열 개여도 늦게 온 살펴보지 않은 위험한 글과 알림이 가리키는 판은 빼지 않는다", () => {
  const pv = (m: number, summary: string, risk: boolean) => D.toPrev({ ...rec(summary, at(m), risk), riskSelf: risk });
  const cur: MoodRecord = {
    ...rec("그냥 그래", at(30), false), risk: true, riskSelf: false, riskChecked: at(40), riskAt: at(20),
    prev: Array.from({ length: 10 }, (_, i) => pv(10 + i, `죽고 싶어 ${i + 1}`, true)),
  };
  const late = D.mergeRecord(cur, save(rec(X, at(5)), true), new Date(T0 + 60 * 60_000))!;
  assert.ok(open(late));
  assert.equal(late.prev?.length, 10);
  assert.equal(late.prev?.[0].summary, X); // 새 글이 남고 이미 살펴본 가장 오래된 위험한 글이 빠짐
  assert.ok(!late.prev?.some((p) => p.summary === "죽고 싶어 1"));
  assert.equal(riskySource(late).text, X);
  // trimPrev: 붙들 판은 빼지 않고, 위험하지 않은 것부터 · 그다음 붙들지 않은 오래된 것부터 · 네 배를 넘으면 가장 오래된 것부터
  const list = Array.from({ length: 12 }, (_, i) => pv(i, `죽고 싶어 ${i}`, true));
  assert.deepEqual(D.trimPrev(list, [at(0), at(1)]).map((p) => p.createdAt), [at(0), at(1), ...list.slice(4).map((p) => p.createdAt)]);
  assert.equal(D.trimPrev(Array.from({ length: 30 }, (_, i) => pv(i, `죽고 싶어 ${i}`, true)), Array.from({ length: 30 }, (_, i) => at(i))).length, 20);
  assert.deepEqual(D.trimPrev([pv(0, "a", false), ...list.slice(0, 5)]).map((p) => p.summary), list.slice(0, 5).map((p) => p.summary));
});

test("걸린 말은 판마다 그 글의 것만 둔다(알림에 보일 때 모은다)", () => {
  const hit = (r: MoodRecord, riskHits: string[]) => ({ ...r, riskHits });
  const a = D.mergeRecord(null, save(hit(rec("죽고 싶어", at(0)), ["죽고 싶"])))!;
  const b = D.mergeRecord(a, save(hit(rec("다 때리고 싶어", at(5), true), ["때리"])))!;
  assert.deepEqual(b.riskHits, ["때리"]);
  assert.deepEqual(b.prev?.[0].riskHits, ["죽고 싶"]);
  assert.deepEqual(riskySource(b).hits, ["죽고 싶", "때리"]);
  // 그 위에 또 다시 남겨도 앞 기록에 섞인 말이 들어가지 않는다
  const c = D.mergeRecord(b, save(rec("이제 괜찮아", at(8), false)))!;
  assert.deepEqual(c.prev?.map((p) => p.riskHits), [["죽고 싶"], ["때리"]]);
  assert.deepEqual(c.riskHits, []);
  assert.ok(open(c));
  // 늦게 온 앞 기록이 알림을 다시 열어도 지금 글의 걸린 말은 그대로
  const late = D.mergeRecord({ ...b, riskChecked: at(6) }, save(hit(rec(X, at(3)), ["때려"]), true), new Date(T0 + 60 * 60_000))!;
  assert.deepEqual(late.riskHits, ["때리"]);
  assert.deepEqual(riskySource(late).hits, ["때려"]);
});

test("담아 둔 기록의 만든 때: 느린 시계는 표를 받은 날 0시로, 빠른 시계는 지금으로(버리지 않음). 오래된 표는 받지 않는다", () => {
  const NOW = Date.parse("2026-11-05T21:00:00.000Z"); // 한국 11월 6일 06:00
  const day = "2026-11-06";
  const start = Date.parse("2026-11-05T15:00:00.000Z"); // 11월 6일 0시(한국)
  // 시계가 13시간 늦음(전날로 보임) → 그날 0시
  assert.deepEqual(D.queuedWhen(new Date(NOW - 13 * 3600_000).toISOString(), day, NOW), { date: day, madeAt: start });
  // 하루 늦음도
  assert.deepEqual(D.queuedWhen(new Date(NOW - 26 * 3600_000).toISOString(), day, NOW), { date: day, madeAt: start });
  // 맞는 시계는 그대로
  assert.deepEqual(D.queuedWhen(new Date(NOW - 60_000).toISOString(), day, NOW), { date: day, madeAt: NOW - 60_000 });
  // 조금(1분 안) 빠름 → 지금으로(자정 바로 앞이어도 다음 날로 넘어가 버려지지 않게)
  assert.deepEqual(D.queuedWhen(new Date(NOW + 30_000).toISOString(), day, NOW), { date: day, madeAt: NOW });
  const midnight = Date.parse("2026-11-06T14:59:50.000Z"); // 한국 11월 6일 23:59:50
  assert.deepEqual(D.queuedWhen(new Date(midnight + 30_000).toISOString(), day, midnight), { date: day, madeAt: midnight });
  // 12시간 빠름 → 지금으로
  assert.deepEqual(D.queuedWhen(new Date(NOW + 12 * 3600_000).toISOString(), day, NOW), { date: day, madeAt: NOW });
  // 어제 받은 표 + 많이 빠른 시계: 언제 만든지 모르니 표의 날, 그날을 넘지 않게
  assert.deepEqual(D.queuedWhen(new Date(NOW + 12 * 3600_000).toISOString(), "2026-11-05", NOW), { date: "2026-11-05", madeAt: start - 1 });
  // 만든 때가 없으면 표의 날(만든 때 없이)
  assert.deepEqual(D.queuedWhen(undefined, day, NOW), { date: day });
  assert.deepEqual(D.queuedWhen("이상한 값", day, NOW), { date: day });
  // 사흘이 지난 표 · 앞날 표 · 이상한 날짜는 받지 않는다
  assert.equal(D.queuedWhen(new Date(NOW).toISOString(), "2026-11-02", NOW), null);
  assert.equal(D.queuedWhen(new Date(NOW - 5 * 86_400_000).toISOString(), "2026-11-01", NOW), null);
  assert.equal(D.queuedWhen(new Date(NOW).toISOString(), "2026-11-07", NOW), null);
  assert.equal(D.queuedWhen(new Date(NOW).toISOString(), "x", NOW), null);
  // 사흘 안의 표로 오늘 만든 기록은 오늘로
  assert.deepEqual(D.queuedWhen(new Date(NOW).toISOString(), "2026-11-03", NOW), { date: day, madeAt: NOW });
});

test("saveMoodRecord: 같은 기록이면 쓰지 않고 저장된 그대로 돌려준다", async () => {
  await inSpace("crecords1", async () => {
    const one = await D.saveMoodRecord(save(rec(X, at(0))));
    assert.equal(one.same, false);
    assert.equal(typeof one.record.updatedAt, "number");
    const before = await db().get("records", one.record.id);
    const two = await D.saveMoodRecord(save(rec(X, at(1)), true));
    assert.equal(two.same, true);
    assert.deepEqual(two.record, before);
    assert.deepEqual(await db().get("records", one.record.id), before);
    // 마음 다스리기는 그 기록에 붙이고(없는 기록이면 null)
    const calm = await D.addCalm(one.record.id, { tool: "breathe", felt: "better", at: at(2) });
    assert.equal(calm?.calm?.length, 1);
    assert.equal(calm?.summary, X);
    assert.equal(await D.addCalm("없음", { tool: "breathe", felt: "better", at: at(2) }), null);
  });
});

test("마치지 않은 글에 이어 적는 사이 그 글의 조치 기록이 마음 기록으로 옮겨 갔으면 이것도 그 기록으로", async () => {
  await inSpace("crecords2", async () => {
    const act = (id: string, recordId: string, createdAt: string, extra: Partial<RiskAction> = {}): RiskAction =>
      ({ id, no: 1, recordId, recordDate: "2026-11-05", date: "2026-11-05", kinds: ["talk"], note: id, createdAt, ...extra });
    const DRAFT = "draft:1_2026-11-05_am";
    await D.saveRiskActions([act("first", DRAFT, at(2), { kind: "draft", text: X })]);
    await D.moveRiskActions(DRAFT, "1_2026-11-05_pm", "2026-11-05"); // 학생이 그 글로 기록을 마침
    // 선생님은 옮기기 전에 그 글(판 at(1))을 읽고 「조치 더 적기」
    await D.addRiskAction(act("follow", DRAFT, at(3), { kind: "draft", kinds: ["parent"], text: X }), { draftAt: at(1) });
    const items = await D.getRiskActions();
    const f = items.find((a) => a.id === "follow")!;
    assert.equal(f.recordId, "1_2026-11-05_pm");
    assert.equal(f.via, DRAFT);
    assert.equal(f.kind, undefined);
    assert.ok(items.every((a) => a.recordId === "1_2026-11-05_pm"));
    // 같은 칸에 새로 쓴 마치지 않은 글(판이 더 나중)에 적는 것은 그 글에 그대로
    await D.addRiskAction(act("new", DRAFT, at(20), { kind: "draft" }), { draftAt: at(15) });
    assert.equal((await D.getRiskActions()).find((a) => a.id === "new")!.recordId, DRAFT);
    // 판을 모르면(마음 기록·돌아보기·쪽지) 옮기지 않는다
    await D.addRiskAction(act("plain", DRAFT, at(21), { kind: "draft" }));
    assert.equal((await D.getRiskActions()).find((a) => a.id === "plain")!.recordId, DRAFT);
  });
});

test("느린 기기 시계로 그날 0시로 당겨진 담아 둔 기록 둘은 판이 겹치지 않는다(앞 글만 본 「살펴봤어요」가 뒤 글까지 닫지 않게)", () => {
  const zero = at(0);
  const a = D.mergeRecord(null, save({ ...rec("죽고 싶어", zero), saveId: "a1" }, true))!;
  const b = D.mergeRecord(a, save({ ...rec("친구가 때려서 죽고 싶어", zero), saveId: "b2" }, true))!;
  assert.notEqual(b.createdAt, a.createdAt);
  assert.ok(Date.parse(b.createdAt) > Date.parse(a.createdAt));
  assert.notEqual(b.riskAt, a.riskAt); // 선생님이 a를 본 판(riskAt)으로는 닫히지 않는다(409)
  assert.equal(b.summary, "친구가 때려서 죽고 싶어");
  assert.deepEqual(b.prev?.map((p) => p.summary), ["죽고 싶어"]);
  assert.equal(riskySource(b).text.includes("죽고 싶어"), true);
  // 셋째도 같은 0시로 오면 앞 기록 자리와도 겹치지 않게
  const c = D.mergeRecord(b, save({ ...rec("오늘 학교 싫어 죽고 싶어", zero), saveId: "c3" }, true))!;
  const times = [c.createdAt, ...(c.prev ?? []).map((p) => p.createdAt)];
  assert.equal(new Set(times).size, times.length);
  // 같은 이름으로 다시 오면(답을 잃은 다시 보냄) 그대로
  assert.equal(D.mergeRecord(c, save({ ...rec("오늘 학교 싫어 죽고 싶어", zero), saveId: "c3" }, true)), null);
});
