# Setting up a WhatsApp number (Cloud API)

How to register a WhatsApp number with Meta's Cloud API, including the
workaround for the dashboard's "Registration failed" bug. This is how
Reload's number was connected on 6 Oct 2026.

> Never paste access tokens or PINs into chats, tickets or screenshots.
> If one leaks, generate a new one.

## Reload's current setup

| | |
|---|---|
| Number | +966 55 236 2631 |
| Display name | Reload |
| Phone Number ID | `1418354908018050` |
| WhatsApp Business account (WABA) ID | `2003054410376909` |
| Meta app | RELOAD (`4582556568654842`) |
| Status | Connected, Cloud API |

The two-step verification PIN is kept by the team owner, not in this repo.

## What you need

- **Phone Number ID** and **WABA ID**: Meta developers → your app →
  WhatsApp → API Setup.
- **Access token** with `whatsapp_business_management` and
  `whatsapp_business_messaging`.
- **The SIM in a phone**, for the SMS code.

The number must **not** be active in the WhatsApp or WhatsApp Business app on
any phone. Saudi numbers are often recycled, so check a "new" SIM too.

## Steps

### 1. Add the number in Meta

WhatsApp Manager → Phone numbers → **Add phone number**.

- Display name: normal capitalisation (not ALL CAPS), matching the website.
- Category and short description.
- Verify the SMS code.

If the dashboard then says **"Registration failed. Please try again"**, continue
below. It's a known dashboard bug at the final step.

### 2. Open Graph API Explorer

[developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)

1. Select the app.
2. Add both WhatsApp permissions.
3. **Generate Access Token**.

Explorer tokens last about an hour, so they're fine for setup only.

Use **JSON mode** for every POST body, not the key/value grid.

### 3. Check the number

`GET`

```
<PHONE_NUMBER_ID>?fields=display_phone_number,verified_name,code_verification_status,status
```

- `code_verification_status: VERIFIED` → go to step 5
- `NOT_VERIFIED` or `EXPIRED` → step 4

### 4. Verify the SMS code (only if needed)

`POST <PHONE_NUMBER_ID>/request_code`

```json
{ "code_method": "SMS", "language": "en" }
```

`POST <PHONE_NUMBER_ID>/verify_code`

```json
{ "code": "123456" }
```

### 5. Register the number

`POST <PHONE_NUMBER_ID>/register`

```json
{ "messaging_product": "whatsapp", "pin": "<6-digit PIN>" }
```

Expect `{"success": true}`. Save the PIN in a password manager: it's needed
whenever the number is registered again.

### 6. Connect the app to the WhatsApp account

`POST <WABA_ID>/subscribed_apps` (no body)

Incoming messages now reach the app's webhook.

### 7. Confirm

Repeat step 3. `status` should be **`CONNECTED`**.

## Common errors

| Error | Meaning | Fix |
|---|---|---|
| "Already registered on WhatsApp" | Number is active in the WhatsApp or Business app on a phone (or recycled) | In the app: Settings → Account → Delete my account. Wait 5 minutes, retry |
| "Registration failed. Please try again" | Dashboard bug | Use step 5 in Graph API Explorer, JSON mode |
| PIN mismatch on register | Two-step verification was set before | Use the old PIN, or turn it off in WhatsApp Manager → number → Two-step verification |
| Error 190 | Token expired or invalid | Generate a new token |
| Can only message a few people | New number or unverified business | Finish Business verification; limits grow with good usage |

## Before going live

1. **Permanent token:** Business Settings → System Users. Create one with both
   WhatsApp permissions; the token doesn't expire.
2. **Backend settings** (Supabase function secrets):
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_WABA_ID`
   - `WHATSAPP_DISPLAY_PHONE_NUMBER`
   - `WHATSAPP_ACCESS_TOKEN` (the permanent one)
   - `WHATSAPP_APP_SECRET`
3. **Webhook:** app → WhatsApp → Configuration. Callback URL is the
   `whatsapp-webhook` function, plus `WHATSAPP_VERIFY_TOKEN`.
4. **Payment method** in WhatsApp Manager, for business-initiated messages.
5. **Business verification** in Business Settings → Security Center.

## Sharing a number between the app and the API

Keeping one number in the WhatsApp Business app *and* on the Cloud API is
called **Coexistence**. It only works through Embedded Signup run by a Meta
Tech Provider or Solution Partner, not through "Add phone number". For
Reload's own number we use a dedicated number on the API only.
