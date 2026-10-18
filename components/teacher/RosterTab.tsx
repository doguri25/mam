"use client";
// 학생 명단과 고유 코드·QR 카드. QR은 이 주소(/join?c=코드)를 담는다.
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { Overview, Reload } from "./types";
import { api } from "@/lib/api";
import { useNames } from "@/lib/local";

export default function RosterTab({ data, reload }: { data: Overview; reload: Reload }) {
  const [text, setText] = useState(() => data.students.map((s) => `${s.no} ${s.alias}`).join("\n"));
  const [msg, setMsg] = useState("");
  const names = useNames();
  const [qr, setQr] = useState<Record<string, string>>({});
  const origin = window.location.origin; // 이 탭은 로그인 뒤 브라우저에서만 그려진다

  useEffect(() => {
    Promise.all(data.students.map(async (s) => [s.code, await QRCode.toDataURL(`${origin}/join?c=${s.code}`, { margin: 1, width: 220 })] as const))
      .then((pairs) => setQr(Object.fromEntries(pairs)));
  }, [data.students, origin]);

  async function saveRoster() {
    try {
      const r = await api<{ students: unknown[] }>("teacher", "roster", { text });
      setMsg(`${r.students.length}명을 저장했어요. 같은 번호는 원래 코드를 그대로 써요.`);
      await reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function renew(no: number) {
    if (!confirm(`${no}번의 코드를 새로 만들까요? 예전 코드와 QR은 더 이상 쓸 수 없어요.`)) return;
    await api("teacher", "newCode", { no });
    await reload();
  }

  const local = /localhost|127\.0\.0\.1/.test(origin);

  return (
    <div className="space-y-5">
      <section className="no-print card space-y-3">
        <h2 className="font-display text-xl">반 명단</h2>
        <p className="text-sm text-soft">한 줄에 한 명, 「번호 가명」으로 적어요. 실명 대신 가명이나 별명을 권해요(AI에는 가명만 가요).</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="field font-mono text-sm" placeholder={"1 햇살\n2 구름\n3 단풍"} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{msg}</span>
          <button onClick={saveRoster} className="btn-main">명단 저장</button>
        </div>
      </section>

      <section className="no-print card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">실명 보기 (이 컴퓨터에만)</h2>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={names.on} onChange={(e) => names.setOn(e.target.checked)} disabled={!names.raw.trim()} className="size-4 accent-leaf" />
            선생님 화면을 실명으로 보기
          </label>
        </div>
        <p className="text-sm text-soft">
          「번호 이름」을 붙여 넣으면 이 브라우저에만 저장돼요. 서버·AI로는 보내지 않고, 다른 컴퓨터에서는 다시 넣어야 해요. 학생 화면은 늘 가명이에요.
        </p>
        <textarea value={names.raw} onChange={(e) => names.setRaw(e.target.value)} rows={4} className="field font-mono text-sm" placeholder={"1 김하늘\n2 이도윤"} />
        {names.raw && <button onClick={() => confirm("이 컴퓨터의 실명 명렬표를 지울까요?") && names.setRaw("")} className="text-xs text-soft underline">이 컴퓨터에서 실명 지우기</button>}
      </section>

      {data.students.length > 0 && (
        <section>
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl">코드·QR 카드</h2>
              <p className="text-xs text-soft">QR 주소: {origin}/join?c=…</p>
              {local && (
                <p className="text-xs text-alert">
                  지금 주소가 localhost라 태블릿에서는 열리지 않아요. 같은 와이파이의 이 컴퓨터 IP 주소(예: http://192.168.0.10:3000)로 선생님 화면을 열고 인쇄하세요.
                </p>
              )}
            </div>
            <button onClick={() => window.print()} className="btn-sub">🖨️ QR 카드 인쇄</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 print:grid-cols-4">
            {data.students.map((s) => (
              <div key={s.no} className="card flex flex-col items-center gap-1 p-3 text-center">
                <p className="text-sm">{s.no}번 <b>{names.name(s.no, s.alias)}</b></p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR이라 이미지 최적화가 필요 없다 */}
                {qr[s.code] ? <img src={qr[s.code]} alt={`${s.no}번 QR`} className="size-28" /> : <div className="size-28" />}
                <p className="font-mono text-lg tracking-widest">{s.code}</p>
                <button onClick={() => renew(s.no)} className="no-print text-xs text-soft underline underline-offset-4">새 코드</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
