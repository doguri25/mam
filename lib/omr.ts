// 학급 역량 진단 서면 검사지: 앱이 그리는 검사지의 좌표와, 스캔한 쪽에서 체크 칸을 읽는 계산(화면·노드 모두에서 돈다).
// 검사지는 A4 세로 2쪽(쪽마다 16문장 = 영역 2개). 300dpi 기준 2480×3508 좌표로 그리고, 네 모서리의 검은 네모(표식)로
// 스캔한 그림과 맞춘 뒤(사영 변환) 칸 안쪽이 얼마나 칠해졌는지 본다. 애매한 칸은 「확인 필요」로 남겨 AI나 선생님이 고른다.
// 쪽마다 QR: MAM1|S|<번호>|<쪽>(앱 검사지, 번호 0 = 빈 검사지라 학생이 번호 칸에 씀) · MAM1|F|<번호>|<쪽>(선생님 양식에 찍은 것)

export const PAGE = { w: 2480, h: 3508 } as const; // A4 300dpi
export const PER_PAGE = 16;
export const PAGES = 2;
export const FID = { size: 70, at: [[150, 150], [2330, 150], [150, 3358], [2330, 3358]] as [number, number][] }; // 표식 가운데
export const QR_BOX = { x: 1830, y: 230, s: 270 }; // 오른쪽 위(모서리 표식 찾는 자리와 겹치지 않게)
export const NUM_BOX = { x: 1440, y: 300, w: 330, h: 190 }; // 빈 검사지: 학생이 번호를 쓰는 칸
export const BOX = 70; // 체크 칸 한 변
export const COLS = [1555, 1720, 1885, 2050, 2215]; // 5단계 칸 가운데 x
export const TEXT_X = 200, TEXT_W = 1250;
const TOP = 720, HEAD = 80, ROW = 145, GAP = 30, SECTION = HEAD + 8 * ROW;
// 쪽 안 영역 순번(0·1)의 머리 줄 y, 문장 k(0~7)의 줄 위쪽 y와 칸 가운데 y
export const sectionY = (s: number) => TOP + s * (SECTION + GAP);
export const rowTop = (s: number, k: number) => sectionY(s) + HEAD + k * ROW;
export const boxY = (s: number, k: number) => rowTop(s, k) + ROW / 2;
// 문장 번호(0~31) → 쪽(1·2)·쪽 안 영역 순번·영역 안 순번
export const placeOf = (i: number) => ({ page: Math.floor(i / PER_PAGE) + 1, s: Math.floor((i % PER_PAGE) / 8), k: i % 8 });

export type Pt = [number, number];
export interface Gray { w: number; h: number; data: Uint8Array | Uint8ClampedArray } // 밝기 0(검정)~255

// QR 글: 앱 검사지(S)·선생님 양식(F), 번호 0~99, 쪽 1~9
export const qrText = (kind: "S" | "F", no: number, page: number) => `MAM1|${kind}|${no}|${page}`;
export function parseQr(t: string | null | undefined): { kind: "S" | "F"; no: number; page: number } | null {
  const m = /^MAM1\|([SF])\|(\d{1,2})\|(\d)$/.exec(String(t ?? "").trim());
  return m ? { kind: m[1] as "S" | "F", no: +m[2], page: +m[3] } : null;
}

// ── 사영 변환: 검사지 좌표 네 점 → 그림 좌표 네 점 ──
export type H = number[]; // 3×3(마지막 1)
export function homography(src: Pt[], dst: Pt[]): H | null {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // 가우스 소거(8×8)
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const h = A.map((row, i) => row[8] / row[i]);
  return [...h, 1];
}
export function apply(h: H, [x, y]: Pt): Pt {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

// 오츠 문턱값(검정·흰색을 가르는 밝기)
export function otsu(g: Gray): number {
  const hist = new Array(256).fill(0);
  const step = Math.max(1, Math.floor(g.data.length / 400000));
  let n = 0;
  for (let i = 0; i < g.data.length; i += step) { hist[g.data[i]]++; n++; }
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; t = i; }
  }
  return Math.min(t, 200);
}

