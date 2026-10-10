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
    <header className="nav-shell">
      <nav className="nav-inner" aria-label="Main navigation">
        <Link href="/" className="brand-link">
          <span className="brand-mark" aria-hidden="true">🤝</span>
          <span>Shake<span className="text-[var(--lime)]">Proof</span></span>
        </Link>
        <div className="nav-links">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
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
