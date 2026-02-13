export function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1160px] items-center justify-between border-t border-[rgba(255,255,255,0.05)] px-12 py-10 max-[960px]:flex-col max-[960px]:gap-5 max-[960px]:px-6 max-[960px]:text-center">
      <div className="text-[13.5px] text-aura-text-dim">
        <strong>Aura</strong> is built by{" "}
        <a
          href="https://sainindustries.com"
          className="font-medium text-aura-text-light no-underline transition-colors hover:text-aura-accent"
        >
          SAIN Industries
        </a>
      </div>
      <div className="flex items-center gap-6 max-[960px]:flex-col max-[960px]:gap-3">
        <a
          href="#"
          className="text-[12.5px] text-aura-text-ghost no-underline transition-colors hover:text-aura-text-dim"
        >
          Privacy
        </a>
        <a
          href="#"
          className="text-[12.5px] text-aura-text-ghost no-underline transition-colors hover:text-aura-text-dim"
        >
          Terms
        </a>
        <a
          href="https://sainindustries.com"
          className="text-[12.5px] text-aura-text-ghost no-underline transition-colors hover:text-aura-text-dim"
        >
          sainindustries.com
        </a>
        <span className="text-[11.5px] text-aura-text-ghost">
          &copy; 2026 SAIN Industries LLC
        </span>
      </div>
    </footer>
  );
}