// 모서리마다 검은 네모(표식) 찾기: 모서리 쪽 칸에서 꽉 찬 네모 덩어리 가운데 모서리에 가장 가까운 것
export function findFiducials(g: Gray, t = otsu(g)): Pt[] | null {
  const exp = (FID.size * g.w) / PAGE.w; // 그림에서 표식 한 변(쪽이 그림을 거의 채운다고 보고)
  const rw = Math.round(g.w * 0.14), rh = Math.round(g.h * 0.095);
  const corners: [number, number, number, number, Pt][] = [
    [0, 0, rw, rh, [0, 0]], [g.w - rw, 0, g.w, rh, [g.w, 0]], [0, g.h - rh, rw, g.h, [0, g.h]], [g.w - rw, g.h - rh, g.w, g.h, [g.w, g.h]],
  ];
  const out: Pt[] = [];
  for (const [x0, y0, x1, y1, corner] of corners) {
    const W = x1 - x0, Hh = y1 - y0;
    const seen = new Uint8Array(W * Hh);
    let best: { c: Pt; d: number } | null = null;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (seen[i] || g.data[(y + y0) * g.w + x + x0] > t) continue;
      // 이어진 검은 덩어리(4방향)
      const stack = [i];
      seen[i] = 1;
      let area = 0, sx = 0, sy = 0, minx = x, maxx = x, miny = y, maxy = y;
      while (stack.length) {
        const j = stack.pop()!;
        const jx = j % W, jy = (j / W) | 0;
        area++; sx += jx; sy += jy;
        if (jx < minx) minx = jx; if (jx > maxx) maxx = jx; if (jy < miny) miny = jy; if (jy > maxy) maxy = jy;
        for (const [nx, ny] of [[jx + 1, jy], [jx - 1, jy], [jx, jy + 1], [jx, jy - 1]]) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= Hh) continue;
          const k = ny * W + nx;
          if (seen[k] || g.data[(ny + y0) * g.w + nx + x0] > t) continue;
          seen[k] = 1;
          stack.push(k);
        }
        if (area > exp * exp * 6) break; // 너무 큰 덩어리(그림자·가장자리)는 그만
      }
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      const fill = area / (bw * bh);
      if (bw < exp * 0.5 || bh < exp * 0.5 || bw > exp * 2 || bh > exp * 2) continue;
      if (Math.abs(bw - bh) > Math.max(bw, bh) * 0.35 || fill < 0.75) continue;
      const c: Pt = [sx / area + x0, sy / area + y0];
      const d = Math.hypot(c[0] - corner[0], c[1] - corner[1]);
      if (!best || d < best.d) best = { c, d };
    }
    if (!best) return null;
    out.push(best.c);
  }
  return out;
}

// 그림이 거꾸로 들어왔으면 180도 돌린다(QR이 아래 왼쪽에서 보일 때)
export function rotate180(g: Gray): Gray {
  const d = new Uint8Array(g.data.length);
  for (let i = 0; i < d.length; i++) d[i] = g.data[d.length - 1 - i];
  return { w: g.w, h: g.h, data: d };
}

// 칸 안쪽(테두리 빼고)의 검은 점 비율
export function darkness(g: Gray, h: H, cx: number, cy: number, t: number, half = BOX / 2 - 12): number {
  let dark = 0, n = 0;
  const steps = 14;
  for (let a = 0; a < steps; a++) for (let b = 0; b < steps; b++) {
    const [x, y] = apply(h, [cx - half + ((a + 0.5) * 2 * half) / steps, cy - half + ((b + 0.5) * 2 * half) / steps]);
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= g.w || yi >= g.h) continue;
    n++;
    if (g.data[yi * g.w + xi] <= t) dark++;
  }
  return n ? dark / n : 0;
}

// 칸 바깥 둘레(테두리 바로 바깥 6~21): 칸을 동그라미로 둘러 표시한 학생도 읽으려고
export function ringDarkness(g: Gray, h: H, cx: number, cy: number, t: number): number {
  const a = BOX / 2 + 6, b = BOX / 2 + 21;
  let dark = 0, n = 0;
  for (let u = -b; u <= b; u += 3) for (let v = -b; v <= b; v += 3) {
    const m = Math.max(Math.abs(u), Math.abs(v));
    if (m < a || m > b) continue;
    const [x, y] = apply(h, [cx + u, cy + v]);
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= g.w || yi >= g.h) continue;
    n++;
    if (g.data[yi * g.w + xi] <= t) dark++;
  }
  return n ? dark / n : 0;
}
// 한 칸의 표시 정도: 안쪽 + 바깥 둘레(동그라미)
export const markScore = (g: Gray, h: H, cx: number, cy: number, t: number) => darkness(g, h, cx, cy, t) + 1.3 * ringDarkness(g, h, cx, cy, t);

export interface Mark { value: number | null; sure: boolean; why?: "빈칸" | "두 칸"; ratios: number[] }
// 한 문장의 다섯 칸에서 고른 칸: 가장 진한 칸이 뚜렷하면 그것, 아무 칸도 안 칠했거나 두 칸이 비슷하게 칠했으면 확인 필요.
// 연한 표시라도 다른 칸이 깨끗하면 확실로 본다.
export function pickMark(ratios: number[]): Mark {
  const order = ratios.map((r, i) => [r, i] as const).sort((a, b) => b[0] - a[0]);
  const [r1, i1] = order[0], [r2] = order[1];
  if (r1 < 0.04) return { value: null, sure: false, why: "빈칸", ratios };
  if (r2 > Math.max(0.04, r1 * 0.55)) return { value: i1 + 1, sure: false, why: "두 칸", ratios };
  return { value: i1 + 1, sure: r1 >= 0.08 || r2 <= 0.015, ratios };
}

