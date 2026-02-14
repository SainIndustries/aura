# Aura OAuth Integration Setup

**Domain:** https://moreaura.ai  
**Generated:** 2025-01-27

---

## ✅ Completed

### INTEGRATION_ENCRYPTION_KEY
```
LoDlzO2yEd1W9UZ0gXX6CZYOGwnny8knGXABzHQUqfw=
```

---

## 🔧 Manual Setup Required

### 1. GitHub OAuth App

**URL:** https://github.com/organizations/SainIndustries/settings/applications/new

**Settings:**
| Field | Value |
|-------|-------|
| Application name | `Aura` |
| Homepage URL | `https://moreaura.ai` |
| Authorization callback URL | `https://moreaura.ai/api/integrations/github/callback` |

**Steps:**
1. Go to https://github.com/organizations/SainIndustries/settings/applications
2. Click "New OAuth App"
3. Fill in the settings above
4. Click "Register application"
5. Copy the **Client ID**
6. Click "Generate a new client secret"
7. Copy the **Client Secret** (only shown once!)

**Environment Variables:**
```
GITHUB_CLIENT_ID=<from step 5>
GITHUB_CLIENT_SECRET=<from step 7>
```

---

### 2. Google OAuth Credentials

**Project:** dora-personal-assistant (existing)  
**URL:** https://console.cloud.google.com/apis/credentials?project=dora-personal-assistant

**Steps:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Select **Web application**
4. Name: `Aura`
5. Add Authorized redirect URI:
   ```
   https://moreaura.ai/api/integrations/google/callback
   ```
6. Click "Create"
7. Copy Client ID and Client Secret

**Required APIs to Enable:**
- Google Calendar API
- Gmail API
- Google Drive API
- Google Docs API

**OAuth Scopes Needed:**
```
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/documents.readonly
```

**Environment Variables:**
```
GOOGLE_CLIENT_ID=<from step 7>
GOOGLE_CLIENT_SECRET=<from step 7>
```

---

### 3. Slack OAuth App

**URL:** https://api.slack.com/apps

**Steps:**
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. App Name: `Aura`
4. Select workspace: SAIN Industries
5. Go to **OAuth & Permissions**
6. Add Redirect URL:
   ```
   https://moreaura.ai/api/integrations/slack/callback
   ```
7. Under **Bot Token Scopes**, add:
   - `channels:read`
   - `chat:write`
   - `users:read`
8. Go to **Basic Information**
9. Copy Client ID and Client Secret

**Environment Variables:**
```
SLACK_CLIENT_ID=<from step 9>
SLACK_CLIENT_SECRET=<from step 9>
```

---

### 4. Notion OAuth Integration

**URL:** https://www.notion.so/my-integrations

**Steps:**
1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name: `Aura`
4. Select workspace
5. Go to **Capabilities** tab:
   - Read content ✓
   - Read comments ✓
   - No user info needed
6. Go to **Distribution** tab:
   - Enable "Public integration"
   - Add redirect URI:
     ```
     https://moreaura.ai/api/integrations/notion/callback
     ```
7. Submit for review (or use internal integration)
8. Copy OAuth Client ID and OAuth Client Secret

**Environment Variables:**
```
NOTION_CLIENT_ID=<from step 8>
NOTION_CLIENT_SECRET=<from step 8>
```

---

## 📋 All Vercel Environment Variables

Add these to Vercel project settings → Environment Variables:

```bash
# Encryption
INTEGRATION_ENCRYPTION_KEY=LoDlzO2yEd1W9UZ0gXX6CZYOGwnny8knGXABzHQUqfw=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Slack OAuth
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# Notion OAuth
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
```

---

## 🔗 Quick Links

- **GitHub OAuth Apps:** https://github.com/organizations/SainIndustries/settings/applications
- **Google Cloud Console:** https://console.cloud.google.com/apis/credentials?project=dora-personal-assistant
- **Slack Apps:** https://api.slack.com/apps
- **Notion Integrations:** https://www.notion.so/my-integrations
- **Vercel Project:** https://vercel.com/sain-industries/aura/settings/environment-variables

---

## ⚠️ Notes

1. **Google OAuth:** May need to configure OAuth consent screen if not already done. Set to "External" for public access or "Internal" for org-only.

2. **Slack:** The app needs to be installed to workspaces. Users will install via OAuth flow.

3. **Notion:** Public integrations require review. For internal use, can skip distribution setup.

4. **Security:** Never commit secrets to git. Use Vercel env vars only.
