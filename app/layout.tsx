import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mercury",
  description: "AI research pilot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[#1a1a1a] antialiased">{children}</body>
    </html>
  );
}
