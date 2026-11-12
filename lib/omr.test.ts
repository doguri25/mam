// 서면 검사지 읽기: 기울고 작아지고 얼룩진 「스캔」을 만들어 체크 칸을 바르게 읽는지, 애매한 칸을 골라내는지, 쪽을 사람별로 묶는지
import assert from "node:assert/strict";
import { test } from "node:test";
import { BOX, COLS, FID, PAGE, apply, boxY, buildEntries, homography, parseQr, pickMark, placeOf, qrText, readPage, type Gray, type Pt } from "./omr.ts";

// 검사지 좌표에서 잉크가 있는 곳(표식 · 칸 테두리 · 학생 표시)
type Tick = { i: number; v: number; kind?: "check" | "fill" | "light" | "circle" };
function inkAt(x: number, y: number, ticks: Tick[]): number {
  for (const [cx, cy] of FID.at) if (Math.abs(x - cx) <= FID.size / 2 && Math.abs(y - cy) <= FID.size / 2) return 20;
  for (let j = 0; j < 16; j++) {
    const { s, k } = placeOf(j);
    const cy = boxY(s, k);
    if (Math.abs(y - cy) > BOX / 2 + 30) continue;
    for (let c = 0; c < 5; c++) {
      const cx = COLS[c];
      const dx = x - cx, dy = y - cy;
      if (Math.abs(dx) <= BOX / 2 && Math.abs(dy) <= BOX / 2 && (Math.abs(dx) >= BOX / 2 - 4 || Math.abs(dy) >= BOX / 2 - 4)) return 40;
      for (const t of ticks) {
        if (t.i !== j || t.v !== c + 1) continue;
        if (t.kind === "fill" && Math.abs(dx) < 26 && Math.abs(dy) < 26) return 60;
        if (t.kind === "circle" && Math.abs(Math.hypot(dx, dy) - 46) < 4) return 50; // 칸을 둘러 그린 동그라미
        // ✔ 모양: 두 선분(두께 8, 연하게 쓴 표시는 두께 4·회색)
        const seg = (ax: number, ay: number, bx: number, by: number) => {
          const vx = bx - ax, vy = by - ay;
          const tt = Math.max(0, Math.min(1, ((dx - ax) * vx + (dy - ay) * vy) / (vx * vx + vy * vy)));
          return Math.hypot(dx - (ax + tt * vx), dy - (ay + tt * vy));
        };
        const w = t.kind === "light" ? 3 : 5;
        if (seg(-24, 2, -6, 24) < w || seg(-6, 24, 30, -30) < w) return t.kind === "light" ? 120 : 30;
      }
    }
  }
  return 255;
}
// 검사지 → 「스캔」: 축소·회전·이동(+사다리꼴 살짝)과 얼룩
function fakeScan(ticks: Tick[], opt: { w: number; angle: number; skew?: number; seed?: number }): Gray {
  const W = opt.w, H = Math.round((opt.w * PAGE.h) / PAGE.w);
  const k = (W * 0.96) / PAGE.w, a = (opt.angle * Math.PI) / 180;
  const map = (p: Pt): Pt => {
    const x = (p[0] - PAGE.w / 2) * k, y = (p[1] - PAGE.h / 2) * k;
    return [W / 2 + x * Math.cos(a) - y * Math.sin(a) + 7, H / 2 + x * Math.sin(a) + y * Math.cos(a) - 5];
  };
  const src: Pt[] = [[0, 0], [PAGE.w, 0], [0, PAGE.h], [PAGE.w, PAGE.h]];
  const dst = src.map(map);
  if (opt.skew) dst[1] = [dst[1][0] - opt.skew, dst[1][1] + opt.skew]; // 한 모서리를 살짝 눌러 사다리꼴
  const back = homography(dst, src)!;
  let seed = opt.seed ?? 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const data = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [tx, ty] = apply(back, [x, y]);
    const v = tx < 0 || ty < 0 || tx > PAGE.w || ty > PAGE.h ? 250 : inkAt(tx, ty, ticks);
    data[y * W + x] = Math.max(0, Math.min(255, v - 12 + rnd() * 24 - (rnd() < 0.002 ? 120 : 0)));
  }
  return { w: W, h: H, data };
}

