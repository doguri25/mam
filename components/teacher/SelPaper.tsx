"use client";
// 학급 역량 진단 · 서면 검사: 종이 검사지 인쇄(앱 검사지 또는 선생님 양식에 번호·QR 찍기) → 학생이 쓴 검사지를 스캔해 올리면
// 이 기기에서 QR(번호·쪽)과 체크 칸을 읽고, 애매한 칸·손글씨 번호만 AI에 묻는다 → 확인 표에서 고쳐 32문장 답으로 저장.
// 영역 점수(8~40)만 있는 학생은 아래 반 전체 표에 한꺼번에 넣는다. 스캔 그림은 이 기기에서만 다루고 저장하지 않는다.
import { useEffect, useRef, useState } from "react";
import Doodle from "../Doodle";
import type { Overview } from "./types";
import type { SelData } from "./SelCheckTab";
import type { SelRow } from "./SelStudent";
import { useAct } from "./useAct";
import { api } from "@/lib/api";
import { buildEntries, type Entry } from "@/lib/omr";
import { PROVIDERS } from "@/lib/shared";
import { DOMAINS, PER, SELF_ITEMS, SELF_SCALE, cleanPaper, domainScores, levelOf, type SelfRound } from "@/lib/selfcheck";
import { drawSheet, eachPage, fileToCanvases, jpegOf, pdfOf, readScan, stampPage, type Corner } from "./selpaper";

type Who = (no: number, at?: string) => string;
interface Props { round: SelfRound; rows: SelRow[]; data: Overview; who: Who; onData: (d: SelData) => void }

export default function SelPaper(props: Props) {
  return (
    <div className="space-y-4">
      <PrintCard {...props} />
      <ScanCard {...props} />
      <ScoresCard {...props} />
    </div>
  );
}

