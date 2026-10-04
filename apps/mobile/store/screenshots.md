# ETHOS — Store screenshot shot list

Six screenshots per store. Capture from a **real device** on the production
build against the live API. No simulator status bar, no debug menu, no
`__DEV__` banner.

## Capture rules

- Light mode for screenshots 1–4, dark mode for 5–6 (shows theming).
- Production build (`--profile production`), logged-in state NOT required.
- Wait for the live marker to disappear (no "loading…" text visible).
- Use the real published corpus — never fabricate story copy.
- Devices: iPhone 6.7" (1290×2796 or 1284×2778) and Android 1080×2400+.

## Shot list

| # | Screen | Route | What must be visible |
| --- | --- | --- | --- |
| 1 | Today | `(tabs)/today` | Masthead date, hero story image, 2–3 rows, "Ordered by editors" line |
| 2 | Story | `story/[slug]` | Corrections block (if any) or headline, summary, reading time, claim chips |
| 3 | Evidence | `story/[slug]` → EvidenceSheet | One claim open: status label, plain-English meaning, primary document card |
| 4 | Sources | `story/[slug]` → SourcesSection | Outlet list + sourcing headline ("N outlets · M independent origins" or honest fallback) |
| 5 | Search | `(tabs)/search` | Term typed, results with "Matched in …" lines |
| 6 | For You | `(tabs)/for-you` | "Your topics" section + "Also developing" band |

## Per-store

- **App Store**: 6.7" screenshots; optionally reuse for iPad (required if
  `supportsTablet: true` — capture at least 2 iPad shots).
- **Google Play**: 16:9 or 9:16 phone shots; feature graphic 1024×500
  required (create from `assets/icon.png` + wordmark).

## Status

NOT CAPTURED — requires one real iPhone and one real Android device
(no adb/emulator tooling on this machine; iOS requires hardware).
