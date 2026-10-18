"use client";
// 3D는 브라우저에서만, 늦게 불러온다. WebGL이 없거나 움직임 줄이기 설정이면 그린 얼굴로 대신한다.
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { EmotionArt } from "./Art";


const Buddy = dynamic(() => import("./Buddy"), { ssr: false, loading: () => null });

function can3D() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}
const subscribe = () => () => {};

export default function BuddyLazy({ emotion, intensity, size = 200 }: { emotion?: string; intensity?: number; size?: number }) {
  const ok = useSyncExternalStore(subscribe, can3D, () => false);
  if (ok) return <Buddy emotion={emotion} intensity={intensity} size={size} />;
  return <EmotionArt name={emotion ?? "편안해요"} size={size} />;
}
