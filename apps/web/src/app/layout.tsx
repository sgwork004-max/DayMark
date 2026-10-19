import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manager",
  description: "Markdown notes, tasks and calendar — all in one.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
