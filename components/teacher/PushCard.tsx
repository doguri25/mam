"use client";
// 이 기기에서 위험 표현 알림 받기(웹 푸시). 아이폰은 Safari에서 「홈 화면에 추가」한 앱에서만 된다(iOS 16.4+).
import { useEffect, useState } from "react";
import Doodle from "../Doodle";
import type { Overview, Reload } from "./types";
import { api } from "@/lib/api";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "checking" | "unsupported" | "ios-install" | "off" | "on" | "denied";

export default function PushCard({ data, reload }: { data: Overview; reload: Reload }) {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState("");
  const [clearing, setClearing] = useState(false);
  const { ready, key, devices } = data.push;

  useEffect(() => {
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      setState(Notification.permission === "denied" ? "denied" : sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
      const label = /iPhone|iPad/.test(navigator.userAgent) ? "아이폰" : /Android/.test(navigator.userAgent) ? "안드로이드" : "컴퓨터";
      await api("teacher", "subscribe", { subscription: sub.toJSON(), label });
      setState("on");
      setMsg("이 기기에서 알림을 받아요.");
      await reload();
    } catch (e) {
      setMsg(`켜지 못했어요: ${(e as Error).message}`);
    }
  }

  async function turnOff() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("teacher", "unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("이 기기 알림을 껐어요.");
      await reload();
    } catch (e) {
      setMsg(`끄지 못했어요: ${(e as Error).message}`);
    }
  }

  async function test() {
    try {
      const r = await api<{ sent: number; failed: number }>("teacher", "testPush");
      setMsg(r.sent ? `시험 알림을 ${r.sent}대에 보냈어요. 잠시 뒤 휴대폰을 확인해 주세요.` : "알림을 받을 기기가 없어요.");
    } catch (e) {
      setMsg(`시험 알림을 보내지 못했어요: ${(e as Error).message}`);
    }
  }

  // 잃어버렸거나 더 쓰지 않는 기기까지, 이 학급에 알림을 받게 해 둔 기기를 모두 끈다
  async function clearAll() {
    if (!confirm(`이 학급 알림을 받는 기기 ${devices}대의 알림을 모두 끌까요? 잃어버린 휴대폰이나 더 쓰지 않는 기기도 함께 꺼져요. 계속 받을 기기는 그 기기에서 다시 켜 주세요.`)) return;
    setClearing(true);
    setMsg("");
    try {
      const r = await api<{ removed?: number }>("teacher", "pushClear");
      // 이 기기의 브라우저 쪽 구독도 함께 정리해 「받는 중」으로 잘못 보이지 않게(실패해도 서버에서는 이미 꺼짐)
      try {
        const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
        const sub = await reg?.pushManager?.getSubscription();
        await sub?.unsubscribe();
      } catch { /* 이 기기 정리는 못 해도 괜찮다 */ }
      if (state === "on") setState("off");
      const n = Number(r.removed) || 0;
      setMsg(n ? `기기 ${n}대의 알림을 모두 껐어요.` : "알림을 받는 기기가 없었어요.");
      await reload();
    } catch (e) {
      setMsg(`모든 기기 알림을 끄지 못했어요: ${(e as Error).message}`);
    }
    setClearing(false);
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-display text-xl"><Doodle name="phone" /> 휴대폰으로 위험 표현 알림 받기</h2>
      <p className="text-sm text-soft">
        학생 기록에 위험 표현이 들어오면 이 기기에 바로 알림이 떠요. 알림에는 <b>번호만</b> 담기고 이름·글은 담기지 않아요(알림은 구글·애플 서버를 거쳐요).
        지금 알림 받는 기기: <b>{devices}대</b>
      </p>
      {!ready ? (
        <p className="text-sm text-alert">서버에 알림 키(VAPID)가 아직 없어요. 관리자에게 환경 변수 설정을 부탁해 주세요.</p>
      ) : state === "ios-install" ? (
        <div className="rounded-2xl bg-leaf-soft p-3 text-sm leading-6">
          아이폰·아이패드는 먼저 앱으로 설치해야 해요: Safari 아래 <b>공유 버튼(□↑)</b> → <b>「홈 화면에 추가」</b> → 홈 화면의 「마음빛 선생님」을 열고
          다시 이 「설정」에서 알림을 켜 주세요(iOS 16.4 이상).
        </div>
      ) : state === "unsupported" ? (
        <p className="text-sm text-alert">이 브라우저는 알림을 받을 수 없어요. 안드로이드는 크롬, 아이폰은 Safari 홈 화면 앱에서 열어 주세요.</p>
      ) : state === "denied" ? (
        <p className="text-sm text-alert">알림이 막혀 있어요. 휴대폰 설정 → 알림에서 이 앱(또는 브라우저)의 알림을 허용한 뒤 다시 시도해 주세요.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {state === "on" ? (
            <>
              <span className="rounded-full bg-leaf-soft px-3 py-1 text-sm font-bold text-leaf">✓ 이 기기에서 받는 중</span>
              <button onClick={test} className="btn-sub min-h-10 px-3 text-sm">시험 알림 보내기</button>
              <button onClick={turnOff} className="text-sm text-soft underline">이 기기 알림 끄기</button>
            </>
          ) : (
            <button onClick={turnOn} disabled={state === "checking"} className="btn-main">이 기기에서 알림 받기</button>
          )}
        </div>
      )}
      {devices > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button onClick={clearAll} disabled={clearing} className="btn-sub min-h-10 px-3 text-sm">{clearing ? "끄는 중…" : `모든 기기 알림 끄기 (${devices}대)`}</button>
          <span className="text-xs text-soft">휴대폰을 잃어버렸거나 바꿨을 때 눌러 주세요.</span>
        </div>
      )}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}
