"use client";
// 면담 메모: 선생님만 보고, AI에는 보내지 않는다
import { useRef, useState } from "react";
import type { Reload } from "./types";
import { focusLater } from "./focusLater";
import { useAct } from "./useAct";
import { kday } from "./when";
import { api } from "@/lib/api";
import type { Note } from "@/lib/shared";

export default function Notes({ no, notes, reload }: { no: number; notes: Note[]; reload: Reload }) {
  const [text, setText] = useState("");
  const act = useAct(); // 두 번 눌러 같은 메모가 두 번 남지 않게, 실패하면 칸 아래에 까닭을
  const mine = notes.filter((n) => n.no === no);
  const box = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [done, setDone] = useState(""); // 남겼다고 화면 읽기 프로그램에 알린다
  // Enter로도 저장. 저장하면 칸이 비어 단추가 막히므로(초점이 사라짐) 다음 메모를 쓰게 칸으로 초점을 돌려준다 —
  // 그사이 선생님이 다른 칸(응원 쓰기 등)으로 옮겼으면 가져가지 않는다. 저장하는 사이 칸에 더 쓴 글은 지우지 않는다
  const add = () => {
    const sent = text;
    if (!sent.trim() || act.busy) return;
    setDone("");
    return act.run("메모를 저장하지 못했어요", async () => {
      await api("teacher", "note", { no, text: sent });
      setText((t) => (t === sent ? "" : t));
      setDone("메모를 남겼어요.");
      await reload();
      focusLater(() => box.current, form.current);
    });
  };
  const remove = (id: string) => act.run("메모를 지우지 못했어요", async () => {
    await api("teacher", "deleteNote", { id });
    await reload();
  }, "이 메모를 지울까요?");
  return (
    <div className="space-y-2">
      <p className="text-xs text-soft">선생님만 보는 메모예요. AI 초안에는 쓰이지 않아요.</p>
      <form ref={form} className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input ref={box} value={text} onChange={(e) => setText(e.target.value)} className="field py-2 text-sm" placeholder="예) 점심시간에 이야기 나눔. 피구 순서 정하기로 함" aria-label="면담 메모" />
        <button type="submit" disabled={!text.trim()} aria-disabled={act.busy} className="btn-main min-h-10 shrink-0 px-4 text-sm">{act.busy ? "남기는 중…" : "메모"}</button>
      </form>
      <span role="status" className="sr-only">{done}</span>
      {act.err && <p role="alert" className="text-sm text-alert">{act.err}</p>}
      {mine.map((n) => (
        <p key={n.id} className="flex items-start justify-between gap-2 border-t border-line pt-2 text-sm">
          <span><span className="text-soft">{kday(n.createdAt).slice(5).replace("-", "/")}</span> {n.text}</span>
          <button onClick={() => remove(n.id)} disabled={act.busy} className="shrink-0 text-xs text-soft underline">지우기</button>
        </p>
      ))}
    </div>
  );
}
