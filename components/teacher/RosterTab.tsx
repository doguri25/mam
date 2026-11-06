"use client";
// 학생 명단과 고유 코드·QR 카드. QR은 이 주소(/join?c=코드)를 담는다.
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import Doodle from "../Doodle";
import ConsentLetter from "./ConsentLetter";
import type { Overview, Reload } from "./types";
import { useAct } from "./useAct";
import { api } from "@/lib/api";
import { useNames } from "@/lib/local";
import type { Student } from "@/lib/shared";

const rosterText = (xs: Pick<Student, "no" | "alias">[]) => xs.map((s) => `${s.no} ${s.alias}`).join("\n");

export default function RosterTab({ data, reload }: { data: Overview; reload: Reload }) {
  const serverText = rosterText(data.students);
  const [text, setText] = useState(serverText);
  // 명단 칸은 서버 명단이 바뀌면 다시 맞춘다(위 띠의 「연습 데이터 지우기」·다른 기기에서 고친 명단): 예전 명단이 칸에 남아
  // 그대로 「명단 저장」하면 지운 연습 학생이 실제 학생으로 다시 들어갔다.
  // base: 칸을 마지막으로 맞춘 서버 명단 · mine: 이 칸에서 방금 저장한 명단(읽지 못한 줄을 고치라고 칸에 남겨 둔 때)
  // · changed: 선생님이 칸을 고치던 사이 서버 명단이 바뀜(고친 글은 두고 알린다)
  const [base, setBase] = useState(serverText);
  const [mine, setMine] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  if (base !== serverText) {
    setBase(serverText);
    setMine(null);
    if (text === base || text === serverText) {
      setText(serverText);
      setChanged(false);
    } else setChanged(serverText !== mine);
  }
  const [msg, setMsg] = useState("");
  const [skipped, setSkipped] = useState<string[]>([]); // 명단 저장 때 읽지 못한 줄
  const names = useNames(data.space);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [letter, setLetter] = useState(false); // 보호자 안내문을 보고 인쇄할 때는 QR 카드를 인쇄에서 뺀다
  const [busy, setBusy] = useState(false);
  const saving = useAct(); // 명단 저장
  const renewing = useAct(); // 새 코드(실패하면 QR 카드 위에 까닭을)
  const origin = window.location.origin; // 이 탭은 로그인 뒤 브라우저에서만 그려진다

  useEffect(() => {
    Promise.all(data.students.map(async (s) => [s.code, await QRCode.toDataURL(`${origin}/join?c=${s.code}`, { margin: 1, width: 220 })] as const))
      .then((pairs) => setQr(Object.fromEntries(pairs)));
  }, [data.students, origin]);

  const saveRoster = () => saving.run("", async () => {
    setSkipped([]);
    try {
      // skipped: 서버가 읽지 못한 줄(번호가 겹침·모양이 다름·가명이 너무 김). 예전 서버는 보내지 않는다.
      const r = await api<{ students: Student[]; skipped?: unknown }>("teacher", "roster", { text });
      const bad = Array.isArray(r.skipped) ? r.skipped.map(String) : [];
      setSkipped(bad);
      setMsg(`${r.students.length}명을 저장했어요. 같은 번호는 원래 코드를 그대로 써요.`);
      setChanged(false);
      // 저장한 명단으로 칸을 맞춘다. 읽지 못한 줄이 있으면 고치라고 칸은 그대로 둔다(이 저장으로 바뀐 서버 명단을 「바뀌었어요」로 알리지 않게)
      const saved = Array.isArray(r.students) ? rosterText(r.students) : null;
      if (saved !== null && !bad.length) setText(saved);
      setMine(saved);
      await reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  });

  const renew = (no: number) => renewing.run(`${no}번 코드를 새로 만들지 못했어요`, async () => {
    await api("teacher", "newCode", { no });
    await reload();
  }, `${no}번의 코드를 새로 만들까요? 예전 코드와 QR은 더 이상 쓸 수 없어요.`);

  // 보호자 동의서 받음 표시(기록을 막지는 않음)
  async function consent(nos: number[], on: boolean) {
    setBusy(true);
    try {
      await api("teacher", "consent", { nos, on });
      await reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }
  const notYet = data.students.filter((s) => !s.consent);

  const local = /localhost|127\.0\.0\.1/.test(origin);

  return (
    <div className="space-y-5">
      <section className="no-print card space-y-3">
        <h2 className="font-display text-xl">반 명단</h2>
        <p className="text-sm text-soft">한 줄에 한 명, 「번호 가명」으로 적어요. 실명 대신 가명이나 별명을 권해요(AI에는 가명만 가요).</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="field font-mono text-sm" placeholder={"1 햇살\n2 구름\n3 단풍"} />
        {changed && text !== serverText && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#fff8e1] px-3 py-2 text-sm">
            <span>칸을 고치는 사이 저장된 명단이 바뀌었어요(연습 데이터 지우기·다른 기기). 칸에 쓰던 글은 그대로 두었어요.</span>
            <button onClick={() => { setText(serverText); setChanged(false); }} className="btn-sub min-h-9 px-3 text-sm">지금 명단으로 바꾸기</button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{msg}</span>
          <button onClick={saveRoster} disabled={saving.busy} className="btn-main">{saving.busy ? "저장하는 중…" : "명단 저장"}</button>
        </div>
        {skipped.length > 0 && (
          <div role="alert" className="space-y-1 rounded-2xl border border-alert/40 bg-alert-soft p-3 text-sm">
            <p className="font-bold text-alert"><Doodle name="warning" /> 읽지 못한 줄 {skipped.length}개 · 명단에 넣지 않았어요</p>
            <ul className="space-y-0.5 font-mono">
              {skipped.slice(0, 10).map((line, i) => <li key={i}>· {line.trim() || "(빈 줄)"}</li>)}
              {skipped.length > 10 && <li className="font-sans text-soft">· 그 밖에 {skipped.length - 10}줄</li>}
            </ul>
            <p className="text-xs text-soft">번호가 겹치거나, 「번호 가명」 모양이 아니거나, 가명이 너무 길면 읽지 못해요. 고친 뒤 다시 저장해 주세요.</p>
          </div>
        )}
      </section>

      <section className="no-print card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">실명 보기 (이 컴퓨터에만)</h2>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={names.on} onChange={(e) => names.setOn(e.target.checked)} disabled={!names.raw.trim()} className="size-4 accent-leaf" />
            선생님 화면을 실명으로 보기
          </label>
        </div>
        <p className="text-sm text-soft">
          「번호 이름」을 붙여 넣으면 이 브라우저에만 저장돼요. 서버·AI로는 보내지 않고, 다른 컴퓨터에서는 다시 넣어야 해요. 학생 화면은 늘 가명이에요.
        </p>
        <textarea value={names.raw} onChange={(e) => names.setRaw(e.target.value)} rows={4} className="field font-mono text-sm" placeholder={"1 김하늘\n2 이도윤"} />
        {names.raw && <button onClick={() => confirm("이 컴퓨터의 실명 명렬표를 지울까요?") && names.setRaw("")} className="text-xs text-soft underline">이 컴퓨터에서 실명 지우기</button>}
      </section>

      {data.students.length > 0 && (
        <section className="no-print card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl">보호자 동의서</h2>
            <button onClick={() => setLetter(!letter)} aria-expanded={letter} className="btn-sub min-h-10 text-sm"><Doodle name="page" /> {letter ? "안내문 닫기" : "보호자 안내문·동의서 보기"}</button>
          </div>
          <p className="text-sm">
            받음 <b>{data.students.length - notYet.length}/{data.students.length}</b>
            {notYet.length > 0 && <span className="text-soft"> · 아직: {notYet.map((s) => s.no).join(", ")}번</span>}
          </p>
          <p className="text-xs text-soft">동의서를 받은 학생을 눌러 표시해요. 표시만 하고 기록을 막지는 않아요. 동의하지 않은 학생은 코드를 나눠 주지 말고 종이 활동으로 함께해 주세요.</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="보호자 동의서 받음">
            {data.students.map((s) => (
              <button key={s.no} onClick={() => consent([s.no], !s.consent)} disabled={busy} aria-pressed={!!s.consent} title={s.consent ? `${s.consent} 받음` : "아직"}
                className={`chip min-h-10 px-3 text-sm ${s.consent ? "border-leaf bg-leaf-soft font-bold text-leaf" : ""}`}>
                {s.consent ? "✓ " : ""}{s.no} {names.name(s.no, s.alias)}
              </button>
            ))}
          </div>
          {notYet.length > 0 && <button onClick={() => consent(notYet.map((s) => s.no), true)} disabled={busy} className="text-xs text-soft underline underline-offset-2">모두 받음으로 표시</button>}
        </section>
      )}

      {letter && (
        <section className="space-y-3">
          <div className="no-print flex justify-end">
            <button onClick={() => window.print()} className="btn-main"><Doodle name="printer" /> 안내문 인쇄</button>
          </div>
          <ConsentLetter className={data.settings.className} retention={data.settings.retention} origin={origin} />
        </section>
      )}

      {data.students.length > 0 && (
        <section className={letter ? "print:hidden" : undefined}>
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl">코드·QR 카드</h2>
              <p className="text-xs text-soft">QR 주소: {origin}/join?c=…</p>
              {renewing.err && <p role="alert" className="text-sm text-alert">{renewing.err}</p>}
              {local && (
                <p className="text-xs text-alert">
                  지금 주소가 localhost라 태블릿에서는 열리지 않아요. 같은 와이파이의 이 컴퓨터 IP 주소(예: http://192.168.0.10:3000)로 선생님 화면을 열고 인쇄하세요.
                </p>
              )}
            </div>
            <button onClick={() => window.print()} className="btn-sub"><Doodle name="printer" /> QR 카드 인쇄</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 print:grid-cols-4">
            {data.students.map((s) => (
              <div key={s.no} className="card flex flex-col items-center gap-1 p-3 text-center">
                <p className="text-sm">{s.no}번 <b>{names.name(s.no, s.alias)}</b></p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR이라 이미지 최적화가 필요 없다 */}
                {qr[s.code] ? <img src={qr[s.code]} alt={`${s.no}번 QR`} className="size-28" /> : <div className="size-28" />}
                <p className="font-mono text-lg tracking-widest">{s.code}</p>
                <button onClick={() => renew(s.no)} disabled={renewing.busy} className="no-print text-xs text-soft underline underline-offset-4">새 코드</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
