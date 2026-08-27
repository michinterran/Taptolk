import "@taptolk/ui/tokens.css";
import "../globals.css";

import { parseServerEnvironment } from "@taptolk/config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getMessages } from "../../content/messages";
import { type AppLocale, HTML_LANGUAGE_BY_LOCALE, SUPPORTED_LOCALES } from "../../i18n/config";
import { isAppLocale } from "../../i18n/locale";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    return {};
  }

  const copy = getMessages(locale);
  const environment = parseServerEnvironment();

  return {
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: "/en",
        ko: "/ko",
      },
    },
    description: copy["metadata.description"],
    icons: {
      apple: "/brand/pwa/taptolk-owner-icon-192.png",
      icon: "/brand/pwa/taptolk-owner-icon-192.png",
    },
    metadataBase: new URL(environment.APP_URL ?? "http://localhost:3000"),
    title: copy["metadata.title"],
  };
}

export default async function LocaleLayout({ children, params }: Readonly<LocaleLayoutProps>) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <html lang={HTML_LANGUAGE_BY_LOCALE[locale as AppLocale]}>
      <body>{children}</body>
    </html>
  );
}
