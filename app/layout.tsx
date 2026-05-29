import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
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
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} h-full`}
      style={{
        ["--font-sans" as never]: "var(--font-inter), system-ui, sans-serif",
        ["--font-display" as never]: "var(--font-fraunces), Georgia, serif",
        ["--font-mono" as never]: "var(--font-jetbrains-mono), ui-monospace, monospace",
      }}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
