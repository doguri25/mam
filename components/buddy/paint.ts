// 손그림 느낌을 내는 작은 도우미: 물감 섞기, 둥근 몸 윤곽(부드러운 곡선), 장면 팔레트
import type { Group } from "@/lib/shared";

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

// 마음 친구 몸: 가운데가 (0,0)인 말랑한 방울. 아래는 바닥에 앉은 듯 살짝 납작, 위는 둥글게.
export function blob(rx: number, ry: number) {
  const pts: [number, number][] = [];
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const full = 1 + 0.035 * Math.pow(Math.abs(c), 3); // 옆구리가 살짝 통통
    let y = s * ry;
    if (y > 0) y *= 1 - 0.13 * Math.pow(s, 4); // 엉덩이는 납작
    pts.push([c * rx * full, y]);
  }
  return smooth(pts);
}
export const bottomOf = (ry: number) => ry * 0.87;

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
