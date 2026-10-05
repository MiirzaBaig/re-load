import {
  AR_LOCKUP_VIEWBOX,
  AR_MARK_PATHS,
  AR_WORD_PATHS,
  MARK_PATHS,
  MARK_VIEWBOX,
} from "@/components/reload-logo";
import { EVENT_QR_URL, INK, PAPER, type BrandQr } from "@/lib/brand-qr";

/*
 * Printable event poster, drawn on a canvas so it uses the site's own fonts
 * (an SVG file can't carry them to a print shop). A4 at 300 dpi; A5 has the
 * same proportions, so the same file prints sharp at either size.
 */

export const POSTER_WIDTH = 2480;
export const POSTER_HEIGHT = 3508;

export type PosterTheme = "light" | "dark";

const STONE = "#e7e9ef";

export async function renderEventPoster(qr: BrandQr, theme: PosterTheme): Promise<Blob> {
  const W = POSTER_WIDTH;
  const H = POSTER_HEIGHT;
  const u = W / 100;
  const m = 8 * u;
  const fg = theme === "light" ? INK : PAPER;
  const bg = theme === "light" ? PAPER : INK;
  const muted = theme === "light" ? "rgba(15,15,18,.56)" : "rgba(248,247,244,.6)";

  const fonts = await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg;

  // Lockups: English on the left, Arabic on the right, same height.
  const markH = 5.4 * u;
  drawPaths(ctx, MARK_VIEWBOX, MARK_PATHS.map((d) => ({ d, rule: "nonzero" as const })), m, m, markH);
  const wordSize = markH / 1.08 / 0.75;
  ctx.font = `600 ${wordSize}px ${fonts.sans}`;
  setSpacing(ctx, -0.02 * wordSize);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText("Reload", m + markH * 1.0252 + markH * 0.259, m + markH * 0.885);
  const [, , arW, arH] = AR_LOCKUP_VIEWBOX.split(" ").map(Number);
  const arHeight = markH * 1.12;
  drawPaths(ctx, AR_LOCKUP_VIEWBOX, [...AR_WORD_PATHS, ...AR_MARK_PATHS.map((d) => ({ d, rule: "nonzero" as const }))], W - m - (arHeight * arW) / arH, m - markH * 0.04, arHeight);

  // Headline: English left, Arabic right, on the same two lines.
  const headTop = 21 * u;
  const lineH = 10.6 * u;
  const columnW = 40 * u;
  ctx.textBaseline = "alphabetic";
  const enSize = fitSize(ctx, ["Returns,", "handled."], (s) => `600 ${s}px ${fonts.display}`, 10 * u, columnW, -0.035);
  ctx.font = `600 ${enSize}px ${fonts.display}`;
  setSpacing(ctx, -0.035 * enSize);
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText("Returns,", m, headTop + lineH * 0.8);
  ctx.fillText("handled.", m, headTop + lineH * 1.8);
  setSpacing(ctx, 0);
  const arSize = fitSize(ctx, ["المرتجعات", "علينا."], (s) => `700 ${s}px ${fonts.arabicDisplay}`, 10 * u, columnW, 0);
  ctx.font = `700 ${arSize}px ${fonts.arabicDisplay}`;
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText("المرتجعات", W - m, headTop + lineH * 0.8);
  ctx.fillText("علينا.", W - m, headTop + lineH * 1.8);

  // The code, on a card that is always light: printed codes scan best dark
  // on light, so the dark poster frames a light card rather than inverting.
  const card = 58 * u;
  const cardX = (W - card) / 2;
  const cardY = 47 * u;
  ctx.fillStyle = theme === "light" ? "#ffffff" : PAPER;
  roundRect(ctx, cardX, cardY, card, card, 3.2 * u);
  ctx.fill();
  if (theme === "light") {
    ctx.strokeStyle = STONE;
    ctx.lineWidth = 0.25 * u;
    ctx.stroke();
  }
  const code = await svgImage(qr.svg("ink", { transparent: true }));
  const pad = 1.2 * u;
  ctx.drawImage(code, cardX + pad, cardY + pad, card - pad * 2, card - pad * 2);

  // Call to action, both languages.
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.font = `600 ${4.2 * u}px ${fonts.sans}`;
  setSpacing(ctx, -0.01 * 4.2 * u);
  ctx.fillText("Scan to sign up", W / 2, cardY + card + 8.2 * u);
  setSpacing(ctx, 0);
  ctx.direction = "rtl";
  ctx.font = `600 ${4 * u}px ${fonts.arabic}`;
  ctx.fillText("امسح الرمز للتسجيل", W / 2, cardY + card + 14.2 * u);

  // Footer: the address for anyone who can't scan.
  const ruleY = H - m - 6 * u;
  ctx.fillStyle = theme === "light" ? STONE : "rgba(248,247,244,.16)";
  ctx.fillRect(m, ruleY, W - m * 2, Math.max(2, 0.12 * u));
  ctx.fillStyle = fg;
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.font = `600 ${2.6 * u}px ${fonts.sans}`;
  ctx.fillText(EVENT_QR_URL.replace(/^https:\/\//, ""), m, ruleY + 5 * u);
  ctx.fillStyle = muted;
  ctx.textAlign = "right";
  ctx.font = `500 ${2.3 * u}px ${fonts.sans}`;
  ctx.fillText("No commitment. Just a conversation.", W - m, ruleY + 5 * u);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export poster."))), "image/png"),
  );
}

/** Rasterise the QR alone as a PNG, for slides and social posts. */
export async function renderQrPng(svg: string, px = 2048): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.drawImage(await svgImage(svg), 0, 0, px, px);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export code."))), "image/png"),
  );
}

async function loadFonts() {
  const style = getComputedStyle(document.body);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const fonts = {
    sans: v("--font-manrope", "system-ui, sans-serif"),
    display: v("--font-sora", "system-ui, sans-serif"),
    arabic: v("--font-thmanyah-sans", "system-ui, sans-serif"),
    arabicDisplay: v("--font-thmanyah-display", "serif"),
  };
  // The Arabic faces aren't preloaded by the site; fetch them before drawing.
  await Promise.all([
    document.fonts.load(`600 100px ${fonts.sans}`, "Reload"),
    document.fonts.load(`500 100px ${fonts.sans}`, "Reload"),
    document.fonts.load(`600 100px ${fonts.display}`, "Returns"),
    document.fonts.load(`600 100px ${fonts.arabic}`, "امسح"),
    document.fonts.load(`700 100px ${fonts.arabicDisplay}`, "المرتجعات"),
  ]).catch(() => undefined);
  return fonts;
}

/** Largest size (up to `max`) at which every line fits `width`. */
function fitSize(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  font: (size: number) => string,
  max: number,
  width: number,
  tracking: number,
) {
  ctx.font = font(max);
  setSpacing(ctx, tracking * max);
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  setSpacing(ctx, 0);
  return widest > width ? max * (width / widest) : max;
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // Not in every browser yet; without it the type is simply set normally.
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function drawPaths(
  ctx: CanvasRenderingContext2D,
  viewBox: string,
  paths: ReadonlyArray<{ d: string; rule: "nonzero" | "evenodd" }>,
  x: number,
  y: number,
  height: number,
) {
  const [vx, vy, , vh] = viewBox.split(" ").map(Number);
  const scale = height / vh;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-vx, -vy);
  for (const p of paths) ctx.fill(new Path2D(p.d), p.rule);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function svgImage(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not draw the code."));
    };
    img.src = url;
  });
}
