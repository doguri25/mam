// 선생님 도우미: 자료 찾기, 학생 찾기, 실명 가리기, 위기 안내 고르기, AI 답 정리
import assert from "node:assert/strict";
import { test } from "node:test";
import { KB, searchKb } from "./kb.ts";
import { CRISIS, crisisOf, crisisText } from "./crisis.ts";
import { parseNames } from "./local.ts";
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
  // 성 뗀 이름 뒤에 어떤 말이 와도(한테·하고·쉼표·물음표), 네 글자 이름도
  const more = { 3: "김민준", 7: "이서연", 12: "남궁민수" };
  assert.equal(hideNames("민준한테 무슨 일 있었는지 정리해 줘", more).text, "3번한테 무슨 일 있었는지 정리해 줘");
  assert.equal(hideNames("민준, 요즘 어때?", more).text, "3번, 요즘 어때?");
  assert.equal(hideNames("민준하고 서연이 다퉜어", more).text, "3번하고 7번이 다퉜어");
  assert.equal(hideNames("민수가 울었어. 남궁민수 보호자 연락", more).text, "12번가 울었어. 12번 보호자 연락");
  assert.equal(hideNames("서민준 선생님께", more).text, "서민준 선생님께"); // 다른 낱말 속 글자는 그대로
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
  // 답 글에 섞인 내부 칸 표시는 지운다
  const marked = cleanAssist({ reply: "필요하면 학생별 누적 기록 화면(go: student, no=3/11/17/22)으로 바로 볼 수 있어요. 마음 지도(tab=map)에서도요. 자세한 건 go: sel 화면에서 봐요.\n- 3번 단풍(5학년 기준) 확인" }, { nos: [], sources: [] });
  assert.equal(marked.reply, "필요하면 학생별 누적 기록 화면으로 바로 볼 수 있어요. 마음 지도에서도요. 자세한 건 화면에서 봐요.\n- 3번 단풍(5학년 기준) 확인");
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

test("명렬표 붙여 넣기: 성별·생년월일 칸이 붙어 있어도 이름만", () => {
  assert.deepEqual(parseNames("1 김하늘 여\n2\t이서연\t여\t2017.03.02\n3, 박도윤, 남\n4 응우옌 반 안\n5. 최하은 2017-05-01"), { 1: "김하늘", 2: "이서연", 3: "박도윤", 4: "응우옌 반 안", 5: "최하은" });
});

test("실명 가리기: 성 뗀 이름은 뒤에 조사·빈칸·문장부호가 올 때만(「슬기로운」「보람찬」「다운로드」는 그대로)", () => {
  const names = { 3: "김슬기", 5: "박보람", 9: "정다운", 11: "김민준" };
  for (const [q, want] of [
    ["슬기로운 생활 수업", "슬기로운 생활 수업"], ["보람찬 하루", "보람찬 하루"], ["다운로드가 안 돼", "다운로드가 안 돼"],
    ["슬기는 요즘 어때?", "3번는 요즘 어때?"], ["민준이가 울었어", "11번이가 울었어"], ["민준아 괜찮니", "11번아 괜찮니"],
    ["김슬기로운", "3번로운"], // 전체 이름은 늘 가린다
  ] as const) assert.equal(hideNames(q, names).text, want, q);
});

test("학생 찾기: 흔한 낱말 가명·횟수를 말한 「번」은 학생으로 보지 않는다", () => {
  const st = [{ no: 2, alias: "구름" }, { no: 3, alias: "단풍" }, { no: 10, alias: "노을" }];
  for (const [q, want] of [
    ["가을 단풍 주제로 수업 아이디어", []], ["단풍잎 그리기", []], ["노을 사진으로 활동", []], ["하루 2번 해도 될까?", []],
    ["가정통신문 3번 항목", []], ["2번째 활동", []],
    ["단풍이 요즘 어때?", [3]], ["노을 학생 상담", [10]], ["3번 학생 요즘 어때", [3]], ["구름", [2]],
  ] as const) assert.deepEqual(mentionedNos(q, st), want, q);
});

