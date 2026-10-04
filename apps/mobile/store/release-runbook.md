# ETHOS — Release runbook (exact commands)

Order matters. Each step blocks the next.

## 0. Preconditions (one-time)

```bash
cd apps/mobile
npx eas login                 # interactive; Expo account required
npx eas init                  # creates/links project; writes projectId into app.json
npx eas credentials           # verify: iOS bundle com.ethos.news, Android package com.ethos.news
```

Backend must be live before any build QA pass:

```bash
# from repo root, with Vercel credentials available
npx vercel --prod             # or connect the GitHub repo in the Vercel dashboard
curl https://ethos-news.vercel.app/api/mobile/v1/meta   # must return JSON
```

## 1. Environment variables on the Vercel project

| Name | Value |
| --- | --- |
| `READER_TOKEN_SECRET` | random 32+ chars (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) |
| `PUBLIC_APP_URL` | `https://ethos-news.vercel.app` |
| `DATABASE_URL` | production Postgres (never committed) |

Production builds **fail closed** without `READER_TOKEN_SECRET`.

## 2. Builds

```bash
cd apps/mobile
npx eas build --platform ios --profile production        # archive → App Store / TestFlight
npx eas build --platform android --profile production    # AAB (release-signed by EAS)
```

- First Android upload: Play Console → Internal testing (automatic, do not
  promote to Production until QA passes).
- iOS: after build completes → TestFlight → submit for App Review.
- Never claim public release until Apple approves.

## 3. Deep links

### Android — custom scheme

Already shipped: `ethos://story/<slug>` (intent filter, no verification needed).

### Android — HTTPS app links (`autoVerify`)

Currently `autoVerify: false` on purpose. Enabling it **before** the server
serves verification data would make story links open in the browser instead
of the app. To enable:

1. Release-sign the Android build and read the certificate fingerprint:
   ```bash
   keytool -list -v -keystore release.keystore -alias upload | grep SHA256
   ```
2. Serve `/.well-known/assetlinks.json` from the site root (Next: place at
   `public/.well-known/assetlinks.json`):
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package": "com.ethos.news",
       "sha256_cert_fingerprints": ["<SHA256>"]
     }
   }]
   ```
3. Flip `autoVerify` to `true` on the HTTPS intent filter and rebuild.

### iOS — Universal Links

Requires the Apple Team ID (from the paid Apple Developer account):

1. Add to app.json: `"ios": { "entitlements": { "com.apple.developer.associated-domains": ["applinks:ethos-news.vercel.app"] } }`
2. Serve `/.well-known/apple-app-site-association`:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [{ "appID": "<TEAMID>.com.ethos.news", "paths": ["/story/*"] }]
     }
   }
   ```
3. Rebuild with a paid account (adhoc/development provisioning needed for
   associated domains on TestFlight too).

Until both are done the custom `ethos://` scheme is the supported path —
this is the documented limitation, not a broken release.

## 4. QA gate (before promoting anything)

- [ ] Real iPhone: launch, Today, story, evidence sheet, sources, search,
      For You, save/unsave, follow/unfollow, share, dark mode, airplane mode,
      deep link `ethos://story/uk-housing-package-4bn-affordable-homes`
- [ ] Real Android: same list
- [ ] Kill network → cached Today shows offline marker, never claims live;
      network returns → pull-to-refresh recovers
- [ ] Unknown slug → "This story is no longer published", no crash
- [ ] Long headline / long story / missing hero image render without overlap

## 5. Explicit non-goals (do not add)

Comments, subscriptions, ads, social, chatbot, notifications, accounts,
native AI, gamification.
