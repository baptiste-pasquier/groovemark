# Authentication Setup Guide <!-- omit from toc -->

GrooveMark supports two authentication modes:

1. **Google SSO** - Sign in with Google to sync favorites across devices
2. **Local Mode** - Continue without authentication, data stored locally in browser

## Table of Contents <!-- omit from toc -->

- [Local Mode Setup](#local-mode-setup)
- [Google SSO Setup](#google-sso-setup)
  - [Prerequisites](#prerequisites)
  - [Step 1: Create Google OAuth Credentials](#step-1-create-google-oauth-credentials)
  - [Step 2: Configure PocketBase](#step-2-configure-pocketbase)
  - [Step 3: Update Environment Variables](#step-3-update-environment-variables)
  - [Step 4: Test the Integration](#step-4-test-the-integration)
- [Troubleshooting](#troubleshooting)
  - [Error: "Google OAuth provider not configured in PocketBase"](#error-google-oauth-provider-not-configured-in-pocketbase)
  - [Error: "redirect_uri_mismatch"](#error-redirect_uri_mismatch)
  - [OAuth Popup Blocked](#oauth-popup-blocked)
  - [Can't Access PocketBase from the App](#cant-access-pocketbase-from-the-app)
  - [Favorites Not Syncing After Login](#favorites-not-syncing-after-login)
  - [Data Lost When Switching Between Modes](#data-lost-when-switching-between-modes)
- [Security Best Practices](#security-best-practices)
- [Additional Resources](#additional-resources)

## Local Mode Setup

Local mode requires no additional setup. Users can simply click "Continue in Local Mode" on the login page, and all data will be stored in the browser's localStorage.

**Limitations of Local Mode:**

- Data is only available on the device/browser where it was created
- No cloud sync across devices
- Data may be lost if browser data is cleared
- No user account or authentication

## Google SSO Setup

### Prerequisites

Before setting up Google SSO, you need:

- A running PocketBase instance (see main [README.md](../README.md))
- A Google Cloud Platform account
- Access to the Google Cloud Console

### Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Navigate to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Create OAuth 2.0 Credentials**
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - If prompted, configure the OAuth consent screen first:
     - User Type: Select "External" for public access
     - App name: "GrooveMark" (or your preferred name)
     - User support email: Your email
     - Developer contact email: Your email
     - Add scopes: `email`, `profile`, `openid` (basic profile info)
     - Add test users if in development mode

3. **Configure OAuth Client**
   - Application type: **Web application**
   - Name: "GrooveMark Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:8090` (for local development)
     - Your production PocketBase URL (e.g., `https://api.yourdomain.com`)
   - Authorized redirect URIs:
     - `http://localhost:8090/api/oauth2-redirect` (for local development)
     - `https://api.yourdomain.com/api/oauth2-redirect` (for production)
   - Click **Create**

4. **Save Your Credentials**
   - Copy the **Client ID**
   - Copy the **Client Secret**
   - Keep these secure - you'll need them in the next step

### Step 2: Configure PocketBase

1. **Start PocketBase**

   ```bash
   ./pocketbase serve
   ```

2. **Access PocketBase Admin UI**
   - Open your browser and go to `http://localhost:8090/_/`
   - Create an admin account if you haven't already

3. **Enable Google OAuth Provider**
   - In the admin UI, go to **Settings** (gear icon in left sidebar)
   - Click on **Auth providers** tab
   - Find **Google** in the list of providers
   - Click to expand the Google provider settings
   - Toggle **Enabled** to ON
   - Enter your **Client ID** from Step 1
   - Enter your **Client Secret** from Step 1
   - Click **Save changes**

4. **Configure the Users Collection**
   - The `users` collection is automatically created by PocketBase
   - Ensure OAuth authentication is enabled (should be by default)
   - You can customize user fields if needed, but the defaults work fine

5. **Update Favorites Collection Rules**

   Since we now have authentication, update the `favorites` collection API Rules to tie records to users:

   **Option 1: User-specific favorites (Recommended)**

   First, add an `owner` field to the `favorites` collection:
   - Type: Relation
   - Collection: users
   - Required: Yes

   Then update the API Rules:
   - **List/Search Rule**: `@request.auth.id != "" && owner = @request.auth.id`
   - **View Rule**: `@request.auth.id != "" && owner = @request.auth.id`
   - **Create Rule**: `@request.auth.id != ""`
   - **Update Rule**: `@request.auth.id != "" && owner = @request.auth.id`
   - **Delete Rule**: `@request.auth.id != "" && owner = @request.auth.id`

   **Option 2: Shared favorites (Development only)**

   Keep the current rules that just check authentication:
   - **List/Search Rule**: `@request.auth.id != ""`
   - **View Rule**: `@request.auth.id != ""`
   - **Create Rule**: `@request.auth.id != ""`
   - **Update Rule**: `@request.auth.id != ""`
   - **Delete Rule**: `@request.auth.id != ""`

### Step 3: Update Environment Variables

No environment variables are needed for the OAuth setup itself. The PocketBase URL is configured at build time via `VITE_POCKETBASE_URL`.

For production deployments, ensure:

```bash
VITE_POCKETBASE_URL=https://api.yourdomain.com
```

Then rebuild the application:

```bash
npm run build
```

### Step 4: Test the Integration

1. **Start the Application**

   ```bash
   npm run dev
   ```

2. **Open the App**
   - Navigate to `http://localhost:5173` (or your configured port)
   - You should see the login page

3. **Test Google Sign In**
   - Click "Sign in with Google"
   - You should be redirected to Google's OAuth consent screen
   - Sign in with your Google account
   - Grant the requested permissions
   - You should be redirected back to the app and logged in

4. **Test Local Mode**
   - If Google sign-in isn't working yet, click "Continue in Local Mode"
   - The app should work normally with localStorage

5. **Test Logout**
   - Click the "Logout" button in the top right
   - You should be returned to the login page
   - Auth state should be cleared

## Troubleshooting

### Error: "Google OAuth provider not configured in PocketBase"

**Solution**: Ensure you've enabled the Google provider in PocketBase admin settings and saved the Client ID and Secret.

### Error: "redirect_uri_mismatch"

**Solution**:

- Check that your redirect URI in Google Cloud Console matches exactly
- For local development: `http://localhost:8090/api/oauth2-redirect`
- For production: `https://your-domain.com/api/oauth2-redirect`
- Make sure there are no trailing slashes or typos

### OAuth Popup Blocked

**Solution**: Some browsers block OAuth popups. Make sure to allow popups for your application domain, or configure PocketBase to use redirect flow instead of popup.

### Can't Access PocketBase from the App

**Solution**:

- Verify PocketBase is running: `http://localhost:8090/_/`
- Check CORS settings in PocketBase if you get CORS errors
- Ensure `VITE_POCKETBASE_URL` environment variable is set correctly
- Remember to rebuild after changing environment variables

### Favorites Not Syncing After Login

**Solution**:

- Check that the `favorites` collection API rules allow authenticated users
- Verify user is actually authenticated by checking `pb.authStore.isValid`
- Check browser console for any error messages
- Ensure the favorites collection exists in PocketBase

### Data Lost When Switching Between Modes

**Solution**:

- Local mode data stays in localStorage
- Google mode data stays in PocketBase
- These are separate storage locations by design
- To migrate data, export from one mode and import in the other

## Security Best Practices

1. **Never commit OAuth secrets** - Keep Client ID and Secret secure
2. **Use HTTPS in production** - Always use HTTPS for production deployments
3. **Limit OAuth scopes** - Only request the minimum scopes needed (email, profile)
4. **Implement user-specific records** - Use the owner field pattern to isolate user data
5. **Regular security updates** - Keep PocketBase and dependencies updated
6. **Enable CORS properly** - Only allow your application domain
7. **Use environment variables** - Never hardcode credentials in source code

## Additional Resources

- [PocketBase OAuth2 Documentation](https://pocketbase.io/docs/authentication/#oauth2-integration)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [PocketBase API Rules Guide](https://pocketbase.io/docs/api-rules/)
