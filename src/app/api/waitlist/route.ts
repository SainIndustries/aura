import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail, emailTemplates } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    const { success } = await checkRateLimit(`waitlist:${ip}`);
    
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, useCase, city, deploymentPreference, company } = body;

    // Validate required fields
    if (!email || !useCase || !city) {
      return NextResponse.json(
        { error: "Email, use case, and city are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This email is already on the waitlist" },
        { status: 409 }
      );
    }

    // Insert into waitlist
    const [entry] = await db
      .insert(waitlist)
      .values({
        email: email.toLowerCase(),
        useCase,
        city,
        deploymentPreference: deploymentPreference || "undecided",
        company: company || null,
      })
      .returning();

    // Send confirmation email (non-blocking)
    sendEmail({
      to: email,
      subject: "You're on the Aura waitlist!",
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
            <h2>You're on the list!</h2>
            <p>Thanks for joining the Aura waitlist. We're building something special — an AI that actually runs with you.</p>
            <p>We'll reach out soon with:</p>
            <ul>
              <li>Early access to Aura</li>
              <li>Updates on our progress</li>
              ${deploymentPreference === "local" ? "<li>Information about local deployment options</li>" : ""}
            </ul>
            <p>In the meantime, feel free to reply to this email with any questions.</p>
            <p style="margin-top: 32px;">— The Aura Team</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} SAIN Industries, Inc. All rights reserved.
            </p>
          </body>
        </html>
      `,
      text: `You're on the Aura waitlist!\n\nThanks for joining. We'll reach out soon with early access and updates.\n\n— The Aura Team`,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Successfully joined the waitlist",
      id: entry.id,
    });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500 }
    );
  }
}

// GET endpoint to check waitlist stats (admin only - would need auth in production)
export async function GET(request: NextRequest) {
  try {
    const entries = await db.select().from(waitlist).orderBy(waitlist.createdAt);
    
    const stats = {
      total: entries.length,
      byPreference: {
        cloud: entries.filter(e => e.deploymentPreference === "cloud").length,
        local: entries.filter(e => e.deploymentPreference === "local").length,
        undecided: entries.filter(e => e.deploymentPreference === "undecided").length,
      },
      entries: entries.map(e => ({
        id: e.id,
        email: e.email,
        useCase: e.useCase,
        city: e.city,
        deploymentPreference: e.deploymentPreference,
        company: e.company,
        contacted: e.contacted,
        createdAt: e.createdAt,
      })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Waitlist fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch waitlist" },
      { status: 500 }
    );
  }
}
