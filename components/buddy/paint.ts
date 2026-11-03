// 손그림 느낌을 내는 작은 도우미: 물감 섞기, 둥근 몸 윤곽(부드러운 곡선), 장면 팔레트
import type { BuddyShape, Group } from "@/lib/shared";

const rgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// 두 색을 k만큼 섞는다(0이면 a, 1이면 b)
export function mix(a: string, b: string, k: number) {
  const x = rgb(a), y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

// 선 색: 검정이 아니라 따뜻한 세피아(셀 애니메이션의 갈색 선)
export const INK = "#3b2a22";

// 몸 색 하나로 셀 채색 물감 세트를 만든다: 밝은 면 · 그림자(차가운 보라 쪽) · 깊은 그림자 · 하이라이트 · 반사광
export function paints(base: string) {
  const b = mix(mix(base, "#fff1d6", 0.2), "#9c8f84", 0.08); // 쨍한 색을 과슈 물감처럼 누그러뜨림
  return {
    base: b,
    lit: mix(b, "#fffaf0", 0.1),
    shade: mix(mix(b, "#4a4790", 0.36), "#000000", 0.05),
    deep: mix(b, "#33284f", 0.48),
    hi: mix(b, "#ffffff", 0.62),
    bounce: mix(b, "#ffe2a8", 0.4),
    soft: mix(b, "#ffffff", 0.45), // 무늬·배
  };
}

// 닫힌 곡선(캣멀롬 → 베지어)
export function smooth(pts: [number, number][]) {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n];
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

// 마음 친구 몸 모양 9가지. 가운데가 (0,0)이고, 아래는 바닥에 앉은 듯 살짝 납작하다.
type Pts = [number, number][];
const ring = (n: number, f: (a: number, c: number, s: number) => [number, number]): Pts =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return f(a, Math.cos(a), Math.sin(a)); });
const sit = (y: number, ry: number, k = 0.13) => (y > 0 ? y * (1 - k * Math.pow(y / ry, 4)) : y); // 엉덩이는 납작
const SHAPES: Record<BuddyShape, { rx: number; ry: number; eye: number; pts: (rx: number, ry: number) => Pts }> = {
  // 동글이: 옆구리가 살짝 통통한 방울
  round: { rx: 60, ry: 57, eye: 0.34, pts: (rx, ry) => ring(30, (_, c, s) => [c * rx * (1 + 0.035 * Math.abs(c) ** 3), sit(s * ry, ry)]) },
  squish: { rx: 68, ry: 49, eye: 0.31, pts: (rx, ry) => ring(30, (_, c, s) => [c * rx * (1 + 0.035 * Math.abs(c) ** 3), sit(s * ry, ry)]) },
  bean: { rx: 51, ry: 64, eye: 0.37, pts: (rx, ry) => ring(30, (_, c, s) => [c * rx * (1 + 0.035 * Math.abs(c) ** 3), sit(s * ry, ry)]) },
  // 물방울이: 위가 뾰족하게 솟은 물방울
  drop: { rx: 56, ry: 60, eye: 0.36, pts: (rx, ry) => ring(40, (_, c, s) => { const k = Math.max(0, -s); return [c * rx * (1 - 0.8 * k ** 2.4), sit(s * ry * (1 + 0.22 * k ** 3), ry)]; }) },
  // 구름이: 몽글몽글 일곱 봉우리
  cloud: { rx: 64, ry: 52, eye: 0.32, pts: (rx, ry) => ring(70, (a, c, s) => { const r = 1 + 0.1 * Math.abs(Math.sin(3.5 * (a + Math.PI / 2))); return [c * rx * r, sit(s * ry * r, ry, 0.2)]; }) },
  // 별님이: 끝이 둥근 통통한 별(아래 두 뿔이 발)
  star: { rx: 64, ry: 62, eye: 0.29, pts: (rx, ry) => ring(80, (a, c, s) => { const r = 1 - 0.28 * (1 - Math.cos(5 * (a + Math.PI / 2))) / 2; return [c * rx * r, s * ry * r]; }) },
  // 찹쌀이: 모서리가 둥근 네모 떡
  mochi: { rx: 60, ry: 52, eye: 0.33, pts: (rx, ry) => ring(48, (_, c, s) => [Math.sign(c) * Math.abs(c) ** 0.62 * rx, sit(Math.sign(s) * Math.abs(s) ** 0.62 * ry, ry, 0.06)]) },
  // 하트: 아래 끝을 뭉툭하게 해 앉을 수 있게
  heart: {
    rx: 64, ry: 58, eye: 0.33, pts: (rx, ry) => ring(60, (a) => {
      const x = 16 * Math.sin(a) ** 3, h = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      let y = ((h - 2.5) / 14.5) * ry;
      if (y > 0.72 * ry) y = 0.72 * ry + (y - 0.72 * ry) * 0.35;
      return [(x / 16) * rx, y];
    }),
  },
  // 알콩이: 위가 좁고 아래가 넉넉한 알
  egg: { rx: 53, ry: 63, eye: 0.36, pts: (rx, ry) => ring(36, (_, c, s) => [c * rx * (s < 0 ? 1 + 0.17 * s : 1 + 0.04 * s), sit(s * ry, ry)]) },
};

