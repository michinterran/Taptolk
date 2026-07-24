import { NextResponse } from "next/server";
import { OWNER_ACTIVATION_COPY } from "../../../../content/owner-activation-copy";
import { isAppLocale } from "../../../../i18n/locale";

export function GET(request: Request) {
  const localeValue = new URL(request.url).searchParams.get("locale");
  const locale = isAppLocale(localeValue) ? localeValue : "en";
  const copy = OWNER_ACTIVATION_COPY[locale];
  return NextResponse.json(
    {
      background_color: "#f7f4ed",
      description: copy.manifestDescription,
      display: "standalone",
      icons: [
        {
          purpose: "any",
          sizes: "192x192",
          src: "/brand/pwa/taptolk-owner-icon-192.png",
          type: "image/png",
        },
        {
          purpose: "any",
          sizes: "512x512",
          src: "/brand/pwa/taptolk-owner-icon-512.png",
          type: "image/png",
        },
        {
          purpose: "maskable",
          sizes: "512x512",
          src: "/brand/pwa/taptolk-owner-maskable-512.png",
          type: "image/png",
        },
      ],
      id: `/${locale}/owner`,
      lang: locale,
      name: copy.manifestName,
      scope: `/${locale}/`,
      short_name: "Taptolk",
      start_url: `/${locale}/owner`,
      theme_color: "#f7f4ed",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/manifest+json",
      },
    },
  );
}
