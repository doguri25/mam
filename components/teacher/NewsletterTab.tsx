"use client";
// 가정 소식지: 이번 주 우리 반 마음(이름 없이 반 전체)·배운 감정 단어·교실 활동·집에서 해 볼 마음 놀이·선생님 한마디를
// 한 장으로. 선생님이 고르고 고친 내용만 담고 자동으로 보내지 않는다. 이주배경학생 가정용 번역본도 만들 수 있다.
import { useState } from "react";
import type { Overview } from "./types";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { LANGS, type Lang } from "@/lib/i18n";
import { GROUPS, groupOf, type Group } from "@/lib/shared";

const HOME_PLAY = [
  "저녁에 「오늘 마음 날씨는 어땠어?」 하고 물어봐 주세요. 맑음·흐림·비처럼 날씨로 말하면 쉽게 이야기해요.",
  "함께 숨 고르기: 4초 동안 코로 들이쉬고 4초 동안 입으로 내쉬기를 세 번 해 보세요.",
  "오늘 쓴 감정 단어 하나씩 말하기: 「나는 오늘 뿌듯했어, 왜냐하면…」처럼 이유까지 이어 말해 보세요.",
];

export default function NewsletterTab({ data }: { data: Overview }) {
  const week = data.records.filter((r) => r.date >= data.weekStart && r.date <= data.today);
  const groups = (Object.keys(GROUPS) as Group[]).map((g) => [g, week.filter((r) => groupOf(r.emotion) === g).length] as const).sort((a, b) => b[1] - a[1]);
  const words = Object.entries(week.reduce<Record<string, number>>((m, r) => (r.word ? { ...m, [r.word]: (m[r.word] ?? 0) + 1 } : m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);
  const activities = [...(data.weekly?.activities.map((a) => a.title) ?? []), ...data.lessons.flatMap((l) => l.activities.map((a) => a.title))].slice(0, 4);
  // 이 반에서 다른 언어로 기록하는 학생 수(번역본이 필요한지 가늠)
  const langs = Object.entries(data.records.reduce<Record<string, Set<number>>>((m, r) => (r.lang && r.lang !== "ko" ? { ...m, [r.lang]: new Set([...(m[r.lang] ?? []), r.no]) } : m), {}));

  const [title, setTitle] = useState(`${data.settings.className} 가정 소식 (${label(data.weekStart)} ~ ${label(data.today)})`);
  const [mood, setMood] = useState(
    data.weekly?.lines.join(" ") ||
      (week.length ? `이번 주 우리 반은 「${GROUPS[groups[0][0]].label}」 마음을 가장 많이 남겼어요. 힘든 마음을 남긴 친구들도 마음 다스리기 활동으로 스스로 마음을 돌보는 연습을 했어요.` : ""),
  );
  const [wordsText, setWordsText] = useState(words.join(", "));
  const [acts, setActs] = useState(activities.map((a) => `· ${a}`).join("\n"));
  const [play, setPlay] = useState(HOME_PLAY.map((p) => `· ${p}`).join("\n"));
  const [note, setNote] = useState("이번 주도 아이들이 자기 마음을 말로 표현하는 연습을 했어요. 가정에서도 아이의 이야기를 따뜻하게 들어 주세요.");
  const [lang, setLang] = useState<Exclude<Lang, "ko">>((langs[0]?.[0] as Exclude<Lang, "ko">) ?? "en");
  const [translated, setTranslated] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const whole = `${title}\n\n■ 이번 주 우리 반 마음\n${mood}\n\n■ 이번 주 배운 감정 단어\n${wordsText}\n\n■ 교실에서 한 활동\n${acts}\n\n■ 집에서 해 볼 마음 놀이\n${play}\n\n■ 선생님 한마디\n${note}`;

  async function translate() {
    setBusy(true);
    setErr("");
    try {
      setTranslated((await api<{ text: string }>("teacher", "translate", { text: whole, lang })).text);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  const field = (name: string, value: string, set: (v: string) => void, rows = 3) => (
    <label className="block">
      <span className="text-sm font-bold">■ {name}</span>
      <textarea value={value} onChange={(e) => set(e.target.value)} rows={rows} className="field mt-1 print:border-0 print:p-0" />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button onClick={() => window.print()} className="btn-main">🖨️ 인쇄·PDF 저장</button>
        <button onClick={() => navigator.clipboard?.writeText(translated || whole)} className="btn-sub">📋 글자 복사(알림장·문자용)</button>
        <span className="text-sm text-soft">반 전체 이야기만 담겨요. 학생 이름·번호는 들어가지 않아요. 자동으로 보내지 않아요.</span>
      </div>
      <section className="no-print card space-y-3">
        <h3 className="font-display text-xl">🌐 이주배경학생 가정용 번역본</h3>
        <p className="text-sm text-soft">
          아래 한국어 소식지를 고친 뒤 언어를 골라 만들면 바로 아래에 번역본이 나와요. 번역본이 있으면 인쇄할 때 번역본만 나가요.
          {langs.length > 0 && <> 이번 달 다른 언어로 기록한 학생: <b className="text-ink">{langs.map(([l, s]) => `${LANGS.find((x) => x.id === l)?.label ?? l} ${s.size}명`).join(", ")}</b></>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value as Exclude<Lang, "ko">)} className="field w-auto">
            {LANGS.filter((l) => l.id !== "ko").map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button onClick={translate} disabled={busy} className="btn-sub">{busy ? "번역하는 중…" : "AI로 번역본 만들기"}</button>
          {translated && <button onClick={() => setTranslated("")} className="btn-sub">번역본 지우기</button>}
          {err && <span className="text-sm text-alert">{err}</span>}
        </div>
        <p className="text-xs text-soft">AI 번역은 틀릴 수 있어요. 중요한 안내는 학교 통역 지원과 함께 확인해 주세요.</p>
      </section>
      {translated && (
        <article className="card mx-auto max-w-[210mm] whitespace-pre-wrap bg-white p-6 text-lg leading-relaxed sm:p-8 print:border-0 print:p-0">{translated}</article>
      )}
      <article className={`card mx-auto max-w-[210mm] space-y-4 bg-white p-6 sm:p-8 print:border-0 print:p-0 ${translated ? "print:hidden" : ""}`}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border-b-2 border-ink pb-2 font-display text-2xl outline-none sm:text-3xl" />
        {field("이번 주 우리 반 마음", mood, setMood)}
        {field("이번 주 배운 감정 단어", wordsText, setWordsText, 1)}
        {field("교실에서 한 활동", acts, setActs)}
        {field("집에서 해 볼 마음 놀이", play, setPlay, 4)}
        {field("선생님 한마디", note, setNote)}
      </article>

    </div>
  );
}
