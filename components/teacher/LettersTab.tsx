"use client";
// 공감 쪽지 검토: 학생이 친구에게 쓴 쪽지는 선생님이 읽고 허락(필요하면 살짝 고쳐서)해야 친구에게 간다.
// 선생님은 「이름 비공개」 쪽지도 보낸 학생을 알 수 있다.
import { useState } from "react";
import Doodle from "../Doodle";
import { RiskActionForm, kindsText } from "./RiskActions";
import type { NameOf, Overview, Reload } from "./types";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import type { Letter, RiskAction } from "@/lib/shared";

type View = "wait" | "ok" | "no";
const VIEWS: [View, string][] = [["wait", "허락을 기다려요"], ["ok", "전했어요"], ["no", "돌려보냈어요"]];
const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });

// 위험 표현 쪽지는 마음 지도 알림처럼 「살펴보고 적기」로 한 일을 남긴다(조치 기록의 recordId는 「letter:」+쪽지 id)
function Card({ l, nameOf, reload, acts, today, students, onNote }: { l: Letter; nameOf: NameOf; reload: Reload; acts: RiskAction[]; today: string; students: Set<number>; onNote: (msg: string) => void }) {
  const [text, setText] = useState(l.text);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [acting, setActing] = useState(false);
  async function check(status: "ok" | "no") {
    // 걱정되는 말이 있는데 살펴본 기록이 없으면 한 번 묻는다(그냥 전하거나 돌려보내면 조치 기록에 아무것도 남지 않음)
    if (l.risk && !acts.length && !confirm(`위험 표현이 있는 쪽지예요. 조치 기록 없이 ${status === "ok" ? "전할까요" : "돌려보낼까요"}?\n\n취소를 누르고 「살펴보고 적기」로 한 일을 먼저 남길 수 있어요.`)) return;
    setBusy(true);
    setErr("");
    try {
      await api("teacher", "letterCheck", { id: l.id, status, text });
    } catch (e) {
      // 실패하면 단추를 다시 쓸 수 있게 하고 까닭을 보여 준다.
      // 409: 다른 기기에서 이미 전하거나 돌려보냄 · 받을 친구가 명단에 없음 → 까닭을 남긴 채 화면을 새로 읽는다
      const msg = `${status === "ok" ? "전하지" : "돌려보내지"} 못했어요: ${(e as Error).message}`;
      setErr(msg);
      setBusy(false);
      if ((e as { status?: number }).status === 409) {
        onNote(`${l.from}번 → ${l.to}번 쪽지를 ${msg}`); // 다시 읽으면 이 쪽지가 다른 목록으로 옮겨 갈 수 있어 위에도 남긴다
        await reload();
      }
      return;
    }
    await reload();
    setBusy(false); // 보통은 다른 목록으로 옮겨 가 사라지지만, 다시 불러오지 못했을 때 단추가 묶이지 않게
  }
  // 쪽지를 읽은 다음 → 한 일 적기 → 전하기·돌려보내기 순서로 놓는다
  const riskBox = l.risk && (
    <div className="space-y-2 rounded-2xl border border-alert/40 bg-card p-3 text-sm">
      {acts.length ? (
        <ol className="space-y-1 border-l-2 border-leaf/40 pl-3">
          {acts.map((a) => (
            <li key={a.id}><span className="font-bold text-leaf">{label(a.date)}</span> {kindsText(a.kinds)}{a.note && <span className="block text-soft">{a.note}</span>}</li>
          ))}
        </ol>
      ) : (
        <p className="font-bold text-alert">{l.riskChecked ? "살펴봄(한 일은 적지 않음)" : "아직 살펴보지 않았어요"}</p>
      )}
      {acting ? (
        <RiskActionForm recordId={`letter:${l.id}`} kind="letter" today={today} first={!l.riskChecked} seen={l.createdAt} text={l.original ?? l.text}
          onCancel={() => setActing(false)} onStale={reload} onDone={async () => { setActing(false); await reload(); }} />
      ) : (
        <button onClick={() => setActing(true)} className="btn-sub min-h-9 px-3 text-sm"><Doodle name="memo" /> {l.riskChecked ? "조치 더 적기" : "살펴보고 적기"}</button>
      )}
    </div>
  );
  // 받을 친구가 명단에 없으면(연습용 학생이었거나 명단에서 빠짐) 전하지 못하고 돌려보내기만 한다
  const noOne = !!l.toPractice || !students.has(l.to);
  return (
    <article className={`card space-y-3 ${l.risk ? "border-alert bg-alert-soft" : ""}`}>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <b>{l.from}번 {nameOf(l.from)}</b> → <b>{l.to}번 {nameOf(l.to)}</b>
        <span className="rounded-full bg-paper px-2 py-0.5 text-xs">{l.showName ? "이름 공개" : "이름 비공개"}</span>
        {l.lang && l.lang !== "ko" && <span className="rounded-full bg-paper px-2 py-0.5 text-xs"><Doodle name="globe" /> {l.lang}</span>}
        {l.risk && <span className="rounded-full bg-alert px-2 py-0.5 text-xs text-white"><Doodle name="warning" /> 걱정되는 말</span>}
        <span className="ml-auto text-xs text-soft">{when(l.createdAt)}</span>
      </p>
      {l.status === "wait" ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} rows={2} className="field text-lg" aria-label="쪽지 내용(고쳐서 전할 수 있어요)" />
          {riskBox}
          {noOne && <p className="text-sm text-soft">받을 친구가 지금 명단에 없어 전할 수 없어요(연습용 학생이었거나 명단에서 빠짐). 읽고 살펴본 뒤 돌려보내 주세요.</p>}
          {err && <p role="alert" className="text-sm text-alert">{err}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => check("no")} disabled={busy} className="btn-sub min-h-11">돌려보내기</button>
            <button onClick={() => check("ok")} disabled={busy || noOne || text.trim().length < 2} className="btn-main min-h-11 px-6">✓ 친구에게 전하기</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-lg">{l.text}</p>
          {/* 선생님이 다듬어 전한 쪽지: 학생이 처음 쓴 글(위험 표현이 있던 글)도 선생님 화면에는 남겨 보인다 */}
          {l.original && <p className="text-sm"><span className="font-bold text-alert">처음 쓴 글</span> “{l.original}”</p>}
          {riskBox}
        </>
      )}
    </article>
  );
}

export default function LettersTab({ data, nameOf, reload }: { data: Overview; nameOf: NameOf; reload: Reload }) {
  const [view, setView] = useState<View>("wait");
  // 위험 표현이 있는 기다리는 쪽지를 맨 위에(그 안에서는 서버가 보낸 새것 순서 그대로)
  const list = data.letters.filter((l) => l.status === view).sort((a, b) => Number(b.status === "wait" && !!b.risk) - Number(a.status === "wait" && !!a.risk));
  const students = new Set(data.students.map((s) => s.no));
  const [note, setNote] = useState("");
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
      {note && (
        <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-alert/40 bg-alert-soft px-3 py-2 text-sm">
          <span className="min-w-0 wrap-anywhere">{note}</span>
          <button onClick={() => setNote("")} className="btn-sub min-h-8 px-3 text-xs">닫기</button>
        </p>
      )}
      {list.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {list.map((l) => <Card key={l.id} l={l} nameOf={nameOf} reload={reload} today={data.today} students={students} onNote={setNote} acts={data.riskActions.filter((a) => a.recordId === `letter:${l.id}`)} />)}
        </div>
      ) : (
        <p className="card text-soft">{view === "wait" ? "기다리는 쪽지가 없어요." : "아직 없어요."}</p>
      )}
    </div>
  );
}
