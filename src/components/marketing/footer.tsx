import Link from "next/link";
import { Logo } from "./logo";

const footerLinks = {
  product: {
    title: "Product",
    links: [
      { label: "Capabilities", href: "#what" },
      { label: "Integrations", href: "#integrations" },
      { label: "How It Works", href: "#how" },
      { label: "Security", href: "/security" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { label: "About SAIN", href: "https://sainindustries.com" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  legal: {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Security", href: "/security" },
    ],
  },
};

export function Footer() {
  return (
    <footer className="border-t border-aura-border">
      <div className="mx-auto max-w-[1160px] px-12 py-16 max-[960px]:px-6">
        {/* Top section */}
        <div className="mb-12 grid grid-cols-4 gap-8 max-[768px]:grid-cols-2 max-[480px]:grid-cols-1">
          {/* Brand column */}
          <div className="col-span-1">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-aura-text-dim">
              The AI that runs with you. Built for operators who ship.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-full border border-aura-border bg-aura-surface/50 px-3 py-1.5 w-fit">
              <span className="text-xs text-aura-text-ghost">Powered by</span>
              <span className="text-xs font-semibold text-aura-text-light">SAIN Industries</span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h4 className="mb-4 text-sm font-semibold text-aura-text-white">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-aura-text-dim transition-colors hover:text-aura-text-light"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mb-8 h-px bg-aura-border" />

        {/* Bottom section */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-4">
            <span className="text-sm text-aura-text-ghost">
              &copy; {new Date().getFullYear()} SAIN Industries LLC
            </span>
            <span className="text-aura-text-ghost">·</span>
            <span className="text-sm text-aura-text-ghost">All rights reserved</span>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com/sainindustries"
              className="text-aura-text-ghost transition-colors hover:text-aura-text-light"
              aria-label="Twitter"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/company/sainindustries"
              className="text-aura-text-ghost transition-colors hover:text-aura-text-light"
              aria-label="LinkedIn"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="https://github.com/sainindustries"
              className="text-aura-text-ghost transition-colors hover:text-aura-text-light"
              aria-label="GitHub"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
