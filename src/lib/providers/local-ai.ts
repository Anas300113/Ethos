/**
 * Local AI provider: deterministic, zero-credential synthesis.
 *
 * extractClaims() delegates to the regex extractor so local and remote agree
 * on shapes. generateStory() composes narrative sections from the STRUCTURED
 * inputs with fixed templates — it never invents facts, because it never sees
 * anything but the claims/evidence the pipeline already validated. A remote
 * model upgrades PROSE quality when configured; it may not add facts, and
 * anything it returns that is not grounded in the inputs fails validation.
 */
import { extractClaims } from "../curation/claims";
import type {
  AIProvider,
  ExtractedClaimOutput,
  StoryGenerationInput,
  StoryGenerationOutput,
} from "./types";

function sentenceCase(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function joinReadable(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export class LocalAIProvider implements AIProvider {
  readonly name = "local-deterministic";

  async extractClaims(text: string): Promise<ExtractedClaimOutput[]> {
    return extractClaims(text).map((claim) => ({
      statement: claim.statement,
      claimType: claim.claimType,
      claimant: claim.claimant,
      isAttributionOnly: claim.isAttributionOnly,
      sourceUrl: "",
      sourcePublisher: "",
    }));
  }

  async generateStory(input: StoryGenerationOutputInput): Promise<StoryGenerationOutput> {
    return generateLocalStory(input);
  }
}

type StoryGenerationOutputInput = StoryGenerationInput;

function claimSentence(statement: string, claimant: string | null): string {
  const clean = sentenceCase(statement.replace(/[.]$/, ""));
  return claimant ? `${clean}, according to ${claimant}.` : `${clean}.`;
}

/** Pure template composer — the only "authoring" the local provider does. */
export function generateLocalStory(
  input: StoryGenerationInput
): StoryGenerationOutput {
  const established = input.claims.filter(
    (c) => c.status === "SUPPORTED" || c.status === "CORROBORATED"
  );
  const attributed = input.claims.filter(
    (c) => c.status !== "SUPPORTED" && c.status !== "CORROBORATED"
  );
  const whatHappenedParagraphs = [
    established.length > 0
      ? established.map((c) => claimSentence(c.statement, c.claimant)).join(" ")
      : "Reporting on this story is still developing, and ETHOS has not yet established the core facts.",
    attributed.length > 0
      ? `Further details are reported but not yet independently established: ${joinReadable(
        attributed.map((c) =>
          c.claimant ? `${c.statement} (${c.claimant})` : c.statement
        )
      )}.`
      : "",
  ].filter(Boolean);

  const sourceList = joinReadable(input.sourceNames);
  return {
    headline: input.headline,
    oneSentenceSummary:
      established.length > 0
        ? sentenceCase(established[0].statement)
        : `Developing story: ${input.claims.length} reported claims under review.`,
    whatHappened: whatHappenedParagraphs.join("\n\n"),
    whyItMatters:
      `This story draws on reporting from ${sourceList || "multiple outlets"}. ` +
      (established.length > 0
        ? "The established facts above are grounded in primary evidence or independent corroboration; everything else is labelled as reported, not confirmed."
        : "No claim in this story is independently established yet — read the claim-by-claim audit before acting on any detail."),
    whatWeKnow: established.map((c) => sentenceCase(c.statement)),
    whatIsUnclear:
      attributed.length > 0
        ? attributed.map(
          (c) =>
            `${sentenceCase(c.statement)} — reported${c.claimant ? ` by ${c.claimant}` : ""}, not independently confirmed.`
        )
        : ["Whether further reporting will confirm the developing details."],
    sourcesAgreeOn: input.agreements,
  };
}