// ── 1. 검사지 인쇄 ──
function PrintCard({ round, data, who }: Props) {
  const [src, setSrc] = useState<"app" | "mine">("app");
  const [nos, setNos] = useState<"all" | "pick" | "blank">("all");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [blank, setBlank] = useState(data.students.length || 25);
  const [corner, setCorner] = useState<Corner>("tr");
  const [big, setBig] = useState(false);
  const [mine, setMine] = useState<{ name: string; pages: HTMLCanvasElement[]; preview: string } | null>(null);
  const [prog, setProg] = useState("");
  const [out, setOut] = useState<{ url: string; name: string; pages: number } | null>(null);
  const act = useAct();
  useEffect(() => () => { if (out) URL.revokeObjectURL(out.url); }, [out]);
  const list = nos === "all" ? data.students.map((s) => s.no) : nos === "pick" ? [...picked].sort((a, b) => a - b) : Array(Math.max(1, Math.min(60, blank))).fill(0);
  const per = src === "app" ? 2 : mine?.pages.length ?? 0;
  const ready = list.length > 0 && per > 0 && !(src === "mine" && nos === "blank");

  const loadMine = (f: File) => act.run("양식을 읽지 못했어요", async () => {
    const r = await fileToCanvases(f, 2339, 6);
    setMine({ name: f.name, pages: r.pages, preview: r.pages[0].toDataURL("image/jpeg", 0.6) });
    if (nos === "blank") setNos("all");
  });
  const make = () => act.run("PDF를 만들지 못했어요", async () => {
    setOut(null);
    const total = list.length * per;
    const blob = await pdfOf(total, async (i) => {
      const no = list[Math.floor(i / per)], page = (i % per) + 1;
      return src === "app" ? drawSheet(no, page as 1 | 2) : stampPage(mine!.pages[page - 1], no, page, corner, big);
    }, (d) => setProg(`${d}/${total}쪽`));
    setProg("");
    const name = `마음점검_서면검사지_${round.title}${src === "mine" ? "_내양식" : ""}.pdf`.replace(/\s+/g, "");
    setOut({ url: URL.createObjectURL(blob), name, pages: total });
  });

  return (
    <section className="card space-y-3">
      <h3 className="flex items-center gap-2 font-display text-xl"><Doodle name="printer" size={28} /> 1. 검사지 인쇄</h3>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="검사지 양식">
        {([["app", "앱 검사지 (A4 2쪽)", "모서리 표식과 QR이 있어 스캔하면 이 기기가 체크 칸을 바로 읽어요"], ["mine", "내 양식에 번호·QR 찍기", "가진 검사지(PDF·그림)를 올리면 학생마다 번호와 QR을 찍어 줘요. 체크는 AI가 읽어요"]] as const).map(([id, name, sub]) => (
          <button key={id} role="radio" aria-checked={src === id} onClick={() => setSrc(id)} className={`chip p-3 text-left ${src === id ? "chip-on" : ""}`}>
            <b className="block">{name}</b><span className="text-xs">{sub}</span>
          </button>
        ))}
      </div>
      {src === "mine" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line p-3">
          <label className="btn-sub min-h-11 cursor-pointer text-sm">
            <Doodle name="clip" /> 양식 올리기(PDF·그림, 6쪽까지)
            <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadMine(f); e.target.value = ""; }} />
          </label>
          {mine && (
            <span className="flex items-center gap-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- 이 기기에서 만든 그림(data URL) */}
              <img src={mine.preview} alt="올린 양식 첫 쪽" className="h-16 rounded border border-line" /> {mine.name} · {mine.pages.length}쪽
            </span>
          )}
          <label className="text-sm">찍을 자리{" "}
            <select value={corner} onChange={(e) => setCorner(e.target.value as Corner)} className="field ml-1 min-h-10 w-auto py-1">
              <option value="tr">오른쪽 위</option><option value="tl">왼쪽 위</option><option value="br">오른쪽 아래</option><option value="bl">왼쪽 아래</option>
            </select>
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={big} onChange={(e) => setBig(e.target.checked)} className="size-5 accent-leaf" /> 크게</label>
          <p className="w-full text-xs text-soft">양식의 이름 칸은 비워 두도록 안내해 주세요. 내 양식은 체크 칸 자리를 앱이 모르니, 스캔하면 쪽 그림을 AI가 읽어요(이름이 쓰여 있으면 그것도 AI로 가요).</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="번호 찍기">
        {([["all", `반 전체 차례대로 (${data.students.length}명)`], ["pick", "번호 골라서"], ["blank", "번호 없는 빈 검사지"]] as const).map(([id, name]) => (
          <button key={id} role="radio" aria-checked={nos === id} onClick={() => setNos(id)} disabled={id === "blank" && src === "mine"} className={`chip min-h-10 px-3 text-sm font-bold ${nos === id ? "chip-on" : ""}`}>{name}</button>
        ))}
        {nos === "blank" && <label className="text-sm"><input type="number" min={1} max={60} value={blank} onChange={(e) => setBlank(Number(e.target.value))} className="field ml-1 min-h-10 w-20 py-1" /> 장 · 학생이 번호 칸에 손으로 써요(AI가 읽어요)</label>}
      </div>
      {nos === "pick" && (
        <div className="flex flex-wrap gap-1.5">
          {data.students.map((s) => {
            const on = picked.has(s.no);
            return <button key={s.no} aria-pressed={on} onClick={() => setPicked((p) => { const n = new Set(p); if (on) n.delete(s.no); else n.add(s.no); return n; })} className={`min-h-10 rounded-full border px-3 text-sm font-bold ${on ? "border-leaf bg-leaf text-white" : "border-line bg-card"}`}>{who(s.no)}</button>;
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {act.err && <span role="alert" className="text-sm text-alert">{act.err}</span>}
        {prog && <span role="status" className="text-sm text-soft">만드는 중 {prog}</span>}
        {out && <a href={out.url} download={out.name} className="btn-sub min-h-11 text-sm"><Doodle name="download" /> {out.name} ({out.pages}쪽) 받기</a>}
        <button onClick={make} disabled={act.busy || !ready || (src === "mine" && !mine)} className="btn-main min-h-11 text-sm">{list.length}명 × {per || "?"}쪽 PDF 만들기</button>
      </div>
      <p className="text-xs text-soft">인쇄할 때는 「실제 크기(100%)」로, 스캔은 흑백·200dpi 정도면 충분해요. 네 모서리의 검은 네모와 QR이 접히거나 가리지 않게 해 주세요.</p>
    </section>
  );
}

// ── 2. 스캔본 읽기 ──
interface Sheet extends Entry { thumbs: string[]; blobs: Blob[]; ai: boolean[]; noFrom: "qr" | "ai" | "teacher" | null; save: boolean; aiNote?: string }
function ScanCard({ round, rows, data, who, onData }: Props) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [prog, setProg] = useState("");
  const [msg, setMsg] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const reading = useAct(), asking = useAct(), saving = useAct();
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const provider = PROVIDERS[data.settings.provider]?.label ?? "AI";
  const online = new Set(rows.filter((r) => r.answer && r.answer.src !== "paper").map((r) => r.st.no));
  const roster = data.students.map((s) => s.no);

  const read = (f: File) => reading.run("스캔본을 읽지 못했어요", async () => {
    setSheets(null); setMsg("");
    urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = [];
    const infos: Parameters<typeof buildEntries>[0] = [];
    const blobs: Blob[] = [];
    const r = await eachPage(f, 1700, 120, async (c, i, total) => {
      setProg(`${i}/${total}쪽 읽는 중`);
      const p = readScan(i, c);
      infos.push({ kind: p.kind, no: p.no, page: p.page, marks: p.marks });
      blobs.push(await jpegOf(p.canvas, 1600, 0.78));
      p.canvas.width = p.canvas.height = 0;
      c.width = c.height = 0;
      await new Promise((ok) => setTimeout(ok, 0)); // 화면이 멈추지 않게
    }).finally(() => setProg(""));
    const list: Sheet[] = buildEntries(infos).map((e) => {
      const thumbs = e.pages.map((i) => { const u = URL.createObjectURL(blobs[i]); urls.current.push(u); return u; });
      const no = e.no && roster.includes(e.no) ? e.no : null;
      return { ...e, no, thumbs, blobs: e.pages.map((i) => blobs[i]), ai: Array(32).fill(false), noFrom: no ? "qr" : null, save: false };
    });
    setSheets(list.map((s) => ({ ...s, save: complete(s) })));
    setMsg(`${r.total}쪽에서 ${list.length}장(사람)을 찾았어요.${r.cut ? " 120쪽까지만 읽었어요." : ""}`);
  });
  const complete = (s: Sheet) => !!s.no && s.answers.every((v) => v != null);
  const update = (key: string, f: (s: Sheet) => Sheet) => setSheets((all) => all && all.map((s) => (s.key === key ? (() => { const n = f(s); return { ...n, save: n.save && complete(n) }; })() : s)));
  const needAi = (s: Sheet) => (s.kind === "F" ? s.answers.some((v, i) => v == null || s.unsure[i]) : s.unsure.some((u, i) => u && !s.ai[i])) || !s.no;

  // 애매한 칸·번호만 AI에(학생 한 명씩 차례로)
  const askAi = () => asking.run("AI가 읽지 못했어요", async () => {
    const todo = (sheets ?? []).filter((s) => s.kind !== "?" && needAi(s));
    let n = 0;
    try {
      for (const s of todo) {
        setProg(`AI가 읽는 중 ${++n}/${todo.length}`);
        const items = s.answers.flatMap((v, i) => ((s.kind === "F" ? v == null || s.unsure[i] : s.unsure[i] && !s.ai[i]) ? [i + 1] : []));
        const form = new FormData();
        form.append("meta", JSON.stringify({ items, number: !s.no }));
        s.blobs.slice(0, 4).forEach((b, i) => form.append("page", b, `p${i + 1}.jpg`));
        const res = await fetch("/api/teacher/selscan", { method: "POST", body: form });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error ?? "AI가 읽지 못했어요.");
        update(s.key, (cur) => {
          const answers = [...cur.answers], unsure = [...cur.unsure], ai = [...cur.ai];
          for (const i of items) {
            const v = out.answers?.[i];
            if (v) { answers[i - 1] = v; unsure[i - 1] = false; ai[i - 1] = true; }
          }
          const no = cur.no ?? (out.no && roster.includes(out.no) ? out.no : null);
          return { ...cur, answers, unsure, ai, no, noFrom: cur.no ? cur.noFrom : no ? "ai" : null, save: true, aiNote: out.viaText ? "업스테이지는 검사지를 글로 바꿔 읽어서 표시를 놓칠 수 있어요" : undefined };
        });
      }
    } finally {
      setProg(""); // 실패해도 「읽는 중」이 남지 않게
    }
  });
  const save = () => saving.run("저장하지 못했어요", async () => {
    const items = (sheets ?? []).filter((s) => s.save && complete(s) && !dupes.has(s.no!)).map((s) => ({ no: s.no, answers: s.answers }));
    const r = await api<SelData & { saved: number[]; kept: number[] }>("teacher", "selPaperSave", { round: round.id, items, overwrite });
    onData(r);
    setMsg(`${r.saved.length}명을 「${round.title}」에 저장했어요.${r.kept.length ? ` ${r.kept.join(", ")}번은 화면에서 이미 답해서 그대로 뒀어요(덮어쓰려면 아래를 켜 주세요).` : ""}`);
    setSheets((all) => all && all.map((s) => (r.saved.includes(s.no ?? -1) ? { ...s, save: false, aiNote: "저장했어요" } : s)));
  });

  const count = new Map<number, number>();
  for (const s of sheets ?? []) if (s.no) count.set(s.no, (count.get(s.no) ?? 0) + 1);
  const dupes = new Set([...count].filter(([, n]) => n > 1).map(([no]) => no));
  const waiting = (sheets ?? []).filter((s) => s.kind !== "?" && needAi(s)).length;
  const toSave = (sheets ?? []).filter((s) => s.save && complete(s) && !dupes.has(s.no!)).length;

  return (
    <section className="card space-y-3">
      <h3 className="flex items-center gap-2 font-display text-xl"><Doodle name="magnifier" size={28} /> 2. 스캔본 올려 「{round.title}」에 기록</h3>
      <p className="text-sm text-soft">
        학생들이 쓴 검사지를 한 번에 스캔한 PDF(또는 사진)를 올리면, 이 기기가 QR로 번호·쪽을 알아보고 체크 칸을 읽어요. 애매한 칸과 손글씨 번호만 {provider}에 물어요.
        스캔 그림은 저장하지 않아요.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`btn-main min-h-11 cursor-pointer text-sm ${reading.busy ? "pointer-events-none opacity-60" : ""}`}>
          <Doodle name="clip" /> 스캔본 올리기
          <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
        </label>
        {prog && <span role="status" className="text-sm text-soft">{prog}</span>}
        {msg && <span role="status" className="text-sm">{msg}</span>}
        {(reading.err || asking.err || saving.err) && <span role="alert" className="text-sm text-alert">{reading.err || asking.err || saving.err}</span>}
      </div>
      {sheets && sheets.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#f1eee7] p-3 text-sm">
            <span>확인할 것: <b>{waiting}장</b>(애매한 칸·번호)</span>
            <button onClick={askAi} disabled={asking.busy || !waiting} className="btn-sub min-h-10 text-sm"><Doodle name="sparkle" /> 애매한 칸 {provider}로 읽기</button>
            <label className="ml-auto flex min-h-10 items-center gap-2"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="size-5 accent-leaf" /> 화면에서 이미 답한 학생도 종이 답으로 바꾸기</label>
            <button onClick={save} disabled={saving.busy || !toSave} className="btn-main min-h-10 text-sm">{toSave}명 저장</button>
          </div>
          <p className="text-xs text-soft">
            <span className="rounded bg-[#fdebc8] px-1">주황 칸</span>은 기기가 확신하지 못한 칸, <span className="rounded bg-[#dfe9f7] px-1">파란 칸</span>은 AI가 읽은 칸이에요. 쪽 그림을 눌러 크게 보고, 칸을 눌러 고칠 수 있어요.
          </p>
          <div className="space-y-3">
            {sheets.map((s) => (
              <SheetRow key={s.key} s={s} roster={data.students.map((x) => x.no)} who={who} dup={!!s.no && dupes.has(s.no)} online={!!s.no && online.has(s.no)}
                onZoom={setZoom} onChange={(f) => update(s.key, f)} onDrop={() => setSheets((all) => all && all.filter((x) => x.key !== s.key))} />
            ))}
          </div>
        </>
      )}
      {zoom && (
        <div role="dialog" aria-modal aria-label="스캔한 쪽 크게 보기" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="스캔한 쪽" className="max-h-full max-w-full rounded-xl bg-white" />
        </div>
      )}
    </section>
  );
}

