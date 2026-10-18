"use client";
// 면담 메모: 선생님만 보고, AI에는 보내지 않는다
import { useState } from "react";
import type { Reload } from "./types";
import { api } from "@/lib/api";
import type { Note } from "@/lib/shared";

export default function Notes({ no, notes, reload }: { no: number; notes: Note[]; reload: Reload }) {
  const [text, setText] = useState("");
  const mine = notes.filter((n) => n.no === no);
  async function add() {
    await api("teacher", "note", { no, text });
    setText("");
    await reload();
  }
  async function remove(id: string) {
    if (!confirm("이 메모를 지울까요?")) return;
    await api("teacher", "deleteNote", { id });
    await reload();
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-soft">선생님만 보는 메모예요. AI 초안에는 쓰이지 않아요.</p>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} className="field py-2 text-sm" placeholder="예) 점심시간에 이야기 나눔. 피구 순서 정하기로 함" />
        <button onClick={add} disabled={!text.trim()} className="btn-main min-h-10 shrink-0 px-4 text-sm">메모</button>
      </div>
      {mine.map((n) => (
        <p key={n.id} className="flex items-start justify-between gap-2 border-t border-line pt-2 text-sm">
          <span><span className="text-soft">{n.createdAt.slice(5, 10).replace("-", "/")}</span> {n.text}</span>
          <button onClick={() => remove(n.id)} className="shrink-0 text-xs text-soft underline">지우기</button>
        </p>
      ))}
    </div>
  );
}
