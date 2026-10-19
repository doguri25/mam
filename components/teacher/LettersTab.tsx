"use client";
// 공감 쪽지 검토: 학생이 친구에게 쓴 쪽지는 선생님이 읽고 허락(필요하면 살짝 고쳐서)해야 친구에게 간다.
// 선생님은 「이름 비공개」 쪽지도 보낸 학생을 알 수 있다.
import { useState } from "react";
import type { NameOf, Overview, Reload } from "./types";
import { api } from "@/lib/api";
import type { Letter } from "@/lib/shared";

type View = "wait" | "ok" | "no";
const VIEWS: [View, string][] = [["wait", "허락을 기다려요"], ["ok", "전했어요"], ["no", "돌려보냈어요"]];
const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });

function Card({ l, nameOf, reload }: { l: Letter; nameOf: NameOf; reload: Reload }) {
  const [text, setText] = useState(l.text);
  const [busy, setBusy] = useState(false);
  async function check(status: "ok" | "no") {
    setBusy(true);
    await api("teacher", "letterCheck", { id: l.id, status, text }).catch(() => {});
    await reload();
  }
  return (
    <article className={`card space-y-3 ${l.risk ? "border-alert bg-alert-soft" : ""}`}>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <b>{l.from}번 {nameOf(l.from)}</b> → <b>{l.to}번 {nameOf(l.to)}</b>
        <span className="rounded-full bg-paper px-2 py-0.5 text-xs">{l.showName ? "이름 공개" : "이름 비공개"}</span>
        {l.lang && l.lang !== "ko" && <span className="rounded-full bg-paper px-2 py-0.5 text-xs">🌐 {l.lang}</span>}
        {l.risk && <span className="rounded-full bg-alert px-2 py-0.5 text-xs text-white">⚠️ 걱정되는 말</span>}
        <span className="ml-auto text-xs text-soft">{when(l.createdAt)}</span>
      </p>
      {l.status === "wait" ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} rows={2} className="field text-lg" aria-label="쪽지 내용(고쳐서 전할 수 있어요)" />
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => check("no")} disabled={busy} className="btn-sub min-h-11">돌려보내기</button>
            <button onClick={() => check("ok")} disabled={busy || text.trim().length < 2} className="btn-main min-h-11 px-6">✓ 친구에게 전하기</button>
          </div>
        </>
      ) : (
        <p className="text-lg">{l.text}</p>
      )}
    </article>
  );
}

export default function LettersTab({ data, nameOf, reload }: { data: Overview; nameOf: NameOf; reload: Reload }) {
  const [view, setView] = useState<View>("wait");
  const list = data.letters.filter((l) => l.status === view);
  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-leaf-soft p-3 text-sm">
        학생이 친구에게 쓴 공감 쪽지는 <b>선생님이 허락해야</b> 친구 화면에 나타나요. 놀리는 말·비밀 이야기·특정 친구를 빼는 말이 보이면
        돌려보내고 따로 이야기를 나눠 주세요. 낱말은 고쳐서 전할 수 있어요.
      </p>
      <div role="tablist" className="flex flex-wrap gap-2">
        {VIEWS.map(([id, name]) => {
          const n = data.letters.filter((l) => l.status === id).length;
          return (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`min-h-11 rounded-2xl px-4 font-bold ${view === id ? "bg-leaf text-white" : "border border-line bg-card text-soft"}`}>
              {name} <span className="opacity-80">{n}</span>
            </button>
          );
        })}
      </div>
      {list.length ? (
        <div className="grid gap-3 xl:grid-cols-2">{list.map((l) => <Card key={l.id} l={l} nameOf={nameOf} reload={reload} />)}</div>
      ) : (
        <p className="card text-soft">{view === "wait" ? "기다리는 쪽지가 없어요." : "아직 없어요."}</p>
      )}
    </div>
  );
}
