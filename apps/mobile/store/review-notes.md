# ETHOS — App Review Notes

Paste into App Store Connect "App Review Notes" and Google Play "Private
notes for review".

## What the app is

ETHOS is a read-only news reader. It aggregates reporting that already
exists on the open web and presents it as structured dossiers.

## Reviewer instructions

1. **ETHOS aggregates reporting from multiple sources.**
   Each story shows every outlet that reported it, with links back to the
   original articles.

2. **ETHOS extracts claims.**
   Inside the editorial pipeline, a story's statements are broken into
   discrete claims.

3. **ETHOS evaluates available evidence.**
   Each claim carries a status — supported, corroborated, partially
   supported, disputed, unverified, contradicted or outdated — with the
   reasoning and the primary document beside it. Open a story, tap a claim
   chip to open the evidence sheet.

4. **ETHOS identifies source independence and shared origins.**
   Where four outlets reprint one wire dispatch, the app says "one origin",
   not "four confirmations". Where that measurement has not run yet, the app
   says so instead of guessing.

5. **AI assists synthesis but does not replace evidence.**
   AI may help draft narrative text inside the editorial pipeline. Every
   claim passes a deterministic publish gate before it reaches readers, and
   AI never provides the final verdict.

6. **Users can inspect the original sources.**
   Every dossier lists its sources with outbound links to the publisher and
   to primary documents (treaties, filings, official records).

7. **Unverified claims remain unverified.**
   The app never upgrades a status to look better. An unassessed claim is
   labelled "Not assessed".

## Accounts and login

There is no sign-up. The app mints an anonymous identifier on first save;
it contains no personal data. Settings shows exactly what is stored and
erases it in one tap.

## Deep links to test

- Custom scheme: `ethos://story/uk-housing-package-4bn-affordable-homes`
- HTTPS (chooser): `https://ethos-news.vercel.app/story/uk-housing-package-4bn-affordable-homes`

## Network

All traffic is HTTPS to `ethos-news.vercel.app` only. No other domains are
contacted except outbound links the user taps.

## Age rating

News / current events — no objectionable content expected. Suggested 4+.

## Demo content

The published corpus is real curated news copy seeded by the ETHOS team.
There is no demo mode and no fake data in the shipped app.
