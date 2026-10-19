"use client";
// 활동지 피드백: 학생 활동지(글·그림)를 스캔한 PDF를 올리면 쪽을 스캔 순서대로 학생 번호에 붙이고(전출·결석 번호는 건너뜀),
// AI가 사회정서교육 4대 핵심역량에 비추어 피드백과 그 이유를 쓴다. PDF는 이 기기에서 쪽 그림으로 나눠 한 명씩 보낸다.
// 결과는 번호로만 저장되고(이름·그림은 저장하지 않음) 선생님이 고친 뒤 학생에게 전한다.
import { useEffect, useRef, useState } from "react";
import type { NameOf, Overview } from "./types";
import { api } from "@/lib/api";
import { parseNums, sheetGroups } from "@/lib/rules";
import { PROVIDERS, SEL_AREAS, type SheetItem, type SheetRun } from "@/lib/shared";

const MAX_PAGES = 80;
const LONG_SIDE = 1600; // 손글씨를 읽을 만한 크기(쪽 그림 한 장 300KB 안팎)

async function renderPdf(file: File, onPage: (done: number, total: number) => void) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  const total = Math.min(doc.numPages, MAX_PAGES);
  const out: Blob[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: LONG_SIDE / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    out.push(await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("쪽 그림을 만들지 못했어요."))), "image/jpeg", 0.8)));
    onPage(i, total);
  }
  const cut = doc.numPages > MAX_PAGES;
  await task.destroy();
  return { pages: out, cut };
}

const AREA_COLOR: Record<string, string> = {
  [SEL_AREAS[0]]: "bg-[#fff3d6]", [SEL_AREAS[1]]: "bg-[#e3f4ea]", [SEL_AREAS[2]]: "bg-[#e6eefc]", [SEL_AREAS[3]]: "bg-[#f3e8fb]",
};

