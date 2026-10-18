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
}

export async function getRoster(): Promise<Student[]> {
  return (await db().get<{ students: Student[] }>("meta", "roster"))?.students ?? [];
}

export async function saveRoster(students: Student[]) {
  await db().set("meta", "roster", { students: [...students].sort((a, b) => a.no - b.no) });
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

export async function allRecords() {
  return db().all<MoodRecord>("records");
}
