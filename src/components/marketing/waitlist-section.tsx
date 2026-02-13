"use client";

import { WaitlistForm } from "./waitlist-form";

export function WaitlistSection() {
  return (
    <section id="waitlist" className="py-24 bg-aura-deep">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Join the Waitlist
            </h2>
            <p className="text-xl text-aura-text-dim">
              Be among the first to experience Aura. Whether you want cloud-based 
              simplicity or a custom local deployment, we&apos;ve got you covered.
            </p>
          </div>

          <div className="bg-aura-surface p-8 rounded-2xl border border-aura-border shadow-xl">
            <WaitlistForm />
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
            <div className="p-6 bg-aura-surface/50 rounded-xl border border-aura-border">
              <div className="text-3xl font-bold text-aura-accent mb-2">Cloud</div>
              <p className="text-aura-text-dim">
                Get started in minutes. We handle the infrastructure, you handle 
                your business.
              </p>
            </div>
            <div className="p-6 bg-aura-surface/50 rounded-xl border border-aura-border">
              <div className="text-3xl font-bold text-aura-purple mb-2">Local</div>
              <p className="text-aura-text-dim">
                Full control on your servers. We&apos;ll set it up with you 
                in person or remotely.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