test("위기 안내: 「밑줄 긋기」「손목시계」「극단적으로」「다 맞았다」, 번호 속 109·117은 위기 말이 아니다", () => {
  for (const q of ["밑줄 긋기 활동", "손목시계 그리기", "극단적으로 말하면", "연락처 010-1095-2233", "20261109까지 내요", "퀴즈 다 맞았을 때 칭찬", "010-3117-2222"])
    assert.deepEqual(crisisOf(q), [], q);
  assert.deepEqual(crisisOf("손목을 그었대요"), ["suicide"]);
  assert.deepEqual(crisisOf("극단적 선택을 말했어요"), ["suicide"]);
  assert.deepEqual(crisisOf("109에 전화해 볼까"), ["suicide"]);
  assert.deepEqual(crisisOf("친구한테 자꾸 맞는대요"), ["violence"]);
  assert.deepEqual(crisisOf("117에 신고했어요"), ["violence"]);
  assert.deepEqual(crisisOf("아빠한테 맞았대요"), ["abuse"]); // 집에서 생긴 일은 아동학대 안내만
});

test("AI 답 정리: 번호는 한 학생을 여는 화면에만, 영어 글의 「no:」는 지우지 않는다", () => {
  const out = cleanAssist({ reply: "Answer yes or no: please reply. 3번을 보세요 (go: student, no=3).", go: [{ tab: "sel", no: 3 }, { tab: "student", no: 3 }, { tab: "cheer", no: 3 }] }, { nos: [3], sources: [] });
  assert.equal(out.reply, "Answer yes or no: please reply. 3번을 보세요.");
  assert.deepEqual(out.go, [{ tab: "sel" }, { tab: "student", no: 3 }, { tab: "cheer", no: 3 }]);
});

test("실명 가리기: 조사가 여러 개 붙어도, 소식지처럼 성까지 쓴 이름만 바꿀 때는 낱말을 건드리지 않는다", () => {
  const names = { 11: "김민준", 12: "이서연", 7: "김하나", 9: "박가을" };
  for (const q of ["민준이까지", "민준이요?", "민준이한테서", "민준이랑은", "민준이에게는", "민준이부터", "민준이에요", "민준이한테도", "서연이와도", "서연이는요?"])
    assert.ok(!/민준|서연/.test(hideNames(q, names).text), q);
  assert.equal(hideNames("가을 하늘이 높고 학습지 하나 더", names, { full: true }).text, "가을 하늘이 높고 학습지 하나 더");
  assert.equal(hideNames("박가을 어머니께", names, { full: true }).text, "9번 어머니께");
});

test("학생 찾기: 「3번하고 7번」「3번이나 7번」「3번 더 살펴볼」, 횟수를 말한 「3번이나 말했는데」는 빼고", () => {
  const st = [{ no: 3, alias: "단풍" }, { no: 7, alias: "구름" }];
  assert.deepEqual(mentionedNos("3번하고 7번 사이가 안 좋아요", st), [3, 7]);
  assert.deepEqual(mentionedNos("3번이나 7번 중에", st), [3, 7]);
  assert.deepEqual(mentionedNos("3번 더 살펴봐야 할까요", st), [3]);
  assert.deepEqual(mentionedNos("하루 3번 더 해도 될까", st), []);
  // 가명은 흔한 낱말이라 조사가 붙을 때만(「구름, 비, 바람 주제로」「햇살 오늘 따뜻하네」는 학생이 아니다)
  assert.deepEqual(mentionedNos("단풍이 요즘 어때?", st), [3]);
  assert.deepEqual(mentionedNos("구름, 비, 바람 주제로", st), []);
  assert.deepEqual(mentionedNos("벌써 3번이나 말했는데", st), []);
  assert.deepEqual(mentionedNos("그림책을 3번 더 읽어 줘", st), []);
});

test("위기 안내: 「아이들에게 맞는 활동」「말씀이 맞아요」는 아니고, 「극단적인 선택」「아이가 맞았는데」「맞는대요」는 위기", () => {
  for (const q of ["우리 반 아이들에게 맞는 활동 추천해 줘", "3학년에게 맞는 그림책", "저한테 맞는 업무 정리 방법", "어머니 말씀이 맞아요", "보호자 연락처가 맞아요?", "정답 맞았어요"])
    assert.deepEqual(crisisOf(q), [], q);
  assert.deepEqual(crisisOf("학생이 극단적인 선택을 하고 싶다고 했어요"), ["suicide"]);
  assert.deepEqual(crisisOf("극단 선택 시도"), ["suicide"]);
  assert.deepEqual(crisisOf("아이가 맞았는데 어떻게 처리해요?"), ["violence"]);
  assert.deepEqual(crisisOf("친구들한테 여러 번 맞았대요"), ["violence"]);
  assert.deepEqual(crisisOf("엄마한테 자꾸 맞아요"), ["abuse"]);
});

