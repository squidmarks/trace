# Landing Page & Access Request Setup

## Overview

The Trace application now includes a public landing page with an access request system. This document explains how to configure it.

## Features Added

1. **Public Landing Page** (`/`)
   - Beautiful, modern design explaining Trace
   - "Sign In" button in header for existing users
   - "Request Access" button for new users
   - Responsive design with gradient backgrounds

2. **Access Request System**
   - Dialog form for users to request access
   - Collects: name, email, message (optional)
   - Sends email notification to admin
   - Success confirmation

3. **Admin Bootstrap**
   - Automatically creates admin user on first app launch
   - Ensures admin has correct role permissions

## Environment Variables Required

Add these to your `apps/web/.env.local` file:

```bash
# Admin Configuration
ADMIN_EMAIL=your-admin-email@example.com

# Postmark Configuration (for sending access request emails)
POSTMARK_API_TOKEN=your-postmark-server-token
POSTMARK_FROM_EMAIL=noreply@yourdomain.com
```

## Postmark Setup

1. **Create a Postmark Account**:
   - Sign up at https://postmarkapp.com
   - Free tier includes 100 emails/month

2. **Get Your Server API Token**:
   - Log in to Postmark
   - Go to "Servers" → Select your server (or create one)
   - Go to "API Tokens" tab
   - Copy your "Server API token"

3. **Verify Your Sender Signature**:
   - Go to "Sender Signatures" in Postmark
   - Add and verify your email domain or individual email address
   - You'll receive a verification email - click the link

4. **Configure Environment Variables**:
   ```bash
   ADMIN_EMAIL=admin@yourdomain.com
   POSTMARK_API_TOKEN=your-server-api-token-here
   POSTMARK_FROM_EMAIL=noreply@yourdomain.com
   ```

**Note**: The `POSTMARK_FROM_EMAIL` must be a verified sender signature in your Postmark account.

## Admin User Bootstrap

On first authenticated user login, the system will:

1. Check if `ADMIN_EMAIL` is configured
2. Look for existing user with that email
3. If not found, create a new user with:
   - Email: Value from `ADMIN_EMAIL`
   - Name: "Admin User"
   - Role: "admin"
4. If found but role isn't admin, update role to admin

The bootstrap happens automatically when the first user signs in and visits the dashboard. It can also be triggered manually by calling `/api/bootstrap`.

**Note**: The admin user is created without a password initially. The admin should use the "Sign In" flow to authenticate via the configured auth provider (Google OAuth).

## Access Request Flow

1. **User visits `/`** (public landing page)
2. **Clicks "Request Access"**
3. **Fills out form** (name, email, optional message)
4. **Submits request**
5. **System sends email** to `ADMIN_EMAIL` with user details
6. **Admin reviews** request and can manually grant access
7. **User receives confirmation** that request was sent

## Email Template

The access request email includes:
- User's name and email
- Optional message from user
- Formatted HTML email with Trace branding
- Plain text fallback

## Testing

To test the setup:

1. **Configure environment variables** in `.env.local`
2. **Restart the application**
3. **Sign in** for the first time (this triggers admin user creation)
4. **Check console logs** for bootstrap confirmation:
   ```
   [Bootstrap] Initializing Trace application...
   [Bootstrap] Created admin user: admin@example.com
   [Bootstrap] Application initialized successfully
   ```
5. **Visit `http://localhost:3000/`** (logged out) to see landing page
6. **Click "Request Access"** and submit a test request
7. **Check admin email** for notification

Alternatively, you can manually trigger bootstrap by visiting `/api/bootstrap`.

## Troubleshooting

### Bootstrap Issues

If admin user isn't created:
- Check `ADMIN_EMAIL` is set in `.env.local`
- Check MongoDB connection is working
- Sign in and visit the dashboard (triggers bootstrap)
- Or manually visit `/api/bootstrap` to trigger it
- Check console logs for errors

### Email Not Sending

If emails aren't being sent:
- Verify `POSTMARK_API_TOKEN` is correct (check for typos)
- Ensure `POSTMARK_FROM_EMAIL` is a verified sender signature in Postmark
- Check you haven't exceeded your Postmark plan limits
- Check console logs for Postmark errors
- Verify your Postmark server is active (not paused)
- Test by sending a test email from the Postmark dashboard

### Landing Page Not Showing

If you see the dashboard instead of landing page:
- Clear browser cookies/session
- Open in incognito/private window
- Verify `apps/web/app/page.tsx` exists (public page)
- Check `apps/web/app/(dashboard)/page.tsx` is for authenticated users

## Files Created/Modified

- ✅ `apps/web/app/page.tsx` - Public landing page
- ✅ `apps/web/app/api/request-access/route.ts` - Access request API endpoint
- ✅ `apps/web/app/api/bootstrap/route.ts` - Bootstrap API endpoint
- ✅ `apps/web/lib/bootstrap.ts` - Admin bootstrap logic
- ✅ `apps/web/app/(dashboard)/page.tsx` - Calls bootstrap on first auth load

## Next Steps

After setup:

1. Configure your email provider
2. Set admin email
3. Restart the application
4. Test the access request flow
5. Monitor admin email for incoming requests
6. Build admin UI to approve/manage access requests (future enhancement)