test("기울고 작게 스캔한 쪽에서 16문장의 체크를 읽는다", () => {
  const want = [3, 4, 5, 2, 1, 4, 4, 3, 5, 5, 2, 3, 4, 1, 3, 4];
  const ticks: Tick[] = want.map((v, i) => ({ i, v, kind: i === 5 ? "fill" : i === 9 || i === 12 ? "circle" : undefined }));
  for (const opt of [{ w: 1240, angle: 1.2 }, { w: 1000, angle: -2.0, skew: 12 }]) {
    const r = readPage(fakeScan(ticks, opt), 1);
    assert.ok(r, `표식을 찾음 ${JSON.stringify(opt)}`);
    assert.deepEqual(r.marks.map((m) => m.value), want, JSON.stringify(opt));
    assert.ok(r.marks.every((m) => m.sure));
  }
});

test("빈칸·두 칸에 표시한 문장은 확인 필요로 남긴다", () => {
  const ticks: Tick[] = [{ i: 0, v: 4 }, { i: 1, v: 2 }, { i: 1, v: 5 }, { i: 3, v: 3 }];
  const r = readPage(fakeScan(ticks, { w: 1240, angle: 0.6 }), 1)!;
  assert.equal(r.marks[0].value, 4);
  assert.equal(r.marks[1].sure, false);
  assert.equal(r.marks[1].why, "두 칸");
  assert.equal(r.marks[2].value, null);
  assert.equal(r.marks[2].why, "빈칸");
  assert.equal(r.marks[3].value, 3);
});

test("표식이 안 보이면(잘린 스캔) 읽지 않는다", () => {
  const g = fakeScan([{ i: 0, v: 3 }], { w: 1000, angle: 0 });
  for (let y = 0; y < 140; y++) for (let x = 0; x < 200; x++) g.data[y * g.w + x] = 250; // 왼쪽 위 표식을 지움
  assert.equal(readPage(g, 1), null);
});

test("한 문장 고르기: 가장 진한 칸이 뚜렷해야 확실", () => {
  assert.deepEqual(pickMark([0.01, 0.02, 0.3, 0.01, 0]).value, 3);
  assert.equal(pickMark([0.01, 0.02, 0.3, 0.01, 0]).sure, true);
  assert.equal(pickMark([0.01, 0.2, 0.25, 0.01, 0]).why, "두 칸");
  assert.equal(pickMark([0.01, 0.03, 0.02, 0.01, 0]).why, "빈칸");
  assert.equal(pickMark([0.02, 0.055, 0.03, 0.01, 0]).sure, false); // 연한 표시인데 옆 칸도 지저분함
  assert.equal(pickMark([0, 0.06, 0.01, 0, 0]).sure, true); // 연해도 다른 칸이 깨끗하면
});

test("QR 글: 앱 검사지·선생님 양식, 번호·쪽", () => {
  assert.deepEqual(parseQr(qrText("S", 12, 2)), { kind: "S", no: 12, page: 2 });
  assert.deepEqual(parseQr(qrText("F", 3, 1)), { kind: "F", no: 3, page: 1 });
  assert.equal(parseQr("https://example.com"), null);
});

test("쪽을 사람별로 묶기: 번호가 찍힌 쪽은 번호로, 빈 검사지·QR 못 읽은 쪽은 차례로 1·2쪽", () => {
  const m = (v: number) => Array.from({ length: 16 }, () => ({ value: v, sure: true, ratios: [] }));
  const e = buildEntries([
    { kind: "S", no: 3, page: 2, marks: m(2) }, // 3번 2쪽이 먼저 들어와도
    { kind: "S", no: 3, page: 1, marks: m(4) },
    { kind: "S", no: 9, page: 1, marks: m(3) }, // 9번 1쪽 뒤에 QR이 지워진 2쪽
    { kind: null, no: null, page: null, marks: m(4) },
    { kind: "S", no: 0, page: 1, marks: m(5) }, // 빈 검사지 1·2쪽
    { kind: null, no: null, page: null, marks: m(1) }, // QR이 지워진 2쪽
    { kind: "F", no: 7, page: 1, marks: null }, // 선생님 양식
    { kind: "F", no: 7, page: 2, marks: null },
    { kind: null, no: null, page: null, marks: null }, // 아무것도 못 읽음
  ]);
  assert.equal(e.length, 5);
  assert.deepEqual([e[0].no, e[0].answers.slice(0, 16).every((v) => v === 4), e[0].answers.slice(16).every((v) => v === 2)], [3, true, true]);
  assert.deepEqual([e[1].no, e[1].pages, e[1].answers[0], e[1].answers[31]], [9, [2, 3], 3, 4]);
  assert.deepEqual([e[2].no, e[2].pages, e[2].answers[0], e[2].answers[31]], [null, [4, 5], 5, 1]);
  assert.deepEqual([e[3].kind, e[3].no, e[3].pages], ["F", 7, [6, 7]]);
  assert.deepEqual([e[4].kind, e[4].pages], ["?", [8]]);
});
