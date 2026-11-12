"use client";
// 선생님 도우미 대화창: AI 도우미 탭과 오른쪽 아래 단추(어느 메뉴에서나)가 함께 쓴다.
// 실명은 이 기기에만 있으므로 보내기 전에 번호로 바꾼다(lib/assist hideNames).
import { useEffect, useRef, useState } from "react";
import Doodle from "@/components/Doodle";
import { api } from "@/lib/api";
import { GO_TABS, hideNames, type ChatMsg, type Contact, type Go } from "@/lib/assist";
import { crisisById, type CrisisId } from "@/lib/crisis";
import { CrisisCard, Md } from "./assistUi";
import type { OverviewRaw } from "./types";

interface ThreadRow { id: string; title: string; updatedAt: string; count: number }
type Shown = ChatMsg & { hid?: boolean; added?: string[]; fail?: boolean };

export function AssistChat({ data, ctx, names, onGo, compact = false, onClose }: {
  data: OverviewRaw;
  ctx: { tab: string; no: number | null };
  names: Record<number, string>;
  onGo: (g: Go) => void;
  compact?: boolean;
  onClose?: () => void;
}) {
  const [msgs, setMsgs] = useState<Shown[]>([]);
  const [thread, setThread] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [saved, setSaved] = useState(!data.trial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const loadThreads = () =>
    api<{ threads: ThreadRow[]; saved: boolean }>("teacher/assist", "threads").then((r) => { setThreads(r.threads); setSaved(r.saved); }).catch(() => {});
  useEffect(() => {
    loadThreads();
    api<{ items: Contact[] }>("teacher/assist", "contacts").then((r) => setContacts(r.items)).catch(() => {});
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs, busy]);

  const open = async (id: string) => {
    if (!id) return fresh();
    setErr("");
    try {
      const r = await api<{ thread: { id: string; msgs: ChatMsg[] } }>("teacher/assist", "thread", { id });
      setThread(r.thread.id);
      setMsgs(r.thread.msgs);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const fresh = () => { setThread(null); setMsgs([]); setErr(""); box.current?.focus(); };
  const drop = async () => {
    if (!thread || !confirm("이 대화를 지울까요? 지우면 되살릴 수 없어요.")) return;
    await api("teacher/assist", "threadDelete", { id: thread }).catch(() => {});
    fresh();
    loadThreads();
  };

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    const { text: safe, hit } = hideNames(q, names);
    const me: Shown = { role: "me", text: safe, at: new Date().toISOString(), hid: hit };
    const history = msgs.filter((m) => !m.fail).slice(-8).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((xs) => [...xs, me]);
    setText("");
    setBusy(true);
    setErr("");
    try {
      const r = await api<ChatMsg & { thread: { id: string; title: string } | null }>("teacher/assist", "ask", {
        text: safe, thread, history, ctx: { tab: ctx.tab, no: ctx.no ?? 0 },
      }, { timeout: 70_000 });
      setMsgs((xs) => [...xs, { role: "bot", text: r.text, at: r.at, sources: r.sources, todos: r.todos, go: r.go, crisis: r.crisis, nos: r.nos }]);
      if (r.thread) {
        setThread(r.thread.id);
        loadThreads();
      }
    } catch (e) {
      const body = (e as { body?: { crisis?: CrisisId[] } }).body;
      // AI가 답하지 못해도 위기 대응 안내는 그대로 보인다
      setMsgs((xs) => [...xs, { role: "bot", text: (e as Error).message, at: new Date().toISOString(), crisis: body?.crisis ?? [], fail: true }]);
    } finally {
      setBusy(false);
    }
  };

  const addTodo = async (i: number, t: { title: string; due: string }) => {
    try {
      await api("teacher/assist", "todoAdd", { ...t, from: "chat" });
      setMsgs((xs) => xs.map((m, k) => (k === i ? { ...m, added: [...(m.added ?? []), t.title] } : m)));
    } catch (e) {
      setErr(`할 일에 넣지 못했어요: ${(e as Error).message}`);
    }
  };

  const quick = [
    ...(ctx.no ? [`${ctx.no}번 학생 상담 준비를 도와줘. 최근 기록에서 살펴볼 점은?`] : []),
    "오늘 해야 할 일 알려 줘",
    "우리 반 요즘 어때? 먼저 살펴볼 학생은?",
    "학교폭력 신고를 받았어. 지금 뭐부터 해?",
    "아동학대가 의심되는 아이가 있어. 절차가 궁금해",
    "3학년 사회정서 성취기준과 수업 아이디어",
    "사회정서 수업을 안내하는 가정통신문 초안 써 줘",
  ];

  return (
    <div className={`flex min-h-0 flex-col ${compact ? "h-full" : "h-[calc(100dvh-14rem)] min-h-[520px]"}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
        {compact && <p className="flex items-center gap-2 font-display text-lg"><Doodle name="sparkle" size={24} />AI 도우미</p>}
        <div className="ml-auto flex items-center gap-2">
          {saved && threads.length > 0 && (
            <select aria-label="지난 대화" value={thread ?? ""} onChange={(e) => open(e.target.value)} className="h-10 max-w-[12rem] rounded-xl border border-line bg-card px-2 text-sm">
              <option value="">지난 대화 {threads.length}개</option>
              {threads.map((t) => <option key={t.id} value={t.id}>{t.updatedAt.slice(5, 10).replace("-", "/")} {t.title}</option>)}
            </select>
          )}
          <button onClick={fresh} className="btn-sub min-h-10 px-3 text-sm">새 대화</button>
          {thread && <button onClick={drop} className="btn-sub min-h-10 px-3 text-sm" aria-label="이 대화 지우기">지우기</button>}
          {onClose && <button onClick={onClose} className="btn-sub min-h-10 px-3 text-sm" aria-label="AI 도우미 닫기">닫기</button>}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3" aria-live="polite">
        {!msgs.length && (
          <div className="space-y-3">
            <p className="text-soft">사회정서교육 자료, 우리 반 학생, 학교 업무, 글쓰기, 해야 할 일, 위기 상황 대응까지 물어보세요.</p>
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => <button key={q} onClick={() => send(q)} className="chip min-h-10 px-3 text-left text-sm">{q}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => m.role === "me" ? (
          <div key={i} className="flex flex-col items-end">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-leaf px-4 py-2 text-white">{m.text}</p>
            {m.hid && <p className="mt-1 text-xs text-soft">실명은 번호로 바꿔 보냈어요.</p>}
          </div>
        ) : (
          <div key={i} className="max-w-[95%] space-y-2">
            <div className={`rounded-2xl rounded-bl-md border px-4 py-3 ${m.fail ? "border-alert/40 bg-alert-soft" : "border-line bg-card"}`}>
              {m.fail ? <p role="alert">{m.text}</p> : <Md text={m.text} />}
              {!m.fail && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(m.sources ?? []).map((s) => <span key={s} className="rounded-full bg-paper px-2 py-0.5 text-xs text-soft">{/^(대응 안내|자료함) ·/.test(s) ? s : `자료 · ${s}`}</span>)}
                  <button onClick={() => navigator.clipboard?.writeText(m.text)} className="ml-auto text-xs font-bold text-leaf">복사</button>
                </div>
              )}
            </div>
            {(m.crisis ?? []).map((id) => (crisisById(id) ? <CrisisCard key={id} id={id} contacts={contacts} compact /> : null))}
            {!!m.todos?.length && (
              <div className="rounded-2xl border border-dashed border-line p-3">
                <p className="text-sm font-bold">할 일로 적어 둘까요?</p>
                <ul className="mt-1 space-y-1">
                  {m.todos.map((t) => (
                    <li key={t.title} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="flex-1">{t.title}{t.due && <span className="text-soft"> · {t.due}</span>}</span>
                      {m.added?.includes(t.title)
                        ? <span className="text-xs font-bold text-leaf">넣었어요 ✓</span>
                        : <button onClick={() => addTodo(i, t)} className="btn-sub min-h-9 px-3 text-xs">할 일에 넣기</button>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!m.go?.length && (
              <div className="flex flex-wrap gap-2">
                {m.go.map((g) => (
                  <button key={`${g.tab}${g.no ?? ""}`} onClick={() => onGo(g)} className="btn-sub min-h-10 px-3 text-sm">
                    {g.no ? `${g.no}번 · ` : ""}{GO_TABS[g.tab]} 열기 →
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="flex items-center gap-2 text-soft"><Doodle name="sparkle" /> 기록과 자료를 살펴보는 중…</p>}
        <div ref={end} />
      </div>

      {err && <p role="alert" className="mb-2 text-sm text-alert">{err}</p>}
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2 border-t border-line pt-3">
        <label className="sr-only" htmlFor={compact ? "assist-q-mini" : "assist-q"}>AI 도우미에게 물어보기</label>
        <textarea
          id={compact ? "assist-q-mini" : "assist-q"}
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1500))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); }
          }}
          rows={2}
          placeholder="예: 5번 학생 요즘 어때? / 다음 주 학부모 상담 안내문 써 줘"
          className="field max-h-40 min-h-12 resize-y"
        />
        <button type="submit" disabled={busy || !text.trim()} className="btn-main min-h-12 shrink-0 px-4">보내기</button>
      </form>
      <p className="mt-2 text-xs text-soft">
        AI 답은 틀릴 수 있어요. 위기 상황은 학교 절차와 담당자를 먼저 따라 주세요. 물은 학생의 기록(면담 메모·조치 기록 포함)이 번호·가명으로 AI에 가요.
        {saved ? " 대화는 학급 저장소에 30일 동안 남아요." : " 체험 반에서는 대화를 남기지 않아요."}
      </p>
    </div>
  );
}
