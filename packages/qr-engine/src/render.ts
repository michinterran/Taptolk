import { createHash } from "node:crypto";
import jsQrModule from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

export const STICKER_TEMPLATES = {
  ROUND_BLUE_HOLOGRAM_V1: {
    background: "#7CB7FF",
    heightMm: 85,
    shape: "CIRCLE",
    widthMm: 85,
  },
  ROUND_PURPLE_GRADIENT_V1: {
    background: "#8066FF",
    heightMm: 85,
    shape: "CIRCLE",
    widthMm: 85,
  },
  ROUND_WHITE_MINIMAL_V1: {
    background: "#FFFFFF",
    heightMm: 85,
    shape: "CIRCLE",
    widthMm: 85,
  },
  SQUARE_DARK_PREMIUM_V1: {
    background: "#111018",
    heightMm: 85,
    shape: "SQUARE",
    widthMm: 85,
  },
} as const;

export type StickerTemplateCode = keyof typeof STICKER_TEMPLATES;

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
<defs>${clip}</defs>
<g clip-path="url(#sticker-clip)">
<rect width="1000" height="1000" fill="${template.background}"/>
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
