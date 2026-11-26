import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion/MotionProvider";
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
  title: "MyPRD — dari ide jadi PRD siap eksekusi",
  description:
    "Platform untuk developer Indonesia: ubah ide jadi PRD + task breakdown siap dipakai AI coding agent (Claude Code, Cursor, OpenCode) dalam hitungan menit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col bg-[#060912] text-slate-100">
        <div aria-hidden className="bg-grid-pattern no-print pointer-events-none fixed inset-0 -z-10" />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
