"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Moon, Sun } from "lucide-react";

export const EditorialHeader: React.FC = () => {
  // Lazy initializers run during render (client value on fresh mount,
  // server value reused across hydration) — no effect needed, no
  // hydration mismatch, no cascading renders.
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );

  const [currentDate] = useState(() =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date())
  );

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800/60 transition-colors">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-sm tracking-wider shadow-sm group-hover:scale-105 transition-transform">
              E
            </div>
            <div className="flex flex-col">
              <span className="font-editorial text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 leading-none">
                ETHOS
              </span>
              <span className="text-[10px] tracking-widest text-zinc-500 font-mono uppercase mt-0.5">
                Evidence First
              </span>
            </div>
          </Link>
        </div>

        <nav aria-label="Main" className="flex items-center gap-1">
          <Link
            href="/for-you"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            For you
          </Link>
          <Link
            href="/saved"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            Saved
          </Link>
          <Link
            href="/search"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            Search
          </Link>
          <button
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition-colors"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>
        </nav>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-medium border-t border-zinc-100 dark:border-zinc-900">
        <span>{currentDate}</span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          Every claim links to its source
        </span>
      </div>
    </header>
  );
};

