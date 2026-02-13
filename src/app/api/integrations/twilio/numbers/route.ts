import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "twilio";

export interface TwilioPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

// GET /api/integrations/twilio/numbers - List phone numbers
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    if (!integration || !integration.accessToken) {
      return NextResponse.json(
        { error: "Twilio not connected. Please connect first." },
        { status: 400 }
      );
    }

    const metadata = integration.metadata as { accountSid: string };
    const accountSid = metadata.accountSid;
    const authToken = decryptToken(integration.accessToken);

    // Fetch phone numbers from Twilio API
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Invalid credentials. Please reconnect Twilio." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch phone numbers from Twilio" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const phoneNumbers: TwilioPhoneNumber[] = data.incoming_phone_numbers || [];

    return NextResponse.json({
      phoneNumbers: phoneNumbers.map((pn) => ({
        sid: pn.sid,
        phoneNumber: pn.phone_number,
        friendlyName: pn.friendly_name,
        capabilities: {
          voice: pn.capabilities?.voice ?? false,
          sms: pn.capabilities?.sms ?? false,
          mms: pn.capabilities?.mms ?? false,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching Twilio phone numbers:", error);
    return NextResponse.json(
      { error: "Failed to fetch phone numbers" },
      { status: 500 }
    );
  }
}
