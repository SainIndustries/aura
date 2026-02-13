"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { Logo } from "./logo";

const CAL_LINK =
  "https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true";

const navLinks = [
  { href: "#what", label: "Capabilities" },
  { href: "#who", label: "Who It's For" },
  { href: "#how", label: "How It Works" },
];

export function Navbar() {
  const { ready, authenticated } = usePrivy();

  return (
    <nav className="fixed inset-x-0 top-0 z-[1000] flex h-[72px] items-center justify-between border-b border-[rgba(255,255,255,0.05)] bg-[rgba(2,3,8,0.75)] px-12 backdrop-blur-[24px] backdrop-saturate-[1.4] max-[960px]:px-6">
      <Logo />
      <div className="flex items-center gap-8">
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="hidden text-[13.5px] font-medium tracking-[0.15px] text-aura-text-dim transition-colors hover:text-aura-text-light min-[961px]:block"
          >
            {link.label}
          </a>
        ))}
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
    </nav>
  );
}
