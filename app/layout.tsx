import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import ThemeProvider from "@/src/components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Receipt Splitter",
  description: "A modern receipt-style bill splitter",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
  className={`${inter.variable} ${mono.variable} min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}
>
  <ThemeProvider>{children}</ThemeProvider>
</body>

    </html>
  );
}
