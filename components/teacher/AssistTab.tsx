"use client";
// AI 도우미 메뉴: 대화 · 할 일(앱이 찾은 일 + 선생님 업무 목록) · 위기 대응(고정 안내 + 학교 연락처) · 자료함(업무 문서·자료 올리기)
import { useEffect, useState } from "react";
import Doodle, { type DoodleName } from "@/components/Doodle";
import { api } from "@/lib/api";
import { CONTACT_SLOTS, DOC_KINDS, DOC_MAX, GO_TABS, dueLabel, type AppTodo, type Contact, type DocKind, type DocMeta, type Go, type Todo } from "@/lib/assist";
import { CRISIS, type CrisisId } from "@/lib/crisis";
import { AssistChat } from "./AssistChat";
import { CrisisCard } from "./assistUi";
import { useAct } from "./useAct";
import type { OverviewRaw } from "./types";

type Mode = "chat" | "todo" | "crisis" | "docs";
const MODES: [Mode, DoodleName, string, string][] = [
  ["chat", "speech", "대화", "자료·학생·업무·글쓰기 묻기"],
  ["todo", "clipboard", "할 일", "앱이 찾은 일과 내 업무"],
  ["crisis", "siren", "위기 대응", "학교폭력·아동학대·자살 위기"],
  ["docs", "clip", "자료함", "업무 문서 올리기"],
];

export function AssistTab({ data, ctx, names, onGo }: { data: OverviewRaw; ctx: { tab: string; no: number | null }; names: Record<number, string>; onGo: (g: Go) => void }) {
  const [mode, setMode] = useState<Mode>("chat");
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="AI 도우미" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map(([id, icon, name, hint]) => (
          <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`chip flex min-h-14 items-center gap-2 px-3 py-2 text-left ${mode === id ? "chip-on" : ""}`}>
            <Doodle name={icon} size={26} />
            <span><b className="block">{name}</b><span className="hidden text-xs text-soft sm:block">{hint}</span></span>
          </button>
        ))}
      </div>
      {mode === "chat" && <section className="card p-4"><AssistChat data={data} ctx={ctx} names={names} onGo={onGo} /></section>}
      {mode === "todo" && <TodoPanel onGo={onGo} trial={!!data.trial} />}
      {mode === "crisis" && <CrisisPanel trial={!!data.trial} />}
      {mode === "docs" && <DocsPanel trial={!!data.trial} />}
    </div>
  );
}

