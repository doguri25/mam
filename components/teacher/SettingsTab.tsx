"use client";
// 설정: 쓸 AI 고르기 · 4가지 API 키(서버에 암호화 저장, 화면엔 가려서) · 반 감정 단어 · 위험 단어 · 시연 데이터
import { kday, kstamp, ktime } from "./when";
import { PART_SEP, kindOfId, reflectEverRisk, reflectSource } from "./alerts";
import { useState } from "react";
import Doodle from "../Doodle";
import RetentionCard from "./RetentionCard";
import PinCard from "./PinCard";
import PushCard from "./PushCard";
import type { Overview, Reload } from "./types";
import { useAct } from "./useAct";
import { api } from "@/lib/api";
import { useLocal } from "@/lib/local";
import { matchRisk } from "@/lib/rules";
import { CALM_KO, FELT_KO, PROVIDERS, PROVIDER_IDS, RISK_ACTION_KO, RISK_WORDS_MAX, RISK_WORD_LEN, type MoodRecord, type Provider, type RiskAction, type Rules, type VoiceMode } from "@/lib/shared";

const LANG_KO: Record<string, string> = { ko: "한국어", en: "영어", zh: "중국어", vi: "베트남어", ja: "일본어" };

const LINKS: Record<Provider, string> = {
  upstage: "https://console.upstage.ai/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/apikey",
};

