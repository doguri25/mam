// 화면에서 API를 부르는 작은 도우미
// status가 없는 오류 = 서버까지 가지 못함(와이파이 끊김 등).
// timeout(밀리초): 답이 너무 늦으면 그만두고 timeout 표시가 붙은 오류로(마음 친구가 오래 생각할 때 기다리지 않게).
// signal: 화면이 그만두면(뒤로 가기·다른 화면으로 나감) aborted 표시가 붙은 오류로. 둘 다 status가 없으니 끊김보다 먼저 살핀다.
export type ApiOpts = { timeout?: number; signal?: AbortSignal };
export const isTimeout = (e: unknown) => !!(e as { timeout?: boolean } | null)?.timeout;
export const isAborted = (e: unknown) => !!(e as { aborted?: boolean } | null)?.aborted;

// 이 화면(브라우저 탭)이 보여 주는 학생: 번호와 학급 공간.
// QR을 찍으면 새 탭이 열려 이 기기의 로그인(쿠키)이 다른 친구로 바뀐다. 앞 탭에 남은 화면에서 저장·쪽지를 하면 다른 친구의 것이 되므로
// 학생 요청마다 이 화면의 학생(screenNo·screenSpace)을 실어 보내고, 서버는 쿠키의 학생과 다르면 409 otherStudent로 막는다.
// 처음 받은 학생 정보(me)가 이 화면의 학생이 된다. 그 뒤 me 답이 다른 학생이면(서버가 아직 막지 않아도) 그 답을 쓰지 않는다.
// 둘 다 이 탭을 첫 화면으로 보낸다(leaveForOther). login·me·logout·saveQueued(담아 둔 기록은 그 학생의 표로 감)에는 싣지 않는다.
export type StudentScreen = { no: number; space?: string };
export const OTHER_STUDENT = "다른 친구가 이 기기로 들어왔어요. 다시 들어와 주세요.";
export const OTHER_KEY = "mb_other"; // 첫 화면이 안내를 띄우게 이 탭에만 남기는 값(sessionStorage): 앞 화면의 학생
const BARE = new Set(["login", "me", "logout", "saveQueued"]);
let screen: StudentScreen | null = null;
let left = false; // 다른 친구가 들어와 첫 화면으로 가는 중: 더 묻지 않는다
export const isOtherStudent = (e: unknown) => (e as { code?: unknown } | null)?.code === "otherStudent";
const otherError = () => Object.assign(new Error(OTHER_STUDENT), { status: 409, code: "otherStudent" });
export const studentScreen = () => screen;
// 들어오기·나가기(그리고 시험)에서 비운다. 비우면 다음 me 답이 다시 이 화면의 학생이 된다.
export function setStudentScreen(s: StudentScreen | null) {
  screen = s;
  if (!s) left = false;
  else watch();
}

// 다른 친구가 이 기기로 들어왔다: 하던 것을 멈추고(이 뒤 학생 요청은 보내지 않음) 화면을 통째로 새로 불러 첫 화면으로.
// 숨겨 둔 화면(Next.js Activity)에 남은 이 학생의 기록·쓰던 글도 함께 사라진다. 첫 화면이 이 학생 언어로 안내한다.
function leaveForOther() {
  if (left) return;
  left = true;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(OTHER_KEY, JSON.stringify(screen ?? {}));
  } catch {
    // 저장소를 못 쓰면 안내 없이 첫 화면으로만
  }
  window.location.replace("/");
}

function forgetOther() {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(OTHER_KEY);
  } catch {
    // 저장소를 못 쓰면 남긴 것도 없다
  }
}

// me 답이 이 화면의 학생인가. 아직 학생이 없으면 이 답의 학생으로 정한다.
// 학급 공간은 둘 다 알 때만 견준다(공간을 알려 주지 않던 예전 서버).
function sameStudent(m: { no?: unknown; space?: unknown }) {
  const no = Number(m.no);
  const space = typeof m.space === "string" ? m.space : undefined;
  if (!screen) {
    if (Number.isFinite(no)) setStudentScreen({ no, space });
    return true;
  }
  if (screen.no !== no) return false;
  if (screen.space !== undefined && space !== undefined && screen.space !== space) return false;
  if (screen.space === undefined && space !== undefined) screen = { no, space };
  return true;
}

