const capabilitiesMap: Record<string, string> = {
  google: `**Google Workspace connected!** Here's what I can do now:

- **Gmail** — Read, search, and send emails on your behalf
- **Google Calendar** — View upcoming events, create meetings, and manage your schedule
- **Google Drive** — Find and access your files and documents
- **Google Contacts** — Look up contact information

Try asking me things like "What's on my calendar today?" or "Send an email to..."`,

  slack: `**Slack connected!** Here's what I can do now:

- **Send messages** to channels and teammates
- **Read channels** to stay up to date on conversations
- **Share files** and links in your workspace
- **Get notifications** about important updates

Try asking me things like "Post a standup update to #general" or "What's happening in #engineering?"`,

  elevenlabs: `**ElevenLabs connected!** Voice mode is now available.

- **Voice chat** — Click the phone icon to start a real-time voice conversation
- **Natural speech** — I'll respond with lifelike AI voice synthesis
- **Hands-free** — Talk to me naturally without typing

Click the phone icon in the header to start a voice chat.`,

  twilio: `**Twilio connected!** Here's what I can do now:

- **SMS** — Send and receive text messages
- **Voice calls** — Make and handle phone calls
- **Phone numbers** — Manage your Twilio phone numbers

Try asking me things like "Send a text to..." or "Check my recent call logs."`,

  hubspot: `**HubSpot connected!** Here's what I can do now:

- **Contacts** — Look up and manage contact records
- **Deals** — Track deals through your pipeline
- **Companies** — Access company information
- **Tasks** — Create and manage follow-up tasks

Try asking me things like "Show my open deals" or "Create a contact for..."`,

  salesforce: `**Salesforce connected!** Here's what I can do now:

- **Leads** — Manage and qualify leads
- **Opportunities** — Track deals and revenue
- **Accounts** — Access account details and history
- **Reports** — Pull data from your Salesforce reports

Try asking me things like "Show my pipeline" or "Update the status on..."`,

  "microsoft-365": `**Microsoft 365 connected!** Here's what I can do now:

- **Outlook** — Read and send emails
- **Calendar** — View and manage your schedule
- **OneDrive** — Access your files and documents
- **Contacts** — Look up people in your organization

Try asking me things like "What meetings do I have tomorrow?" or "Send an email to..."`,
};

export function getCapabilitiesMessage(providerId: string, providerName?: string): string {
  const message = capabilitiesMap[providerId];
  if (message) return message;

  const name = providerName ?? providerId;
  return `**${name} connected!** The integration is now active and ready to use. Ask me what I can do with ${name}.`;
}
