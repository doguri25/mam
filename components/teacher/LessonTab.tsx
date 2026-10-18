"use client";
// 교과서 연결: 도덕 교과서·학습지를 올리면 업스테이지 Document Parse가 글을 읽고, AI가 감정 단어·활동을 골라 준다.
// 선생님이 고른 것만 반 감정 단어(도움판·되묻기·응원 초안)와 주간 활동 추천에 쓰인다.
import { useState } from "react";
import { EmotionArt } from "../Art";
import type { Overview, Reload } from "./types";
import { api } from "@/lib/api";

interface Found {
  unit: string;
  words: { word: string; emotion: string; meaning: string }[];
  activities: { title: string; how: string; minutes: number }[];
  pages: number;
  chars: number;
}

export default function LessonTab({ data, reload }: { data: Overview; reload: Reload }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [unit, setUnit] = useState("");
  const [pickW, setPickW] = useState<Set<number>>(new Set());
  const [pickA, setPickA] = useState<Set<number>>(new Set());
  const toggle = (set: Set<number>, i: number) => {
    const n = new Set(set);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    return n;
  };

  async function read() {
    if (!file) return;
    setBusy(true);
    setErr("");
    setFound(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/teacher/doc", { method: "POST", body: form });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "읽지 못했어요.");
      setFound(out);
      setUnit(out.unit);
      setPickW(new Set(out.words.map((_: unknown, i: number) => i)));
      setPickA(new Set(out.activities.map((_: unknown, i: number) => i)));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  async function save() {
    if (!found) return;
    await api("teacher", "saveLesson", {
      unit,
      words: found.words.filter((_, i) => pickW.has(i)),
      activities: found.activities.filter((_, i) => pickA.has(i)),
    });
    setFound(null);
    setFile(null);
    await reload();
  }

  async function remove(id: string) {
    if (!confirm("이 차시를 지울까요? 반 감정 단어는 그대로 남아요(설정에서 지울 수 있어요).")) return;
    await api("teacher", "deleteLesson", { id });
    await reload();
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4">
        <div>
          <h2 className="font-display text-2xl">📚 도덕 교과서·학습지 연결</h2>
          <p className="text-sm text-soft">
            그 주에 가르친 쪽을 사진·PDF·HWP로 올리면 <b>업스테이지 Document Parse</b>가 글을 읽고, AI가 감정 단어와 교실 활동을 골라 줘요.
            고른 것만 학생 도움판·되묻기·응원 초안과 「다음 주 활동 추천」에 쓰여요. (4MB 안, 필요한 쪽만)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-sub cursor-pointer">
            📎 파일 고르기
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.hwp,.hwpx,.docx,.pptx"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setFound(null);
                setErr("");
              }}
            />
          </label>
          <span className="text-sm">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB` : "아직 고르지 않았어요"}</span>
          <button onClick={read} disabled={!file || busy} className="btn-main">{busy ? "읽는 중… (최대 1분)" : "읽고 정리하기"}</button>
        </div>
        {err && <p className="text-sm text-alert">{err}</p>}
      </section>

      {found && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-soft">{found.pages}쪽에서 글자 {found.chars.toLocaleString()}자를 읽었어요. 반영할 것만 골라 주세요.</p>
          </div>
          <label className="block">
            <span className="text-sm font-bold">차시·단원 이름</span>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className="field mt-1" />
          </label>
          <div>
            <h3 className="mb-2 font-bold">감정 단어</h3>
            {found.words.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {found.words.map((x, i) => (
                  <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-2.5 ${pickW.has(i) ? "border-leaf bg-leaf-soft/40" : "border-line"}`}>
                    <input type="checkbox" checked={pickW.has(i)} onChange={() => setPickW(toggle(pickW, i))} className="size-4 accent-leaf" />
                    <EmotionArt name={x.emotion} size={34} />
                    <span>
                      <b className="text-lg">{x.word}</b> <span className="text-xs text-soft">({x.emotion} 무리)</span>
                      <span className="block text-sm text-soft">{x.meaning}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-soft">감정 단어를 찾지 못했어요.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-bold">교실 활동</h3>
            {found.activities.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {found.activities.map((a, i) => (
                  <label key={i} className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-2.5 ${pickA.has(i) ? "border-leaf bg-leaf-soft/40" : "border-line"}`}>
                    <input type="checkbox" checked={pickA.has(i)} onChange={() => setPickA(toggle(pickA, i))} className="mt-1 size-4 accent-leaf" />
                    <span>
                      <b>{a.title}</b> <span className="text-xs text-soft">· {a.minutes}분</span>
                      <span className="block text-sm">{a.how}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-soft">활동을 찾지 못했어요.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setFound(null)} className="btn-sub">취소</button>
            <button onClick={save} disabled={!pickW.size && !pickA.size} className="btn-main">선택한 것 반영하기</button>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 font-display text-xl">연결한 차시</h2>
        {data.lessons.length ? (
          <ul className="space-y-2">
            {data.lessons.map((l) => (
              <li key={l.id} className="rounded-2xl border border-line p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <b>{l.unit || "이름 없는 차시"}</b>
                  <button onClick={() => remove(l.id)} className="text-xs text-soft underline">지우기</button>
                </div>
                {l.words.length > 0 && <p className="mt-1">단어: {l.words.join(", ")}</p>}
                {l.activities.length > 0 && <p className="text-soft">활동: {l.activities.map((a) => a.title).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-soft">아직 없어요. 위에서 교과서 쪽을 올려 보세요.</p>
        )}
        <p className="mt-3 text-xs text-soft">지금 반 감정 단어: {data.settings.vocab.join(", ")}</p>
      </section>
    </div>
  );
}
