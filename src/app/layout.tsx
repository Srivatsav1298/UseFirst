import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/i18n/provider";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker";

export const metadata: Metadata = {
  title: { default: "USE FIRST", template: "%s · USE FIRST" },
  description: "Free, privacy-first household food waste prevention. Scan groceries, use what you have, waste less.",
  manifest: "/manifest.webmanifest",
  applicationName: "USE FIRST",
  appleWebApp: { capable: true, title: "USE FIRST", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2e6645",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const locale = store.get("usefirst_locale")?.value === "nb" ? "nb" : "en";
  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>
          <ToastProvider>
            {children}
            <ServiceWorkerRegister />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
