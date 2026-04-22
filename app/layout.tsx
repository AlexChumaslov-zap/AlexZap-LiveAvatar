import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alex ZAP — ZAPTEST AI Avatar",
  description: "Interactive AI avatar for ZAPTEST.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-full w-full overflow-hidden bg-black">{children}</body>
    </html>
  );
}
