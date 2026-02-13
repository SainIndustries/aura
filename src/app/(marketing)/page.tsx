import { Navbar } from "@/components/marketing/navbar";
import { HeroSection } from "@/components/marketing/hero-section";
import { SlackDemo } from "@/components/marketing/slack-demo";
import { ProblemSection } from "@/components/marketing/problem-section";
import { SolutionSection } from "@/components/marketing/solution-section";
import { ComparisonSection } from "@/components/marketing/comparison-section";
import { CapabilitiesSection } from "@/components/marketing/capabilities-section";
import { SolutionsByTeamSection } from "@/components/marketing/solutions-by-team-section";
import { IntegrationsSection } from "@/components/marketing/integrations-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { TrustSection } from "@/components/marketing/trust-section";
import { WaitlistSection } from "@/components/marketing/waitlist-section";
import { Footer } from "@/components/marketing/footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <SlackDemo />
      <ProblemSection />
      <SolutionSection />
      <ComparisonSection />
      <CapabilitiesSection />
      <SolutionsByTeamSection />
      <IntegrationsSection />
      <HowItWorksSection />
      <TrustSection />
      <WaitlistSection />
      <Footer />
    </>
  );
}
