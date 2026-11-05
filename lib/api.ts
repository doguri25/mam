// 화면에서 API를 부르는 작은 도우미
// status가 없는 오류 = 서버까지 가지 못함(와이파이 끊김 등).
// timeout(밀리초): 답이 너무 늦으면 그만두고 timeout 표시가 붙은 오류로(마음 친구가 오래 생각할 때 기다리지 않게).
// signal: 화면이 그만두면(뒤로 가기·다른 화면으로 나감) aborted 표시가 붙은 오류로. 둘 다 status가 없으니 끊김보다 먼저 살핀다.
export type ApiOpts = { timeout?: number; signal?: AbortSignal };
export const isTimeout = (e: unknown) => !!(e as { timeout?: boolean } | null)?.timeout;
export const isAborted = (e: unknown) => !!(e as { aborted?: boolean } | null)?.aborted;

export async function api<T = Record<string, unknown>>(who: "student" | "teacher" | "try", action: string, body: Record<string, unknown> = {}, opt: ApiOpts = {}): Promise<T> {
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
        body: JSON.stringify({ action, ...body }),
        signal: ctl?.signal,
      });
    } catch {
      throw fail();
    }
    let data: { error?: string } = {};
    try {
      data = (await res.json()) ?? {};
    } catch {
      if (ctl?.signal.aborted) throw fail(); // 답을 읽는 사이에 그만둠·늦음
    }
    if (!res.ok) throw Object.assign(new Error(data.error ?? "문제가 생겼어요."), { status: res.status });
    return data as T;
  } finally {
    clearTimeout(timer);
    opt.signal?.removeEventListener("abort", stop);
  }
}
