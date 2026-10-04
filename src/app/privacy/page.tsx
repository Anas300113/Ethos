import React from "react";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy — ETHOS",
  description: "What the ETHOS app stores, and how to erase it.",
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Anonymous reader identifier",
    body: (
      <>
        When you first save a story or follow a desk, ETHOS creates an anonymous
        reader profile: a random identifier only. No name, no e-mail, no phone
        number, no location, no advertising ID. The app holds it in your
        device&apos;s secure keystore; the server stores only that identifier
        and the rows below.
      </>
    ),
  },
  {
    title: "Saved stories",
    body: (
      <>
        Saving stores the story, the version you saved, and when you saved it —
        so the app can tell you truthfully if the story changed or was
        corrected afterwards.
      </>
    ),
  },
  {
    title: "Topic preferences",
    body: (
      <>
        Following a desk stores which desk you follow. It only changes ordering
        in For You. It never removes a story, a source, or a dispute from your
        feed.
      </>
    ),
  },
  {
    title: "Reading events",
    body: (
      <>
        Opening a story records a read receipt, at most once per hour per
        story. No dwell time, no scroll depth, no attention profile.
      </>
    ),
  },
  {
    title: "Network requests",
    body: (
      <>
        The app talks only to <code className="text-xs">ethos-news.vercel.app</code>{" "}
        over HTTPS. Standard hosting logs (IP, time, path) are kept for
        operations and security for up to 30 days. No analytics, no tracking
        pixels, no advertising SDKs.
      </>
    ),
  },
  {
    title: "External source links",
    body: (
      <>
        Stories link to original reporting and primary documents on other
        websites. Opening one leaves ETHOS; that site&apos;s privacy policy
        then applies.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header className="border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <h1 className="font-editorial text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          <span>Privacy</span>
        </h1>
        <p className="text-xs text-zinc-500">
          Effective 4 October 2026 — what the ETHOS app stores, and how to
          erase it.
        </p>
      </header>

      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        ETHOS is a news reader. No accounts, no advertising, no analytics. The
        only data stored is what you choose to save inside the app, under an
        anonymous identifier that lives on your device.
      </p>

      <div className="space-y-5">
        {SECTIONS.map((section) => (
          <section key={section.title} className="space-y-1.5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {section.title}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <section className="space-y-1.5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          What ETHOS never collects
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Name, e-mail, phone number, location, camera, microphone, contacts,
          photos, Bluetooth, advertising identifiers, device fingerprints,
          payment information.
        </p>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Retention and deletion
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Bookmarks, desk preferences and read receipts live as long as your
          profile exists. In the app, <strong>Settings → Erase everything</strong>{" "}
          deletes the profile on the server; everything above cascades with it,
          and the token is removed from your device. There is no account to
          recover. <strong>Settings → Clear offline copies</strong> removes
          locally cached stories.
        </p>
      </section>

      <footer className="border-t border-zinc-200/80 dark:border-zinc-800 pt-4 text-xs text-zinc-500">
        Material changes appear here with an updated effective date. Questions:
        open an issue at{" "}
        <a
          href="https://github.com/Anas300113/Ethos"
          className="underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          github.com/Anas300113/Ethos
        </a>
        .
      </footer>
    </div>
  );
}

