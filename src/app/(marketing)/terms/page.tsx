import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — More Aura",
  description: "Terms of Service for More Aura - Your Executive AI Assistant",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: February 13, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using More Aura (&quot;Service&quot;), provided by SAIN Industries, Inc. 
              (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of Service 
              (&quot;Terms&quot;). If you do not agree to these Terms, you may not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              More Aura is an AI-powered executive assistant platform that helps users manage 
              communications, scheduling, research, and business operations through artificial 
              intelligence and integrations with third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To use certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and update your information to keep it accurate</li>
              <li>Maintain the security of your account credentials</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Subscription and Payment</h2>
            <h3 className="text-xl font-medium mb-3">4.1 Billing</h3>
            <p className="text-muted-foreground leading-relaxed">
              Some features require a paid subscription. By subscribing, you authorize us to charge 
              your payment method on a recurring basis. Subscription fees are billed in advance on 
              a monthly or annual basis.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6">4.2 Cancellation</h3>
            <p className="text-muted-foreground leading-relaxed">
              You may cancel your subscription at any time through your account settings. Cancellation 
              will take effect at the end of your current billing period. No refunds will be provided 
              for partial billing periods.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6">4.3 Price Changes</h3>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify our pricing. We will provide at least 30 days&apos; notice 
              before any price increase takes effect for existing subscribers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Send spam, phishing, or other unwanted communications</li>
              <li>Distribute malware or engage in hacking activities</li>
              <li>Attempt to gain unauthorized access to the Service or other systems</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Generate content that is harmful, abusive, or violates our content policies</li>
              <li>Circumvent any access or usage limitations</li>
              <li>Resell or redistribute the Service without authorization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our Service uses artificial intelligence to generate content and responses. You acknowledge that:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>AI-generated content may not always be accurate, complete, or appropriate</li>
              <li>You are responsible for reviewing and verifying AI-generated content before use</li>
              <li>AI outputs should not be considered professional advice (legal, medical, financial, etc.)</li>
              <li>We do not guarantee the accuracy or reliability of AI-generated content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Third-Party Integrations</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service allows you to connect third-party applications and services. Your use of 
              third-party integrations is subject to the terms and policies of those third parties. 
              We are not responsible for the content, accuracy, or practices of third-party services. 
              Connecting an integration authorizes us to access and use data from that service on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
            <h3 className="text-xl font-medium mb-3">8.1 Our Rights</h3>
            <p className="text-muted-foreground leading-relaxed">
              The Service and its original content, features, and functionality are owned by 
              SAIN Industries, Inc. and are protected by international copyright, trademark, 
              patent, trade secret, and other intellectual property laws.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6">8.2 Your Content</h3>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of content you create or upload to the Service. By using the 
              Service, you grant us a limited license to use, store, and process your content 
              solely to provide and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our Privacy Policy, which is incorporated 
              into these Terms by reference. Please review our Privacy Policy to understand our 
              data practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, 
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF 
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT 
              WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SAIN INDUSTRIES, INC. SHALL NOT BE LIABLE 
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY 
              LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS 
              OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless SAIN Industries, Inc. and its officers, 
              directors, employees, and agents from any claims, damages, losses, liabilities, 
              and expenses (including attorneys&apos; fees) arising out of your use of the Service 
              or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your account and access to the Service immediately, 
              without prior notice, for any reason, including breach of these Terms. Upon 
              termination, your right to use the Service will cease immediately. You may 
              terminate your account at any time by contacting us or through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will provide notice of 
              material changes by posting the updated Terms on the Service and updating the 
              &quot;Last updated&quot; date. Your continued use of the Service after changes constitutes 
              acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the 
              State of Delaware, without regard to its conflict of law provisions. Any disputes 
              arising from these Terms shall be resolved in the courts of Delaware.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">16. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms, please contact us at:
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
