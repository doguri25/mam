"use client";
// 손그림 그림 단추: 마음 친구와 같은 그림체로 그린 작은 그림들. 앱 곳곳의 기본 이모지 대신 쓴다.
// 따뜻한 세피아 잉크선 + 잉크 그림자(아래·오른쪽 선이 굵어 보임) + 한 단계 셀 그림자(차가운 보라) + 윤기 한 줄.
// 크게 그릴 때(30px 넘게)는 선이 살짝 떨려 손으로 그린 듯하다.
import { Fragment, useId, type ReactNode } from "react";
import { INK, paints, smooth } from "./buddy/paint";

const C = {
  red: "#ef6b5b", pink: "#f58fa6", orange: "#f5a04a", yellow: "#f7c948", gold: "#f2bd3c", green: "#7cc06a", teal: "#56b9ae",
  blue: "#6aa6e6", navy: "#5a7bd0", purple: "#a28be0", brown: "#c99460", paper: "#fff4dc", white: "#fffaf0", grey: "#a9b6c6",
  skin: "#f6c9a4", sky: "#9fd3f5", glass: "#e3f3fa", cloud: "#f7f9fc", dusk: "#8f7cc8", storm: "#8b93a8",
};
const SOFT = "#bba98e"; // 종이 위 연필 줄