export default function SettingsTab({ data, reload, onAlerts }: { data: Overview; reload: Reload; onAlerts?: () => void }) {
  const s = data.settings;
  const shared = data.sharedAi; // 서버의 공용 업스테이지 키(있으면 키 없이도 하루 정해진 번까지)
  // 선생님이 이 기기에서 고친 칸만 기억하고 보낸다. 고치지 않은 칸은 늘 서버 값을 보여 주고 보내지도 않는다
  // → 다른 기기에서 더한 위험 표현·규칙을 이 기기의 오래된 화면이 덮어쓰지 않게.
  // 모델 이름·규칙은 고친 칸(열쇠)만 보낸다 — 서버가 열쇠마다 합치므로 다른 기기에서 바꾼 다른 모델·규칙을 덮지 않는다
  type Draft = { provider: Provider; className: string; models: Partial<Record<Provider, string>>; vocab: string; risk: string; voiceMode: VoiceMode; rules: Partial<Rules> };
  const [draft, setDraft] = useState<Partial<Draft>>({});
  const edit = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const provider = draft.provider ?? s.provider;
  const className = draft.className ?? s.className;
  const models = { ...s.models, ...draft.models };
  const vocab = draft.vocab ?? s.vocab.join(", ");
  const risk = draft.risk ?? s.riskWords.join(", ");
  const voiceMode = draft.voiceMode ?? s.voiceMode;
  const rules = { ...s.rules, ...draft.rules };
  const setProvider = edit("provider"), setClassName = edit("className"), setModels = edit("models"), setVocab = edit("vocab");
  const setRisk = edit("risk"), setVoiceMode = edit("voiceMode"), setRules = edit("rules");
  const [keys, setKeys] = useState<Partial<Record<Provider, string>>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [advRaw, setAdv] = useLocal("mb_adv"); // 자세한 설정(모델 이름·단어 목록·말투·규칙·연습 데이터)은 펼칠 때만
  const adv = advRaw === "1";
  const say = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }));
  // 쓰는 단추를 두 번 눌러 겹쳐 보내지 않게(까닭은 저마다 msg에): 설정 저장 · 키(연결 확인·키 지우기) · 연습 데이터
  const saving = useAct(), keying = useAct(), demoing = useAct();
  const split = (t: string) => t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  // 위험 표현 단어: 서버는 한 낱말 RISK_WORD_LEN자·모두 RISK_WORDS_MAX개까지만 받는다 → 넘는 것을 저장 전에 알린다(말없이 잘려 빠지지 않게)
  const riskList = [...new Set(split(risk).map((w) => w.replace(/[\p{Cc}\p{Cf}]/gu, "").trim()).filter(Boolean))];
  const tooLong = riskList.filter((w) => w.length > RISK_WORD_LEN);
  const riskIssue = draft.risk === undefined ? "" : [
    tooLong.length ? `「${tooLong.slice(0, 5).join("」, 「")}」${tooLong.length > 5 ? ` 등 ${tooLong.length}개` : ""}는 ${RISK_WORD_LEN}자가 넘어요. 짧게 줄여 주세요(앞 ${RISK_WORD_LEN}자만 남으면 다른 뜻이 될 수 있어요).` : "",
    riskList.length > RISK_WORDS_MAX ? `위험 표현이 ${riskList.length}개예요. ${RISK_WORDS_MAX}개까지 저장돼요 — ${riskList.length - RISK_WORDS_MAX}개를 빼 주세요(넘는 것은 저장되지 않아요).` : "",
  ].filter(Boolean).join(" ");

  const save = () => saving.run("", async () => {
    if (riskIssue) return say("save", `저장하지 않았어요. ${riskIssue}`);
    try {
      const d = draft;
      // 키는 새로 친 칸만 보낸다. 쳤다가 지운 빈칸(·빈칸만 친 칸)은 보내지 않는다 — 서버는 빈 글자를 「지우기」로 받으므로
      // 그대로 보내면 묻지도 않고 저장된 키를 지운다(키 지우기는 「키 지우기」 단추로만, 먼저 묻고).
      const typed = Object.fromEntries(Object.entries(keys).map(([p, v]) => [p, v?.trim() ?? ""]).filter(([, v]) => v));
      await api("teacher", "settings", {
        ...(Object.keys(typed).length ? { keys: typed } : {}),
        ...(d.provider ? { provider: d.provider } : {}), ...(d.className !== undefined ? { className: d.className } : {}),
        ...(d.models ? { models: d.models } : {}), ...(d.vocab !== undefined ? { vocab: split(d.vocab) } : {}),
        ...(d.risk !== undefined ? { riskWords: split(d.risk) } : {}), ...(d.voiceMode ? { voiceMode: d.voiceMode } : {}), ...(d.rules ? { rules: d.rules } : {}),
      });
      setKeys({});
      setDraft({});
      say("save", "저장했어요.");
      await reload();
    } catch (e) {
      say("save", (e as Error).message);
    }
  });

  async function exportCsv() {
    let got: {
      records: MoodRecord[]; students: { no: number; alias: string }[]; riskActions?: RiskAction[];
      riskDrafts?: Overview["riskDrafts"]; reflects?: Overview["reflects"]; letters?: Overview["letters"];
    };
    try {
      got = await api("teacher", "export");
    } catch (e) {
      return say("export", `내보내지 못했어요: ${(e as Error).message}`);
    }
    const { records, students } = got;
    // 한 일(조치)은 내보낼 때 서버에서 받은 것(다른 기기에서 적은 것까지). 예전 서버면 화면에 있는 것
    const actions = got.riskActions ?? data.riskActions;
    const alias = (no: number) => students.find((x) => x.no === no)?.alias ?? "";
    // 엑셀·구글 시트가 = + - @ 탭·줄바꿈으로 시작하는 칸을 수식으로 읽지 않게 앞에 '를 붙인다
    const cell = (v: unknown) => {
      const t = String(v ?? "");
      return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
    };
    // 앞 열 순서는 그대로 두고(예전 파일과 맞게) 새 열은 뒤에 붙인다
    const head = ["날짜", "시점", "번호", "가명", "방법", "감정", "세기", "까닭", "한 줄", "되묻기", "답", "말투", "위험 표현", "살펴본 시각", "한 일(조치)", "감정 단어", "한국어 정리", "언어", "마음 다스리기", "고치기 전 위험 표현"];
    const did = (id: string) => actions.filter((x) => x.recordId === id).map((x) => `${x.date} ${x.kinds.map((k) => RISK_ACTION_KO[k]).join("·")}${x.note ? ` (${x.note})` : ""}`).join(" / ");
    const calm = (r: MoodRecord) => (r.calm ?? []).map((c) => `${CALM_KO[c.tool] ?? c.tool} → ${FELT_KO[c.felt] ?? c.felt}`).join(" / ");
    const lang = (l?: string) => (l ? LANG_KO[l] ?? l : "");
    const slotKo = (x?: string) => (x === "am" ? "아침" : x === "pm" ? "하교 전" : "");
    type Row = { date: string; no: number; k: string; cells: unknown[] };
    const rows: Row[] = records.map((r) => ({
      date: r.date, no: r.no, k: r.slot,
      cells: [
        // 위험 표현: 이 글(지금 글)의 걸린 말만. 지금 글은 순하고 고치기 전 글에만 있었으면 그렇다고(그 글과 걸린 말은 맨 끝 칸에)
        r.date, slotKo(r.slot), r.no, alias(r.no), r.method === "voice" ? "말하기" : "카드", r.emotion, r.intensity, r.reason, r.summary, r.question, r.answer, r.tone ?? "",
        (r.riskSelf ?? r.risk) ? r.riskHits.join(" ") || "AI 판단" : r.risk ? "고치기 전 글에 있음" : "", kstamp(r.riskChecked), did(r.id),
        r.word ?? "", r.summaryKo ?? "", lang(r.lang), calm(r),
        // 같은 칸에 다시 남겨 지금 글에는 없지만, 고치기 전 글에 있던 위험 표현(때·글·그 글의 걸린 말). 글 사이는 「 ‖ 」(한 줄과 답 사이 「 / 」와 헷갈리지 않게)
        (r.prev ?? []).filter((p) => p.risk).map((p) => `${ktime(p.createdAt)} “${p.summaryKo || p.summary}${p.answer ? ` / ${p.answer}` : ""}” ${p.riskHits.join(" ") || "AI 판단"}`).join(PART_SEP),
      ],
    }));
    // 마음 기록 밖의 위험 표현(마치지 않은 기록 · 한 주 돌아보기 · 공감 쪽지): 감정·까닭 칸은 비우고 글은 「한 줄」에
    const hitsOf = (t: string) => matchRisk(t, s.riskWords).join(" ") || "있음";
    const other = (o: { id: string; date: string; slot?: string; no: number; method: string; line: string; risk: string; checked?: string | null; summaryKo?: string; lang?: string; earlier?: string }): Row => ({
      date: o.date, no: o.no, k: `z${o.method}`,
      cells: [o.date, slotKo(o.slot), o.no, alias(o.no), o.method, "", "", "", o.line, "", "", "", o.risk, kstamp(o.checked), did(o.id), "", o.summaryKo ?? "", lang(o.lang), "", o.earlier ?? ""],
    });
    const extra: Row[] = [];
    const done = new Set<string>();
    // 서버가 보낸 전체(오래된 것까지)를 쓰고, 예전 서버면 화면에 있는 것
    for (const d of got.riskDrafts ?? data.riskDrafts ?? []) {
      done.add(`draft:${d.id}`);
      extra.push(other({
        id: `draft:${d.id}`, date: d.date, slot: d.slot, no: d.no, method: "마치지 않은 기록", line: d.text, risk: d.hits.join(" ") || "AI 판단", checked: d.checked,
        summaryKo: d.summaryKo, lang: d.lang, earlier: (d.earlier ?? []).map((e) => `${ktime(e.at)} “${e.text}” ${e.hits.join(" ") || "AI 판단"}`).join(PART_SEP),
      }));
    }
    for (const x of (got.reflects ?? data.reflects).filter(reflectEverRisk)) {
      done.add(`reflect:${x.id}`);
      const src = reflectSource(x, s.riskWords);
      extra.push(other({
        id: `reflect:${x.id}`, date: kday(x.createdAt), no: x.no, method: "돌아보기", line: x.text, risk: src.prev ? "" : hitsOf(x.text), checked: x.riskChecked, lang: x.lang,
        earlier: (x.prev ?? []).filter((p) => p.risk).map((p) => `${ktime(p.createdAt)} “${p.text}” ${hitsOf(p.text)}`).join(PART_SEP),
      }));
    }
    for (const l of (got.letters ?? data.letters).filter((l) => l.risk)) {
      done.add(`letter:${l.id}`);
      const status = { wait: "허락 기다림", ok: "전함", no: "돌려보냄" }[l.status];
      extra.push(other({ id: `letter:${l.id}`, date: kday(l.createdAt), no: l.from, method: "쪽지", line: `(→ ${l.to}번 · ${status}${l.toPractice ? " · 받을 학생 없음" : ""}) ${l.text}${l.original ? ` (처음 쓴 글: ${l.original})` : ""}`, risk: hitsOf(l.original ?? l.text), checked: l.riskChecked, lang: l.lang }));
    }
    // 화면에 없는(오래됐거나 지워진) 것은 조치 기록에 남긴 글로
    const METHOD = { draft: "마치지 않은 기록", reflect: "돌아보기", letter: "쪽지" } as const;
    for (const id of new Set(actions.map((a) => a.recordId))) {
      const as = actions.filter((a) => a.recordId === id);
      const kind = as.find((a) => a.kind)?.kind ?? kindOfId(id);
      if (kind === "record" || done.has(id)) continue;
      const text = [...as].reverse().find((a) => a.text)?.text ?? "";
      const first = [...as].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      // recordDate가 없던 예전 조치 기록은 한 날로(없으면 날짜 정렬이 깨진다)
      extra.push(other({ id, date: first.recordDate || first.date, no: first.no, method: METHOD[kind], line: text, risk: text ? hitsOf(text) : "있음", checked: first.createdAt }));
    }
    const all = [...rows, ...extra].sort((a, b) => a.date.localeCompare(b.date) || a.no - b.no || a.k.localeCompare(b.k));
    const csv = "﻿" + [head, ...all.map((r) => r.cells)].map((row) => row.map(cell).join(",")).join("\r\n"); // 엑셀 한글이 깨지지 않게 BOM
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `마음빛-기록-${data.today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    say("export", extra.length ? `마음 기록 ${records.length}건과 그 밖의 위험 표현 ${extra.length}건을 내보냈어요.` : `${records.length}건을 내보냈어요.`);
  }

  // 키 하나만 저장하거나 지운다(연결 확인·키 지우기). 다른 칸에 넣던 키와 고치던 반 이름·위험 표현 등은 보내지도 비우지도 않는다
  // (전체 저장을 부르면 다른 칸 키가 빈칸이 되고, 위험 표현 경고가 떠 있으면 키도 저장되지 않은 채 옛 키로 확인했다).
  async function saveKey(p: Provider, value: string) {
    await api("teacher", "settings", { keys: { [p]: value } });
    setKeys((k) => {
      const { [p]: _done, ...rest } = k;
      void _done;
      return rest;
    });
    await reload();
  }

  const test = (p: Provider) => keying.run("", async () => {
    say(p, "확인하는 중…");
    try {
      const typed = keys[p]?.trim();
      if (typed) await saveKey(p, typed);
      const r = await api<{ model: string }>("teacher", "testAI", { provider: p });
      say(p, `✓ 연결됐어요 (${r.model})`);
    } catch (e) {
      say(p, (e as Error).message);
    }
  });
  const dropKey = (p: Provider) => keying.run("", () => saveKey(p, "").then(() => say(p, "키를 지웠어요."), (e) => say(p, (e as Error).message)), "이 키를 지울까요?");

  const demo = (mode: "seed" | "clear" | "clearDemo") => demoing.run("", async () => {
    try {
      await api("teacher", "demo", { mode });
    } catch (e) {
      return say("demo", (e as Error).message); // 체험 반에서 너무 자주 누르면 기다리라는 안내
    }
    say("demo", { seed: "연습 데이터를 만들었어요. 「마음 지도」를 보세요.", clear: "모두 지웠어요.", clearDemo: "연습 데이터를 지웠어요." }[mode]);
    await reload();
  }, {
    seed: "지금 기록과 명단을 모두 지우고 연습용 가짜 학생 25명 + 7일 기록을 만들까요? 실제 반 기록이 있다면 함께 지워져요.",
    clear: "모든 기록·응원·메모·명단을 지울까요? 되돌릴 수 없어요.",
    clearDemo: "연습용(시연) 기록만 지울까요? 실제로 남긴 기록은 그대로예요.",
  }[mode]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-soft">처음에는 <b>비밀번호 바꾸기 · AI 키 넣기 · 반 이름</b>만 하면 돼요. 나머지는 아래 「자세한 설정」에 있어요.</p>
      <PinCard pinSet={data.pinSet} />
      <section className="card space-y-4">
        <div>
          <h2 className="font-display text-xl">AI 연결</h2>
          <p className="text-sm text-soft">
            쓸 AI를 하나 고르고 키를 넣어요. 키는 서버에 암호화해 저장되고 화면에는 가려서만 보여요. 키가 없으면 카드 기록은 기본 질문으로, 말하기는 카드 고르기로 이어져요.
          </p>
          {shared && (
            <p className="mt-2 rounded-2xl bg-leaf-soft px-3 py-2 text-sm">
              <b>키를 넣지 않아도</b> 업스테이지 공용 키로 하루 {shared.cap}번까지 AI가 돌아요(오늘 {shared.used}번 씀). 선생님 키를 넣으면 그 키를 먼저, 횟수 제한 없이 써요.
            </p>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {PROVIDER_IDS.map((p) => (
            <div key={p} className={`rounded-2xl border-2 p-4 ${provider === p ? "border-leaf bg-leaf-soft/40" : "border-line"}`}>
              <label className="flex items-center gap-2 font-bold">
                <input type="radio" name="provider" checked={provider === p} onChange={() => setProvider(p)} className="size-4 accent-leaf" />
                {PROVIDERS[p].label}
                <span className="ml-auto text-xs font-normal text-soft">{s.keys[p] ? `저장됨 ${s.keys[p]}` : p === "upstage" && shared ? `공용 키 · 오늘 ${shared.used}/${shared.cap}번` : "키 없음"}</span>
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
              {adv && (
                <label className="mt-2 block text-xs text-soft">
                  모델 이름{data.trial && " (체험에서는 바꿀 수 없어요)"}
                  {/* 체험은 실제 반의 키를 빌려 쓰므로 모델 이름을 바꾸지 않는다(서버도 받지 않음) */}
                  <input value={models[p]} onChange={(e) => setModels({ ...draft.models, [p]: e.target.value })} disabled={!!data.trial} className="field mt-1 py-2 font-mono text-sm disabled:opacity-60" />
                </label>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => test(p)} disabled={keying.busy || (!s.keys[p] && !keys[p] && !(p === "upstage" && shared))} className="btn-sub min-h-9 px-3 text-sm">연결 확인</button>
                {s.keys[p] && (
                  <button onClick={() => dropKey(p)} disabled={keying.busy} className="text-xs text-soft underline">키 지우기</button>
                )}
                <span className="text-xs">{msg[p]}</span>
              </div>
            </div>
          ))}
        </div>
        {shared && provider !== "upstage" && !s.keys[provider] && (
          <p className="text-sm text-soft">{PROVIDERS[provider].label} 키가 없어서 지금은 업스테이지 공용 키로 돌아요.</p>
        )}
      </section>

      <section className="card grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="font-bold">반 이름</span>
          <input value={className} onChange={(e) => setClassName(e.target.value)} className="field mt-1" />
        </label>
        {adv && <label className="block">
          <span className="font-bold">우리 반에서 배운 감정 단어</span>
          <span className="block text-xs text-soft">쉼표로 나눠요. 학생 도움판과 되묻기·응원 초안에 쓰여요.</span>
          <input value={vocab} onChange={(e) => setVocab(e.target.value)} className="field mt-1" />
        </label>}
        {adv && <label className="block md:col-span-2">
          <span className="font-bold">위험 표현 단어</span>
          <span className="block text-xs text-soft">학생 말에 이 글자가 들어 있으면 선생님 화면에만 빨간 알림이 떠요. AI 판단과 함께 두 겹으로 살펴요.</span>
          <textarea value={risk} onChange={(e) => setRisk(e.target.value)} rows={2} className="field mt-1 text-sm" aria-describedby="risk-limit" />
          <span id="risk-limit" className={`mt-1 block text-xs wrap-anywhere ${riskIssue ? "font-bold text-alert" : "text-soft"}`} role={riskIssue ? "alert" : undefined}>
            {riskIssue || `${riskList.length}/${RISK_WORDS_MAX}개 · 한 낱말 ${RISK_WORD_LEN}자까지`}
          </span>
        </label>}
        <div className="flex items-center justify-end gap-3 md:col-span-2">
          <span className="min-w-0 text-sm wrap-anywhere">{msg.save}</span>
          <button onClick={() => save()} disabled={saving.busy} className="btn-main">설정 저장</button>
        </div>
      </section>

      <RetentionCard data={data} reload={reload} onExport={exportCsv} exportMsg={msg.export ?? ""} onAlerts={onAlerts} />

      <button onClick={() => setAdv(adv ? "" : "1")} aria-expanded={adv} className="btn-sub w-full">
        {adv ? "▴ 자세한 설정 접기" : "▾ 자세한 설정 펼치기 (휴대폰 알림 · 단어 목록 · 말투 · 살펴볼 학생 규칙 · 연습 데이터)"}
      </button>

      {adv && <>
      <PushCard data={data} reload={reload} />
      <section className="card space-y-3">
        <h2 className="font-display text-xl"><Doodle name="mic" /> 말투(목소리 기운) 살피기</h2>
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
          <span className="min-w-0 text-sm wrap-anywhere">{msg.save}</span>
          <button onClick={() => save()} disabled={saving.busy} className="btn-main">설정 저장</button>
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
              <input type="number" min={1} max={max} value={rules[k]} onChange={(e) => setRules({ ...draft.rules, [k]: Number(e.target.value) })} className="field w-20 py-2 text-center" />
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={() => save()} disabled={saving.busy} className="btn-main">규칙 저장</button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-xl">연습용(시연) 데이터</h2>
        <p className="text-sm text-soft">
          저장 위치: <b>{data.storage === "local" ? "이 컴퓨터 파일(.data/db.json)" : `${data.storage === "mongo" ? "MongoDB Atlas" : "Firebase Firestore"} (${data.dataPrefix === "maeumbit_" ? "실제 반 공간" : `연습 공간 ${data.dataPrefix}`})`}</b>.
          연습 데이터는 가명 25명과 최근 7일 기록으로, 살펴볼 학생 3명과 위험 표현 1건이 들어 있어요. 연습 기록에는 표시가 붙어 「연습 데이터만 지우기」로 따로 지울 수 있어요.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => demo("seed")} disabled={demoing.busy} className="btn-sub">연습 데이터 만들기</button>
          {data.demo && <button onClick={() => demo("clearDemo")} disabled={demoing.busy} className="btn-sub">연습 데이터만 지우기</button>}
          <button onClick={() => demo("clear")} disabled={demoing.busy} className="btn-sub text-alert">모두 지우기</button>
          <span className="text-sm">{msg.demo}</span>
        </div>
      </section>
      </>}
    </div>
  );
}
