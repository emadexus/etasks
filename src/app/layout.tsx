import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { TelegramProvider } from "@/components/telegram-provider";
import { SWRProvider } from "@/components/swr-provider";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "etasks",
  description: "Task tracker for Telegram",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "production" && (
          <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        )}
      </head>
      <body>
        <div className="ambient-glow" />
        <SWRProvider>
          <TelegramProvider>
            <ToastProvider>{children}</ToastProvider>
          </TelegramProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
