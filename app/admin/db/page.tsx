// 저장소 옮기기·속도 재기(미리보기 전용). 실제 배포에서는 없는 화면(404).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminDb from "./AdminDb";

export const metadata: Metadata = { title: "저장소 옮기기 · 마음빛 길잡이", robots: { index: false } };

export default function Page() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <AdminDb />;
}