// ── 할 일 ──
function TodoPanel({ onGo, trial }: { onGo: (g: Go) => void; trial: boolean }) {
  const [app, setApp] = useState<AppTodo[] | null>(null);
  const [mine, setMine] = useState<Todo[]>([]);
  const [day, setDay] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const act = useAct();
  const { setErr } = act;
  useEffect(() => {
    api<{ app: AppTodo[]; mine: Todo[]; today: string }>("teacher/assist", "todos")
      .then((r) => { setApp(r.app); setMine(r.mine); setDay(r.today); })
      .catch((e) => setErr(`할 일을 불러오지 못했어요: ${(e as Error).message}`));
  }, [setErr]);
  const edit = (action: string, body: Record<string, unknown>, fail: string) =>
    act.run(fail, async () => setMine((await api<{ mine: Todo[] }>("teacher/assist", action, body)).mine));
  const add = async () => {
    if (await edit("todoAdd", { title, due }, "할 일을 넣지 못했어요")) { setTitle(""); setDue(""); }
  };
  const open = mine.filter((t) => !t.done), done = mine.filter((t) => t.done);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3">
        <h3 className="flex items-center gap-2 font-display text-xl"><Doodle name="sparkle" />앱이 찾은 할 일</h3>
        {!app ? <p className="text-soft">불러오는 중…</p> : !app.length ? <p className="text-soft">지금 챙길 일이 없어요.</p> : (
          <ul className="space-y-2">
            {app.map((t) => (
              <li key={t.key} className={`flex flex-wrap items-center gap-2 rounded-2xl border p-3 ${t.urgent ? "border-alert/40 bg-alert-soft" : "border-line"}`}>
                <span className="flex-1">{t.urgent && <b className="text-alert">먼저 · </b>}{t.text}</span>
                <button onClick={() => onGo({ tab: t.tab, ...(t.no ? { no: t.no } : {}) })} className="btn-sub min-h-9 px-3 text-sm">{GO_TABS[t.tab]} →</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card space-y-3">
        <h3 className="flex items-center gap-2 font-display text-xl"><Doodle name="clipboard" />내 업무 목록</h3>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="todo-title">할 일</label>
          <input id="todo-title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="예: 융합독서 운영 결과 제출" className="field min-w-0 flex-1" />
          <label className="sr-only" htmlFor="todo-due">마감일</label>
          <input id="todo-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="field w-auto" />
          <button disabled={act.busy || !title.trim()} className="btn-main">넣기</button>
        </form>
        {trial && <p className="text-xs text-soft">체험 반은 여러 사람이 함께 써요. 실제 업무는 적지 말아 주세요.</p>}
        {act.err && <p role="alert" className="text-sm text-alert">{act.err}</p>}
        {!open.length ? <p className="text-soft">적어 둔 할 일이 없어요. 대화에서 「할 일에 넣기」를 눌러도 여기에 모여요.</p> : (
          <ul className="space-y-1">
            {open.map((t) => {
              const d = dueLabel(t.due, day);
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-paper">
                  <input type="checkbox" aria-label={`${t.title} 마침`} checked={false} onChange={() => edit("todoEdit", { id: t.id, done: true }, "바꾸지 못했어요")} className="size-5 accent-[var(--color-leaf)]" />
                  <span className="flex-1">{t.title}{t.from === "chat" && <span className="ml-1 text-xs text-soft">(대화에서)</span>}</span>
                  {t.due && <span className={`text-sm ${d.late ? "font-bold text-alert" : "text-soft"}`}>{t.due.slice(5).replace("-", "/")} · {d.text}</span>}
                  <button onClick={() => edit("todoDelete", { id: t.id }, "지우지 못했어요")} className="text-sm text-soft hover:text-alert" aria-label={`${t.title} 지우기`}>지우기</button>
                </li>
              );
            })}
          </ul>
        )}
        {!!done.length && (
          <details>
            <summary className="cursor-pointer text-sm font-bold text-soft">마친 일 {done.length}개</summary>
            <ul className="mt-1 space-y-1">
              {done.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-2 py-1 text-soft">
                  <input type="checkbox" aria-label={`${t.title} 다시 할 일로`} checked onChange={() => edit("todoEdit", { id: t.id, done: false }, "바꾸지 못했어요")} className="size-5 accent-[var(--color-leaf)]" />
                  <span className="flex-1 line-through">{t.title}</span>
                  <button onClick={() => edit("todoDelete", { id: t.id }, "지우지 못했어요")} className="text-sm hover:text-alert">지우기</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

// ── 위기 대응: 고정 안내(AI 없이) + 학교 연락처 ──
function CrisisPanel({ trial }: { trial: boolean }) {
  const [pick, setPick] = useState<CrisisId>("violence");
  const [items, setItems] = useState<Contact[]>([]);
  const [draft, setDraft] = useState<Contact[] | null>(null);
  const act = useAct();
  useEffect(() => {
    api<{ items: Contact[] }>("teacher/assist", "contacts").then((r) => setItems(r.items)).catch(() => {});
  }, []);
  const startEdit = () => {
    const have = new Map(items.map((c) => [c.label, c.num]));
    setDraft([...CONTACT_SLOTS.map((label) => ({ label, num: have.get(label) ?? "" })), ...items.filter((c) => !CONTACT_SLOTS.includes(c.label)), { label: "", num: "" }]);
  };
  const save = () => act.run("연락처를 저장하지 못했어요", async () => {
    const r = await api<{ items: Contact[] }>("teacher/assist", "contactsSave", { items: draft });
    setItems(r.items);
    setDraft(null);
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {CRISIS.map((g) => (
          <button key={g.id} onClick={() => setPick(g.id)} aria-pressed={pick === g.id} className={`chip min-h-20 px-4 py-3 text-left ${pick === g.id ? "chip-on" : ""}`}>
            <b className="block text-lg">{g.title}</b>
            <span className="text-sm text-soft">{g.short}</span>
          </button>
        ))}
      </div>
      <CrisisCard id={pick} contacts={items} />
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-xl"><Doodle name="phone" />우리 학교 연락처</h3>
          {!draft && <button onClick={startEdit} className="btn-sub min-h-10 px-3 text-sm">{items.length ? "고치기" : "적어 두기"}</button>}
        </div>
        <p className="text-sm text-soft">위기 대응 안내와 AI 답에 함께 보여요. Wee클래스, 교육지원청 담당, 학교전담경찰관 번호를 미리 적어 두세요.</p>
        {!draft ? (
          items.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map((c) => <li key={c.label} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"><span>{c.label}</span><a href={`tel:${c.num.replace(/[^\d+]/g, "")}`} className="font-bold text-leaf">{c.num}</a></li>)}
            </ul>
          ) : <p className="text-soft">아직 적어 둔 연락처가 없어요.</p>
        ) : (
          <div className="space-y-2">
            {draft.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] gap-2">
                <input aria-label="기관 이름" value={c.label} onChange={(e) => setDraft(draft.map((x, k) => (k === i ? { ...x, label: e.target.value.slice(0, 30) } : x)))} placeholder="기관 이름" className="field" />
                <input aria-label={`${c.label || "기관"} 번호`} inputMode="tel" value={c.num} onChange={(e) => setDraft(draft.map((x, k) => (k === i ? { ...x, num: e.target.value.slice(0, 40) } : x)))} placeholder="번호" className="field" />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setDraft([...draft, { label: "", num: "" }])} className="btn-sub min-h-10 px-3 text-sm">한 줄 더</button>
              <button onClick={save} disabled={act.busy} className="btn-main min-h-10 px-4 text-sm">{act.busy ? "저장하는 중…" : "저장"}</button>
              <button onClick={() => setDraft(null)} className="btn-sub min-h-10 px-3 text-sm">그만두기</button>
            </div>
            {trial && <p className="text-xs text-soft">체험 반은 여러 사람이 함께 써요.</p>}
          </div>
        )}
        {act.err && <p role="alert" className="text-sm text-alert">{act.err}</p>}
      </section>
    </div>
  );
}

// ── 자료함 ──
async function pdfText(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), cMapUrl: "/pdfjs-cmaps/", cMapPacked: true }).promise;
  const out: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 300); i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join(""));
  }
  return { text: out.join("\n\n"), pages: doc.numPages };
}
const PLAIN = /\.(txt|md|csv)$/i;
const SERVER = /\.(hwp|hwpx|docx?|pptx?|xlsx?|png|jpe?g|webp)$/i;

function DocsPanel({ trial }: { trial: boolean }) {
  const [items, setItems] = useState<DocMeta[] | null>(null);
  const [kind, setKind] = useState<DocKind>("업무");
  const [ready, setReady] = useState<{ title: string; text: string; how: string } | null>(null);
  const [reading, setReading] = useState("");
  const act = useAct();
  const { setErr } = act;
  useEffect(() => {
    api<{ items: DocMeta[] }>("teacher/assist", "docs").then((r) => setItems(r.items)).catch((e) => setErr((e as Error).message));
  }, [setErr]);
  const read = async (f: File) => {
    act.setErr("");
    setReady(null);
    setReading(`「${f.name}」 읽는 중…`);
    try {
      let text = "", how = "";
      if (PLAIN.test(f.name)) { text = await f.text(); how = "글 파일"; }
      else if (/\.pdf$/i.test(f.name)) {
        const r = await pdfText(f);
        text = r.text; how = `PDF ${r.pages}쪽(이 기기에서 읽음)`;
        // 글자가 거의 없으면 스캔한 PDF: 업스테이지로 읽는다
        if (text.replace(/\s/g, "").length < 40 * Math.min(r.pages, 5)) { text = ""; }
      }
      if (!text && (SERVER.test(f.name) || /\.pdf$/i.test(f.name))) {
        if (f.size > 4 * 1024 * 1024) throw new Error("4MB보다 큰 파일은 서버에서 읽을 수 없어요. 필요한 쪽만 잘라 주세요.");
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/teacher/assist/parse", { method: "POST", body: form });
        const r = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(r.error ?? "파일을 읽지 못했어요.");
        text = r.text; how = `업스테이지로 읽음${r.pages ? ` · ${r.pages}쪽` : ""}`;
      }
      if (!text.trim()) throw new Error("이 파일에서는 글을 찾지 못했어요. PDF·HWP·DOCX·TXT 파일을 올려 주세요.");
      setReady({ title: f.name.replace(/\.[^.]+$/, "").slice(0, 80), text, how });
    } catch (e) {
      act.setErr((e as Error).message);
    } finally {
      setReading("");
    }
  };
  const save = () => act.run("자료를 저장하지 못했어요", async () => {
    const r = await api<{ items: DocMeta[]; cut: boolean }>("teacher/assist", "docSave", { title: ready!.title, kind, text: ready!.text });
    setItems(r.items);
    setReady(null);
    if (r.cut) alert("자료가 길어서 앞부분(12만 자)까지만 담았어요.");
  });
  const drop = (d: DocMeta) => act.run("지우지 못했어요", async () => setItems((await api<{ items: DocMeta[] }>("teacher/assist", "docDelete", { id: d.id })).items), `「${d.title}」을 자료함에서 지울까요?`);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <section className="card space-y-3">
        <h3 className="flex items-center gap-2 font-display text-xl"><Doodle name="clip" />자료 올리기</h3>
        <p className="text-sm text-soft">업무 계획·공문·연수 자료를 올려 두면 AI 도우미가 물음에 맞는 부분을 찾아 출처와 함께 답해요. 2026 사회정서교육 기본 자료(한국형 사회정서교육 지도서·교육과정 요약)는 처음부터 들어 있어요.</p>
        {trial ? <p className="rounded-2xl bg-paper p-3 text-sm">체험 반은 여러 사람이 함께 보는 곳이라 자료를 올릴 수 없어요. 실제 학급에서 써 보세요.</p> : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">종류</span>
              {DOC_KINDS.map((k) => <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`chip min-h-10 px-3 text-sm ${kind === k ? "chip-on" : ""}`}>{k}</button>)}
            </div>
            <label className="btn-main w-full cursor-pointer">
              <Doodle name="clip" /> 파일 고르기 (PDF·HWP·HWPX·DOCX·PPTX·TXT)
              <input type="file" accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) read(f); }} />
            </label>
            <p className="text-xs text-soft">글이 든 PDF와 TXT는 이 기기에서 읽어요. HWP·DOCX·스캔 PDF는 업스테이지 Document Parse로 읽고 파일은 남기지 않아요. 학생 이름이 든 문서는 올리지 말아 주세요.</p>
            {reading && <p className="text-soft">{reading}</p>}
            {ready && (
              <div className="space-y-2 rounded-2xl border border-line p-3">
                <label className="block text-sm font-bold" htmlFor="doc-title">자료 이름</label>
                <input id="doc-title" value={ready.title} onChange={(e) => setReady({ ...ready, title: e.target.value.slice(0, 80) })} className="field" />
                <p className="text-sm text-soft">{ready.how} · {ready.text.length.toLocaleString()}자</p>
                <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper p-2 text-xs text-soft">{ready.text.slice(0, 600)}</p>
                <div className="flex gap-2">
                  <button onClick={save} disabled={act.busy || !ready.title.trim()} className="btn-main">{act.busy ? "저장하는 중…" : "자료함에 넣기"}</button>
                  <button onClick={() => setReady(null)} className="btn-sub">그만두기</button>
                </div>
              </div>
            )}
          </>
        )}
        {act.err && <p role="alert" className="text-sm text-alert">{act.err}</p>}
      </section>
      <section className="card space-y-3">
        <h3 className="font-display text-xl">자료함 {items ? `${items.length}/${DOC_MAX}` : ""}</h3>
        {!items ? <p className="text-soft">불러오는 중…</p> : !items.length ? <p className="text-soft">올린 자료가 없어요.</p> : (
          <ul className="space-y-2">
            {items.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
                <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-bold text-leaf">{d.kind}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{d.title}</span>
                <span className="text-xs text-soft">{d.chars.toLocaleString()}자 · {d.at.slice(0, 10)}</span>
                {!trial && <button onClick={() => drop(d)} className="text-sm text-soft hover:text-alert">지우기</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
