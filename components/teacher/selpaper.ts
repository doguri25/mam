// 학급 역량 진단 서면 검사(화면 쪽에서만): 앱 검사지 그리기 · 선생님 양식에 번호·QR 찍기 · 쪽 그림을 PDF로 묶기 ·
// 스캔본(PDF·사진)을 쪽 그림으로 나눠 QR과 체크 칸 읽기. 그림은 이 기기 안에서만 다루고 서버에 저장하지 않는다.
import QRCode from "qrcode";
import jsQR from "jsqr";
import { BOX, COLS, FID, NUM_BOX, PAGE, PER_PAGE, QR_BOX, TEXT_W, TEXT_X, boxY, parseQr, qrText, readPage, rotate180, rowTop, sectionY, type Gray, type Mark } from "@/lib/omr";
import { DOMAINS, SELF_ITEMS } from "@/lib/selfcheck";

const A4 = { w: 595.28, h: 841.89 }; // pt
const SANS = '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const DISPLAY = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const LABELS = [["전혀 그렇지", "않아요"], ["그렇지", "않아요"], ["보통", "이에요"], ["그래요"], ["매우", "그래요"]];

async function fontsReady() {
  try {
    await Promise.all([document.fonts.load(`76px ${DISPLAY}`, "마음 점검"), document.fonts.load(`38px ${SANS}`, "나는")]);
  } catch {
    // 글꼴을 못 받아도 기본 글꼴로 그린다
  }
}
const qrCanvas = async (text: string, size: number) => {
  const c = document.createElement("canvas");
  await QRCode.toCanvas(c, text, { margin: 1, width: size, errorCorrectionLevel: "M" });
  return c;
};
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > width && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// 앱 검사지 한 쪽(no 0 = 번호를 학생이 쓰는 빈 검사지). 영역 색과 문장은 학생 화면과 같다.
// scale: 300dpi 좌표를 줄여 그린다(기본 200dpi — 인쇄에 충분하고 PDF가 가벼움)
export async function drawSheet(no: number, page: 1 | 2, scale = 2 / 3): Promise<HTMLCanvasElement> {
  await fontsReady();
  const c = document.createElement("canvas");
  c.width = Math.round(PAGE.w * scale); c.height = Math.round(PAGE.h * scale);
  const x = c.getContext("2d")!;
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
  x.scale(scale, scale);
  x.fillStyle = "#111111";
  for (const [cx, cy] of FID.at) x.fillRect(cx - FID.size / 2, cy - FID.size / 2, FID.size, FID.size);
  x.textBaseline = "alphabetic";
  x.fillStyle = "#1f3a2c"; x.font = `76px ${DISPLAY}`;
  x.fillText("마음 점검 · 학급 역량 진단", 230, 300);
  x.fillStyle = "#5f6d65"; x.font = `34px ${SANS}`;
  x.fillText(`종이 검사지 ${page}/2쪽`, 230, 370);
  x.fillStyle = "#2d3a33"; x.font = `36px ${SANS}`;
  x.fillText("요즘 나와 가장 가까운 칸 하나에 ✔ 표시해요.", 230, 470);
  x.fillText("정답은 없어요. 이름은 쓰지 않아요.", 230, 525);
  x.drawImage(await qrCanvas(qrText("S", no, page), QR_BOX.s), QR_BOX.x, QR_BOX.y, QR_BOX.s, QR_BOX.s);
  if (no > 0) {
    x.textAlign = "right"; x.fillStyle = "#1f3a2c"; x.font = `130px ${DISPLAY}`;
    x.fillText(`${no}번`, QR_BOX.x - 40, QR_BOX.y + 190);
    x.textAlign = "left";
  } else {
    x.strokeStyle = "#333333"; x.lineWidth = 4;
    x.strokeRect(NUM_BOX.x, NUM_BOX.y, NUM_BOX.w, NUM_BOX.h);
    x.beginPath(); x.moveTo(NUM_BOX.x + NUM_BOX.w / 2, NUM_BOX.y + 20); x.lineTo(NUM_BOX.x + NUM_BOX.w / 2, NUM_BOX.y + NUM_BOX.h - 20); x.stroke();
    x.fillStyle = "#2d3a33"; x.font = `34px ${SANS}`;
    x.fillText("번호", NUM_BOX.x, NUM_BOX.y - 18);
  }
  // 칸 머리말
  x.textAlign = "center"; x.fillStyle = "#4f5d55"; x.font = `27px ${SANS}`;
  LABELS.forEach((ls, i) => ls.forEach((l, k) => x.fillText(l, COLS[i], 620 + k * 34 + (ls.length === 1 ? 17 : 0))));
  x.textAlign = "left";
  for (let s = 0; s < 2; s++) {
    const d = (page - 1) * 2 + s;
    const dom = DOMAINS[d];
    const y0 = sectionY(s);
    x.fillStyle = `${dom.color}1f`; x.fillRect(TEXT_X - 20, y0 + 6, COLS[4] + BOX / 2 + 20 - (TEXT_X - 20), 64);
    x.fillStyle = dom.color; x.font = `44px ${DISPLAY}`;
    x.fillText(dom.name, TEXT_X, y0 + 54);
    for (let k = 0; k < 8; k++) {
      const i = d * 8 + k;
      const top = rowTop(s, k), cy = boxY(s, k);
      x.font = `37px ${SANS}`; x.fillStyle = "#1f2a24";
      const lines = wrap(x, `${i + 1}. ${SELF_ITEMS[i].ko}`, TEXT_W);
      const lh = 46;
      lines.slice(0, 3).forEach((l, j) => x.fillText(l, TEXT_X, cy - ((Math.min(lines.length, 3) - 1) * lh) / 2 + j * lh + 13));
      x.strokeStyle = "#333333"; x.lineWidth = 4;
      for (const cx of COLS) x.strokeRect(cx - BOX / 2, cy - BOX / 2, BOX, BOX);
      if (k < 7) { x.strokeStyle = "#e3ddd2"; x.lineWidth = 2; x.beginPath(); x.moveTo(TEXT_X - 20, top + 145); x.lineTo(COLS[4] + BOX / 2 + 10, top + 145); x.stroke(); }
    }
  }
  x.textAlign = "center"; x.fillStyle = "#8a948e"; x.font = `26px ${SANS}`;
  x.fillText("마음빛 길잡이 · 네 모서리의 검은 네모와 QR은 가리거나 접지 마세요", PAGE.w / 2, PAGE.h - 120);
  void PER_PAGE;
  return c;
}

