"use client";
// 3D는 브라우저에서만, 늦게 불러온다. WebGL이 없거나 움직임 줄이기 설정이면 그린 얼굴로 대신한다.
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { EmotionArt } from "./Art";
import type { BuddyProps } from "./Buddy";
import BuddyFace from "./BuddyFace";

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

export default function BuddyLazy(props: BuddyProps) {
  const ok = useSyncExternalStore(subscribe, can3D, () => false);
  if (ok) return <Buddy {...props} />;
  const { emotion, look, size = 200, className } = props;
  // 꾸민 모습이 있으면 그 얼굴로, 없으면 감정 그림으로
  return look ? <BuddyFace look={look} emotion={emotion} size={size} className={className} /> : <EmotionArt name={emotion ?? "편안해요"} size={size} className={className} />;
}