// 도형 길잡이(48×48 칸)
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x + r}Q${x},${y + h} ${x},${y + h - r}V${y + r}Q${x},${y} ${x + r},${y}Z`;
const el = (cx: number, cy: number, rx: number, ry = rx) => `M${cx - rx},${cy}a${rx},${ry} 0 1 0 ${2 * rx},0a${rx},${ry} 0 1 0 ${-2 * rx},0Z`;
const heart = (cx: number, cy: number, s: number) =>
  `M${cx},${cy + s * 0.95}C${cx - s * 1.7},${cy - s * 0.1} ${cx - s * 0.75},${cy - s * 1.45} ${cx},${cy - s * 0.45}C${cx + s * 0.75},${cy - s * 1.45} ${cx + s * 1.7},${cy - s * 0.1} ${cx},${cy + s * 0.95}Z`;
const star5 = (cx: number, cy: number, R: number, r = R * 0.48) =>
  `M${Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r : R;
    return `${(cx + Math.cos(a) * k).toFixed(2)},${(cy + Math.sin(a) * k).toFixed(2)}`;
  }).join("L")}Z`;
const star4 = (cx: number, cy: number, s: number) => `M${cx},${cy - s}Q${cx + s * 0.16},${cy - s * 0.16} ${cx + s},${cy}Q${cx + s * 0.16},${cy + s * 0.16} ${cx},${cy + s}Q${cx - s * 0.16},${cy + s * 0.16} ${cx - s},${cy}Q${cx - s * 0.16},${cy - s * 0.16} ${cx},${cy - s}Z`;
const drop = (cx: number, cy: number, s: number) => `M${cx},${cy - s}C${cx + s * 0.9},${cy} ${cx + s * 0.75},${cy + s * 0.9} ${cx},${cy + s * 0.9}C${cx - s * 0.75},${cy + s * 0.9} ${cx - s * 0.9},${cy} ${cx},${cy - s}Z`;
// 뭉게구름: 아래가 평평하고 위가 몽글몽글
const cloud = (x: number, y: number, w: number, h: number) =>
  `M${x + h * 0.45},${y + h}Q${x},${y + h} ${x},${y + h * 0.62}Q${x},${y + h * 0.3} ${x + w * 0.22},${y + h * 0.36}Q${x + w * 0.26},${y} ${x + w * 0.52},${y}Q${x + w * 0.76},${y} ${x + w * 0.8},${y + h * 0.34}Q${x + w},${y + h * 0.36} ${x + w},${y + h * 0.68}Q${x + w},${y + h} ${x + w - h * 0.4},${y + h}Z`;
const gear = (cx: number, cy: number, R: number, r: number, n = 8) =>
  smooth(Array.from({ length: n * 4 }, (_, i) => {
    const a = (i / (n * 4)) * Math.PI * 2, k = i % 4 < 2 ? R : r;
    return [cx + Math.cos(a + Math.PI / (n * 4)) * k, cy + Math.sin(a + Math.PI / (n * 4)) * k] as [number, number];
  }));
const rays = (cx: number, cy: number, r1: number, r2: number, n = 8, off = 0, step = (Math.PI * 2) / n) =>
  Array.from({ length: n }, (_, i) => {
    const a = off + i * step;
    return `M${(cx + Math.cos(a) * r1).toFixed(2)},${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)},${(cy + Math.sin(a) * r2).toFixed(2)}`;
  }).join("");

interface Pen {
  b: (d: string, c: string, hi?: string) => ReactNode; // 셀 칠한 덩어리(잉크 그림자·그림자·밝은 면·윤곽·윤기)
  p: (d: string, c: string, w?: number) => ReactNode; // 납작하게 칠하고 선만(작은 조각)
  l: (d: string, w?: number, c?: string, dash?: string) => ReactNode; // 잉크 선
  t: (d: string, c: string, w?: number) => ReactNode; // 색 굵은 선(잉크 테두리)
  f: (d: string, c: string, o?: number) => ReactNode; // 선 없이 칠
  g: (transform: string, ...kids: ReactNode[]) => ReactNode;
}

// 그림 목록: 이름 → 그리는 방법
const ICONS = {
  // ── 선생님 메뉴 ──
  map: ({ b, l, f }: Pen) => [
    b("M5 13L17 8L31 13L43 8V35L31 40L17 35L5 40Z", C.paper, "M9 16V22"),
    f("M17 8L31 13V40L17 35Z", "#000", 0.06),
    l("M17 8V35M31 13V40", 1.6),
    l("M9 32Q13 24 20 27T31 22", 1.9, C.red, "2.6 3"),
    b(heart(35.5, 20, 4.6), C.red),
  ],
  letter: ({ b, l }: Pen) => [b(rr(4, 12, 40, 27, 4), C.paper, "M8 18V24"), l("M6 15L24 28L42 15", 2), b(heart(24, 27.5, 6.4), C.pink, "M20.5 25Q21 22.5 23 22.5")],
  envelope: ({ b, l }: Pen) => [b(rr(4, 12, 40, 27, 4), "#d9e8fb", "M8 18V24"), l("M6 15L24 28L42 15", 2), l("M7 36L18.5 25.5M41 36L29.5 25.5", 1.5)],
  memo: ({ b, l, p, f, g }: Pen) => [
    b("M8 5H29L36 12V43H8Z", C.white, "M12 9V15"),
    l("M29 5V12H36", 1.7),
    l("M13 19H29M13 25H27M13 31H21", 1.6, SOFT),
    g("rotate(45 34 33)", b(rr(31, 19, 7, 20, 1), C.yellow), b("M31 39H38L34.5 46Z", C.skin), f("M33.3 43.6H35.7L34.5 46Z", INK), p(rr(31, 15.5, 7, 4, 1.5), C.pink)),
  ],
  notebook: ({ b, l, p }: Pen) => [b(rr(10, 5, 31, 38, 4), C.orange, "M14 10V18"), l("M10 12H6M10 20H6M10 28H6M10 36H6", 2.2), p(rr(18, 13, 17, 9, 2), C.white), l("M21 17.5H32", 1.4, SOFT)],
  compass: ({ b, p, f, g }: Pen) => [
    b(el(24, 24, 19), C.gold, "M10 17Q12 11 17 8"), p(el(24, 24, 13.5), C.white),
    g("rotate(35 24 24)", b("M24 11.5L28.6 24H19.4Z", C.red), b("M19.4 24H28.6L24 36.5Z", C.blue)), f(el(24, 24, 2), INK),
  ],
  page: ({ b, l, p }: Pen) => [b("M9 5H30L38 13V43H9Z", C.white, "M13 9V15"), l("M30 5V13H38", 1.7), l("M14 16H27", 1.6, SOFT), p(rr(14, 30, 5, 8, 1), C.teal), p(rr(21, 25, 5, 13, 1), C.yellow), p(rr(28, 20, 5, 18, 1), C.pink)],
  house: ({ b, p }: Pen) => [
    b("M10 22V42H38V22L24 11Z", C.paper), b("M5 24L24 6.5L43 24L39 27.5L24 14L9 27.5Z", C.red, "M12 20L20 12.5"),
    p(rr(20, 29, 8, 13, 2), C.brown), p(rr(29.5, 26, 6, 6, 1), C.sky), p(rr(12.5, 26, 6, 6, 1), C.sky),
  ],
  books: ({ b, l }: Pen) => [
    b(rr(7, 10, 10, 32, 2), C.red, "M10 15V20"), b(rr(17, 14, 9, 28, 2), C.blue), b("M27 16L35.5 13L44 40L35.5 43Z", C.green),
    l("M7 16H17M7 36H17M17 20H26M17 36H26", 1.4), l("M29.2 22L37.7 19M33.6 36.5L42 33.6", 1.4),
  ],
  crayon: ({ b, p, l, g }: Pen) => [g("rotate(40 24 24)", b(rr(19, 13, 10, 31, 2.5), C.pink), b("M19.6 13.4L24 4L28.4 13.4Z", C.pink), p(rr(19, 19, 10, 17, 1), C.white), l("M21.5 24H26.5M21.5 30H26.5", 1.3, SOFT))],
  key: ({ b, p, g }: Pen) => [g("rotate(-35 24 24)", b("M20 21.5H41Q43.5 21.5 43.5 24V26.5H40.5V31H36.5V26.5H33.5V30H30V26.5H20Z", C.gold), b(el(14, 24, 9.5), C.gold, "M8 21Q9 17 12 16"), p(el(14, 24, 3.4), C.white))],
  gear: ({ b, p }: Pen) => [b(gear(24, 24, 19, 14.5), C.grey, "M12 15Q14 12 17 10.5"), p(el(24, 24, 5.6), C.white)],
  book: ({ b, l, p }: Pen) => [p(rr(13, 9, 27, 35, 3), C.white), l("M36 12V41", 1.2, SOFT), b(rr(8, 5, 27, 36, 3), C.blue, "M17 9H24"), l("M13 5V41", 1.7), p(rr(17, 12, 13, 7, 1.5), C.paper)],
  tv: ({ b, l, p, f }: Pen) => [
    l("M18 5L24 12L31 4", 2), b(rr(4, 12, 40, 28, 6), "#d99268", "M8 18V26"), p(rr(9, 17, 25, 18, 4), C.sky),
    b(heart(21.5, 26.5, 4.2), C.pink), f(el(38.5, 21, 2), INK), f(el(38.5, 28, 2), INK), l("M12 40L10 44M36 40L38 44", 2.2),
  ],
  flask: ({ b, l, p }: Pen) => [
    b("M20 6H28V18L39 37Q41.5 42 36 42H12Q6.5 42 9 37L20 18Z", C.glass),
    b("M14.6 29H33.4L39 37Q41.5 42 36 42H12Q6.5 42 9 37Z", C.green),
    l("M20 6H28V18L39 37Q41.5 42 36 42H12Q6.5 42 9 37L20 18Z", 2.4), l("M17 6H31", 2.6),
    p(el(19.5, 35, 2.1), C.white, 1.2), p(el(27, 32.5, 1.5), C.white, 1.2), l("M23 10V17", 1.6, "#fff"),
  ],
  lock: ({ b, t, f }: Pen) => [t("M15 22V15Q15 6 24 6Q33 6 33 15V22", C.grey, 3.6), b(rr(9, 20, 30, 22, 5), C.gold, "M13 25V30"), f(el(24, 29.5, 2.7), INK), f("M22.6 30.5H25.4L26.2 36.5H21.8Z", INK)],
  school: ({ b, l, p }: Pen) => [
    l("M24 13V3", 1.8), b("M24 3.5L32.5 6L24 8.5Z", C.yellow), b("M7 22H41V43H7Z", C.paper), b("M4 23.5L24 12L44 23.5Z", C.red),
    p(el(24, 20, 2.8), C.white), p(rr(20, 32, 8, 11, 2), C.brown), p(rr(10.5, 27, 6.5, 5.5, 1), C.sky), p(rr(31, 27, 6.5, 5.5, 1), C.sky),
  ],
  // ── 학생 화면 ──
  calendar: ({ b, t, f }: Pen) => [
    b(rr(6, 9, 36, 33, 5), C.white), b("M6 18V14Q6 9 11 9H37Q42 9 42 14V18Z", C.red, "M11 12.5H18"),
    t("M15 5V12", C.grey, 2.4), t("M33 5V12", C.grey, 2.4),
    ...[[14, 25], [24, 25], [34, 25], [14, 32], [24, 32], [14, 38.5], [24, 38.5]].map(([x, y]) => f(el(x, y, 2.1), "#cdb99c")),
    b(heart(34, 35, 3.6), C.pink),
  ],
  dice: ({ b, f, g }: Pen) => [g("rotate(-12 24 24)", b(rr(8, 8, 32, 32, 8), C.white, "M13 15V21"), ...[[16, 16], [32, 16], [16, 32], [32, 32]].map(([x, y]) => f(el(x, y, 3), INK)), f(el(24, 24, 3.4), C.red))],
  bookOpen: ({ b, l }: Pen) => [
    b("M24 12Q14 6 4 9V38Q14 35 24 41Z", C.white, "M8 14V20"), b("M24 12Q34 6 44 9V38Q34 35 24 41Z", C.white),
    l("M8 17Q14 15 20 18M8 23Q14 21 20 24M8 29Q14 27 20 30M28 18Q34 15 40 17M28 24Q34 21 40 23", 1.4, SOFT), l("M24 12V41", 1.8),
  ],
  palette: ({ b, p }: Pen) => [
    b("M24 6C37 6 45 13 44 22C43 30 35 27 33 32C31 37 37 41 28 42.5C15 44 4 36 4 24C4 13 13 6 24 6Z", "#e9c48f", "M10 17Q12 12 17 10"),
    p(el(14.5, 25, 3.6), C.green), p(el(17, 16, 3.6), C.red), p(el(26, 12.5, 3.6), C.yellow), p(el(35, 16.5, 3.6), C.blue), p(el(23, 33, 3.2), C.white),
  ],
  calm: ({ b, l, t, p }: Pen) => [t("M17 15V10Q17 7 20 7H28Q31 7 31 10V15", C.grey, 2.6), b(rr(5, 14, 38, 28, 5), C.teal, "M9 19V26"), l("M5 23H43", 1.8), p(rr(20, 20, 8, 6, 1.5), C.gold), b(heart(24, 34, 4.4), C.pink)],
  mic: ({ b, l }: Pen) => [l("M11 21Q11 34 24 34Q37 34 37 21", 2.4), l("M24 34V41M16 42H32", 2.6), b(rr(17, 4, 14, 24, 7), C.grey, "M20.5 9V15"), l("M17.5 13H30.5M17.5 18.5H30.5", 1.3)],
  sun: ({ b, t }: Pen) => [t(rays(24, 24, 15, 21), C.orange, 3), b(el(24, 24, 11), C.yellow, "M16 21Q17 17 21 15.5")],
  sunset: ({ b, t }: Pen) => [
    t(rays(24, 30, 15.5, 20.5, 5, Math.PI + Math.PI / 6, Math.PI / 6), C.orange, 2.8), b("M10 30A14 14 0 0 1 38 30Z", "#f7875a", "M15 25Q17 21 21 19.5"),
    t("M4 31H44", C.dusk, 2.6), t("M13 37H35", C.dusk, 2.4), t("M19 42.5H29", C.dusk, 2.2),
  ],
  speaker: ({ b, l }: Pen) => [b("M5 18H12L22 9V39L12 30H5Z", C.blue, "M8 21V25"), l("M28 18Q32 24 28 30M33.5 12.5Q41 24 33.5 35.5", 2.6)],
  speakerOff: ({ b, l }: Pen) => [b("M5 18H12L22 9V39L12 30H5Z", C.grey, "M8 21V25"), l("M29 19L39 29M39 19L29 29", 2.6)],
  globe: ({ b, l }: Pen) => [b(el(24, 24, 19), C.sky, "M10 16Q12 11 17 8.5"), l("M24 5Q12 24 24 43M24 5Q36 24 24 43M24 5V43M6.5 17H41.5M6.5 31H41.5", 1.5)],
  signal: ({ b }: Pen) => [b(rr(6, 31, 7, 11, 1.5), C.green), b(rr(15.5, 24, 7, 18, 1.5), C.green), b(rr(25, 16, 7, 26, 1.5), C.green), b(rr(34.5, 8, 7, 34, 1.5), C.green, "M37.5 12V18")],
  flower: ({ b, g }: Pen) => [...[0, 72, 144, 216, 288].map((a) => g(`rotate(${a} 24 25)`, b(el(24, 13, 6.4, 8.6), C.pink))), b(el(24, 25, 5.4), C.yellow)],
  star: ({ b }: Pen) => [b(star5(24, 25.5, 20), C.yellow, "M17 21L21.5 20")],
  pencil: ({ b, p, f, g }: Pen) => [g("rotate(45 24 24)", b(rr(19, 11, 10, 25, 1), C.yellow, "M21.5 15V31"), b("M19 36H29L24 45Z", C.skin), f("M22.2 41.3H25.8L24 45Z", INK), p(rr(19, 8, 10, 4, 0.5), C.grey), b("M19 8V5.5Q19 2.5 22 2.5H26Q29 2.5 29 5.5V8Z", C.pink))],
  sprout: ({ b, t }: Pen) => [t("M24 41Q23 32 24 24", C.green, 3), b("M24 27Q11 28 7 15Q20 12 24 27Z", C.green, "M11 17Q15 17 18 20"), b("M24 24Q30 9 42 10Q40 25 24 24Z", "#94d07a"), b("M11 43Q24 34 37 43Z", C.brown)],
  gift: ({ b, p }: Pen) => [b(rr(8, 21, 32, 21, 3), C.red, "M12 26V33"), b(rr(6, 14, 36, 8, 3), C.red), p(rr(21, 14, 6, 28, 0.5), C.gold), b("M24 14Q14 3 11 9Q10 15 24 14Z", C.gold), b("M24 14Q34 3 37 9Q38 15 24 14Z", C.gold)],
  // ── 마음 친구 꾸미기 칸 ──
  bubble: ({ b, l }: Pen) => [b(el(19, 28, 13), "#bfe5f4", "M10 24Q11 19 15 17"), b(el(36, 13.5, 7), "#cfeaf6", "M32 11Q33 9 35 8.5"), b(el(37, 35, 5), "#cfeaf6"), l("M13 31Q14 35 18 36", 1.2, "#fff")],
  eyes: ({ b, f }: Pen) => [b(el(15, 24, 9, 12), C.white), b(el(33, 24, 9, 12), C.white), f(el(17, 26.5, 4, 5.4), INK), f(el(35, 26.5, 4, 5.4), INK), f(el(18.4, 24.3, 1.4), "#fff"), f(el(36.4, 24.3, 1.4), "#fff")],
  cheek: ({ b, l, f }: Pen) => [
    b(el(24, 25, 19), C.paper, "M10 18Q12 13 16 10"), l("M13 21Q16 18 19 21M29 21Q32 18 35 21", 2), l("M21 30Q24 33 27 30", 2),
    f(el(13, 29, 5.5, 3.6), "#ff8fa3", 0.85), f(el(35, 29, 5.5, 3.6), "#ff8fa3", 0.85), l("M12 27l-1.6 3.6M15 27l-1.6 3.6M34 27l-1.6 3.6M37 27l-1.6 3.6", 1, "#c4566a"),
  ],
  spots: ({ b, f }: Pen) => [b(el(24, 24, 19), C.blue, "M10 16Q12 11 17 8.5"), ...[[16, 19, 4], [30, 14, 3], [32, 30, 5], [18, 33, 3]].map(([x, y, r]) => f(el(x, y, r), "#fff", 0.7))],
  hand: ({ b, l }: Pen) => [b("M13 26V14Q13 10.5 16 10.5Q19 10.5 19 14V8.5Q19 5 22 5Q25 5 25 8.5V9Q25 6 28 6Q31 6 31 9.5V15Q31 12 34 12Q37 12 37 15.5V30Q37 43 25 43Q17 43 13 36L7.5 27.5Q6 24.5 8.7 23.6Q11 23 13 26Z", C.skin, "M16 15V21"), l("M19 14V23M25 9V22M31 15V23", 1.4)],
  ribbon: ({ b }: Pen) => [b("M22 24L15 41L20 39L23 42L25.5 25Z", C.pink), b("M26 24L33 41L28 39L25 42L22.5 25Z", C.pink), b("M24 22Q10 7 6 16Q4 28 24 24Z", C.pink, "M9 16Q10 13 12 12.5"), b("M24 22Q38 7 42 16Q44 28 24 24Z", C.pink), b(rr(19.5, 18.5, 9, 9, 3.5), C.pink)],
  tag: ({ b, l, p }: Pen) => [b("M4 15Q4 11 8 11H31L44 24L31 37H8Q4 37 4 33Z", C.yellow, "M8 16V22"), p(el(34.5, 24, 2.8), C.white), l("M10 21H25M10 27H21", 1.6, "#9a7a3a")],
  // ── 마음 다스리기 ──
  squeeze: ({ b, l }: Pen) => [b("M11 22Q11 13 19 13H31Q39 13 39 21V31Q39 42 28 42H20Q11 42 11 33Z", C.skin, "M15 19V25"), l("M19 13.5V22M25 13.5V22M31 13.5V22", 1.4), b("M11 27Q19 24 26 28Q25 33 14 32Z", C.skin)],
  magnifier: ({ b, p, t, l }: Pen) => [t("M30.5 30.5L41 41", C.brown, 5), b(el(21, 21, 14), C.grey), p(el(21, 21, 9.6), C.glass), l("M15 17Q16 14 19 13", 1.8, "#fff")],
  ear: ({ b, l }: Pen) => [b("M15 19Q15 6 27 6Q38 6 38 18Q38 26 32 30Q28.5 33 28.5 37Q28.5 43 21.5 43Q15 43 15 37Z", C.skin, "M18 15Q19 11 22 9.5"), l("M21 19Q21 12 27 12Q32 12 32 18Q32 22 28 24.5Q26 26 26 29", 1.8)],
  nose: ({ b, f }: Pen) => [b("M23 6Q26 21 33 29Q37.5 34.5 33 39Q29.5 42 25.5 40Q23.5 42 19.5 41Q13.5 39 14.5 34Q15.5 30 19.5 28Q22 20 23 6Z", C.skin, "M21 14V22"), f(el(27.5, 37, 2.2, 1.4), "#9b5b3c")],
  heart: ({ b, l }: Pen) => [b(heart(23, 25, 14), C.pink, "M11 21Q11.5 16 16 15"), l("M38 9l3 -3M40.5 15h4M37.5 4.5l0.5 -3", 1.6)],
  // ── 선생님 화면 단추·제목 ──
  printer: ({ b, l, p, f }: Pen) => [p(rr(14, 4, 20, 15, 1), C.white), b(rr(4, 15, 40, 18, 5), C.grey, "M8 20V26"), l("M11 27H37", 2.2), p("M13 27H35V43H13Z", C.white), l("M17 32H31M17 37H27", 1.4, SOFT), f(el(37, 20.5, 1.9), C.green)],
  warning: ({ b, l, f }: Pen) => [b("M24 5L44.5 39.5Q46 43 42 43H6Q2 43 3.5 39.5Z", C.yellow, "M17 20L13 27"), l("M24 17V29.5", 3.6), f(el(24, 36, 2.2), INK)],
  phone: ({ b, p, f }: Pen) => [b(rr(12, 3, 24, 42, 5), C.navy, "M15 9V16"), p(rr(15.5, 8, 17, 28, 2), C.sky), b(heart(24, 22, 4.2), C.pink), f(el(24, 40.5, 1.7), C.white)],
  clipboard: ({ b, l, p }: Pen) => [b(rr(8, 8, 32, 36, 4), C.brown, "M11.5 13V20"), p(rr(12.5, 13, 23, 27, 1.5), C.white), b(rr(17, 4.5, 14, 8, 3), C.grey), l("M17 21H31M17 27H31M17 33H26", 1.4, SOFT)],
  sparkle: ({ b }: Pen) => [b(star4(20, 27, 15), C.yellow, "M16 22Q18 20 19 17"), b(star4(37, 11, 7), C.yellow), b(star4(38, 36, 5), C.yellow)],
  dotYellow: ({ b }: Pen) => [b(el(24, 24, 15), C.yellow, "M14 19Q16 13.5 21 12")],
  dotRed: ({ b }: Pen) => [b(el(24, 24, 15), C.red, "M14 19Q16 13.5 21 12")],
  siren: ({ b, p, t }: Pen) => [t("M24 2.5V7.5M8 10.5L12 14.5M40 10.5L36 14.5M3.5 25H8.5M39.5 25H44.5", C.yellow, 2.6), p(rr(9, 35, 30, 8, 2.5), C.grey), b("M14 35V25Q14 14 24 14Q34 14 34 25V35Z", C.red, "M18 22Q19 19 21 18")],
  speech: ({ b, f }: Pen) => [b("M8 7H40Q44 7 44 11V29Q44 33 40 33H22L12 42L13.5 33H8Q4 33 4 29V11Q4 7 8 7Z", C.white, "M8 12V18"), f(el(15, 20, 2.3), INK), f(el(24, 20, 2.3), INK), f(el(33, 20, 2.3), INK)],
  thumb: ({ b, l }: Pen) => [b(rr(4, 21, 9, 21, 2), C.blue), b("M14 22H18L23.5 8.5Q26.5 4 30 7.5Q31.5 11.5 29.5 19H38.5Q43 19 42 24L39 38Q38 42 33 42H14Z", C.skin, "M18 25V32"), l("M39.5 26H32M39 32H32M38 38H32", 1.4)],
  chart: ({ b, l, t }: Pen) => [b(rr(5, 5, 38, 38, 6), C.white), l("M11 11V36H37", 1.6, SOFT), t("M13 31L21 23L27 27.5L37 14", C.green, 3)],
  bars: ({ b, l }: Pen) => [b(rr(5, 5, 38, 38, 6), C.white), b(rr(11, 25, 7, 12, 1), C.teal), b(rr(20.5, 17, 7, 20, 1), C.yellow), b(rr(30, 11, 7, 26, 1), C.pink), l("M9 37.5H39", 1.6, SOFT)],
  clip: ({ t, g }: Pen) => [g("rotate(25 24 24)", t("M29 13V33Q29 41 22 41Q15 41 15 33V13Q15 6.5 20 6.5Q25 6.5 25 13V31Q25 34.5 22 34.5Q19 34.5 19 31V16", C.grey, 2.8))],
  download: ({ b }: Pen) => [b("M5 29V39Q5 43 9 43H39Q43 43 43 39V29H36V35H12V29Z", C.grey), b("M19.5 4H28.5V18H36L24 31L12 18H19.5Z", C.green, "M22.5 8V15")],
  // ── 교실 화면 날씨 ──
  sunCloud: ({ b, t }: Pen) => [t(rays(18, 18, 12, 17, 8, Math.PI / 8), C.orange, 2.6), b(el(18, 18, 9), C.yellow, "M11.5 16Q12.5 12.5 15.5 11"), b(cloud(18, 25, 27, 16), C.cloud)],
  partly: ({ b, t }: Pen) => [t(rays(29, 15, 10.5, 14.5, 5, -Math.PI, Math.PI / 4), C.orange, 2.4), b(el(29, 15, 8), C.yellow), b(cloud(4, 18, 36, 23), C.cloud, "M10 30Q11 26 15 25.5")],
  rainbow: ({ b, t }: Pen) => [t("M6 37A18 18 0 0 1 42 37", C.red, 4.2), t("M11.5 37A12.5 12.5 0 0 1 36.5 37", C.yellow, 4.2), t("M17 37A7 7 0 0 1 31 37", C.blue, 4.2), b(cloud(1, 30, 15, 12), C.cloud), b(cloud(32, 30, 15, 12), C.cloud)],
  cloud: ({ b }: Pen) => [b(cloud(3, 12, 42, 26), "#eef1f6", "M9 27Q10 22 15 21")],
  rain: ({ b }: Pen) => [b(cloud(3, 5, 42, 24), "#dfe5ee", "M9 19Q10 14 15 13.5"), b(drop(14, 36, 4.6), C.sky), b(drop(25, 41, 4.6), C.sky), b(drop(36, 36, 4.6), C.sky)],
  storm: ({ b }: Pen) => [b(cloud(3, 4, 42, 24), C.storm, "M9 18Q10 13 15 12.5"), b("M25 25L17 36H24L20 46L33 32H26L30 25Z", C.yellow)],
  fog: ({ b, t }: Pen) => [b(cloud(8, 4, 32, 19), "#eceaf3"), t("M5 29Q12 26 19 29T33 29T43 28", C.grey, 2.8), t("M8 37Q15 34 22 37T36 37", C.grey, 2.8), t("M14 44Q21 41 28 44T40 43.5", C.grey, 2.8)],
  // ── 까닭 카드 ──
  friends: ({ b, f, l }: Pen) => [
    b(el(16, 30, 11, 12), C.teal, "M9 26Q10 22 13 20.5"), b(el(32.5, 31.5, 10.5, 11), C.orange, "M26 28Q27 24.5 30 23"),
    f(el(13, 29, 1.6), INK), f(el(19.5, 29, 1.6), INK), f(el(29.5, 30.5, 1.6), INK), f(el(36, 30.5, 1.6), INK),
    l("M14 34Q16.2 36 18.5 34M30.5 35.5Q32.7 37.5 35 35.5", 1.5), b(heart(24.5, 12, 5), C.pink),
  ],
  study: ({ b, l, f, g }: Pen) => [
    b("M24 14Q14 8 4 11V39Q14 36 24 42Z", C.white), b("M24 14Q34 8 44 11V39Q34 36 24 42Z", C.white), l("M24 14V42", 1.8), l("M8 19Q14 17 20 20M8 25Q14 23 20 26M28 20Q34 17 40 19", 1.4, SOFT),
    g("rotate(35 36 18)", b(rr(33, 2, 6, 19, 1), C.blue), b("M33 21H39L36 26Z", C.skin), f("M35.1 24.5H36.9L36 26Z", INK)),
  ],
  bandage: ({ b, p, f, g }: Pen) => [g("rotate(-35 24 24)", b(rr(4, 16, 40, 16, 8), C.skin, "M10 20Q12 18.5 15 18.5"), p(rr(17, 16, 14, 16, 0.5), "#fbe1c9", 1.4), ...[[20.5, 20.5], [27.5, 20.5], [20.5, 27.5], [27.5, 27.5]].map(([x, y]) => f(el(x, y, 1.3), "#d49b70")))],
  cloudDots: ({ b, f }: Pen) => [b(cloud(3, 10, 42, 27), "#eef1f6", "M9 25Q10 20 15 19.5"), f(el(16, 29, 2.4), "#8e9aaa"), f(el(24, 29, 2.4), "#8e9aaa"), f(el(32, 29, 2.4), "#8e9aaa")],
} satisfies Record<string, (p: Pen) => ReactNode[]>;

export type DoodleName = keyof typeof ICONS;
export const DOODLES = Object.keys(ICONS) as DoodleName[];

export default function Doodle({ name, size = "1.3em", label, className = "inline-block shrink-0 align-[-0.25em]", wobble }: {
  name: DoodleName; size?: number | string; label?: string; className?: string; wobble?: boolean;
}) {
  const id = `d${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const boil = wobble ?? (typeof size === "number" && size >= 30);
  let k = 0;
  const pen: Pen = {
    b: (d, c, hi) => {
      const n = k++;
      const pal = paints(c);
      return (
        <g key={n}>
          <clipPath id={`${id}${n}`}><path d={d} /></clipPath>
          <path d={d} fill={INK} transform="translate(0.9 1.4)" />
          <path d={d} fill={pal.shade} />
          <g clipPath={`url(#${id}${n})`}><path d={d} fill={pal.lit} transform="translate(-2.2 -2.4)" /></g>
          <path d={d} fill="none" stroke={INK} strokeWidth="2.3" strokeLinejoin="round" />
          {hi && <path d={hi} fill="none" stroke={pal.hi} strokeWidth="2" strokeLinecap="round" opacity="0.9" />}
        </g>
      );
    },
    p: (d, c, w = 1.8) => <path key={k++} d={d} fill={paints(c).lit} stroke={INK} strokeWidth={w} strokeLinejoin="round" />,
    l: (d, w = 2, c = INK, dash) => <path key={k++} d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />,
    t: (d, c, w = 3) => (
      <g key={k++} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} stroke={INK} strokeWidth={w + 2.6} transform="translate(0.5 0.8)" />
        <path d={d} stroke={paints(c).lit} strokeWidth={w} />
      </g>
    ),
    f: (d, c, o = 1) => <path key={k++} d={d} fill={c} opacity={o} />,
    g: (transform, ...kids) => <g key={k++} transform={transform}>{kids}</g>,
  };
  const art = (ICONS[name] ?? ICONS.star)(pen);
  return (
    <svg viewBox="-1 -1 50 50" width={size} height={size} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} overflow="visible">
      {boil && (
        <defs>
          <filter id={`${id}w`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed={name.length} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      )}
      <g filter={boil ? `url(#${id}w)` : undefined}>{art}</g>
    </svg>
  );
}

// 글 속 {이름}을 손그림 그림으로 바꿔 보여 준다(사용 설명서·진단 안내 글)
export function DoodleText({ text }: { text: string }) {
  return text.split(/\{(\w+)\}/).map((part, i) =>
    i % 2 && part in ICONS ? <Doodle key={i} name={part as DoodleName} /> : <Fragment key={i}>{part}</Fragment>,
  );
}
