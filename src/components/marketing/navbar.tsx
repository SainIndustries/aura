"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { Logo } from "./logo";
import { useTheme } from "@/components/providers/theme-provider";
import { ChevronDown, Users, Briefcase, Code, Megaphone, HeadphonesIcon, Zap, Calendar, Mail, BarChart3, Bot } from "lucide-react";

type NavItem = {
  label: string;
  href?: string;
  highlight?: boolean;
  dropdown?: {
    sections: {
      title: string;
      items: {
        label: string;
        description: string;
        href: string;
        icon: React.ReactNode;
      }[];
    }[];
  };
};

const navItems: NavItem[] = [
  { href: "#demo", label: "Demo" },
  {
    label: "Solutions",
    dropdown: {
      sections: [
        {
          title: "By Team",
          items: [
            {
              label: "Operations",
              description: "Streamline workflows and processes",
              href: "#who",
              icon: <Briefcase className="w-5 h-5" />,
            },
            {
              label: "Engineering",
              description: "Automate DevOps and code reviews",
              href: "#who",
              icon: <Code className="w-5 h-5" />,
            },
            {
              label: "Sales",
              description: "Accelerate pipeline and outreach",
              href: "#who",
              icon: <BarChart3 className="w-5 h-5" />,
            },
            {
              label: "Marketing",
              description: "Scale content and campaigns",
              href: "#who",
              icon: <Megaphone className="w-5 h-5" />,
            },
            {
              label: "Support",
              description: "Resolve tickets faster",
              href: "#who",
              icon: <HeadphonesIcon className="w-5 h-5" />,
            },
          ],
        },
        {
          title: "By Use Case",
          items: [
            {
              label: "Email Management",
              description: "Triage, draft, and respond intelligently",
              href: "#what",
              icon: <Mail className="w-5 h-5" />,
            },
            {
              label: "Calendar & Scheduling",
              description: "Smart scheduling and prep",
              href: "#what",
              icon: <Calendar className="w-5 h-5" />,
            },
            {
              label: "Workflow Automation",
              description: "Connect tools and automate tasks",
              href: "#what",
              icon: <Zap className="w-5 h-5" />,
            },
            {
              label: "AI Agents",
              description: "Deploy custom AI agents",
              href: "#what",
              icon: <Bot className="w-5 h-5" />,
            },
          ],
        },
      ],
    },
  },
  { href: "#how", label: "How It Works" },
  { href: "/sign-in", label: "Start Free Trial", highlight: true },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-aura-border bg-aura-surface transition-all duration-200 hover:border-aura-border-hover hover:bg-aura-elevated"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
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

function NavDropdown({ item }: { item: NavItem }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!item.dropdown) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="hidden items-center gap-1 text-[13.5px] font-medium tracking-[0.15px] text-aura-text-dim transition-colors hover:text-aura-text-light min-[961px]:flex"
      >
        {item.label}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      <div
        className={`absolute left-1/2 top-full pt-4 -translate-x-1/2 transition-all duration-200 ${
          isOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"
        }`}
      >
        <div className="bg-aura-surface border border-aura-border rounded-xl shadow-2xl shadow-black/20 p-6 min-w-[520px]">
          <div className="grid grid-cols-2 gap-8">
            {item.dropdown.sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-aura-text-ghost mb-4">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((subItem) => (
                    <a
                      key={subItem.label}
                      href={subItem.href}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-aura-elevated transition-colors group"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-aura-accent/10 text-aura-accent flex items-center justify-center group-hover:bg-aura-accent group-hover:text-white transition-colors">
                        {subItem.icon}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-aura-text-white group-hover:text-aura-accent transition-colors">
                          {subItem.label}
                        </div>
                        <div className="text-xs text-aura-text-dim mt-0.5">
                          {subItem.description}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { ready, authenticated } = usePrivy();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] min-[961px]:hidden">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-[320px] bg-aura-surface border-l border-aura-border shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-aura-border">
          <span className="font-semibold text-aura-text-white">Menu</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-aura-elevated transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          {navItems.map((item) => (
            <div key={item.label}>
              {item.dropdown ? (
                <div>
                  <button
                    onClick={() => setExpandedItem(expandedItem === item.label ? null : item.label)}
                    className="flex items-center justify-between w-full py-3 px-2 text-base font-medium text-aura-text-light"
                  >
                    {item.label}
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedItem === item.label ? "rotate-180" : ""}`} />
                  </button>
                  {expandedItem === item.label && (
                    <div className="pl-4 pb-4 space-y-4">
                      {item.dropdown.sections.map((section) => (
                        <div key={section.title}>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-aura-text-ghost mb-2 px-2">
                            {section.title}
                          </h4>
                          {section.items.map((subItem) => (
                            <a
                              key={subItem.label}
                              href={subItem.href}
                              onClick={onClose}
                              className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-aura-elevated transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-aura-accent/10 text-aura-accent flex items-center justify-center">
                                {subItem.icon}
                              </div>
                              <span className="text-sm text-aura-text-light">{subItem.label}</span>
                            </a>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <a
                  href={item.href}
                  onClick={onClose}
                  className={`block py-3 px-2 text-base font-medium transition-colors ${
                    item.highlight
                      ? "text-aura-accent hover:text-aura-accent-bright"
                      : "text-aura-text-light hover:text-aura-accent"
                  }`}
                >
                  {item.label}
                </a>
              )}
            </div>
          ))}
          <div className="pt-4 mt-4 border-t border-aura-border">
            {ready && authenticated ? (
              <Link
                href="/dashboard"
                onClick={onClose}
                className="block w-full text-center rounded-lg bg-aura-accent px-6 py-3 font-semibold text-white hover:bg-aura-accent-bright transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/sign-in"
                onClick={onClose}
                className="block w-full text-center rounded-lg bg-aura-accent px-6 py-3 font-semibold text-white hover:bg-aura-accent-bright transition-colors"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { ready, authenticated } = usePrivy();

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-[1000] flex h-[72px] items-center justify-between border-b border-aura-border bg-aura-void/75 px-4 backdrop-blur-[24px] backdrop-saturate-[1.4] sm:px-6 lg:px-12">
        <div className="flex items-center gap-4 lg:gap-6">
          <Logo />
          <div className="hidden items-center gap-1.5 rounded-full border border-aura-border bg-aura-surface/50 px-3 py-1 text-[10px] font-medium text-aura-text-dim md:flex">
            <span>Powered by</span>
            <span className="font-bold text-aura-text-light">SAIN Industries</span>
          </div>
        </div>
        <div className="flex items-center gap-3 lg:gap-6">
          {navItems.map((item) =>
            item.dropdown ? (
              <NavDropdown key={item.label} item={item} />
            ) : (
              <a
                key={item.label}
                href={item.href}
                className={`hidden text-[13.5px] font-medium tracking-[0.15px] transition-colors min-[961px]:block ${
                  item.highlight
                    ? "text-aura-accent hover:text-aura-accent-bright"
                    : "text-aura-text-dim hover:text-aura-text-light"
                }`}
              >
                {item.label}
              </a>
            )
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="hidden min-[961px]:block">
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
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-aura-border bg-aura-surface transition-all hover:border-aura-border-hover hover:bg-aura-elevated min-[961px]:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
