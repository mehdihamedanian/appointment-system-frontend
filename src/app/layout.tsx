import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { SkipLink } from "@/components/layout/skip-link";
import { getDocumentLocale } from "@/config/locale";
import { env } from "@/config/env";
import { Providers } from "./providers";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-vazirmatn",
});

const locale = getDocumentLocale();

export const metadata: Metadata = {
  title: {
    default: env.appName,
    template: `%s | ${env.appName}`,
  },
  description: env.appTagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={locale.lang}
      dir={locale.dir}
      className={vazirmatn.variable}
    >
      <body className="app-root">
        <SkipLink />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
