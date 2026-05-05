/* eslint-disable react-hooks/set-state-in-effect */
/* src/components/ThemeToggle.tsx */

"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      aria-label="Toggle theme"
    >
      {isDark ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}