// 쪽 하나 읽기: 표식으로 맞추고 그 쪽 16문장의 칸을 본다(page: 1·2)
export function readPage(g: Gray, page: number): { marks: Mark[]; h: H } | null {
  const t = otsu(g);
  const fids = findFiducials(g, t);
  if (!fids) return null;
  const h = homography(FID.at, fids);
  if (!h) return null;
  const marks: Mark[] = [];
  for (let j = 0; j < PER_PAGE; j++) {
    const { s, k } = placeOf((page - 1) * PER_PAGE + j);
    marks.push(pickMark(COLS.map((cx) => markScore(g, h, cx, boxY(s, k), t))));
  }
  return { marks, h };
}

// 빈 검사지의 번호 칸·문장 줄이 그림에서 어디인지(AI에 보낼 조각을 자르려고)
export function regionOf(h: H, x: number, y: number, w: number, hh: number) {
  const pts = [apply(h, [x, y]), apply(h, [x + w, y]), apply(h, [x, y + hh]), apply(h, [x + w, y + hh])];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// ── 스캔한 쪽들을 학생 한 명씩 묶기 ──
// 앱 검사지(S): 번호가 찍혔으면 번호로, 빈 검사지(번호 0)·QR을 못 읽은 쪽은 차례대로 1쪽 → 2쪽을 한 사람으로.
// 선생님 양식(F): 번호로 묶고 체크는 AI가 읽는다. 아무것도 못 읽은 쪽은 따로 두어 선생님이 고르게 한다.
export interface PageInfo { kind: "S" | "F" | null; no: number | null; page: number | null; marks: Mark[] | null }
export interface Entry {
  key: string;
  kind: "S" | "F" | "?";
  no: number | null; // 알아낸 번호(빈 검사지·못 읽음이면 null → AI나 선생님이)
  pages: number[]; // 스캔 파일 속 쪽 차례(0부터)
  sheetPages: (number | null)[]; // 각 쪽이 검사지 몇 쪽인지(모르면 null)
  answers: (number | null)[]; // 32문장(1~5)
  unsure: boolean[]; // 32문장: 기기가 확신하지 못한 칸
}
export function buildEntries(pages: PageInfo[]): Entry[] {
  const out: Entry[] = [];
  const blank = (): Entry => ({ key: "", kind: "S", no: null, pages: [], sheetPages: [], answers: Array(32).fill(null), unsure: Array(32).fill(true) });
  const put = (e: Entry, idx: number, sheetPage: number | null, marks: Mark[] | null) => {
    e.pages.push(idx);
    e.sheetPages.push(sheetPage);
    if (marks && sheetPage) marks.forEach((m, j) => {
      const i = (sheetPage - 1) * PER_PAGE + j;
      e.answers[i] = m.value;
      e.unsure[i] = !m.sure;
    });
  };
  let open: Entry | null = null; // 2쪽을 기다리는 빈 검사지
  let last: Entry | null = null; // 바로 앞 쪽이 들어간 사람(QR이 지워진 2쪽을 붙이려고)
  pages.forEach((p, idx) => {
    if (p.kind === "F") {
      let e = p.no ? out.find((x) => x.kind === "F" && x.no === p.no) : undefined;
      if (!e) { e = { ...blank(), kind: "F", no: p.no || null, key: `F${p.no}_${idx}` }; out.push(e); }
      put(e, idx, p.page, null);
      return;
    }
    if (!p.marks && p.kind !== "S") { out.push({ ...blank(), kind: "?", key: `?${idx}`, pages: [idx], sheetPages: [null] }); return; }
    if (p.kind === "S" && p.no) {
      let e = out.find((x) => x.kind === "S" && x.no === p.no && !x.sheetPages.includes(p.page));
      if (!e) { e = { ...blank(), no: p.no, key: `S${p.no}_${idx}` }; out.push(e); }
      put(e, idx, p.page, p.marks);
      last = e;
      return;
    }
    // QR이 지워진 쪽인데 바로 앞 사람이 1쪽만 있으면 그 사람의 2쪽으로
    if (!p.kind && last && last.kind === "S" && last.sheetPages.includes(1) && !last.sheetPages.includes(2)) {
      put(last, idx, 2, p.marks);
      if (open === last) open = null;
      last = null;
      return;
    }
    // 빈 검사지 또는 QR을 못 읽은 앱 검사지: 쪽을 알면 그대로, 모르면 열린 사람이 있으면 2쪽, 없으면 1쪽
    const sp = p.page ?? (open ? 2 : 1);
    if (sp === 1 || !open) {
      open = { ...blank(), key: `B${idx}` };
      out.push(open);
      put(open, idx, sp, p.marks);
      last = open;
      if (sp === 2) open = last = null;
    } else {
      put(open, idx, 2, p.marks);
      open = last = null;
    }
  });
  return out;
}
