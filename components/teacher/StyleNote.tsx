"use client";
// AI 글에 남은 번역투·기계식 표현 알림(확실한 것은 서버가 이미 고쳤고, 뜻이 바뀔 수 있는 것만 선생님이 다듬게 알려 준다)
export default function StyleNote({ hits, className = "" }: { hits?: string[]; className?: string }) {
  if (!hits?.length) return null;
  return (
    <span className={`no-print block text-xs text-[#8a6100] ${className}`}>
      다듬으면 더 자연스러워요: {hits.join(" · ")}
    </span>
  );
}
