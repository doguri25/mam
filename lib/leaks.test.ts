// 아이에게 가는 AI 글에서 선생님용 횟수·날수·기록 이름만 찾고, 평범한 칭찬은 지나가게
import assert from "node:assert/strict";
import { test } from "node:test";
import { leaks } from "./rules.ts";

test("횟수·날수·기록 이름은 찾는다", () => {
  assert.deepEqual(leaks("가라앉은 날이 두 번이나 있었구나"), ["두 번"]);
  assert.deepEqual(leaks("3번째 속상했구나"), ["3번째"]);
  assert.deepEqual(leaks("세 번째 이야기네"), ["세 번째"]);
  assert.deepEqual(leaks("사흘째 속상했구나. 한줄에도 적었지"), ["사흘", "한줄"]);
  assert.deepEqual(leaks("이틀 동안 힘들었구나"), ["이틀"]);
  assert.deepEqual(leaks("며칠째 마음이 무거웠구나"), ["며칠째"]);
  assert.deepEqual(leaks("3일 동안 기록을 보니"), ["3일", "기록"]);
  assert.deepEqual(leaks("세 차례나 그랬구나"), ["세 차례"]);
  assert.deepEqual(leaks("선생님이 본 신호가 있어"), ["선생님이 본 신호"]);
  assert.deepEqual(leaks("You felt sad 3 times this week."), ["3 times"]);
  assert.deepEqual(leaks("这周你难过了3次。"), ["3次"]);
});

test("평범한 따뜻한 말은 지나간다", () => {
  for (const s of [
    "네 일처럼 기뻤구나",
    "규칙을 잘 지켰구나. 정말 멋져!",
    "한 번 더 이야기해 줘서 고마워. 내일도 만나자",
    "다음엔 네 차례야, 기대돼!",
    "마음이 보내는 신호를 잘 알아챘구나",
    "달리기 신기록을 세웠구나!",
    "줄넘기 기록이 늘어서 뿌듯했겠다",
    "네 번호를 기억해 줘서 고마워",
    "이번 주에 친구를 도와줬구나",
  ]) assert.deepEqual(leaks(s), [], s);
});