test("실명 가리기: 「이·아·야」가 붙은 이름은 뒤에 무엇이 와도, 「해야 하나요」「바다에서」「가을부터」는 그대로", () => {
  const names = { 7: "김하나", 5: "김바다", 11: "김민준", 9: "박가을" };
  for (const q of ["학교폭력 신고는 어떻게 해야 하나요?", "바다에서 하는 생존수영 안내문", "가을부터 시작", "가을에는", "하나부터 열까지"])
    assert.equal(hideNames(q, names).text, q, q);
  for (const q of ["민준이라서", "민준이니까", "민준인데", "민준한테서는", "민준이지만"]) assert.ok(!/민준/.test(hideNames(q, names).text), q);
});

test("위기 안내: 「부모님께 맞았대요」는 아동학대, 「예방주사 맞았는지」「비를 맞았어요」「저한테 맞아요」「극단적인 행동」은 아니다", () => {
  assert.deepEqual(crisisOf("부모님께 맞았대요"), ["abuse"]);
  assert.deepEqual(crisisOf("친구한테 맞아요"), ["violence"]);
  assert.deepEqual(crisisOf("친구에게 맞는 것 같아요"), ["violence"]);
  for (const q of ["독감 예방주사 맞았는지 가정통신문", "비를 맞았어요", "숫자가 맞았는지", "선생님 말씀이 맞았어요", "이 방법이 저한테 맞아요", "아이가 극단적인 행동을 해요"])
    assert.deepEqual(crisisOf(q), [], q);
});

test("위기 안내: 따돌림·괴롭힘의 여러 꼴, 할머니·삼촌이 때린 일, 살기 싫다는 말을 알아보고 업무 물음(예방 교육·공문)에는 띄우지 않는다", () => {
  for (const [q, id] of [
    ["따돌림 당하는 학생이 있어요", "violence"], ["괴롭힘 당한대요", "violence"], ["반 아이들이 한 학생을 따돌리고 있는 것 같아요", "violence"], ["학생 간 성추행이 있었어요", "violence"],
    ["할머니가 회초리로 때렸대요", "abuse"], ["삼촌이 때린대요", "abuse"], ["아이 팔에 멍이 있어요", "abuse"], ["가정에서 맞고 오는 것 같아요", "abuse"], ["엄마가 아이를 때리는 걸 봤어요", "abuse"],
    ["학생이 살기 싫다고 해요", "suicide"], ["아이가 유서를 썼어요", "suicide"], ["아이 팔에 그은 자국이 있어요", "suicide"], ["학생이 죽어버릴 거라고 했어요", "suicide"],
  ] as const) assert.deepEqual(crisisOf(q), [id], q);
  for (const q of ["아동학대 예방교육 이수 확인 공문", "가정폭력 예방 교육 연수 신청", "자살 예방 교육 연수 신청 방법", "생명존중 교육 자료 추천해 줘", "딥페이크 예방 교육 자료",
    "청렴 교육: 금품 수수 금지 안내문 써 줘", "교육과정 심의위원회 회의록 정리해 줘", "피구 하다가 공에 맞았어요", "학부모 상담 날짜가 맞았는지 확인해 줘", "시험지 채점: 몇 개 맞았어", "목숨을 건 탈출 독서 감상문 예시"])
    assert.deepEqual(crisisOf(q), [], q);
});

