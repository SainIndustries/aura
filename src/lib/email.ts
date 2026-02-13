import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "Aura <noreply@moreaura.ai>";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Email not configured: RESEND_API_KEY missing");
    return { success: false, error: "Email not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      replyTo,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Email send error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Pre-built email templates
export const emailTemplates = {
  welcome: (userName: string) => ({
    subject: "Welcome to More Aura",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #4f8fff; margin: 0;">More Aura</h1>
          </div>
          <h2>Welcome, ${userName}!</h2>
          <p>Thanks for joining More Aura. Your AI assistant is ready to help you run your business more efficiently.</p>
          <p>Here's what you can do next:</p>
          <ul>
            <li>Connect your integrations (calendar, email, CRM)</li>
            <li>Set up your first AI agent</li>
            <li>Explore templates for common workflows</li>
          </ul>
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://www.moreaura.ai/dashboard" style="background: #4f8fff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Go to Dashboard</a>
          </div>
          <p style="color: #666; font-size: 14px;">Questions? Reply to this email — we're here to help.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} SAIN Industries, Inc. All rights reserved.
          </p>
        </body>
      </html>
    `,
    text: `Welcome to More Aura, ${userName}!\n\nThanks for joining. Your AI assistant is ready to help you run your business more efficiently.\n\nGet started: https://www.moreaura.ai/dashboard`,
  }),

  teamInvite: (inviterName: string, teamName: string, inviteLink: string) => ({
    subject: `${inviterName} invited you to join ${teamName} on Aura`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #4f8fff; margin: 0;">More Aura</h1>
          </div>
          <h2>You're invited!</h2>
          <p><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on More Aura.</p>
          <p>More Aura is an AI-powered platform that helps teams manage communications, scheduling, and operations.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteLink}" style="background: #4f8fff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} SAIN Industries, Inc. All rights reserved.
          </p>
        </body>
      </html>
    `,
    text: `${inviterName} invited you to join ${teamName} on More Aura.\n\nAccept the invitation: ${inviteLink}\n\nThis invitation expires in 7 days.`,
  }),

  subscriptionConfirmation: (planName: string) => ({
    subject: "Your Aura subscription is active",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #4f8fff; margin: 0;">More Aura</h1>
          </div>
          <h2>Subscription Confirmed ✓</h2>
          <p>Your <strong>${planName}</strong> subscription is now active. You have full access to all features.</p>
          <p>Your subscription includes:</p>
          <ul>
            <li>Unlimited AI agent interactions</li>
            <li>All integrations</li>
            <li>Team collaboration features</li>
            <li>Priority support</li>
          </ul>
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://www.moreaura.ai/dashboard" style="background: #4f8fff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Go to Dashboard</a>
          </div>
          <p style="color: #666; font-size: 14px;">Manage your subscription anytime in Settings → Billing.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} SAIN Industries, Inc. All rights reserved.
          </p>
        </body>
      </html>
    `,
    text: `Your ${planName} subscription is now active!\n\nYou have full access to all More Aura features.\n\nGo to dashboard: https://www.moreaura.ai/dashboard`,
  }),
};
