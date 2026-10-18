"use client";
// 응원 한마디: 학생 기록 2주 → AI 초안 2개 → 선생님이 고쳐서 복사·저장 (학생에게 자동으로 보내지 않음)
import { useState } from "react";
import Timeline from "./Timeline";
import Notes from "./Notes";
import type { NameOf, Overview, Reload } from "./types";
import { api } from "@/lib/api";
import { leaks } from "@/lib/rules";
import { PROVIDERS } from "@/lib/shared";

export default function CheerTab({ data, reload, no, setNo, nameOf }: { data: Overview; reload: Reload; no: number | null; setNo: (n: number) => void; nameOf: NameOf }) {
  const [drafts, setDrafts] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const s = data.students.find((x) => x.no === no);
  const saved = data.cheers.filter((c) => c.no === no);
  const flagged = new Set(data.flags.map((f) => f.no));

  async function draft() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ drafts: string[]; warns: string[] }>("teacher", "cheer", { no });
      setWarns(r.warns ?? []);
      setDrafts(r.drafts);
      setText(r.drafts[0] ?? "");
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }

  async function save() {
    await api("teacher", "saveCheer", { no, text });
    await navigator.clipboard?.writeText(text).catch(() => {});
    setMsg("저장하고 복사했어요. 쪽지나 알림장에 붙여 전해 주세요.");
    await reload();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <aside className="card self-start p-3">
        <p className="mb-2 px-2 text-sm text-soft">학생 고르기 · 🟡 살펴볼 신호</p>
        <div className="grid max-h-[60dvh] grid-cols-3 gap-1 overflow-y-auto lg:grid-cols-1">
          {data.students.map((x) => (
            <button
              key={x.no}
              onClick={() => { setNo(x.no); setDrafts([]); setText(""); setMsg(""); }}
              className={`rounded-xl px-3 py-2 text-left text-sm ${x.no === no ? "bg-leaf text-white" : "hover:bg-paper"}`}
            >
              {x.no} {nameOf(x.no)} {flagged.has(x.no) && "🟡"}
            </button>
          ))}
        </div>
      </aside>

      {!s ? (
        <div className="card text-soft">왼쪽에서 학생을 골라 주세요.</div>
      ) : (
        <div className="space-y-5">
          <section className="card">
            <h2 className="mb-3 font-display text-2xl">{s.no}번 {nameOf(s.no)} · 최근 2주</h2>
            <Timeline records={data.records.filter((r) => r.no === s.no)} today={data.today} />
          </section>
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl">응원 한마디</h2>
              <button onClick={draft} disabled={busy} className="btn-main">
                {busy ? "초안 만드는 중…" : drafts.length ? "다시 만들기" : "✨ AI 초안 만들기"}
              </button>
            </div>
            <p className="text-xs text-soft">
              {PROVIDERS[data.settings.provider].label}가 기록과 반 감정 단어({data.settings.vocab.join(", ")})를 보고 써요. 학생 이름은 보내지 않아요(가명만).
            </p>
            {drafts.length > 1 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {drafts.map((d, i) => (
                  <button key={i} onClick={() => setText(d)} className={`chip p-3 text-left text-sm ${text === d ? "chip-on" : ""}`}>
                    <b className="text-xs text-soft">{["마음 알아주기", "응원하기"][i] ?? `초안 ${i + 1}`}</b>
                    <span className="mt-1 block">{d}</span>
                    {warns[i] && <span className="mt-1 block text-xs text-alert">⚠️ 아이에게 맞지 않을 수 있는 말: {warns[i]}</span>}
                  </button>
                ))}
              </div>
            )}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="field" placeholder="초안을 고르거나 직접 써 주세요." />
            {leaks(text).length > 0 && (
              <p className="text-xs text-alert">⚠️ 「{leaks(text).join("」, 「")}」 — 선생님용 숫자·말은 아이에게 보내기 전에 고쳐 주세요.</p>
            )}
            {msg && <p className="text-sm">{msg}</p>}
            <div className="flex justify-end">
              <button onClick={save} disabled={!text.trim()} className="btn-main">선생님이 확인했어요 · 저장하고 복사</button>
            </div>
          </section>
          {saved.length > 0 && (
            <section className="card">
              <h2 className="mb-2 font-display text-xl">전에 쓴 응원</h2>
              {saved.map((c) => (
                <p key={c.id} className="border-t border-line py-2 text-sm">
                  <span className="text-soft">{c.createdAt.slice(0, 10)}</span> {c.text}
                </p>
              ))}
            </section>
          )}
          <section className="card">
            <h2 className="mb-2 font-display text-xl">📝 면담 메모</h2>
            <Notes no={s.no} notes={data.notes} reload={reload} />
          </section>
        </div>
      )}
    </div>
  );
}
