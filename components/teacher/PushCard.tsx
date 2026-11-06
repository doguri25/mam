"use client";
// 이 기기에서 위험 표현 알림 받기(웹 푸시). 아이폰은 Safari에서 「홈 화면에 추가」한 앱에서만 된다(iOS 16.4+).
import { useEffect, useState } from "react";
import Doodle from "../Doodle";
import type { Overview, Reload } from "./types";
import { useAct } from "./useAct";
import { api } from "@/lib/api";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// lost: 이 브라우저는 구독해 두었는데 서버의 알림 받는 기기 목록에는 없음(다른 기기에서 비밀번호를 바꾸거나
// 「모든 기기 알림 끄기」를 누르면 빠진다) → 알림이 오지 않으니 꺼진 것으로 보이고 「알림 받기」로 다시 등록한다
type State = "checking" | "unsupported" | "ios-install" | "off" | "lost" | "on" | "denied";

export default function PushCard({ data, reload }: { data: Overview; reload: Reload }) {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState("");
  const [clearing, setClearing] = useState(false);
  const act = useAct(); // 켜기·끄기·시험·모두 끄기를 두 번 눌러 겹치지 않게
  const push = data.push;
  const { ready, key, devices } = push;
  // 탭으로 돌아올 때마다 한 번 더 본다(그사이 다른 기기에서 끄거나 비밀번호를 바꿨을 수 있다)
  const [look, setLook] = useState(0);
  useEffect(() => {
    const again = () => document.visibilityState === "visible" && setLook((n) => n + 1);
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  }, []);

  // 처음 열 때와 서버에서 통째로 다시 읽을 때마다(알림 기기가 바뀌면 변경 표시가 남아 다른 기기도 20초 안에 다시 읽는다),
  // 그리고 탭으로 돌아올 때 이 기기가 정말 서버 목록에 있는지 다시 본다. 기기 수만 보면 한 대 끄고 한 대 켜면 못 본다.
  useEffect(() => {
    let live = true;
    (async (): Promise<State> => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return ios && !standalone ? "ios-install" : "unsupported";
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      if (Notification.permission === "denied") return "denied";
      if (!sub) return "off";
      try {
        const r = await api<{ has?: unknown }>("teacher", "pushHas", { endpoint: sub.endpoint });
        if (typeof r.has === "boolean") return r.has ? "on" : "lost";
      } catch {
        // 예전 서버(이 요청을 모름)·끊김: 서버에 알림 받는 기기가 하나도 없으면 이 기기도 빠진 것
      }
      return push.devices > 0 ? "on" : "lost";
    })().then((st) => live && setState(st), () => live && setState("unsupported"));
    return () => { live = false; };
  }, [push, look]);

  async function turnOn() {
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const opts = { userVisibleOnly: true, applicationServerKey: keyBytes(key) };
      // 이 브라우저에 남은 구독이 있으면 그대로 다시 등록한다. 알림 키가 바뀌어 그 구독을 쓸 수 없으면 지우고 새로
      const sub = await reg.pushManager.subscribe(opts).catch(async (e) => {
        const old = await reg.pushManager.getSubscription();
        if (!old) throw e;
        await old.unsubscribe();
        return reg.pushManager.subscribe(opts);
      });
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
      if (state === "on" || state === "lost") setState("off");
      const n = Number(r.removed) || 0;
      setMsg(n ? `기기 ${n}대의 알림을 모두 껐어요.` : "알림을 받는 기기가 없었어요.");
      await reload();
    } catch (e) {
      setMsg(`모든 기기 알림을 끄지 못했어요: ${(e as Error).message}`);
    }
    setClearing(false);
  }

  const guard = (fn: () => Promise<void>) => () => void act.run("", fn); // 저마다 까닭을 msg에 쓴다

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
              <button onClick={guard(test)} disabled={act.busy} className="btn-sub min-h-10 px-3 text-sm">시험 알림 보내기</button>
              <button onClick={guard(turnOff)} disabled={act.busy} className="text-sm text-soft underline">이 기기 알림 끄기</button>
            </>
          ) : (
            <>
              {state === "lost" && !data.trial && (
                <p className="w-full text-sm text-alert">
                  이 기기는 지금 알림을 받지 않아요. 다른 기기에서 비밀번호를 바꾸거나 「모든 기기 알림 끄기」를 누르면 알림 받는 기기에서 빠져요. 다시 받으려면 아래를 눌러 주세요.
                </p>
              )}
              <button onClick={guard(turnOn)} disabled={state === "checking" || act.busy} className="btn-main">이 기기에서 알림 받기</button>
            </>
          )}
        </div>
      )}
      {devices > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button onClick={guard(clearAll)} disabled={clearing || act.busy} className="btn-sub min-h-10 px-3 text-sm">{clearing ? "끄는 중…" : `모든 기기 알림 끄기 (${devices}대)`}</button>
          <span className="text-xs text-soft">휴대폰을 잃어버렸거나 바꿨을 때 눌러 주세요.</span>
        </div>
      )}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}
