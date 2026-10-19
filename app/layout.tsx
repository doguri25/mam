import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "마음빛 길잡이",
  description: "카드나 한 문장으로 오늘의 마음을 남기고, 선생님이 변화를 살펴보는 사회정서교육 도구",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#fbf8f2" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* 한글 폰트는 next/font가 글자 묶음을 다 못 다뤄서, 구글 폰트 CSS를 그대로 쓴다(필요한 글자 조각만 받음) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router 루트 레이아웃이라 모든 페이지에 적용된다 */}
        <link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
