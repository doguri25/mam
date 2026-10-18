"use client";
// 설정: 쓸 AI 고르기 · 4가지 API 키(서버에 암호화 저장, 화면엔 가려서) · 반 감정 단어 · 위험 단어 · 시연 데이터
import { useState } from "react";
import PushCard from "./PushCard";
import type { Overview, Reload } from "./types";
import { api } from "@/lib/api";
import { PROVIDERS, PROVIDER_IDS, type MoodRecord, type Provider, type Rules, type VoiceMode } from "@/lib/shared";

const LINKS: Record<Provider, string> = {
  upstage: "https://console.upstage.ai/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/apikey",
};

export default function SettingsTab({ data, reload }: { data: Overview; reload: Reload }) {
  const s = data.settings;
  const [provider, setProvider] = useState<Provider>(s.provider);
  const [className, setClassName] = useState(s.className);
  const [models, setModels] = useState(s.models);
  const [keys, setKeys] = useState<Partial<Record<Provider, string>>>({});
  const [vocab, setVocab] = useState(s.vocab.join(", "));
  const [risk, setRisk] = useState(s.riskWords.join(", "));
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(s.voiceMode);
  const [rules, setRules] = useState<Rules>(s.rules);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const say = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }));
  const split = (t: string) => t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

  async function save(extraKeys: Partial<Record<Provider, string>> = keys) {
    try {
      await api("teacher", "settings", { provider, className, models, keys: extraKeys, vocab: split(vocab), riskWords: split(risk), voiceMode, rules });
      setKeys({});
      say("save", "저장했어요.");
      await reload();
    } catch (e) {
      say("save", (e as Error).message);
    }
  }

  async function exportCsv() {
    const { records, students } = await api<{ records: MoodRecord[]; students: { no: number; alias: string }[] }>("teacher", "export");
    const alias = (no: number) => students.find((x) => x.no === no)?.alias ?? "";
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["날짜", "시점", "번호", "가명", "방법", "감정", "세기", "까닭", "한 줄", "되묻기", "답", "말투", "위험 표현", "살펴본 시각"];
    const rows = records
      .sort((a, b) => a.date.localeCompare(b.date) || a.no - b.no || a.slot.localeCompare(b.slot))
      .map((r) => [r.date, r.slot === "am" ? "아침" : "하교 전", r.no, alias(r.no), r.method === "voice" ? "말하기" : "카드", r.emotion, r.intensity, r.reason, r.summary, r.question, r.answer, r.tone ?? "", r.risk ? r.riskHits.join(" ") || "AI 판단" : "", r.riskChecked ?? ""]);
    const csv = "﻿" + [head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n"); // 엑셀 한글이 깨지지 않게 BOM
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `마음빛-기록-${data.today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    say("export", `${records.length}건을 내보냈어요.`);
  }

  async function test(p: Provider) {
    say(p, "확인하는 중…");
    try {
      if (keys[p]) await save({ [p]: keys[p] });
      const r = await api<{ model: string }>("teacher", "testAI", { provider: p });
      say(p, `✓ 연결됐어요 (${r.model})`);
    } catch (e) {
      say(p, (e as Error).message);
    }
  }

  async function demo(mode: "seed" | "clear" | "clearDemo") {
    const ask = {
      seed: "지금 기록과 명단을 모두 지우고 연습용 가짜 학생 25명 + 7일 기록을 만들까요? 실제 반 기록이 있다면 함께 지워져요.",
      clear: "모든 기록·응원·메모·명단을 지울까요? 되돌릴 수 없어요.",
      clearDemo: "연습용(시연) 기록만 지울까요? 실제로 남긴 기록은 그대로예요.",
    }[mode];
    if (!confirm(ask)) return;
    await api("teacher", "demo", { mode });
    say("demo", { seed: "연습 데이터를 만들었어요. 「마음 지도」를 보세요.", clear: "모두 지웠어요.", clearDemo: "연습 데이터를 지웠어요." }[mode]);
    await reload();
  }

  return (
    <div className="space-y-5">
      <PushCard data={data} reload={reload} />
      <section className="card space-y-4">
        <div>
          <h2 className="font-display text-xl">AI 연결</h2>
          <p className="text-sm text-soft">
            쓸 AI를 하나 고르고 키를 넣어요. 키는 서버에 암호화해 저장되고 화면에는 가려서만 보여요. 키가 없으면 카드 기록은 기본 질문으로, 말하기는 카드 고르기로 이어져요.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {PROVIDER_IDS.map((p) => (
            <div key={p} className={`rounded-2xl border-2 p-4 ${provider === p ? "border-leaf bg-leaf-soft/40" : "border-line"}`}>
              <label className="flex items-center gap-2 font-bold">
                <input type="radio" name="provider" checked={provider === p} onChange={() => setProvider(p)} className="size-4 accent-leaf" />
                {PROVIDERS[p].label}
                <span className="ml-auto text-xs font-normal text-soft">{s.keys[p] ? `저장됨 ${s.keys[p]}` : "키 없음"}</span>
              </label>
              <label className="mt-3 block text-xs text-soft">
                API 키 ({PROVIDERS[p].keyHint}) · <a href={LINKS[p]} target="_blank" rel="noreferrer" className="underline">발급받기</a>
                <input
                  type="password"
                  autoComplete="off"
                  value={keys[p] ?? ""}
                  onChange={(e) => setKeys({ ...keys, [p]: e.target.value })}
                  className="field mt-1 py-2 text-sm"
                  placeholder={s.keys[p] ? "바꿀 때만 새로 넣어요" : "키 붙여 넣기"}
                />
              </label>
              <label className="mt-2 block text-xs text-soft">
                모델 이름
                <input value={models[p]} onChange={(e) => setModels({ ...models, [p]: e.target.value })} className="field mt-1 py-2 font-mono text-sm" />
              </label>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => test(p)} disabled={!s.keys[p] && !keys[p]} className="btn-sub min-h-9 px-3 text-sm">연결 확인</button>
                {s.keys[p] && (
                  <button onClick={() => confirm("이 키를 지울까요?") && save({ [p]: "" })} className="text-xs text-soft underline">키 지우기</button>
                )}
                <span className="text-xs">{msg[p]}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="font-bold">반 이름</span>
          <input value={className} onChange={(e) => setClassName(e.target.value)} className="field mt-1" />
        </label>
        <label className="block">
          <span className="font-bold">우리 반에서 배운 감정 단어</span>
          <span className="block text-xs text-soft">쉼표로 나눠요. 학생 도움판과 되묻기·응원 초안에 쓰여요.</span>
          <input value={vocab} onChange={(e) => setVocab(e.target.value)} className="field mt-1" />
        </label>
        <label className="block md:col-span-2">
          <span className="font-bold">위험 표현 단어</span>
          <span className="block text-xs text-soft">학생 말에 이 글자가 들어 있으면 선생님 화면에만 빨간 알림이 떠요. AI 판단과 함께 두 겹으로 살펴요.</span>
          <textarea value={risk} onChange={(e) => setRisk(e.target.value)} rows={2} className="field mt-1 text-sm" />
        </label>
        <div className="flex items-center justify-end gap-3 md:col-span-2">
          <span className="text-sm">{msg.save}</span>
          <button onClick={() => save()} className="btn-main">설정 저장</button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-xl">🎙 말투(목소리 기운) 살피기</h2>
        <p className="text-sm text-soft">말하기로 남긴 기록에 「들떠 있음·차분함·가라앉음」 같은 목소리 기운을 더해요. 선생님 화면에만 보이고, 감정을 단정하는 데 쓰지 않아요.</p>
        <div className="grid gap-2 md:grid-cols-3">
          {([
            ["off", "끄기", "말의 내용으로만 감정을 정리해요."],
            ["device", "기기 안에서 재기 (권장)", `태블릿이 소리 크기·높낮이·빠르기만 숫자로 재서, 그 아이의 평소 목소리와 비교해요. 소리는 밖으로 나가지 않고, 숫자는 지금 고른 AI(${PROVIDERS[provider].label})가 감정을 정리할 때 함께 참고해요.`],
            ["gemini", "Gemini가 직접 듣기", "말한 소리를 Gemini에 보내 말투까지 판단해요(저장하지 않음). Gemini 키가 필요하고, 아이 목소리가 외부 AI로 가므로 보호자 동의서에 꼭 적어 주세요. 실패하면 기기 재기로 넘어가요."],
          ] as [VoiceMode, string, string][]).map(([v, title, desc]) => (
            <label key={v} className={`cursor-pointer rounded-2xl border-2 p-3 ${voiceMode === v ? "border-leaf bg-leaf-soft/40" : "border-line"}`}>
              <span className="flex items-center gap-2 font-bold">
                <input type="radio" name="voiceMode" checked={voiceMode === v} onChange={() => setVoiceMode(v)} className="size-4 accent-leaf" />
                {title}
              </span>
              <span className="mt-1 block text-xs text-soft">{desc}</span>
            </label>
          ))}
        </div>
        {voiceMode === "gemini" && !s.keys.gemini && <p className="text-sm text-alert">Gemini 키가 없어요. 위 「AI 연결」에서 Gemini 키를 넣어 주세요(쓸 AI로 고르지 않아도 돼요).</p>}
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm">{msg.save}</span>
          <button onClick={() => save()} className="btn-main">설정 저장</button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-xl">먼저 살펴볼 학생 규칙</h2>
        <p className="text-sm text-soft">최근 7일 기록으로 계산해요. 숫자가 작을수록 신호가 많아져요.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["streakDays", "힘든 마음이 기록한 날 몇 번 이어지면", 7],
            ["dropDays", "아침보다 하교 전 크게 가라앉은 날이 몇 번이면", 7],
            ["reasonTimes", "같은 까닭으로 힘든 마음이 몇 번이면", 14],
            ["absentDays", "반 기록이 있던 최근 며칠 동안 기록이 없으면 「기록 없음」", 10],
          ] as [keyof Rules, string, number][]).map(([k, text, max]) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3 text-sm">
              {text}
              <input type="number" min={1} max={max} value={rules[k]} onChange={(e) => setRules({ ...rules, [k]: Number(e.target.value) })} className="field w-20 py-2 text-center" />
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={() => save()} className="btn-main">규칙 저장</button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-xl">기록 내보내기 · 보관</h2>
        <p className="text-sm text-soft">모든 기록을 엑셀에서 열 수 있는 CSV로 받아요(가명 기준, 녹음·목소리 숫자는 빠짐). 학년도가 끝나면 내보낸 뒤 아래 「모두 지우기」로 지워 주세요.</p>
        <button onClick={exportCsv} className="btn-sub">⬇️ 기록 CSV 내보내기</button>
        <span className="ml-3 text-sm">{msg.export}</span>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-xl">연습용(시연) 데이터</h2>
        <p className="text-sm text-soft">
          저장 위치: <b>{data.storage === "firestore" ? `Firebase Firestore (${data.dataPrefix === "maeumbit_" ? "실제 반 공간" : `연습 공간 ${data.dataPrefix}`})` : "이 컴퓨터 파일(.data/db.json)"}</b>.
          연습 데이터는 가명 25명과 최근 7일 기록으로, 살펴볼 학생 3명과 위험 표현 1건이 들어 있어요. 연습 기록에는 표시가 붙어 「연습 데이터만 지우기」로 따로 지울 수 있어요.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => demo("seed")} className="btn-sub">연습 데이터 만들기</button>
          {data.demo && <button onClick={() => demo("clearDemo")} className="btn-sub">연습 데이터만 지우기</button>}
          <button onClick={() => demo("clear")} className="btn-sub text-alert">모두 지우기</button>
          <span className="text-sm">{msg.demo}</span>
        </div>
      </section>
    </div>
  );
}
