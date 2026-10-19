// 화면에서 API를 부르는 작은 도우미
// status가 없는 오류 = 서버까지 가지 못함(와이파이 끊김 등)
export async function api<T = Record<string, unknown>>(who: "student" | "teacher" | "try", action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`/api/${who}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "문제가 생겼어요."), { status: res.status });
  return data as T;
}
