// 선생님 도우미: 자료 찾기, 학생 찾기, 실명 가리기, 위기 안내 고르기, AI 답 정리
import assert from "node:assert/strict";
import { test } from "node:test";
import { KB, searchKb } from "./kb.ts";
import { CRISIS, crisisOf, crisisText } from "./crisis.ts";
import { chunks, cleanAssist, saysTodo, cleanContacts, cleanDocText, dueLabel, hideNames, isClassWide, mentionedNos, searchDocs, sortTodos, type DocMeta, type Todo } from "./assist.ts";

test("기본 자료 찾기: 물음에 맞는 카드가 먼저", () => {
  assert.equal(searchKb("3학년 사회정서 성취기준 알려줘")[0].id, "sel-std34");
  assert.equal(searchKb("화가 났을 때 나비포옹 하는 법")[0].id, "sel-skills");
  assert.ok(searchKb("초등 고학년 6차시 수업 흐름").some((c) => c.id === "sel-upper"));
  assert.ok(searchKb("Wee 상담 1388 같은 연락처").some((c) => c.id === "sel-help"));
  assert.deepEqual(searchKb("ㅋㅋ"), []);
  // 카드마다 출처와 꼬리표가 있다(답의 「자료」에 보인다)
  for (const c of KB) assert.ok(c.src && c.tags.length && c.text.length > 100, c.id);
});

test("위기 안내 고르기: 학교폭력·아동학대·자살 위험 말에 맞는 안내", () => {
  assert.deepEqual(crisisOf("우리 반 아이가 단체방에서 따돌림을 당한대요"), ["violence"]);
  assert.deepEqual(crisisOf("아이 몸에 멍이 자주 보여요. 학대가 의심돼요"), ["abuse"]);
  assert.deepEqual(crisisOf("학생이 죽고 싶다고 썼어요"), ["suicide"]);
  assert.deepEqual(crisisOf("아이가 아빠한테 맞았다고 했어. 몸에 멍도 있어"), ["abuse"]);
  assert.deepEqual(crisisOf("친구한테 맞았대요"), ["violence"]);
  assert.deepEqual(crisisOf("마음의 상처를 다루는 수업 아이디어"), []);
  assert.deepEqual(crisisOf("가정통신문 써 줘"), []);
  assert.deepEqual(crisisOf("학교폭력예방 교육주간 결과 보고는 언제까지야?"), []); // 업무 물음
  assert.deepEqual(crisisOf("학교폭력 신고를 받았어. 뭐부터 해?"), ["violence"]);
  for (const g of CRISIS) {
    const t = crisisText(g);
    assert.match(t, /가장 먼저/);
    assert.match(t, /112/);
    assert.ok(g.src.length);
  }
});

test("학생 찾기: 「3번」·가명, 명단에 없는 번호는 빼고", () => {
  const st = [{ no: 3, alias: "햇살" }, { no: 12, alias: "단풍" }, { no: 5, alias: "별" }];
  assert.deepEqual(mentionedNos("3번이랑 단풍이 요즘 어때?", st), [3, 12]);
  assert.deepEqual(mentionedNos("40번 학생", st), []);
  assert.deepEqual(mentionedNos("별이 빛나는 밤", st), []); // 한 글자 가명은 낱말과 헷갈려 찾지 않는다
  assert.ok(isClassWide("우리 반 요즘 분위기 어때?"));
  assert.ok(!isClassWide("가정통신문 써 줘"));
});

test("실명 가리기: 이 기기의 실명을 번호로(성 뗀 이름도)", () => {
  const names = { 3: "김민준", 7: "이서연", 9: "민" };
  const r = hideNames("민준이가 요즘 힘들어 보여요. 이서연이랑 다퉜대요", names);
  assert.equal(r.text, "3번이가 요즘 힘들어 보여요. 7번이랑 다퉜대요");
  assert.ok(r.hit);
  assert.deepEqual(hideNames("민속놀이 수업", names), { text: "민속놀이 수업", hit: false }); // 한 글자 이름은 바꾸지 않음
});

test("자료함: 글을 겹치게 자르고, 물음에 맞는 조각을 자료마다 둘까지", () => {
  const long = Array.from({ length: 40 }, (_, i) => `${i}번째 문단. 학교폭력 예방교육 주간 운영 계획과 일정 ${i}`).join("\n");
  const cs = chunks(long, 300, 50);
  assert.ok(cs.length > 3 && cs.every((c) => c.length <= 300));
  const meta = (id: string, title: string): DocMeta => ({ id, title, kind: "업무", chars: 0, at: "" });
  const hits = searchDocs("학교폭력 예방교육 주간 일정", [{ meta: meta("a", "예방교육 계획"), text: long }, { meta: meta("b", "급식"), text: "오늘의 급식 메뉴 안내" }]);
  assert.ok(hits.length >= 1 && hits.length <= 2 && hits.every((h) => h.id === "a"));
  assert.equal(cleanDocText("가\u0000나\r\n\n\n\n다   라"), "가 나\n\n다 라");
});

test("AI 답 정리: 정한 화면·학생·자료 이름만 남긴다", () => {
  const out = cleanAssist({
    reply: "  답이에요  ",
    todos: [{ title: "결과 보고 제출", due: "2026-11-19" }, { title: "", due: "x" }, { title: "날짜 이상", due: "11월 19일" }],
    go: [{ tab: "cheer", no: 3 }, { tab: "cheer", no: 3 }, { tab: "hack", no: 0 }, { tab: "student", no: 99 }],
    sources: ["한국형 사회정서교육이란", "지어낸 자료"],
  }, { nos: [3], sources: ["한국형 사회정서교육이란"] });
  assert.equal(out.reply, "답이에요");
  assert.deepEqual(out.todos, [{ title: "결과 보고 제출", due: "2026-11-19" }, { title: "날짜 이상", due: "" }]);
  assert.deepEqual(out.go, [{ tab: "cheer", no: 3 }, { tab: "student" }]);
  assert.deepEqual(out.sources, ["한국형 사회정서교육이란"]);
});

test("할 일: 마치지 않은 일·이른 마감 먼저, 남은 날 글", () => {
  const t = (id: string, due: string, done = false): Todo => ({ id, title: id, due, done, at: id });
  assert.deepEqual(sortTodos([t("c", ""), t("a", "2026-11-20"), t("d", "2026-11-01", true), t("b", "2026-11-13")]).map((x) => x.id), ["b", "a", "c", "d"]);
  assert.deepEqual(dueLabel("2026-11-10", "2026-11-12"), { text: "2일 지남", late: true });
  assert.equal(dueLabel("2026-11-13", "2026-11-12").text, "내일");
  assert.ok(saysTodo("다음 주 금요일까지 결과 보고 내야 해"));
  assert.ok(!saysTodo("3번 학생 요즘 어때?"));
  assert.deepEqual(cleanContacts([{ label: "Wee클래스", num: "041-000-0000" }, { label: "", num: "1" }, null]), [{ label: "Wee클래스", num: "041-000-0000" }]);
});
