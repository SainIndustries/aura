"use client";

import { Check } from "lucide-react";
import Link from "next/link";

const features = [
  "Unlimited AI agents",
  "All messaging channels (WhatsApp, Slack, Telegram, etc.)",
  "Voice calling integration",
  "Custom knowledge base",
  "Calendar & email integration",
  "24/7 agent availability",
  "Priority support",
  "SOC 2 ready infrastructure",
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-aura-deep">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-aura-mint/20 bg-aura-mint/10 px-4 py-1.5 text-sm font-medium text-aura-mint mb-6">
              <span className="h-2 w-2 rounded-full bg-aura-mint animate-pulse" />
              Limited Time Offer
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-aura-text-dim">
              Start free for 7 days. No credit card required to explore.
            </p>
          </div>

          <div className="bg-aura-surface p-8 md:p-12 rounded-2xl border border-aura-border shadow-xl">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-8">
              <div>
                <div className="text-sm font-medium text-aura-accent mb-2">Pro Plan</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl md:text-6xl font-bold text-aura-text-white">$199</span>
                  <span className="text-xl text-aura-text-dim">/month</span>
                </div>
                <p className="text-aura-text-dim mt-2">after 7-day free trial</p>
              </div>
              <Link
                href="/sign-in"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-aura-accent px-8 py-4 text-lg font-semibold text-white transition-all duration-250 hover:-translate-y-0.5 hover:bg-aura-accent-bright hover:shadow-[0_8px_36px_rgba(79,143,255,0.25)]"
              >
                Start Free Trial
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  <path
                    d="M3 8h10m0 0L9 4m4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>

            <div className="border-t border-aura-border pt-8">
              <h3 className="text-lg font-semibold text-aura-text-white mb-6">Everything you need:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-aura-mint/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-aura-mint" />
                    </div>
                    <span className="text-aura-text-light">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-aura-text-dim">
            <p>Cancel anytime. No questions asked.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
