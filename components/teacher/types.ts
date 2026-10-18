import type { Flag } from "@/lib/rules";
import type { Cheer, MoodRecord, Note, Provider, Rules, Student, VoiceMode } from "@/lib/shared";

export interface Overview {
  today: string;
  weekStart: string;
  storage: "firestore" | "local";
  students: Student[];
  records: MoodRecord[];
  flags: Flag[];
  absent: number[];
  cheers: Cheer[];
  notes: Note[];
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

export type Reload = () => Promise<void>;
export type NameOf = (no: number) => string;
