import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vyuha / व्यूह — Agentic Sandbox",
  description: "Natural language-controlled multi-agent sandbox. Describe worlds in English, watch autonomous LLM agents think and act on a live 2D grid.",
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "Vyuha / व्यूह — Agentic Sandbox",
    description: "Natural language-controlled multi-agent sandbox. Game theory x LLM agents on a live 2D grid.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}
      >
        {children}
      </body>
    </html>
  );
}
