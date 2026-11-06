// 같은 번호를 다른 학생에게 줄 때: 명단 읽기가 묻는 번호를 알려 주고, 새 학생이면 앞 학생과 나눈다
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-reuse-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const { addLetter, getLooks, getRiskDrafts, getSettings, readRoster, saveLook, saveSettings, startFresh, withDataFor } = await import("./data.ts");
const { formerAt, ownBy, ownOnly } = await import("./shared.ts");
const { monday, today } = await import("./date.ts");

const old = [
  { no: 1, alias: "햇살", code: "AAA111", consent: "2026-03-05" },
  { no: 2, alias: "구름", code: "BBB222" },
  { no: 3, alias: "연습", code: "CCC333", demo: true },
];

test("명단 읽기: 가명이 바뀐 번호(연습 학생 빼고)와 새로 넣은 번호를 알려 주고, 고르지 않으면 예전처럼 같은 학생으로 둔다", () => {
  const r = readRoster("1 해님\n2 구름\n3 진짜\n4 바람", old);
  assert.deepEqual(r.renamed, [{ no: 1, before: "햇살", now: "해님" }]);
  assert.deepEqual(r.added, [{ no: 4, now: "바람" }]);
  const one = r.students.find((s) => s.no === 1)!;
  assert.equal(one.code, "AAA111");
  assert.equal(one.consent, "2026-03-05");
  assert.equal(one.since, undefined);
});

test("새 학생이면 새 코드·동의 떼기·since와 앞 학생 가명을 남기고, 같은 학생이면 이어받는다", () => {
  const now = "2026-11-06T01:00:00.000Z";
  const r = readRoster("1 해님\n2 구름", old, { fresh: new Set([1]), now });
  const one = r.students.find((s) => s.no === 1)!;
  assert.notEqual(one.code, "AAA111");
  assert.equal(one.consent, undefined);
  assert.equal(one.since, now);
  assert.deepEqual(one.formers, [{ alias: "햇살", until: now }]);
  // 그 뒤 이름만 고치면(같은 학생) since·앞 학생은 그대로, 코드도 그대로
  const again = readRoster("1 해님이\n2 구름", r.students).students.find((s) => s.no === 1)!;
  assert.equal(again.code, one.code);
  assert.equal(again.since, now);
  assert.deepEqual(again.formers, one.formers);
  // 가명이 그대로인 번호는 fresh에 있어도 나누지 않는다(물은 적이 없는 번호)
  const same = readRoster("1 햇살\n2 구름", old, { fresh: new Set([1]), now }).students.find((s) => s.no === 1)!;
  assert.equal(same.code, "AAA111");
  assert.equal(same.since, undefined);
});

test("뺐다가 다시 넣은 번호: 새 학생이면 뺄 때 남긴 학생이 앞 학생, 같은 학생이면 그 학생의 since를 되살린다", () => {
  const left = { 5: { alias: "별님", at: "2026-10-01T00:00:00.000Z", since: "2026-09-01T00:00:00.000Z", formers: [{ alias: "달님", until: "2026-09-01T00:00:00.000Z" }] } };
  const now = "2026-11-06T01:00:00.000Z";
  const fresh = readRoster("5 새별", [], { fresh: new Set([5]), left, now }).students[0];
  assert.equal(fresh.since, now);
  assert.deepEqual(fresh.formers, [{ alias: "달님", until: "2026-09-01T00:00:00.000Z" }, { alias: "별님", until: now }]);
  const back = readRoster("5 별님", [], { left, now }).students[0];
  assert.equal(back.since, "2026-09-01T00:00:00.000Z");
  assert.deepEqual(back.formers, [{ alias: "달님", until: "2026-09-01T00:00:00.000Z" }]);
  // 「같은 학생 · 다시 넣음」을 고르면 뺄 때의 코드·동의 날짜를 되살린다. 고르지 않았으면(묻지 않은 번호) 예전처럼 새 코드
  const left2 = { 5: { ...left[5], code: "STAR55", consent: "2026-04-20" } };
  const same = readRoster("5 별님", [], { same: new Set([5]), left: left2, now }).students[0];
  assert.equal(same.code, "STAR55");
  assert.equal(same.consent, "2026-04-20");
  const unasked = readRoster("5 별님", [], { left: left2, now }).students[0];
  assert.notEqual(unasked.code, "STAR55");
  assert.equal(unasked.consent, undefined);
});

test("ownBy·formerAt: 번호를 받은 때 앞은 앞 학생 것, 날짜만 있으면 받은 날부터 지금 학생 것", () => {
  const s = { since: "2026-11-05T23:30:00.000Z", formers: [{ alias: "앞앞", until: "2026-03-01T00:00:00.000Z" }, { alias: "앞", until: "2026-11-05T23:30:00.000Z" }] };
  assert.equal(ownBy(s, "2026-11-05T23:00:00.000Z"), false);
  assert.equal(ownBy(s, "2026-11-05T23:30:00.000Z"), true);
  assert.equal(ownBy(undefined, "2020-01-01T00:00:00.000Z"), true);
  assert.equal(ownBy({}, "2020-01-01T00:00:00.000Z"), true);
  // 한국 날짜로 11월 6일 아침 8시 30분에 받음 → 11월 6일 날짜는 지금 학생, 11월 5일은 앞 학생
  assert.equal(ownBy(s, "2026-11-06"), true);
  assert.equal(ownBy(s, "2026-11-05"), false);
  assert.equal(formerAt(s, "2026-02-01T00:00:00.000Z"), "앞앞");
  assert.equal(formerAt(s, "2026-07-09T00:00:00.000Z"), "앞");
  assert.equal(formerAt(s, "2026-11-06T00:00:00.000Z"), null);
  assert.equal(formerAt({ since: s.since }, "2026-07-09T00:00:00.000Z"), "");
  const xs = [{ no: 1, at: "2026-07-09T00:00:00.000Z" }, { no: 1, at: "2026-11-06T00:00:00.000Z" }, { no: 2, at: "2026-07-09T00:00:00.000Z" }, { no: 9, at: "2020-01-01T00:00:00.000Z" }];
  assert.deepEqual(ownOnly(xs, [{ no: 1, since: s.since }, { no: 2 }], (x) => x.no, (x) => x.at).map((x) => [x.no, x.at.slice(0, 10)]), [[1, "2026-11-06"], [2, "2026-07-09"], [9, "2020-01-01"]]);
});

