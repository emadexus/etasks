import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "etasks",
  description: "Task tracker for Telegram",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