// 탭이 다시 보이거나 다시 눌리면(다른 탭에서 QR로 다른 친구가 들어왔을 수 있다) 학생 화면에서는 바로 me를 물어 견준다.
// 1분마다 보는 시계를 기다리지 않는다. 묻는 중이면 겹쳐 묻지 않는다.
let watching = false;
let looking = false;
function watch() {
  if (watching || typeof window === "undefined" || typeof document === "undefined") return;
  watching = true;
  const look = () => {
    if (!/^\/me(\/|$)/.test(window.location.pathname)) return;
    // 뒤로 가기로 쫓겨나기 전 화면이 그대로 되살아났으면(브라우저 페이지 캐시) 다시 첫 화면으로
    if (kicked()) return window.location.replace("/");
    if (!screen || left || looking || document.visibilityState !== "visible") return;
    looking = true;
    api("student", "me").then(
      () => { looking = false; },
      () => { looking = false; },
    );
  };
  document.addEventListener("visibilitychange", look);
  window.addEventListener("focus", look);
  window.addEventListener("pageshow", look);
}

// 이 탭은 다른 친구가 들어와 첫 화면으로 보낸 탭이다(코드로 다시 들어오기 전까지). 화면을 새로 불러도 남는다(sessionStorage).
function kicked() {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(OTHER_KEY) !== null;
  } catch {
    return false;
  }
}

export async function api<T = Record<string, unknown>>(who: "student" | "teacher" | "try", action: string, body: Record<string, unknown> = {}, opt: ApiOpts = {}): Promise<T> {
  const student = who === "student";
  if (student && left) throw otherError();
  // 쫓겨난 탭에서 브라우저 뒤로 가기로 학생 화면(/me)을 다시 열면, 새로 읽는 me는 지금 이 기기에 들어온 다른 친구다.
  // 코드로 다시 들어오기(login) 전에는 학생 요청을 보내지 않고, 학생 화면이면 다시 첫 화면으로 보낸다(나가기 logout도 다른 친구를 내보내므로 막는다).
  if (student && action !== "login" && kicked()) {
    if (typeof window !== "undefined" && /^\/me(\/|$)/.test(window.location.pathname)) {
      left = true;
      window.location.replace("/");
    }
    throw otherError();
  }
  const extra = student && screen && !BARE.has(action) ? { screenNo: screen.no, ...(screen.space !== undefined ? { screenSpace: screen.space } : {}) } : {};
  // AbortSignal.timeout·AbortSignal.any가 없는 오래된 태블릿에서도 되게 손수 잇는다
  const ctl = opt.timeout || opt.signal ? new AbortController() : null;
  let late = false;
  const timer = opt.timeout ? setTimeout(() => { late = true; ctl!.abort(); }, opt.timeout) : undefined;
  const stop = () => ctl!.abort();
  if (opt.signal?.aborted) ctl!.abort();
  else opt.signal?.addEventListener("abort", stop);
  const fail = () =>
    opt.signal?.aborted ? Object.assign(new Error("그만뒀어요."), { aborted: true })
    : late ? Object.assign(new Error("답이 너무 늦어요."), { timeout: true })
    : new Error("인터넷 연결을 확인해 주세요."); // 브라우저의 영어 오류(Failed to fetch) 대신
  try {
    let res: Response;
    try {
      res = await fetch(`/api/${who}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...body, ...extra }),
        signal: ctl?.signal,
      });
    } catch {
      throw fail();
    }
    let data: { error?: string; code?: unknown } = {};
    try {
      data = (await res.json()) ?? {};
    } catch {
      if (ctl?.signal.aborted) throw fail(); // 답을 읽는 사이에 그만둠·늦음
    }
    if (student && res.status === 409 && data.code === "otherStudent") {
      leaveForOther();
      throw otherError(); // 안내는 학생 언어로 바꿔 보여 줄 수 있게 늘 같은 한국어 글로
    }
    // body: 서버가 함께 보낸 것(예: 명단 저장의 whoIs — 같은 번호를 새 학생에게 주는지 물을 번호 목록)
    if (!res.ok) throw Object.assign(new Error(data.error ?? "문제가 생겼어요."), { status: res.status, body: data });
    if (student) {
      if (action === "me" && !sameStudent(data as { no?: unknown; space?: unknown })) {
        leaveForOther();
        throw otherError(); // 다른 친구의 정보는 이 화면에 넘기지 않는다
      }
      if (action === "login" || action === "logout") setStudentScreen(null);
      if (action === "login") forgetOther(); // 이 탭에서 다시 들어왔으니 첫 화면의 「다른 친구가 들어왔어요」 안내는 거둔다
    }
    return data as T;
  } finally {
    clearTimeout(timer);
    opt.signal?.removeEventListener("abort", stop);
  }
}
