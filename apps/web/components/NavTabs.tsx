"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/listings", label: "Explorar" },
  { href: "/sell", label: "Publicar" },
  { href: "/wallet", label: "Wallet" },
] as const;

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
