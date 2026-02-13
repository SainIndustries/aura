"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, CheckCircle, Cloud, Server } from "lucide-react";

export function WaitlistForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    useCase: "",
    city: "",
    deploymentPreference: "undecided",
    company: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join waitlist");
      }

      setIsSuccess(true);
      toast.success("You're on the list! Check your email for confirmation.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-12 px-6 bg-aura-surface/50 rounded-2xl border border-aura-border">
        <CheckCircle className="w-16 h-16 text-aura-mint mx-auto mb-4" />
        <h3 className="text-2xl font-semibold mb-2">You&apos;re on the list!</h3>
        <p className="text-aura-text-dim">
          We&apos;ll be in touch soon with early access details.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          className="bg-aura-surface border-aura-border"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Company (optional)</Label>
        <Input
          id="company"
          type="text"
          placeholder="Your company name"
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          className="bg-aura-surface border-aura-border"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">City *</Label>
        <Input
          id="city"
          type="text"
          placeholder="San Francisco, CA"
          value={formData.city}
          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          required
          className="bg-aura-surface border-aura-border"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="useCase">What would you use Aura for? *</Label>
        <Textarea
          id="useCase"
          placeholder="I want to automate my email management, scheduling, and CRM updates..."
          value={formData.useCase}
          onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
          required
          rows={3}
          className="bg-aura-surface border-aura-border resize-none"
        />
      </div>

      <div className="space-y-3">
        <Label>How would you prefer to deploy Aura?</Label>
        <RadioGroup
          value={formData.deploymentPreference}
          onValueChange={(value) =>
            setFormData({ ...formData, deploymentPreference: value })
          }
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <label
            htmlFor="cloud"
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              formData.deploymentPreference === "cloud"
                ? "border-aura-accent bg-aura-accent/10"
                : "border-aura-border hover:border-aura-border-hover"
            }`}
          >
            <RadioGroupItem value="cloud" id="cloud" />
            <Cloud className="w-5 h-5 text-aura-accent" />
            <div>
              <div className="font-medium">Cloud (SaaS)</div>
              <div className="text-xs text-aura-text-dim">Hosted by us</div>
            </div>
          </label>

          <label
            htmlFor="local"
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              formData.deploymentPreference === "local"
                ? "border-aura-accent bg-aura-accent/10"
                : "border-aura-border hover:border-aura-border-hover"
            }`}
          >
            <RadioGroupItem value="local" id="local" />
            <Server className="w-5 h-5 text-aura-purple" />
            <div>
              <div className="font-medium">Local Setup</div>
              <div className="text-xs text-aura-text-dim">On your servers</div>
            </div>
          </label>

          <label
            htmlFor="undecided"
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              formData.deploymentPreference === "undecided"
                ? "border-aura-accent bg-aura-accent/10"
                : "border-aura-border hover:border-aura-border-hover"
            }`}
          >
            <RadioGroupItem value="undecided" id="undecided" />
            <div>
              <div className="font-medium">Not sure yet</div>
              <div className="text-xs text-aura-text-dim">Tell me more</div>
            </div>
          </label>
        </RadioGroup>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-aura-accent hover:bg-aura-accent-bright text-white py-6 text-lg font-medium"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Joining...
          </>
        ) : (
          "Join the Waitlist"
        )}
      </Button>

      <p className="text-center text-sm text-aura-text-ghost">
        We&apos;ll never spam you. Unsubscribe anytime.
      </p>
    </form>
  );
}
