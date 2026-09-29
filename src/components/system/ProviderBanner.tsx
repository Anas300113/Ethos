import React from "react";
import { constructProviders } from "@/lib/providers";

/**
 * Honest labelling: when no AI or evidence provider is configured, the app
 * says so instead of implying that live synthesis is running. Rendered
 * server-side from the same provider report the curation pipeline logs.
 */
export const ProviderBanner: React.FC = () => {
  const providers = constructProviders();
  if (!providers.isDevelopmentMode) return null;

  return (
    <div className="rounded-lg border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 text-[11px] leading-snug text-amber-900 dark:text-amber-200">
      <span className="font-semibold">Development mode.</span> These stories
      were assembled on this machine by the local synthesiser (
      <code className="font-mono text-[10px]">{providers.report.ai.name}</code>
      ). No AI or evidence-search provider is configured, so claims stay marked
      unverified until primary documents are found.{" "}
      <span className="opacity-80">
        Set AI_PROVIDER/AI_API_KEY and EVIDENCE_SEARCH_PROVIDER for live
        synthesis.
      </span>
    </div>
  );
};