export default function SheetTab({ data, nameOf }: { data: Overview; nameOf: NameOf }) {
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [criteria, setCriteria] = useState("");
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<{ blob: Blob; url: string }[]>([]);
  const [reading, setReading] = useState("");
  const [pagesPer, setPagesPer] = useState(1);
  const [skipText, setSkipText] = useState("");
  const [runs, setRuns] = useState<SheetRun[]>([]);
  const [run, setRun] = useState<SheetRun | null>(null);
  const [fails, setFails] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState("");
  const stop = useRef(false);

  const skip = parseNums(skipText);
  const groups = sheetGroups(pages.length, pagesPer, skip);
  const thumb = (n: number) => pages[n - 1]?.url; // n: 1부터 센 쪽
  const ai = PROVIDERS[data.settings.provider].label;

  useEffect(() => {
    api<{ runs: SheetRun[] }>("teacher", "sheets").then((r) => setRuns(r.runs)).catch(() => {});
  }, []);
  useEffect(() => () => pages.forEach((p) => URL.revokeObjectURL(p.url)), [pages]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setErr("");
    setRun(null);
    setFails({});
    setFileName(file.name);
    setReading("PDF를 여는 중…");
    try {
      const { pages: blobs, cut } = await renderPdf(file, (d, t) => setReading(`쪽을 나누는 중… ${d}/${t}`));
      setPages(blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) })));
      if (cut) setErr(`한 번에 ${MAX_PAGES}쪽까지 읽어요. 나머지는 PDF를 나눠 다시 올려 주세요.`);
    } catch (e) {
      setPages([]);
      setErr(`PDF를 열지 못했어요: ${(e as Error).message}`);
    }
    setReading("");
  }

  async function sendOne(r: SheetRun, g: { no: number; pages: number[] }) {
    const form = new FormData();
    form.append("meta", JSON.stringify({ run: r, no: g.no, pages: g.pages }));
    for (const p of g.pages) form.append("page", pages[p - 1].blob, `p${p}.jpg`);
    const res = await fetch("/api/teacher/sheet", { method: "POST", body: form });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error ?? "피드백을 만들지 못했어요."), { status: res.status });
    return out.item as SheetItem;
  }

  async function start(only?: { no: number; pages: number[] }[]) {
    const todo = only ?? groups;
    const r: SheetRun = only && run ? run : {
      id: `s${Date.now().toString(36)}`, file: fileName, topic, content, criteria, pagesPer, skip, createdAt: new Date().toISOString(), items: [],
    };
    setRun(r);
    setErr("");
    stop.current = false;
    setProgress({ done: 0, total: todo.length });
    let cur = r;
    for (const [i, g] of todo.entries()) {
      if (stop.current) break;
      try {
        const item = await sendOne(cur, g);
        cur = { ...cur, items: [...cur.items.filter((x) => x.no !== item.no), item].sort((a, b) => a.no - b.no) };
        setRun(cur);
        setFails((f) => Object.fromEntries(Object.entries(f).filter(([k]) => Number(k) !== g.no)));
      } catch (e) {
        setFails((f) => ({ ...f, [g.no]: (e as Error).message }));
        // 비밀번호가 풀렸거나 키가 없으면 나머지도 안 되므로 멈춤
        if ([400, 401].includes((e as { status?: number }).status ?? 0)) {
          setErr((e as Error).message);
          break;
        }
      }
      setProgress({ done: i + 1, total: todo.length });
    }
    setProgress(null);
    api<{ runs: SheetRun[] }>("teacher", "sheets").then((x) => setRuns(x.runs)).catch(() => {});
  }

  async function edit(no: number, toStudent: string) {
    if (!run) return;
    setRun({ ...run, items: run.items.map((x) => (x.no === no ? { ...x, toStudent } : x)) });
    await api("teacher", "sheetEdit", { id: run.id, no, toStudent }).catch((e) => setErr(e.message));
  }

  async function remove(r: SheetRun) {
    if (!confirm(`${r.createdAt.slice(0, 10)} 「${r.topic || r.items[0]?.topic || r.file}」 피드백을 지울까요?`)) return;
    await api("teacher", "sheetDelete", { id: r.id });
    setRuns(runs.filter((x) => x.id !== r.id));
    if (run?.id === r.id) setRun(null);
  }

  const busy = !!progress || !!reading;
  const failed = groups.filter((g) => fails[g.no]);
  // 지난 회차를 열었을 때는 이 기기에 쪽 그림이 없을 수 있다
  const live = run && pages.length > 0 && run.file === fileName;

  return (
    <div className="space-y-4">
      <section className="no-print card space-y-2">
        <p className="text-sm">
          학생 활동지(글·그림)를 스캔한 PDF를 올리면, 스캔한 순서대로 번호를 붙이고 {ai}가 <b>한국형 사회정서교육 4대 핵심역량</b>에 비추어 피드백과 그 이유를 써 줘요.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SEL_AREAS.map((a) => <span key={a} className={`rounded-full px-3 py-1 text-xs font-bold ${AREA_COLOR[a]}`}>{a}</span>)}
        </div>
        <p className="text-xs text-soft">
          활동지 그림이 AI로 보내져요. 이름 칸은 가리고 스캔해 주세요. 결과는 번호로만 저장되고 그림은 저장하지 않아요.
          {data.settings.provider === "upstage" && " 업스테이지는 Document Parse가 손글씨와 그림을 글로 바꾼 뒤 Solar가 피드백해요(그림은 설명 글로만 봐요)."}
        </p>
      </section>

      <section className="no-print card grid gap-3 lg:grid-cols-3">
        <h3 className="font-bold lg:col-span-3">① 활동 정보 <span className="text-sm font-normal text-soft">· 비워 두면 AI가 활동지를 보고 판단해요</span></h3>
        <label className="block">
          <span className="text-sm font-bold">활동 주제</span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className="field mt-1" placeholder="예: 내 마음을 색으로 그려요" maxLength={60} />
        </label>
        <label className="block">
          <span className="text-sm font-bold">활동 내용</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="field mt-1" placeholder="예: 오늘 기분을 날씨 그림으로 그리고 까닭을 한 줄로 써요" maxLength={600} />
        </label>
        <label className="block">
          <span className="text-sm font-bold">피드백 기준</span>
          <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={3} className="field mt-1" placeholder="예: 감정 단어를 알맞게 썼는지, 까닭을 함께 말했는지" maxLength={600} />
        </label>
      </section>

      <section className="no-print card space-y-3">
        <h3 className="font-bold">
          ② 스캔한 PDF 올리기{" "}
          <a href="/sample-sheets.pdf" download className="text-sm font-normal text-leaf underline">예시 활동지 PDF 받기(6장)</a>
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="btn-sub cursor-pointer">
            📄 PDF 고르기
            <input type="file" accept=".pdf,application/pdf" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <label className="block">
            <span className="text-sm font-bold">한 학생 쪽 수</span>
            <select value={pagesPer} onChange={(e) => setPagesPer(Number(e.target.value))} disabled={busy} className="field mt-1 min-h-12 w-auto">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}쪽</option>)}
            </select>
          </label>
          <label className="block min-w-0 flex-1">
            <span className="text-sm font-bold">건너뛸 번호 <span className="font-normal text-soft">(전출·결석)</span></span>
            <input value={skipText} onChange={(e) => setSkipText(e.target.value)} disabled={busy} className="field mt-1" placeholder="예: 4, 12" inputMode="numeric" />
          </label>
        </div>
        {reading && <p className="text-sm">{reading}</p>}
        {fileName && pages.length > 0 && (
          <>
            <p className="text-sm">
              <b>{fileName}</b> · {pages.length}쪽 → <b>{groups.length}명</b>
              {skip.length > 0 && <span className="text-soft"> (건너뜀: {skip.join(", ")}번)</span>}
              <span className="text-soft"> · 번호가 맞는지 확인해 주세요</span>
            </p>
            <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {groups.map((g) => (
                <li key={g.no} className="overflow-hidden rounded-xl border border-line bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 이 기기에서 만든 쪽 그림(blob:) */}
                  <img src={thumb(g.pages[0])} alt={`${g.no}번 활동지`} className="aspect-[3/4] w-full object-cover object-top" />
                  <p className="truncate px-2 py-1 text-xs font-bold">
                    {g.no}번 {nameOf(g.no)} <span className="font-normal text-soft">· {g.pages.join("·")}쪽</span>
                  </p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => start()} disabled={busy} className="btn-main">✨ 피드백 만들기 ({groups.length}명)</button>
              {progress && <button onClick={() => (stop.current = true)} className="btn-sub">멈추기</button>}
              {!progress && failed.length > 0 && live && <button onClick={() => start(failed)} className="btn-sub">못 만든 {failed.length}명 다시</button>}
            </div>
          </>
        )}
        {progress && (
          <div aria-live="polite">
            <div className="h-3 overflow-hidden rounded-full bg-paper">
              <div className="h-full bg-leaf transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <p className="mt-1 text-sm">{progress.done}/{progress.total}명 · 한 명에 10~30초쯤 걸려요. 이 화면을 열어 두세요.</p>
          </div>
        )}
        {err && <p className="text-sm text-alert">{err}</p>}
      </section>

      {run && (
        <section id="sheet-run" className="scroll-mt-20 space-y-3">
          <div className="no-print flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl">
              {run.topic || run.items[0]?.topic || "활동지"} <span className="text-base text-soft">· {run.createdAt.slice(0, 10)} · {run.items.length}명</span>
            </h3>
            <button onClick={() => window.print()} disabled={!run.items.length} className="btn-sub ml-auto">🖨️ 학생용 쪽지 인쇄</button>
            <button onClick={() => navigator.clipboard?.writeText(run.items.map((x) => `${x.no}번 ${nameOf(x.no)}\n${x.toStudent}`).join("\n\n"))} disabled={!run.items.length} className="btn-sub">
              📋 전체 복사
            </button>
          </div>
          {Object.entries(fails).map(([no, m]) => (
            <p key={no} className="no-print rounded-xl bg-[#fdecec] px-3 py-2 text-sm">⚠️ {no}번: {m}</p>
          ))}
          {run.items.map((x) => (
            <article key={`${run.id}-${x.no}`} className="no-print card grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
              <div className="space-y-2">
                <p className="font-display text-lg">{x.no}번 {nameOf(x.no)}</p>
                {live && x.pages.map((p) => (
                  <a key={p} href={thumb(p)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 이 기기에서 만든 쪽 그림(blob:) */}
                    <img src={thumb(p)} alt={`${x.no}번 활동지 ${p}쪽`} className="w-full" />
                  </a>
                ))}
                <p className="text-xs text-soft">스캔 {x.pages.join("·")}쪽</p>
              </div>
              <div className="min-w-0 space-y-3">
                {x.check && <p className="rounded-xl bg-[#fdecec] px-3 py-2 text-sm font-bold">🚨 직접 살펴봐 주세요: {x.check}</p>}
                {x.blank && <p className="rounded-xl bg-paper px-3 py-2 text-sm">빈 활동지이거나 읽기 어려워요. 스캔 순서·건너뛸 번호를 확인해 주세요.</p>}
                <p className="text-sm"><b>📖 AI가 읽은 내용</b> <span className="text-soft">({x.topic})</span><br />{x.read}</p>
                {([["잘 드러난 점", x.strengths], ["더 키워 볼 점", x.grow]] as const).map(([title, list]) =>
                  list.length > 0 && (
                    <div key={title}>
                      <p className="text-sm font-bold">{title}</p>
                      <ul className="mt-1 space-y-1.5">
                        {list.map((p, i) => (
                          <li key={i} className="text-sm">
                            <span className={`mr-1 rounded-full px-2 py-0.5 text-xs font-bold ${AREA_COLOR[p.area]}`}>{p.area}</span>
                            {p.point}
                            <span className="block text-xs text-soft">근거: {p.evidence}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )}
                <label className="block">
                  <span className="text-sm font-bold">💬 학생에게 줄 피드백 <span className="font-normal text-soft">· 고치면 저장돼요</span></span>
                  <textarea
                    defaultValue={x.toStudent}
                    onBlur={(e) => e.target.value !== x.toStudent && edit(x.no, e.target.value)}
                    rows={3}
                    className="field mt-1"
                  />
                </label>
                <div className="rounded-xl bg-paper px-3 py-2 text-sm">
                  <b>🧭 이렇게 쓴 이유</b> <span className="text-xs text-soft">(선생님용)</span>
                  <p>{x.why}</p>
                  <p className="mt-1 text-xs text-soft">적용한 기준: {x.criteria}</p>
                </div>
              </div>
            </article>
          ))}
          {/* 인쇄: 학생에게 오려 줄 쪽지만 */}
          <div className="hidden print:block">
            {run.items.filter((x) => x.toStudent).map((x) => (
              <div key={x.no} className="break-inside-avoid border-b border-dashed border-ink py-4 text-lg leading-relaxed">
                <p className="font-bold">{x.no}번 {nameOf(x.no)} · {x.topic}</p>
                <p>{x.toStudent}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {runs.length > 0 && (
        <section className="no-print card">
          <h3 className="mb-2 font-bold">지난 활동지 피드백</h3>
          <ul className="divide-y divide-line">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                <button onClick={() => { setRun(r); setFails({}); setTimeout(() => document.getElementById("sheet-run")?.scrollIntoView({ behavior: "smooth" }), 50); }} className="min-h-11 flex-1 text-left">
                  <b>{r.topic || r.items[0]?.topic || r.file}</b> <span className="text-soft">· {r.createdAt.slice(0, 10)} · {r.items.length}명</span>
                </button>
                <button onClick={() => remove(r)} className="btn-sub min-h-11 px-3 text-xs" aria-label="지우기">지우기</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
