import { Navbar } from "@/components/marketing/navbar";
import { HeroSection } from "@/components/marketing/hero-section";
import { TerminalDemo } from "@/components/marketing/terminal-demo";
import { CapabilitiesSection } from "@/components/marketing/capabilities-section";
import { AudienceSection } from "@/components/marketing/audience-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { TrustSection } from "@/components/marketing/trust-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { Footer } from "@/components/marketing/footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <TerminalDemo />
      <CapabilitiesSection />
      <AudienceSection />
      <HowItWorksSection />
      <TrustSection />
      <CtaSection />
      <Footer />
    </>
  );
}
