// 반 명단·설정·기록을 읽고 쓰는 곳
import { decrypt, newCode } from "./auth.ts";
import { db } from "./db.ts";
import { DEFAULT_RISK_WORDS, DEFAULT_RULES, DEFAULT_VOCAB, PROVIDERS, PROVIDER_IDS, type MoodRecord, type Provider, type Rules, type Student, type VoiceMode } from "./shared.ts";

export interface Settings {
  className: string;
  provider: Provider;
  models: Record<Provider, string>;
  keys: Partial<Record<Provider, string>>; // 암호화된 값
  vocab: string[];
  riskWords: string[];
  checks: Record<string, string>; // 「살펴봤어요」 표시: `${no}_${주 시작일}` → 시각
  voiceMode: VoiceMode; // 말투: 끄기 · 기기 안에서 재기 · Gemini가 듣기
  rules: Rules;
}

export function defaultSettings(): Settings {
  return {
    className: "3학년 2반",
    provider: "upstage",
    models: Object.fromEntries(PROVIDER_IDS.map((p) => [p, PROVIDERS[p].model])) as Record<Provider, string>,
    keys: {},
    vocab: DEFAULT_VOCAB,
    riskWords: DEFAULT_RISK_WORDS,
    checks: {},
    voiceMode: "device",
    rules: DEFAULT_RULES,
  };
}

export async function getSettings(): Promise<Settings> {
  const s = await db().get<Partial<Settings>>("meta", "settings");
  const d = defaultSettings();
  return { ...d, ...s, models: { ...d.models, ...s?.models }, rules: { ...d.rules, ...s?.rules } };
}

export async function saveSettings(s: Settings) {
  await db().set("meta", "settings", { ...s });
  await touch("other");
}

export async function getRoster(): Promise<Student[]> {
  return (await db().get<{ students: Student[] }>("meta", "roster"))?.students ?? [];
}

export async function rosterIsDemo() {
  return (await db().get<{ demo?: boolean }>("meta", "roster"))?.demo === true;
}

// demo: 시연(연습)용 가짜 명단인지 — 교사 화면에 「연습 데이터」 띠를 띄운다
export async function saveRoster(students: Student[], demo = false) {
  await db().set("meta", "roster", { students: [...students].sort((a, b) => a.no - b.no), demo });
  await touch("other");
}

// 「1 햇살」, 「1,햇살」, 「1	햇살」 한 줄에 한 명. 같은 번호는 원래 코드를 그대로 둔다.
export function parseRoster(text: string, old: Student[]): Student[] {
  const taken = new Set(old.map((s) => s.code));
  const seen = new Set<number>();
  const out: Student[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{1,3})\s*[,.\t ]\s*(.{1,12})$/);
    if (!m) continue;
    const no = Number(m[1]);
    if (seen.has(no)) continue;
    seen.add(no);
    const prev = old.find((s) => s.no === no);
    out.push({ no, alias: m[2].trim(), code: prev?.code ?? newCode(taken) });
    taken.add(out.at(-1)!.code);
  }
  return out;
}

export async function aiConfig(provider?: Provider) {
  const s = await getSettings();
  const p = provider ?? s.provider;
  const box = s.keys[p];
  const key = box ? decrypt(box) : null;
  return key ? { provider: p, model: s.models[p], key } : null;
}

// ── 기록 읽기: 통째로 읽지 않고 필요한 만큼만(Firestore 읽기 횟수 = 돌려받은 문서 수) ──
export const allRecords = () => db().all<MoodRecord>("records"); // 내보내기에서만
export const recordsOf = (no: number) => db().find<MoodRecord>("records", "no", "==", no);
export const recordsFrom = (date: string) => db().find<MoodRecord>("records", "date", ">=", date);
export const recordsChangedAfter = (ms: number) => db().find<MoodRecord>("records", "updatedAt", ">", ms);

export async function putRecord(r: MoodRecord) {
  await db().set("records", r.id, { ...r, updatedAt: Date.now() });
  await touch("records");
}

// 변경 표시: 교사 화면은 이 문서 하나만 자주 읽고, 바뀌었을 때만 기록을 더 읽는다
export interface Stamp {
  records: number;
  other: number;
}
export async function getStamp(): Promise<Stamp> {
  return (await db().get<Stamp>("meta", "stamp")) ?? { records: 0, other: 0 };
}
export async function touch(kind: keyof Stamp) {
  await db().set("meta", "stamp", { ...(await getStamp()), [kind]: Date.now() });
}
