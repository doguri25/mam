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
  // 바로 보낸 기록이 두 번(태블릿 두 대·두 번 보냄)
  assert.equal(D.mergeRecord(checked, save(rec(X, at(0.5)))), null);
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
  assert.equal(riskySource(b).text, "친구가 나를 때렸어 / 죽고 싶어");
  // 살펴본 뒤에 남긴 위험한 글은 그 글만
  const c = D.mergeRecord({ ...a, riskChecked: at(1) }, save(rec("죽고 싶어", at(5))))!;
  assert.equal(c.riskSrc, undefined);
  assert.equal(riskySource(c).text, "죽고 싶어");
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
