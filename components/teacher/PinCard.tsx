"use client";
// 선생님 비밀번호 바꾸기: 숫자 4~12자리. 바꾸면 다른 기기의 선생님 화면은 잠기고, 이 기기만 계속 열려 있다.
import { useRef, useState } from "react";
import Doodle from "../Doodle";
import { api } from "@/lib/api";

export default function PinCard({ pinSet }: { pinSet: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // 보내는 동안은 다시 받지 않는다: 두 번 누르면 첫 요청이 비밀번호를 바꾼 뒤 둘째 요청이 옛 표로 가서 401
  // → 바꿨는데도 「선생님 비밀번호를 입력해 주세요」가 뜨고 칸이 비었다. 그려지기 전 두 번째 누름도 막게 ref로
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 12);
  const problem =
    next && next.length < 4 ? "숫자 4자리 이상으로 해 주세요."
    : again && next !== again ? "새 비밀번호 두 칸이 서로 달라요."
    : next && next === current ? "지금 비밀번호와 다르게 해 주세요."
    : "";

  async function change(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMsg(null);
    try {
      // 이 기기의 휴대폰 알림은 그대로 두고, 다른 기기 알림은 모두 끈다
      const keep = await navigator.serviceWorker?.getRegistration().then((r) => r?.pushManager.getSubscription()).catch(() => null);
      const r = await api<{ pushRemoved?: number }>("teacher", "changePin", { current, next, ...(keep ? { keepEndpoint: keep.endpoint } : {}) });
      const off = r.pushRemoved ? ` 알림 받던 다른 기기 ${r.pushRemoved}대의 알림도 껐어요.` : "";
      setMsg({ ok: true, text: `바꿨어요. 다른 기기에서 열려 있던 선생님 화면은 잠겼어요. 새 비밀번호로 다시 열면 돼요.${off}` });
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
    sending.current = false;
    setBusy(false);
  }

  const box = (label: string, value: string, set: (v: string) => void, auto: string) => (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete={auto}
        value={value}
        onChange={(e) => set(digits(e.target.value))}
        className="field mt-1 tracking-[0.3em]"
      />
    </label>
  );

  return (
    <section className="card space-y-3">
      <h2 className="font-display text-xl"><Doodle name="lock" /> 선생님 비밀번호 바꾸기</h2>
      {!pinSet && (
        <p className="rounded-2xl bg-[#fff8e1] p-3 text-sm">아직 처음 비밀번호를 쓰고 있어요. 학생들이 모르는 숫자로 바꿔 주세요.</p>
      )}
      <form onSubmit={change} className="grid gap-3 sm:grid-cols-3">
        {box("지금 비밀번호", current, setCurrent, "current-password")}
        {box("새 비밀번호 (숫자 4~12자리)", next, setNext, "new-password")}
        {box("새 비밀번호 한 번 더", again, setAgain, "new-password")}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button className="btn-main" disabled={busy || !current || next.length < 4 || next !== again || !!problem}>{busy ? "바꾸는 중…" : "비밀번호 바꾸기"}</button>
          {problem && <span className="text-sm text-alert">{problem}</span>}
          {msg && <span className={`text-sm ${msg.ok ? "text-leaf" : "text-alert"}`}>{msg.text}</span>}
        </div>
      </form>
      <p className="text-xs text-soft">5번 틀리면 1분 동안 잠겨요. 비밀번호를 잊으면 관리자가 저장소의 비밀번호 기록(meta/pin)을 지우면 처음 비밀번호로 돌아가요.</p>
    </section>
  );
}