export type Corner = "tr" | "tl" | "br" | "bl";
// 선생님이 올린 양식 한 쪽(그림)에 번호와 QR 찍기
export async function stampPage(src: HTMLCanvasElement, no: number, page: number, corner: Corner, big: boolean): Promise<HTMLCanvasElement> {
  await fontsReady();
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const x = c.getContext("2d")!;
  x.drawImage(src, 0, 0);
  const s = Math.round(Math.min(c.width, c.height) * (big ? 0.12 : 0.085)); // QR 한 변
  const m = Math.round(Math.min(c.width, c.height) * 0.03);
  const fs = Math.round(s * 0.42);
  x.font = `${fs}px ${DISPLAY}`;
  const label = `${no}번`;
  const tw = x.measureText(label).width;
  const bw = s + tw + m * 1.6, bh = s + m * 0.6;
  const bx = corner.endsWith("r") ? c.width - m - bw : m, by = corner.startsWith("b") ? c.height - m - bh : m;
  x.fillStyle = "#ffffff"; x.strokeStyle = "#cfd6d1"; x.lineWidth = Math.max(2, s / 60);
  x.beginPath(); x.roundRect(bx, by, bw, bh, m * 0.4); x.fill(); x.stroke();
  x.drawImage(await qrCanvas(qrText("F", no, page), s), bx + m * 0.3, by + m * 0.3, s, s);
  x.fillStyle = "#1f3a2c"; x.textBaseline = "middle";
  x.fillText(label, bx + s + m * 0.9, by + bh / 2);
  return c;
}

// 쪽 그림 여러 장 → PDF 한 파일(쪽 크기는 그림 비율 그대로, 긴 변 A4). make(i)가 쪽마다 그림을 만들고, JPEG로 바꾼 뒤 바로 버린다(메모리 아끼기)
export async function pdfOf(n: number, make: (i: number) => Promise<HTMLCanvasElement>, onPage?: (done: number) => void, quality = 0.82): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const kids = Array.from({ length: n }, (_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  for (let i = 0; i < n; i++) {
    const cv = await make(i);
    const jpeg = new Uint8Array(await (await new Promise<Blob>((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("쪽 그림을 만들지 못했어요."))), "image/jpeg", quality))).arrayBuffer());
    const portrait = cv.height >= cv.width;
    const w = portrait ? (A4.h * cv.width) / cv.height : A4.h, h = portrait ? A4.h : (A4.h * cv.height) / cv.width;
    const [pw, ph] = [w.toFixed(2), h.toFixed(2)];
    const p = 3 + i * 3;
    obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im${i} ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`));
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im${i} Do Q`;
    obj(p + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(p + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push("\nendstream");
    });
    cv.width = cv.height = 0; // 그림 메모리 돌려주기
    onPage?.(i + 1);
  }
  const xref = len;
  const total = 3 + n * 3;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

