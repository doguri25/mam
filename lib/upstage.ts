// 업스테이지 Document Parse: 교과서·학습지(PDF·사진·HWP·DOCX…) → 마크다운
// https://console.upstage.ai/docs/capabilities/parse/document-parsing
// 손글씨·그림 활동지는 { ocr: "force", mode: "enhanced" }: 늘 OCR + VLM 파서(그림 설명 글을 붙여 줌, 쪽당 값이 더 비쌈)
// signal: 부르는 쪽의 마감(Vercel이 끊기 전에 한국어로 답하려고). 없으면 100초에서 멈춘다.
export async function parseDocument(key: string, file: Blob, name: string, opt: { ocr?: "auto" | "force"; mode?: "standard" | "enhanced"; signal?: AbortSignal } = {}) {
  const form = new FormData();
  form.append("document", file, name);
  form.append("model", "document-parse");
  form.append("output_formats", '["markdown"]');
  form.append("ocr", opt.ocr ?? "auto");
  if (opt.mode) form.append("mode", opt.mode);
  const res = await fetch("https://api.upstage.ai/v1/document-digitization", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: opt.signal ? AbortSignal.any([opt.signal, AbortSignal.timeout(100_000)]) : AbortSignal.timeout(100_000),
  });
  if (!res.ok) throw new Error(`Document Parse ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { markdown: String(data.content?.markdown ?? ""), pages: Number(data.usage?.pages ?? 0) };
}
