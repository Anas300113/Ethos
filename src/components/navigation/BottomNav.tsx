"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Sparkles, Search, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    name: "Today",
    href: "/",
    icon: Newspaper,
  },
  {
    name: "For You",
    href: "/for-you",
    icon: Sparkles,
  },
  {
    name: "Search",
    href: "/search",
    icon: Search,
  },
  {
    name: "Saved",
    href: "/saved",
    icon: Bookmark,
  },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800/80 pb-safe">
      <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all py-1 px-3 rounded-lg text-xs font-medium",
                isActive
                  ? "text-zinc-950 dark:text-white font-semibold"
                  : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform duration-150",
                  isActive ? "scale-110 stroke-[2.25]" : "stroke-[1.75]"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
