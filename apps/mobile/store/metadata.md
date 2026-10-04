---
# ETHOS — App Store / Play Store metadata (source of truth)

Copy verbatim into App Store Connect and Google Play Console.
Last reviewed: 2026-10-04.

## Identity

| Field | Value |
| --- | --- |
| App name | ETHOS |
| iOS subtitle | Evidence-first news |
| Android short description | Understand the story. See the evidence. |
| Bundle ID (iOS) | com.ethos.news |
| Package (Android) | com.ethos.news |
| Version | 1.0.0 (buildNumber 1 / versionCode 1) |
| Category | News (primary), Education (secondary, optional) |
| URLs | https://ethos-news.vercel.app |

## Short description (Play, ≤80 chars)

```
Understand the story. See the evidence.
```

## Full description (both stores)

```
ETHOS is a news reader built around one question: what is the evidence?

Every story is a dossier, not a headline. ETHOS brings together reporting
from multiple outlets, states which claims each piece of evidence supports
or contradicts, and shows how many independent origins the reporting traces
back to — so four reprints of one wire dispatch are never presented as four
confirmations.

What you get:

• Today — the desk's editorial order, unchanged. No engagement ranking.
• Story dossiers — what happened, why it matters, what is known and what
  is still unclear.
• Claims with verdicts — each claim carries a status (supported,
  corroborated, partially supported, disputed, unverified) with the
  reasoning and the primary documents behind it, one tap away.
• Corrections in front — corrections and re-assessments are shown at the
  top of the story, with the change history.
• Sources, named — every outlet, every original document, every link back
  to the primary source so you can check the work yourself.
• Saved and For You — save stories, follow desks. Ordering only: following
  a topic never hides a story, a source, or a dispute.
• Honest by design — where ETHOS has not measured source independence, it
  says so instead of guessing. Unverified claims stay labelled unverified.

AI assists with synthesis and drafting inside the editorial pipeline; it
never replaces evidence, and it never gets the final say. Every claim is
checked against a deterministic publish gate before readers see it.

No account. No tracking. Your saved stories live behind an anonymous
identifier on your device, and you can erase them in one tap from Settings.

## Keywords (App Store, ≤100 chars incl. commas)

```
news,evidence,fact check,journalism,claims,analysis,sources,world news
```

## What's New in 1.0.0

```
First public release: Today, dossiers with claim verdicts, evidence and
source views, search, For You, Saved, and one-tap privacy erase.
```

## Support URL

https://ethos-news.vercel.app (root must be live — the app itself is the support surface; optional /support page can replace it later)

## Privacy Policy URL

https://ethos-news.vercel.app/privacy (rendered from src/app/privacy/page.tsx)

## Marketing URL

https://ethos-news.vercel.app

## Prohibited claims — do NOT use in any store copy

- "100% accurate", "always correct", "bias-free", "unbiased", "verified truth"
- Any claim of real-time verification the backend does not perform.

## Export compliance (iOS)

`ITSAppUsesNonExemptEncryption: false` is set in app.json — standard
non-exempt answer for HTTPS-only traffic.
