"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Meet" },
  { href: "/passport", label: "Passport" },
  { href: "/leaderboard", label: "Leaders" },
];

export function NavBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b-2 border-[var(--line)] bg-[#0b0b1acc] backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-black tracking-tight">
          🤝 Shake<span className="text-[var(--lime)]">Proof</span>
        </Link>
        <div className="flex gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                  active ? "bg-[var(--violet)] text-white" : "muted hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