test("startFresh: 마음 친구 모습은 처음으로, 새 학생이 쓸 자리(오늘 기록·마치지 않은 기록·이번 주 돌아보기)의 앞 학생 것은 다른 id로 옮기고 조치 기록도 따라간다", async () => {
  await inSpace("creuse001", async () => {
    await saveLook(1, { body: "cat", color: "blue", acc: "none" } as never);
    await saveLook(2, { body: "cat", color: "blue", acc: "none" } as never);
    const day = today();
    const ws = monday(day);
    const id = `1_${ws}`;
    const at = new Date(Date.now() - 3600e3).toISOString();
    await db().set("reflects", id, { id, no: 1, weekStart: ws, text: "무서워", reply: "", createdAt: at, risk: true, riskChecked: null });
    await db().set("records", `1_${day}_am`, { id: `1_${day}_am`, no: 1, date: day, slot: "am", summary: "죽고 싶어", createdAt: at, risk: true, riskChecked: null });
    await db().set("records", `2_${day}_am`, { id: `2_${day}_am`, no: 2, date: day, slot: "am", summary: "", createdAt: at });
    await db().set("meta", "riskDrafts", { items: [{ id: `1_${day}_pm`, no: 1, date: day, slot: "pm", text: "무서워", hits: [], at, checked: null }] });
    await db().set("meta", "riskActions", { items: [
      { id: "a1", no: 1, recordId: `reflect:${id}`, recordDate: ws, date: ws, kinds: ["talk"], note: "", createdAt: new Date().toISOString(), kind: "reflect" },
      { id: "a2", no: 1, recordId: `1_${day}_am`, recordDate: day, date: day, kinds: ["talk"], note: "", createdAt: new Date().toISOString() },
    ] });
    await saveSettings({ ...(await getSettings()), checks: { [`1_${ws}`]: at, [`2_${ws}`]: at } });
    assert.equal(await startFresh([1]), true);
    const recs = (await db().all<{ id: string; no: number; summary: string }>("records")).filter((r) => r.no === 1);
    assert.equal(recs.length, 1);
    assert.match(recs[0].id, new RegExp(`^1_${day}_am_p`));
    assert.equal(recs[0].summary, "죽고 싶어");
    assert.ok(await db().get("records", `2_${day}_am`)); // 다른 번호는 그대로
    const drafts = await getRiskDrafts();
    assert.match(drafts[0].id, new RegExp(`^1_${day}_pm_p`));
    assert.deepEqual(Object.keys((await getSettings()).checks), [`2_${ws}`]);
    const looks = await getLooks();
    assert.equal(1 in looks, false);
    assert.equal(2 in looks, true);
    assert.equal(await db().get("reflects", id), null);
    const moved = (await db().all<{ id: string; no: number; text: string }>("reflects")).filter((r) => r.no === 1);
    assert.equal(moved.length, 1);
    assert.match(moved[0].id, new RegExp(`^1_${ws}_p`));
    assert.equal(moved[0].text, "무서워");
    const acts = (await db().get<{ items: { recordId: string; kind?: string }[] }>("meta", "riskActions"))!.items;
    assert.equal(acts[0].recordId, `reflect:${moved[0].id}`);
    assert.equal(acts[0].kind, "reflect");
    assert.equal(acts[1].recordId, recs[0].id);
  });
});

test("addLetter(since): 같은 번호의 앞 학생이 오늘 보낸 쪽지는 새 학생의 하루 5통에 세지 않는다", async () => {
  await inSpace("creuse003", async () => {
    const before = new Date(Date.now() - 3600e3).toISOString();
    const since = new Date(Date.now() - 1800e3).toISOString();
    const base = { from: 3, to: 4, text: "안녕", showName: true, status: "wait" as const, risk: false, lang: "ko" as const };
    for (let i = 0; i < 5; i++) assert.ok(await addLetter({ ...base, createdAt: before }, 5));
    assert.equal(await addLetter({ ...base, createdAt: new Date().toISOString() }, 5), null); // 예전처럼(since 없음) 막힘
    const got = await Promise.all(Array.from({ length: 8 }, () => addLetter({ ...base, createdAt: new Date().toISOString() }, 5, since)));
    assert.equal(got.filter(Boolean).length, 5); // 한꺼번에 보내도 새 학생 몫 5통까지
    assert.equal((await db().find("letters", "from", "==", 3)).length, 10);
  });
});

test("withDataFor: 그 번호로 남은 기록·쪽지·돌아보기가 있는 번호만(반에 아무것도 없으면 묻지 않음)", async () => {
  await inSpace("creuse002", async () => {
    assert.deepEqual([...(await withDataFor([1, 2, 3]))], []);
    await db().set("records", "2_2026-07-09_am", { id: "2_2026-07-09_am", no: 2, date: "2026-07-09", slot: "am", createdAt: "2026-07-09T00:00:00.000Z" });
    await db().set("letters", "x", { id: "x", from: 5, to: 3, createdAt: "2026-07-09T00:00:00.000Z" });
    assert.deepEqual([...(await withDataFor([1, 2, 3]))].sort(), [2, 3]);
  });
});
