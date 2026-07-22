import { createHash } from "node:crypto";
import jsQrModule from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

export const STICKER_TEMPLATES = {
  ROUND_BLUE_HOLOGRAM_V1: {
    background: "#2C7594",
    heightMm: 85,
    pattern: "HOLOGRAM",
    shape: "CIRCLE",
    widthMm: 85,
  },
  ROUND_PURPLE_GRADIENT_V1: {
    background: "#8066FF",
    heightMm: 85,
    pattern: "GRADIENT",
    shape: "CIRCLE",
    widthMm: 85,
  },
  ROUND_WHITE_MINIMAL_V1: {
    background: "#FFFFFF",
    heightMm: 85,
    pattern: "FLAT",
    shape: "CIRCLE",
    widthMm: 85,
  },
  SQUARE_DARK_PREMIUM_V1: {
    background: "#111018",
    heightMm: 85,
    pattern: "FLAT",
    shape: "SQUARE",
    widthMm: 85,
  },
} as const;

export type StickerTemplateCode = keyof typeof STICKER_TEMPLATES;
type StickerTemplate = (typeof STICKER_TEMPLATES)[StickerTemplateCode];

/**
 * Iridescent facets for the holographic sticker face.
 *
 * The facets sit outside the central QR panel, so they never reduce QR contrast.
 * The physical hologram/dome finish comes from the print material; this artwork
 * only approximates it so the operator preview matches the produced sticker.
 */
const HOLOGRAM_FACETS = [
  '<polygon points="0,140 250,0 320,210 70,330" fill="#BFF3E0" opacity="0.26"/>',
  '<polygon points="250,0 520,60 430,250 300,150" fill="#F3C9E6" opacity="0.20"/>',
  '<polygon points="640,0 1000,120 880,300 660,190" fill="#CFC9F7" opacity="0.24"/>',
  '<polygon points="1000,300 1000,620 830,520 870,330" fill="#A9E7F2" opacity="0.22"/>',
  '<polygon points="0,420 190,360 240,640 30,700" fill="#D8F5E8" opacity="0.18"/>',
  '<polygon points="60,760 300,700 380,940 140,1000" fill="#F6D2EA" opacity="0.20"/>',
  '<polygon points="600,900 860,760 1000,900 900,1000 650,1000" fill="#BFE3F8" opacity="0.22"/>',
  '<polygon points="380,60 620,20 560,180 420,200" fill="#FFFFFF" opacity="0.12"/>',
  '<polygon points="820,620 1000,700 940,880 800,780" fill="#E7D6FA" opacity="0.18"/>',
  '<polygon points="0,860 160,820 200,1000 40,1000" fill="#CFEFF5" opacity="0.16"/>',
  '<g stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="5" fill="none">',
  '<path d="M110 300 L340 120"/><path d="M150 350 L380 170"/><path d="M190 400 L420 220"/>',
  '<path d="M700 820 L900 660"/><path d="M740 870 L940 710"/>',
  "</g>",
].join("");

function backgroundDefs(pattern: StickerTemplate["pattern"]): string {
  if (pattern === "HOLOGRAM") {
    return [
      '<linearGradient id="holo-base" x1="0" y1="0" x2="1" y2="1">',
      '<stop offset="0%" stop-color="#4A9BB4"/><stop offset="45%" stop-color="#2C7594"/>',
      '<stop offset="100%" stop-color="#1B5673"/></linearGradient>',
      '<radialGradient id="holo-sheen" cx="35%" cy="28%" r="78%">',
      '<stop offset="0%" stop-color="#EAF9FF" stop-opacity="0.36"/>',
      '<stop offset="55%" stop-color="#BFE9F2" stop-opacity="0.12"/>',
      '<stop offset="100%" stop-color="#1B5673" stop-opacity="0"/></radialGradient>',
    ].join("");
  }
  if (pattern === "GRADIENT") {
    return [
      '<linearGradient id="grad-base" x1="0" y1="0" x2="1" y2="1">',
      '<stop offset="0%" stop-color="#9C86FF"/><stop offset="100%" stop-color="#5C42DA"/>',
      "</linearGradient>",
    ].join("");
  }
  return "";
}

function backgroundMarkup(template: StickerTemplate): string {
  if (template.pattern === "HOLOGRAM") {
    return [
      '<rect width="1000" height="1000" fill="url(#holo-base)"/>',
      HOLOGRAM_FACETS,
      '<rect width="1000" height="1000" fill="url(#holo-sheen)"/>',
    ].join("");
  }
  if (template.pattern === "GRADIENT") {
    return '<rect width="1000" height="1000" fill="url(#grad-base)"/>';
  }
  return `<rect width="1000" height="1000" fill="${template.background}"/>`;
}

export interface StickerRenderInput {
  customerLogoDataUri?: string;
  publicUrl: string;
  taptolkLogoDataUri: string;
  templateCode: StickerTemplateCode;
}

export interface StickerRenderResult {
  checksumSha256: string;
  decodedValue: string;
  png: Uint8Array;
  svg: string;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function assertDataImage(value: string): void {
  if (!/^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/=]+$/u.test(value)) {
    throw new Error("INVALID_LOGO_DATA_URI");
  }
}

export async function decodeQrFromImage(image: Uint8Array): Promise<string | null> {
  const raster = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const jsQR = jsQrModule as unknown as typeof import("jsqr").default;
  const decoded = jsQR(new Uint8ClampedArray(raster.data), raster.info.width, raster.info.height, {
    inversionAttempts: "dontInvert",
  });
  return decoded?.data ?? null;
}

export async function renderSticker(input: StickerRenderInput): Promise<StickerRenderResult> {
  const template = STICKER_TEMPLATES[input.templateCode];
  if (!template) {
    throw new Error("INVALID_TEMPLATE");
  }
  assertDataImage(input.taptolkLogoDataUri);
  if (input.customerLogoDataUri) {
    assertDataImage(input.customerLogoDataUri);
  }

  const qrSvg = await QRCode.toString(input.publicUrl, {
    color: { dark: "#111111", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
    margin: 4,
    type: "svg",
  });
  const qrDataUri = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;
  const customerLogo = input.customerLogoDataUri
    ? `<image href="${escapeAttribute(input.customerLogoDataUri)}" x="220" y="58" width="560" height="150" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const clip =
    template.shape === "CIRCLE"
      ? '<clipPath id="sticker-clip"><circle cx="500" cy="500" r="495"/></clipPath>'
      : '<clipPath id="sticker-clip"><rect x="5" y="5" width="990" height="990" rx="72"/></clipPath>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${template.widthMm}mm" height="${template.heightMm}mm" viewBox="0 0 1000 1000">
<defs>${clip}${backgroundDefs(template.pattern)}</defs>
<g clip-path="url(#sticker-clip)">
${backgroundMarkup(template)}
${customerLogo}
<rect x="230" y="245" width="540" height="540" rx="40" fill="#FFFFFF"/>
<image href="${qrDataUri}" x="270" y="285" width="460" height="460"/>
<image href="${escapeAttribute(input.taptolkLogoDataUri)}" x="300" y="840" width="400" height="90" preserveAspectRatio="xMidYMid meet"/>
</g>
</svg>`;
  const png = await sharp(Buffer.from(svg), { density: 300 }).png().toBuffer();
  const decodedValue = await decodeQrFromImage(png);
  if (decodedValue !== input.publicUrl) {
    throw new Error("QR_DECODE_MISMATCH");
  }
  return {
    checksumSha256: createHash("sha256").update(svg).digest("hex"),
    decodedValue,
    png,
    svg,
  };
}
