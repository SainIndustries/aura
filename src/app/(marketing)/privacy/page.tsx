import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — More Aura",
  description: "Privacy Policy for More Aura - Your Executive AI Assistant",
};

export const dynamic = "force-static";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fff", color: "#222" }}>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8" style={{ color: "#111" }}>Privacy Policy</h1>
        <p className="mb-8" style={{ color: "#666" }}>Last updated: February 13, 2026</p>

        <div className="max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>1. Introduction</h2>
            <p className="leading-relaxed" style={{ color: "#444" }}>
              SAIN Industries, Inc. (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your privacy and is
              committed to protecting it through our compliance with this policy. This Privacy Policy describes
              how we collect, use, disclose, and safeguard your information when you use our More Aura service
              (&quot;Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>2. Information We Collect</h2>
            <h3 className="text-xl font-medium mb-3" style={{ color: "#222" }}>2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2" style={{ color: "#444" }}>
              <li>Account information (name, email address, password)</li>
              <li>Profile information and preferences</li>
              <li>Payment and billing information</li>
              <li>Communications with our AI assistant</li>
              <li>Content you create, upload, or share through the Service</li>
              <li>Information from third-party integrations you connect</li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6" style={{ color: "#222" }}>2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-2" style={{ color: "#444" }}>
              <li>Device information (browser type, operating system)</li>
              <li>Log data (IP address, access times, pages viewed)</li>
              <li>Usage data (features used, actions taken)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2" style={{ color: "#444" }}>
              <li>Provide, maintain, and improve the Service</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Develop new features and services</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent or unauthorized activity</li>
              <li>Personalize and improve your experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>4. AI and Data Processing</h2>
            <p className="leading-relaxed" style={{ color: "#444" }}>
              Our Service uses artificial intelligence to process your requests and provide assistance.
              When you interact with our AI assistant:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4" style={{ color: "#444" }}>
              <li>Your conversations may be processed by AI models to generate responses</li>
              <li>We may use anonymized conversation data to improve our AI systems</li>
              <li>You can request deletion of your conversation history at any time</li>
              <li>Sensitive data from integrations is encrypted and handled according to industry standards</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>5. Third-Party Integrations</h2>
            <p className="leading-relaxed" style={{ color: "#444" }}>
              When you connect third-party services (such as Google, Slack, or Salesforce) to More Aura,
              we access only the data necessary to provide the features you request. Each integration
              operates under its own privacy policy, and we encourage you to review those policies.
              You can disconnect integrations at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>5a. Google API Services — Limited Use Disclosure</h2>
            <p className="leading-relaxed mb-4" style={{ color: "#444" }}>
              When you connect your Google account, More Aura requests access to the following Google
              API scopes:
            </p>
            <ul className="list-disc pl-6 space-y-2" style={{ color: "#444" }}>
              <li><strong>Gmail (read &amp; send):</strong> To read, summarize, and draft email responses on your behalf through your AI agent.</li>
              <li><strong>Google Calendar (read &amp; write):</strong> To view your schedule and create or modify events when you ask your AI agent to manage your calendar.</li>
              <li><strong>Google Drive (read-only):</strong> To search and retrieve documents you reference in conversations with your AI agent.</li>
              <li><strong>Google Docs (read-only):</strong> To read document contents when summarizing or answering questions about your files.</li>
              <li><strong>User profile (email &amp; profile):</strong> To identify your Google account and display your name and email within the Service.</li>
            </ul>
            <p className="leading-relaxed mt-4" style={{ color: "#444" }}>
              More Aura&apos;s use and transfer to any other app of information received from Google APIs
              will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1a73e8", textDecoration: "underline" }}
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="leading-relaxed mt-4" style={{ color: "#444" }}>
              Specifically:
            </p>
            <ul className="list-disc pl-6 space-y-2" style={{ color: "#444" }}>
              <li>We only use Google data to provide and improve the features you explicitly request.</li>
              <li>We do not use Google data for advertising, selling to third parties, or training general-purpose AI models.</li>
              <li>We do not allow humans to read your Google data except where necessary for security purposes, to comply with applicable law, or with your explicit consent.</li>
              <li>OAuth tokens are encrypted at rest. You can revoke access at any time by disconnecting Google in your chat settings or at{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1a73e8", textDecoration: "underline" }}
                >
                  myaccount.google.com/permissions
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>6. Data Sharing and Disclosure</h2>
            <p className="leading-relaxed mb-4" style={{ color: "#444" }}>
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2" style={{ color: "#444" }}>
              <li><strong>Service Providers:</strong> With vendors who assist in providing the Service</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>With Your Consent:</strong> When you have given us permission to share</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>7. Data Security</h2>
            <p className="leading-relaxed" style={{ color: "#444" }}>
              We implement appropriate technical and organizational measures to protect your personal
              information, including encryption in transit and at rest, regular security assessments,
              and access controls. However, no method of transmission over the Internet is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>8. Data Retention</h2>
            <p className="leading-relaxed" style={{ color: "#444" }}>
              We retain your personal information for as long as your account is active or as needed
              to provide you services. We will retain and use your information as necessary to comply
              with legal obligations, resolve disputes, and enforce our agreements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>9. Your Rights</h2>
            <p className="leading-relaxed mb-4" style={{ color: "#444" }}>
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc pl-6 space-y-2" style={{ color: "#444" }}>
              <li>Access and receive a copy of your personal data</li>
              <li>Rectify inaccurate personal data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="leading-relaxed mt-4" style={{ color: "#444" }}>
              To exercise these rights, please contact us at business@sainindustries.com.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>10. Children&apos;s Privacy</h2>
            <p className="leading-relaxed" style={{ color: "#444" }}>
              Our Service is not intended for children under 13 years of age. We do not knowingly
              collect personal information from children under 13. If you believe we have collected
              information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>11. Changes to This Policy</h2>
            <p className="leading-relaxed" style={{ color: "#444" }}>
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111" }}>12. Contact Us</h2>
            <p className="leading-relaxed" style={{ color: "#444" }}>
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <div className="mt-4" style={{ color: "#444" }}>
              <p>SAIN Industries, Inc.</p>
              <p>Email: business@sainindustries.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
