import QRCode from "qrcode";
import { MARK_PATHS, MARK_VIEWBOX } from "@/components/reload-logo";

/*
 * Reload event QR, drawn by hand from the raw QR matrix so it can carry the
 * brand: round data dots, softened finder eyes, and the symbol on an ink tile
 * in the centre. It stays scannable because:
 *   - error correction is "H" (any 30% of the code can be lost);
 *   - the logo clears under 8% of the modules;
 *   - dots are 88% of a module, so cameras still read a solid grid;
 *   - the quiet zone is the full 4 modules the spec asks for.
 * Colours are ink and off-white only (Brand System 3.0): no gradients, no
 * glow. Contrast is what makes a code scan on a cheap phone in a dim hall.
 */

/** The printed address. It forwards to the sign-up form (see next.config.ts),
 *  so the destination can change later without reprinting a single code. */
export const EVENT_QR_URL = "https://reload.sa/qr";

export const INK = "#0f0f12";
export const PAPER = "#f8f7f4";

export type QrTheme = "ink" | "inverted";

export type BrandQr = {
  /** Modules per side, quiet zone included. The SVG viewBox is size × size. */
  size: number;
  /** Data dots as [x, y] module centres, in drawing order from the centre out. */
  dots: Array<[number, number]>;
  /** `dots: false` draws only the eyes and symbol, for the animated preview
   *  that lays its own dots over the top. */
  svg: (theme: QrTheme, options?: { transparent?: boolean; dots?: boolean }) => string;
};

const QUIET = 4;
export const DOT_R = 0.44;
/** Side of the cleared centre, in modules. Odd, so it centres on a module. */
const LOGO_SPAN = 9;

export function createBrandQr(text = EVENT_QR_URL): BrandQr {
  // At least version 4 (33×33) rather than the minimum: finer dots read as a
  // texture and leave room for the symbol. Longer text (e.g. a store's return
  // link) needs a bigger version, so let the library grow it from there.
  const fitted = QRCode.create(text, { errorCorrectionLevel: "H" });
  const qr = fitted.version >= 4 ? fitted : QRCode.create(text, { errorCorrectionLevel: "H", version: 4 });
  const n = qr.modules.size;
  const size = n + QUIET * 2;
  const centre = (n - 1) / 2;
  const logoLo = centre - (LOGO_SPAN - 1) / 2;
  const logoHi = centre + (LOGO_SPAN - 1) / 2;

  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  const inLogo = (x: number, y: number) =>
    x >= logoLo && x <= logoHi && y >= logoLo && y <= logoHi;

  const dots: Array<[number, number]> = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(x, y) || inFinder(x, y) || inLogo(x, y)) continue;
      dots.push([x + QUIET + 0.5, y + QUIET + 0.5]);
    }
  }
  const mid = size / 2;
  dots.sort((a, b) => Math.hypot(a[0] - mid, a[1] - mid) - Math.hypot(b[0] - mid, b[1] - mid));

  const finders = [
    [QUIET, QUIET],
    [QUIET + n - 7, QUIET],
    [QUIET, QUIET + n - 7],
  ];

  const svg = (theme: QrTheme, { transparent = false, dots: withDots = true } = {}) => {
    const fg = theme === "ink" ? INK : PAPER;
    const bg = theme === "ink" ? PAPER : INK;
    const f = (v: number) => +v.toFixed(3);
    const dotsPath = dots
      .map(([x, y]) => `M${f(x - DOT_R)} ${f(y)}a${DOT_R} ${DOT_R} 0 1 0 ${f(DOT_R * 2)} 0a${DOT_R} ${DOT_R} 0 1 0 ${f(-DOT_R * 2)} 0`)
      .join("");
    // Finder eye: a 7×7 ring with soft corners and a rounded 3×3 pupil.
    const eyes = finders
      .map(([x, y]) => `<path fill-rule="evenodd" d="${roundRect(x, y, 7, 7, 2.1)}${roundRect(x + 1, y + 1, 5, 5, 1.35)}"/><path d="${roundRect(x + 2, y + 2, 3, 3, 0.95)}"/>`)
      .join("");
    // The symbol sits on a tile of the code's own colour, mark knocked out.
    const tile = LOGO_SPAN - 1.6;
    const tileAt = mid - tile / 2;
    const markSize = tile * 0.6;
    const markAt = mid - markSize / 2;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="geometricPrecision">`,
      transparent ? "" : `<rect width="${size}" height="${size}" rx="${f(size * 0.06)}" fill="${bg}"/>`,
      `<g fill="${fg}">${withDots ? `<path d="${dotsPath}"/>` : ""}${eyes}`,
      `<path d="${roundRect(tileAt, tileAt, tile, tile, 1.9)}"/></g>`,
      `<svg x="${f(markAt)}" y="${f(markAt)}" width="${f(markSize)}" height="${f(markSize)}" viewBox="${MARK_VIEWBOX}" fill="${bg}">`,
      `<path d="${MARK_PATHS[0]}"/><path d="${MARK_PATHS[1]}"/></svg>`,
      `</svg>`,
    ].join("");
  };

  return { size, dots, svg };
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
}
