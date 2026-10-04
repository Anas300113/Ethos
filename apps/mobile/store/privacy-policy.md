# ETHOS — Privacy Policy

**Effective date:** 4 October 2026  
**Applies to:** the ETHOS mobile application (iOS, Android) and the API it talks to at `https://ethos-news.vercel.app`.

## Summary

ETHOS is a news reader. It has no accounts, no advertising, and no analytics.
The only data it stores is what you choose to save inside the app, under an
anonymous identifier that lives on your device.

## What ETHOS stores, and why

### 1. Anonymous reader identifier

When you first save a story or follow a desk, the app creates an anonymous
reader profile. The profile is a random identifier only — no name, no e-mail
address, no phone number, no location, no advertising ID, no social login.

The app holds this identifier as a signed token in your device's secure
keystore (iOS Keychain / Android Keystore). The server stores only the
identifier and the rows listed below.

**Why:** so your saved stories, desks and read receipts stay with you across
app launches without you having to create an account.

### 2. Saved stories

When you tap save on a story, ETHOS stores: the story identifier, the story
version that was saved, and the time it was saved.

**Why:** to show your saved list, and to tell you truthfully if a story has
been updated or corrected since you saved it.

### 3. Topic preferences (desks you follow)

When you follow a desk, ETHOS stores which desk you follow.

**Why:** ordering only. Followed desks move to the top of For You. Following
never removes a story, a source, or a dispute from your feed.

### 4. Reading events

When you open a story, ETHOS records that you read it — at most once per
hour per story. No dwell time, no scroll depth, no attention profile.

**Why:** staleness hints and recently-read ordering inside the app.

### 5. Network requests

The app makes requests to `https://ethos-news.vercel.app` to load stories,
search, and synchronise the four items above. Standard server logs
(IP address, time, path) are kept by the hosting provider for operational
security and debugging.

**Why:** operating and securing the service. ETHOS itself adds no tracking
pixels, no third-party analytics, and no advertising SDKs.

### 6. External source links

Stories link to the original reporting and primary documents on other
websites. Opening one leaves ETHOS; that site's own privacy policy then
applies. ETHOS does not receive money for these links and does not wrap them
in trackers.

## What ETHOS never collects

- Name, e-mail, phone number, address
- Location, camera, microphone, contacts, photos, Bluetooth
- Advertising identifiers or device fingerprints
- Payment information (the app is free)
- What you read beyond the local read receipts described above

## Data retention and deletion

Bookmarks, desk preferences and reading events live as long as your profile
exists. Tapping **Settings → Erase everything** deletes the profile on the
server; bookmarks, preferences and read receipts cascade with it, and the
token is removed from your device. There is no account to recover and no
backup copy on ETHOS's side.

Offline copies of stories cached on your device can be cleared separately
with **Settings → Clear offline copies**.

Server logs held by the hosting provider are retained for up to 30 days.

## Children

ETHOS is a general-audience news reader and does not knowingly collect data
from children.

## Changes

Material changes to this policy will be reflected in the app's next update
and the effective date above will change.

## Contact

Questions about privacy: see https://ethos-news.vercel.app/support
