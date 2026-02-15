import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — More Aura",
  description: "Security practices at More Aura - Your Executive AI Assistant",
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Security</h1>
        <p className="text-muted-foreground mb-8">Last updated: February 15, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              At More Aura, security is foundational to everything we build. We handle sensitive data
              including email content, calendar events, and documents on behalf of our users, and we
              take that responsibility seriously. This page outlines the measures we employ to protect
              your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Infrastructure</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Application hosted on <strong>Vercel</strong> with automatic TLS/SSL for all traffic.</li>
              <li>Database hosted on <strong>Neon</strong> (PostgreSQL) with encryption at rest and in transit.</li>
              <li>Agent compute runs on isolated virtual machines provisioned per-customer, terminated on stop.</li>
              <li>All internal service-to-service communication is encrypted via TLS.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Data Encryption</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>In transit:</strong> All data transmitted between your browser and our servers is encrypted using TLS 1.2+.</li>
              <li><strong>At rest:</strong> Database contents are encrypted at rest via the hosting provider&apos;s encryption.</li>
              <li><strong>OAuth tokens:</strong> All third-party OAuth tokens (Google, Slack, etc.) are encrypted with AES-256 before storage. Tokens are never stored in plaintext.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Authentication &amp; Access Control</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>User authentication powered by <strong>Privy</strong> with support for email, social login, and embedded wallets.</li>
              <li>All API endpoints verify user identity and ownership before returning data.</li>
              <li>Agent resources are scoped per-user — users can only access their own agents and data.</li>
              <li>Admin access to production systems requires multi-factor authentication.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Third-Party Integrations</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you connect third-party services like Google or Slack:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>We request only the minimum scopes needed to deliver the features you enable.</li>
              <li>OAuth tokens are encrypted at rest and refreshed automatically.</li>
              <li>You can revoke access at any time from your chat settings or directly from the provider (e.g., Google Account permissions).</li>
              <li>We adhere to the <strong>Google API Services User Data Policy</strong>, including the Limited Use requirements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Agent Isolation</h2>
            <p className="text-muted-foreground leading-relaxed">
              Each deployed AI agent runs on its own isolated virtual machine. Agent instances are
              provisioned on demand and fully terminated (including disk) when stopped. No agent
              instance shares resources with another customer&apos;s agent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Data Retention &amp; Deletion</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Chat conversations are processed in real-time and not stored beyond the session unless explicitly saved.</li>
              <li>Integration tokens are retained only while the integration is connected. Disconnecting removes stored tokens.</li>
              <li>Account deletion removes all associated data, including agent configurations, integration tokens, and billing records.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Incident Response</h2>
            <p className="text-muted-foreground leading-relaxed">
              In the event of a security incident, we will notify affected users within 72 hours,
              investigate the root cause, remediate the vulnerability, and publish a post-mortem
              where appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Responsible Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you discover a security vulnerability, please report it to{" "}
              <a
                href="mailto:business@sainindustries.com"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                business@sainindustries.com
              </a>
              . We appreciate responsible disclosure and will work with you to resolve issues promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For security questions or concerns, contact us at:
            </p>
            <div className="mt-4 text-muted-foreground">
              <p>SAIN Industries, Inc.</p>
              <p>Email: business@sainindustries.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
