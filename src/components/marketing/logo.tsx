import Link from "next/link";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={`relative grid h-[34px] w-[34px] place-items-center overflow-hidden rounded-[9px] bg-gradient-to-br from-aura-accent to-aura-purple ${className ?? ""}`}
    >
      <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/15 to-transparent" />
      <svg
        className="relative z-[1] h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  );
}

export function LogoWordmark() {
  return (
    <span className="text-[17px] font-bold tracking-[-0.4px] text-aura-text-white">
      more<em className="not-italic text-aura-accent">aura</em>
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-[14px] no-underline">
      <LogoWordmark />
    </Link>
  );
}
