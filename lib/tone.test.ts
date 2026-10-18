import { test } from "node:test";
import assert from "node:assert/strict";
import { baseline, cleanFeatures, toneOf, type VoiceFeatures } from "./tone.ts";

// loud·pitch·pitchVar는 가짜 마이크(TTS)로 잰 실제 값, rate는 문장 글자 수 ÷ 말한 시간
const SAD: VoiceFeatures = { seconds: 3.4, loud: 0.079, pitch: 138, pitchVar: 3.1, rate: 4.8 };
const HAPPY: VoiceFeatures = { seconds: 3.6, loud: 0.209, pitch: 421, pitchVar: 2.8, rate: 6.3 };
const USUAL: VoiceFeatures = { seconds: 3, loud: 0.13, pitch: 260, pitchVar: 2.9, rate: 5.4 };

test("평소 목소리와 비교해 가라앉음·들떠 있음을 가린다", () => {
  const base = baseline([USUAL, USUAL, { ...USUAL, loud: 0.12 }]);
  assert.equal(toneOf(SAD, base)?.tone, "가라앉음");
  assert.equal(toneOf(HAPPY, base)?.tone, "들떠 있음");
  assert.equal(toneOf(USUAL, base)?.tone, "차분함");
  assert.match(toneOf(SAD, base)!.why, /작게.*낮게/);
  // 크기·높이가 둘 다 내려가면 빠르기 한 가지로는 뒤집히지 않는다(실제 시험에서 나온 숫자)
  assert.equal(toneOf({ seconds: 3.1, loud: 0.072, pitch: 137, pitchVar: 3, rate: 6.8 }, base)?.tone, "가라앉음");
  // 빠르기 하나만 다르면 그대로 차분함
  assert.equal(toneOf({ ...USUAL, rate: 8 }, base)?.tone, "차분함");
});

test("기록이 3번 안 되면 절대 기준, 너무 짧으면 판단하지 않음", () => {
  assert.equal(baseline([USUAL, USUAL]), null);
  assert.equal(toneOf({ ...SAD, loud: 0.03, rate: 2.5 }, null)?.tone, "가라앉음");
  assert.equal(toneOf({ ...SAD, seconds: 0.3 }, null), null);
});

test("보낸 숫자는 범위를 자르고 이상하면 버린다", () => {
  assert.deepEqual(cleanFeatures({ seconds: 5, loud: 9, pitch: -3, pitchVar: "x", rate: 3 }), { seconds: 5, loud: 1, pitch: 0, pitchVar: 0, rate: 3 });
  assert.equal(cleanFeatures("hi"), null);
  assert.equal(cleanFeatures({ seconds: 0 }), null);
});
