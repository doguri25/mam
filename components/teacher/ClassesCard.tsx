"use client";
// 운영 선생님(처음 반 홍북초)만 보는 「다른 선생님 학급」: 누가 언제 학급을 만들었고 요즘 쓰는지.
// 학급 이름·로그인 이름·날짜·학생 수·기록 수만 보인다(학생 이름·기록 글은 서버가 보내지 않는다).
import { useState } from "react";
import { api } from "@/lib/api";
import { useAct } from "./useAct";
import { kday } from "./when";

interface Row { name: string; className: string; space: string; createdAt: string; lastLogin: string; students: number; records: number; recent: number }

export default function ClassesCard() {
  const [list, setList] = useState<{ items: Row[]; max: number } | null>(null);
  const [q, setQ] = useState("");
  const loading = useAct();
  const load = () => loading.run("학급 목록을 읽지 못했어요", async () => setList(await api<{ items: Row[]; max: number }>("teacher", "classes")));
  const shown = (list?.items ?? []).filter((r) => !q.trim() || `${r.name} ${r.className}`.toLowerCase().includes(q.trim().toLowerCase()));
  const using = (list?.items ?? []).filter((r) => r.recent > 0).length;

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl">다른 선생님 학급</h2>
          <p className="text-sm text-soft">운영 선생님(처음 반)에게만 보여요. 학급 이름·만든 날·마지막 접속·학생 수·기록 수만 보이고, 학생 이름과 기록 글은 보이지 않아요.</p>
        </div>
        <button onClick={load} disabled={loading.busy} className="btn-sub">{loading.busy ? "읽는 중…" : list ? "다시 읽기" : "학급 목록 보기"}</button>
      </div>
      {loading.err && <p role="alert" className="text-sm text-alert">{loading.err}</p>}
      {list && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-paper px-3 py-1">학급 <b>{list.items.length}</b> / 최대 {list.max}</span>
            <span className="rounded-full bg-paper px-3 py-1">최근 7일 기록이 있는 학급 <b>{using}</b></span>
            {list.items.length > 6 && (
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·학급으로 찾기" aria-label="학급 찾기" className="field ml-auto h-10 w-48 py-1 text-sm" />
            )}
          </div>
          {list.items.length === 0 ? (
            <p className="text-soft">아직 다른 선생님이 만든 학급이 없어요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-soft">
                    <th className="py-2">로그인 이름</th><th>학급</th><th>만든 날</th><th>마지막 접속</th>
                    <th className="text-right">학생</th><th className="text-right">기록</th><th className="text-right">최근 7일</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.space} className="border-t border-line">
                      <td className="py-2 font-bold">{r.name}</td>
                      <td>{r.className || <span className="text-soft">-</span>}</td>
                      <td>{r.createdAt ? kday(r.createdAt) : "-"}</td>
                      <td>{r.lastLogin ? kday(r.lastLogin) : "-"}</td>
                      <td className="text-right">{r.students}</td>
                      <td className="text-right">{r.records}</td>
                      <td className={`text-right ${r.recent ? "font-bold text-leaf" : "text-soft"}`}>{r.recent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-soft">학생이 없고 기록도 없는 학급은 만든 지 14일이 지나고 그동안 들어오지 않으면 저절로 정리돼요.</p>
        </>
      )}
    </section>
  );
}