test("위기 안내: 업무 물음(예방주사·학부모 상담·유서 깊은 절·멍 때리기·꼬리 뺏기·우유 방치)에는 띄우지 않고 새 위험 말은 알아본다", () => {
  for (const q of ["독감 예방주사 맞고 오라고 안내문 써 줘", "학부모 상담 신청이 꽉 찼어요 시간표 짜 줘", "유서 깊은 절 체험학습 안내문 써 줘", "수업 시간에 자꾸 멍 때리는 아이 어떻게 지도해요?", "체육 시간 꼬리 뺏기 놀이 규칙 알려 줘", "교실에 우유를 방치하지 않도록 안내문"])
    assert.deepEqual(crisisOf(q), [], q);
  for (const [q, id] of [["아이가 죽고만 싶대요", "suicide"], ["아이가 하늘나라에 가고 싶대요", "suicide"], ["아이가 엄마한테 효자손으로 맞았대요", "abuse"]] as const) assert.deepEqual(crisisOf(q), [id], q);
});

test("위기 안내: 부모가 아이를 때린 일·핑계 뒤 멍·방치·그만 살겠다는 말·딱지 뺏기는 알아보고, 진로 활동지·강아지 죽음 위로에는 띄우지 않는다", () => {
  for (const [q, id] of [["아빠가 아이가 잘못하면 때린대요", "abuse"], ["아이가 넘어졌다고 하는데 팔에 멍이 너무 많아요", "abuse"], ["보호자가 방치하고 있는 것 같아요", "abuse"], ["아이가 그만 살겠대요", "suicide"], ["형들이 딱지 뺏어 갔대요", "violence"], ["형이 삥을 당했대요", "violence"], ["엄마가 그러는데 아이가 집에서 동생을 때린대요", "violence"]] as const)
    assert.ok(crisisOf(q).includes(id), q);
  for (const q of ["살아서 뭐 하고 싶은지 진로 활동지 만들어 줘", "강아지가 죽어 버렸다고 우는 아이 위로", "혼자 방치된 화분 정리"]) assert.deepEqual(crisisOf(q), [], q);
});

test("위기 안내: 몸을 만져서 불쾌·다른 아이들 앞에서 때린 부모·살아 있는 게 싫대요는 알아보고, 살아서 뭐 해 줄·휴대폰 방치·긴장 풀기 활동에는 띄우지 않는다", () => {
  for (const [q, id] of [["남학생이 여학생 몸을 만져서 여학생이 불쾌감을 느끼고 있어요", "violence"], ["친구가 몸을 만져서 수업 시간에 울었어요", "violence"], ["엄마가 다른 애들 있는 데서 아이를 발로 찼대요", "abuse"], ["엄마가 다른 아이들 앞에서 아이 뺨을 때렸대요", "abuse"], ["아이가 살아 있는 게 싫대요", "suicide"]] as const)
    assert.ok(crisisOf(q).includes(id), q);
  for (const q of ["보호자가 외국에 살아서 뭐 해 줄 수 없다는 아이 상담", "옛날 사람들은 움집에 살아서 뭐 해 먹었는지 수업 자료", "부모님이 아이 휴대폰 사용을 방치하는 것 같아요", "몸을 만지며 긴장 풀기 활동 추천"]) assert.deepEqual(crisisOf(q), [], q);
});

test("이름 가리기: 두 학생이 같은 이름(성을 뗀 이름)이면 한 학생 번호로 고르지 않는다", () => {
  const names = { 1: "김하늘", 5: "이하늘", 7: "박서연" };
  assert.equal(hideNames("하늘이가 오늘 울었어", names).text, "1번·5번 가운데 한 명이가 오늘 울었어");
  assert.equal(hideNames("김하늘 보호자 연락, 서연이도", names).text, "1번 보호자 연락, 7번이도");
  assert.deepEqual(mentionedNos(hideNames("하늘이 상담 준비", names).text, [{ no: 1, alias: "가" }, { no: 5, alias: "나" }, { no: 7, alias: "다" }]), [1, 5]);
});

test("위기 안내: 목 조르기·머리채·가두기는 학대 안내, 마사지 활동 물음에는 안내를 띄우지 않는다", async () => {
  const { crisisOf } = await import("./crisis.ts");
  for (const t of ["아빠가 아이 목을 졸랐대요", "엄마가 머리채를 잡았대요", "엄마가 아이를 방에 가뒀대요"]) assert.ok(crisisOf(t).includes("abuse"), t);
  assert.ok(crisisOf("자기만 없으면 된대요").includes("suicide"));
  assert.deepEqual(crisisOf("짝과 서로 어깨를 주물러 주며 몸을 만져 주는 마사지 활동 괜찮을까요?"), []);
});