function SheetRow({ s, roster, who, dup, online, onZoom, onChange, onDrop }: {
  s: Sheet; roster: number[]; who: Who; dup: boolean; online: boolean; onZoom: (u: string) => void; onChange: (f: (s: Sheet) => Sheet) => void; onDrop: () => void;
}) {
  const scores = s.answers.every((v) => v != null) ? domainScores(s.answers as number[]) : null;
  const left = s.answers.filter((v, i) => v == null || (s.unsure[i] && !s.ai[i])).length;
  const tag = s.kind === "F" ? "내 양식" : s.kind === "?" ? "읽지 못한 쪽" : s.noFrom === "qr" ? "QR로 번호 읽음" : "빈 검사지";
  return (
    <div className={`rounded-2xl border p-3 ${dup ? "border-alert" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {s.thumbs.map((u, i) => (
            <button key={i} onClick={() => onZoom(u)} className="overflow-hidden rounded border border-line" aria-label={`${i + 1}쪽 크게 보기`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-20 w-14 object-cover" />
            </button>
          ))}
        </div>
        <label className="text-sm font-bold">번호{" "}
          <select value={s.no ?? ""} onChange={(e) => onChange((x) => ({ ...x, no: e.target.value ? Number(e.target.value) : null, noFrom: "teacher", save: true }))} className={`field ml-1 min-h-10 w-auto py-1 ${!s.no || dup ? "border-alert" : ""}`}>
            <option value="">골라 주세요</option>
            {roster.map((n) => <option key={n} value={n}>{who(n)}</option>)}
          </select>
        </label>
        <span className="rounded-full bg-[#f1eee7] px-2 py-0.5 text-xs">{tag}{s.noFrom === "ai" ? " · 번호는 AI가 읽음" : ""}</span>
        {dup && <span className="text-xs font-bold text-alert">같은 번호가 또 있어요</span>}
        {online && <span className="text-xs text-soft">화면에서 이미 답한 학생</span>}
        {left > 0 ? <span className="text-xs font-bold text-[#a35a00]">확인할 칸 {left}</span> : <span className="text-xs font-bold text-[#1d7144]">모두 읽음</span>}
        {s.aiNote && <span className="text-xs text-soft">{s.aiNote}</span>}
        <span className="ml-auto flex items-center gap-2">
          <label className="flex min-h-10 items-center gap-1.5 text-sm"><input type="checkbox" checked={s.save} disabled={!s.no || s.answers.some((v) => v == null)} onChange={(e) => onChange((x) => ({ ...x, save: e.target.checked }))} className="size-5 accent-leaf" /> 저장</label>
          <button onClick={onDrop} className="btn-sub min-h-10 px-3 text-xs">빼기</button>
        </span>
      </div>
      {s.kind !== "?" && (
        <div className="mt-2 grid gap-x-6 gap-y-2 lg:grid-cols-2">
          {DOMAINS.map((dom, d) => (
            <div key={dom.key}>
              <p className="mb-1 flex items-center gap-2 text-xs font-bold" style={{ color: dom.color }}>
                {dom.name} <span className="font-normal text-soft">{d * PER + 1}~{d * PER + PER}번</span>
                {scores && <span className="rounded-full px-2 py-0.5" style={{ color: levelOf(scores[d]).color, background: levelOf(scores[d]).bg }}>{scores[d]}점</span>}
              </p>
              <div className="grid grid-cols-8 gap-1">
                {Array.from({ length: PER }, (_, k) => {
                  const i = d * PER + k, v = s.answers[i];
                  const warn = v == null || (s.unsure[i] && !s.ai[i]);
                  return (
                    <select key={i} value={v ?? ""} title={`${i + 1}. ${SELF_ITEMS[i].ko}`} aria-label={`${i + 1}번 문장`}
                      onChange={(e) => onChange((x) => { const answers = [...x.answers], unsure = [...x.unsure]; answers[i] = e.target.value ? Number(e.target.value) : null; unsure[i] = false; return { ...x, answers, unsure, save: true }; })}
                      className={`h-10 w-full min-w-0 rounded-lg border px-0.5 text-center text-sm font-bold ${warn ? "border-[#e0a54a] bg-[#fdebc8]" : s.ai[i] ? "border-[#9db8e0] bg-[#dfe9f7]" : "border-line bg-card"}`}>
                      <option value="">?</option>
                      {SELF_SCALE.map((l, n) => <option key={n} value={n + 1}>{n + 1} {l.ko}</option>)}
                    </select>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 3. 영역 점수로 넣기(반 전체 한 표) ──
function ScoresCard({ round, rows, who, onData }: Props) {
  const init = () => Object.fromEntries(rows.map((r) => [r.st.no, (r.note?.paper ?? []).map(String).concat(["", "", "", ""]).slice(0, 4)]));
  const [vals, setVals] = useState<Record<number, string[]>>(init);
  const [msg, setMsg] = useState("");
  const s = useAct();
  const key = rows.map((r) => `${r.st.no}:${r.note?.paper?.join(",") ?? ""}`).join("|");
  const [seen, setSeen] = useState(key); // 저장하거나 다른 기기에서 바뀌면 표를 새 값으로
  if (seen !== key) { setSeen(key); setVals(init()); }
  const changed = rows.filter((r) => (r.note?.paper ?? []).join(",") !== (vals[r.st.no] ?? []).filter(Boolean).join(","));
  const bad = changed.filter((r) => { const v = vals[r.st.no]; return v.some(Boolean) && !cleanPaper(v.map(Number)); });
  const save = () => s.run("저장하지 못했어요", async () => {
    const items = changed.map((r) => { const v = vals[r.st.no]; return { no: r.st.no, paper: v.some(Boolean) ? v.map(Number) : null }; });
    const out = await api<SelData>("teacher", "selPaperScores", { round: round.id, items });
    onData(out);
    setMsg(`${items.length}명 저장했어요.`);
  });
  return (
    <details className="card">
      <summary className="min-h-10 cursor-pointer font-display text-xl"><Doodle name="bars" /> 3. 영역 점수로 넣기 <span className="text-sm text-soft">(종이 검사 합계만 있을 때 · 반 전체 한 표)</span></summary>
      <p className="mt-2 text-sm text-soft">영역마다 8문장 점수(1~5)를 더한 값(8~40)을 넣어요. 학생이 화면에서 답했거나 스캔으로 32문장 답을 저장한 학생은 그 답을 먼저 써요.</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-soft"><th className="py-1.5 font-normal">학생</th>{DOMAINS.map((d) => <th key={d.key} className="px-1 font-normal" style={{ color: d.color }}>{d.name}</th>)}<th className="px-1 font-normal">비고</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.st.no} className="border-b border-line/60">
                <td className="whitespace-nowrap py-1 pr-2 font-bold">{who(r.st.no, r.answer?.at)}</td>
                {DOMAINS.map((d, i) => (
                  <td key={d.key} className="px-1">
                    <input inputMode="numeric" aria-label={`${r.st.no}번 ${d.name}`} value={vals[r.st.no]?.[i] ?? ""} placeholder="8~40"
                      onChange={(e) => setVals((v) => ({ ...v, [r.st.no]: (v[r.st.no] ?? ["", "", "", ""]).map((x, k) => (k === i ? e.target.value.replace(/\D/g, "").slice(0, 2) : x)) }))}
                      className={`field min-h-10 w-20 py-1 ${bad.includes(r) ? "border-alert" : ""}`} />
                  </td>
                ))}
                <td className="px-1 text-xs text-soft">{r.answer ? (r.answer.src === "paper" ? "종이 32문장 답 있음" : "화면에서 답함") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {msg && <span role="status" className="text-sm text-[#1d7144]">{msg}</span>}
        {s.err && <span role="alert" className="text-sm text-alert">{s.err}</span>}
        {bad.length > 0 && <span className="text-sm text-alert">{bad.map((r) => r.st.no).join(", ")}번: 네 칸 모두 8~40으로 넣어 주세요</span>}
        <button onClick={save} disabled={s.busy || !changed.length || bad.length > 0} className="btn-main min-h-10 text-sm">{changed.length}명 저장</button>
      </div>
    </details>
  );
}