// 올린 파일(PDF·그림)을 한 쪽씩 그림으로(긴 변 longSide 픽셀) 만들어 each에 넘긴다 — 한꺼번에 들고 있지 않게
export async function eachPage(file: File, longSide: number, max: number, each: (c: HTMLCanvasElement, i: number, total: number) => Promise<void> | void): Promise<{ total: number; cut: boolean }> {
  if (file.type.startsWith("image/")) {
    const { pages } = await fileToCanvases(file, longSide);
    await each(pages[0], 1, 1);
    return { total: 1, cut: false };
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), cMapUrl: "/pdfjs-cmaps/", cMapPacked: true });
  const doc = await task.promise;
  const total = Math.min(doc.numPages, max);
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: longSide / Math.max(base.width, base.height) });
    const c = document.createElement("canvas");
    c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
    await page.render({ canvas: c, viewport }).promise;
    page.cleanup();
    await each(c, i, total);
  }
  const cut = doc.numPages > max;
  await task.destroy();
  return { total, cut };
}
// 올린 파일(PDF·그림) → 쪽 그림 모두(선생님 양식처럼 쪽이 적을 때). 긴 변 longSide 픽셀
export async function fileToCanvases(file: File, longSide: number, max = 80, onPage?: (done: number, total: number) => void): Promise<{ pages: HTMLCanvasElement[]; cut: boolean }> {
  if (file.type.startsWith("image/")) {
    const img = await createImageBitmap(file);
    const k = longSide / Math.max(img.width, img.height);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    onPage?.(1, 1);
    return { pages: [c], cut: false };
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), cMapUrl: "/pdfjs-cmaps/", cMapPacked: true });
  const doc = await task.promise;
  const total = Math.min(doc.numPages, max);
  const pages: HTMLCanvasElement[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: longSide / Math.max(base.width, base.height) });
    const c = document.createElement("canvas");
    c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
    await page.render({ canvas: c, viewport }).promise;
    pages.push(c);
    onPage?.(i, total);
  }
  const cut = doc.numPages > max;
  await task.destroy();
  return { pages, cut };
}

const grayOf = (c: HTMLCanvasElement): Gray => {
  const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  const g = new Uint8Array(c.width * c.height);
  for (let i = 0; i < g.length; i++) g[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  return { w: c.width, h: c.height, data: g };
};
const turn180 = (c: HTMLCanvasElement) => {
  const o = document.createElement("canvas");
  o.width = c.width; o.height = c.height;
  const x = o.getContext("2d")!;
  x.translate(c.width, c.height); x.rotate(Math.PI);
  x.drawImage(c, 0, 0);
  return o;
};
function findQr(c: HTMLCanvasElement) {
  const x = c.getContext("2d")!;
  const { data } = x.getImageData(0, 0, c.width, c.height);
  const hit = jsQR(data, c.width, c.height, { inversionAttempts: "dontInvert" });
  return hit ? { ...parseQr(hit.data), at: [(hit.location.topLeftCorner.x + hit.location.bottomRightCorner.x) / 2, (hit.location.topLeftCorner.y + hit.location.bottomRightCorner.y) / 2] as [number, number], raw: hit.data } : null;
}

export interface ScanPage {
  index: number; // 스캔 파일 속 쪽 차례(1부터)
  canvas: HTMLCanvasElement; // (거꾸로였으면 바로 세운) 쪽 그림
  kind: "S" | "F" | null; // 앱 검사지 · 선생님 양식 · QR 못 읽음
  no: number | null; // QR 번호(0 = 빈 검사지)
  page: number | null; // 검사지 쪽(1·2)
  marks: Mark[] | null; // 앱 검사지: 그 쪽 16문장
}
// 스캔한 쪽 하나 읽기: QR(번호·쪽) → 거꾸로면 돌리기 → 앱 검사지면 체크 칸 읽기
export function readScan(index: number, raw: HTMLCanvasElement): ScanPage {
  let canvas = raw;
  let q = findQr(canvas);
  if (q?.kind === "S" && q.at[1] > canvas.height / 2) { canvas = turn180(canvas); q = findQr(canvas); } // 위아래가 뒤집혀 들어왔다
  const kind = q?.kind ?? null;
  let marks: Mark[] | null = null;
  if (kind !== "F") {
    // 두 쪽 모두 칸 자리가 같아서 쪽을 몰라도 읽을 수 있다(QR을 못 읽은 쪽은 나중에 차례로 1·2쪽을 짐작한다)
    const g = grayOf(canvas);
    let r = readPage(g, 1);
    if (!r && !q) { r = readPage(rotate180(g), 1); if (r) canvas = turn180(canvas); }
    if (r) marks = r.marks;
  }
  return { index, canvas, kind, no: q?.no ?? null, page: q?.page ?? null, marks };
}
export const jpegOf = (c: HTMLCanvasElement, longSide = 1600, q = 0.8) => {
  const k = Math.min(1, longSide / Math.max(c.width, c.height));
  const o = document.createElement("canvas");
  o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
  o.getContext("2d")!.drawImage(c, 0, 0, o.width, o.height);
  return new Promise<Blob>((ok, no) => o.toBlob((b) => (b ? ok(b) : no(new Error("쪽 그림을 만들지 못했어요."))), "image/jpeg", q));
};
