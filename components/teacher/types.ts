import type { Flag } from "@/lib/rules";
import type { Cheer, MoodRecord, Note, Provider, Rules, Student, VoiceMode } from "@/lib/shared";

export interface Stamp {
  records: number;
  other: number;
}

// 서버가 보내는 것
export interface OverviewRaw {
  today: string;
  weekStart: string;
  storage: "firestore" | "local";
  dataPrefix: string;
  stamp: Stamp;
  students: Student[];
  records: MoodRecord[];
  demo: boolean;
  cheers: Cheer[];
  notes: Note[];
  push: { ready: boolean; key: string; devices: number };
  settings: {
    className: string;
    provider: Provider;
    models: Record<Provider, string>;
    keys: Record<Provider, string | null>;
    vocab: string[];
    riskWords: string[];
    checks: Record<string, string>;
    voiceMode: VoiceMode;
    rules: Rules;
  };
}

// 화면에서 쓰는 것: 살펴볼 학생·기록 없음은 브라우저에서 계산(기록을 바뀐 것만 받아 오므로)
export interface Overview extends OverviewRaw {
  flags: Flag[];
  absent: number[];
}

export type Reload = () => Promise<void>;
export type NameOf = (no: number) => string;
