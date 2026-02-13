"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { Logo } from "./logo";
import { useTheme } from "@/components/providers/theme-provider";

const navLinks = [
  { href: "#demo", label: "Demo" },
  { href: "#what", label: "Capabilities" },
  { href: "#who", label: "Solutions" },
  { href: "#how", label: "How It Works" },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-aura-border bg-aura-surface transition-all duration-200 hover:border-aura-border-hover hover:bg-aura-elevated"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {/* Sun icon */}
      <svg
        className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
          theme === "light"
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0"
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      {/* Moon icon */}
      <svg
        className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
          theme === "dark"
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}

export function Navbar() {
  const { ready, authenticated } = usePrivy();

  return (
    <nav className="fixed inset-x-0 top-0 z-[1000] flex h-[72px] items-center justify-between border-b border-aura-border bg-aura-void/75 px-12 backdrop-blur-[24px] backdrop-saturate-[1.4] max-[960px]:px-6">
      <div className="flex items-center gap-6">
        <Logo />
        {/* Powered by SAIN badge */}
        <div className="hidden items-center gap-1.5 rounded-full border border-aura-border bg-aura-surface/50 px-3 py-1 text-[10px] font-medium text-aura-text-dim min-[768px]:flex">
          <span>Powered by</span>
          <span className="font-bold text-aura-text-light">SAIN Industries</span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="hidden text-[13.5px] font-medium tracking-[0.15px] text-aura-text-dim transition-colors hover:text-aura-text-light min-[961px]:block"
          >
            {link.label}
          </a>
        ))}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {ready && authenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex rounded-lg bg-aura-accent px-[22px] py-[9px] text-[13.5px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-aura-accent-bright hover:shadow-[0_4px_24px_rgba(79,143,255,0.25)]"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex rounded-lg bg-aura-accent px-[22px] py-[9px] text-[13.5px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-aura-accent-bright hover:shadow-[0_4px_24px_rgba(79,143,255,0.25)]"
            >
              Get Started
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
