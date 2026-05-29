import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaxaTech CTMS — Prototype",
  description:
    "HIPAA-compliant Clinical Trial Management System — prototype with mock data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrains.variable} h-full`}
      style={{
        // Wire the next/font CSS vars into our @theme tokens
        // so Tailwind's font-* classes pick them up automatically.
        ["--font-sans" as never]: "var(--font-inter), system-ui, sans-serif",
        ["--font-display" as never]: "var(--font-instrument-serif), Georgia, serif",
        ["--font-mono" as never]: "var(--font-jetbrains-mono), ui-monospace, monospace",
      }}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