export interface Geo { rx: number; ry: number; eye: number; d: string; lit: string; top: number; bottom: number; half: (y: number) => number }
const geoCache = new Map<BuddyShape, Geo>();
export function shapeGeo(shape: BuddyShape): Geo {
  const hit = geoCache.get(shape);
  if (hit) return hit;
  const sh = SHAPES[shape] ?? SHAPES.round;
  const pts = sh.pts(sh.rx, sh.ry);
  const ys = pts.map((p) => p[1]);
  const geo: Geo = {
    rx: sh.rx, ry: sh.ry, eye: sh.eye,
    d: smooth(pts),
    lit: smooth(sh.pts(sh.rx * 0.93, sh.ry * 0.9)), // 밝은 면(셀 경계)
    top: Math.min(...ys),
    bottom: Math.max(...ys),
    // 그 높이에서 몸의 반 너비(귀·팔 자리)
    half: (y) => Math.max(8, ...pts.filter((p) => Math.abs(p[1] - y) < sh.ry * 0.14).map((p) => Math.abs(p[0]))),
  };
  geoCache.set(shape, geo);
  return geo;
}

// 몽글몽글 구름(동그라미 여럿): 가운데가 솟은 뭉게구름
export function cloudBumps(w: number, h: number, seed: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const r = h * (0.38 + 0.5 * Math.sin(u * Math.PI)) * (0.88 + 0.24 * Math.abs(Math.sin(seed * 7 + i * 2.3)));
    out.push([(u - 0.5) * w * 0.86, h * 0.35 - r * 0.8, r]);
  }
  out.push([-w * 0.12, h * 0.3, h * 0.5], [w * 0.14, h * 0.32, h * 0.45]);
  return out;
}

// 감정 무리에 따른 장면(하늘·빛·언덕) 팔레트
export interface SceneKit {
  sky: [string, string, string]; sun: string | null; moon: boolean; glow: string; cloud: [string, string, string];
  far: string; mid: string; near: [string, string]; grass: string; light: string; lightOp: number; particle: "fluff" | "butterfly" | "rain" | "leaf" | "firefly";
}
export const SCENE: Record<Group, SceneKit> = {
  joy: {
    sky: ["#5aa7e6", "#9fd0f2", "#e8f4f0"], sun: "#fff4c2", moon: false, glow: "#ffe9a6", cloud: ["#ffffff", "#e4ecf7", "#b9c7e3"],
    far: "#9ec6c9", mid: "#86b97a", near: ["#8cc762", "#5f9a43"], grass: "#4f8a36", light: "#ffd36b", lightOp: 0.22, particle: "butterfly",
  },
  calm: {
    sky: ["#8ec3e8", "#c7e2ee", "#f6efdf"], sun: "#fff8dc", moon: false, glow: "#fff1c8", cloud: ["#fffdf6", "#ecebe6", "#c9cbd6"],
    far: "#a8c4c4", mid: "#9cc28d", near: ["#a6cf7f", "#6fa457"], grass: "#5c9346", light: "#ffe6a8", lightOp: 0.16, particle: "fluff",
  },
  sad: {
    sky: ["#6f839c", "#98a8ba", "#c7cfd6"], sun: null, moon: false, glow: "#d7dde4", cloud: ["#c3cbd6", "#9aa5b5", "#717d90"],
    far: "#7f93a0", mid: "#6f8f80", near: ["#7aa074", "#4e7457"], grass: "#3f644a", light: "#a9bdd6", lightOp: 0.18, particle: "rain",
  },
  angry: {
    sky: ["#6f4a78", "#d4795a", "#f6c88e"], sun: "#ffe0a0", moon: false, glow: "#ffcf8a", cloud: ["#ffd9b8", "#d99a88", "#8f5f6e"],
    far: "#8c6a78", mid: "#7f7a4e", near: ["#9a9a52", "#5f6236"], grass: "#4f5228", light: "#ff9b5c", lightOp: 0.2, particle: "leaf",
  },
  fear: {
    sky: ["#1d2446", "#38406f", "#7a6f9a"], sun: null, moon: true, glow: "#f6f0c8", cloud: ["#8f86b4", "#6b6396", "#4a4475"],
    far: "#4b4a78", mid: "#475e66", near: ["#4f7062", "#2f4a45"], grass: "#26403b", light: "#b9a6ff", lightOp: 0.14, particle: "firefly",
  },
};
