import type { Flag } from "@/lib/rules";
import type { Retention } from "@/lib/retention";
import type { BuddyLook, Cheer, Letter, MoodRecord, Note, Provider, Reflect, RiskAction, Rules, Student, VoiceMode } from "@/lib/shared";

export interface Weekly {
  weekStart: string;
  createdAt: string;
  lines: string[];
  activities: { title: string; why: string; how: string; minutes: number }[];
}

export interface Stamp {
  records: number;
  other: number;
  wipe?: number;
}

// 서버가 보내는 것
export interface OverviewRaw {
  today: string;
  weekStart: string;
  storage: "mongo" | "firestore" | "local";
  dataPrefix: string;
  stamp: Stamp;
  partial?: boolean;
  pinSet: boolean; // 선생님이 비밀번호를 바꿨는지 // true면 records는 저장해 둔 때 뒤에 바뀐 것만
  students: Student[];
  records: MoodRecord[];
  demo: boolean;
  cheers: Cheer[];
  notes: Note[];
  push: { ready: boolean; key: string; devices: number };
  lessons: { id: string; unit: string; words: string[]; activities: { title: string; how: string; minutes: number }[]; createdAt: string }[];
  weekly: Weekly | null;
  looks: Record<number, BuddyLook>;
  letters: Letter[];
  reflects: Reflect[];
  riskActions: RiskAction[]; // 위험 표현 조치 기록(선생님만)
  expired: number; // 보관 기한이 지난 마음 기록 수
  trial: { aiUsed: number; aiCap: number; aiSource: "upstage" | "trial" | "class" | "none" | null } | null; // 심사용 체험 공간이면
  sharedAi: { used: number; cap: number } | null; // 실제 학급이 빌려 쓰는 공용 업스테이지 키(서버에 있을 때만)
  space: string; // 학급 공간(""=홍북초, demo=체험, c…=가입한 학급)
  account: string; // 로그인한 이름
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
    retention: Retention;
  };
}

// 화면에서 쓰는 것: 살펴볼 학생·기록 없음은 브라우저에서 계산(기록을 바뀐 것만 받아 오므로)
export interface Overview extends OverviewRaw {
  flags: Flag[];
  absent: number[];
}

export type Reload = () => Promise<void>;
export type NameOf = (no: number) => string;
