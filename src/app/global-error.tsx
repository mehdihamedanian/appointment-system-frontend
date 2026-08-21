"use client";

import { Vazirmatn } from "next/font/google";
import { UnexpectedErrorState } from "@/components/feedback/app-states";
import { getDocumentLocale } from "@/config/locale";
import "@/app/globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-vazirmatn",
});

const locale = getDocumentLocale();

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang={locale.lang} dir={locale.dir} className={vazirmatn.variable}>
      <body className="app-root">
        <main id="main-content" className="public-main">
          <UnexpectedErrorState
            onRetry={reset}
            detail={error.digest ?? error.message}
          />
        </main>
      </body>
    </html>
  );
}
