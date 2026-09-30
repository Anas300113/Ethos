import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { figuresIn, groundingIssues } from "./grounding";
import { generateLocalStory } from "../providers/local-ai";
import type { StoryGenerationOutput } from "../providers/types";

const CLAIMS = [
  { statement: "The government announced a £4bn housing programme." },
  { statement: "The programme will create 100,000 homes." },
  { statement: "The minister said the fund will open in spring." },
];

function generated(overrides: Partial<StoryGenerationOutput>): StoryGenerationOutput {
  return {
    headline: "Government announces £4bn housing programme",
    oneSentenceSummary: "The government announced a £4bn housing programme.",
    whatHappened: "The government announced a £4bn housing programme today.",
    whyItMatters: "This story draws on reporting from BBC News and The Guardian.",
    whatWeKnow: ["The government announced a £4bn housing programme."],
    whatIsUnclear: ["The programme will create 100,000 homes — reported, not confirmed."],
    sourcesAgreeOn: ["A £4bn package was announced."],
    ...overrides,
  };
}

describe("generation grounding", () => {
  it("accepts prose that maps to the stored claims", () => {
    assert.deepEqual(groundingIssues(generated({}), CLAIMS), []);
  });

  it("rejects an invented number (the classic hallucinated sentence)", () => {
    // 500,000 homes appears in NO claim: the sentence must be refused.
    const issues = groundingIssues(
      generated({
        whatHappened:
          "The government announced a £4bn housing programme and promised 500,000 homes by 2030.",
      }),
      CLAIMS
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].reason, "figure-not-in-claims");
    assert.equal(issues[0].field, "whatHappened");
  });

  it("rejects a factual sentence with no claim overlap", () => {
    const issues = groundingIssues(
      generated({
        whyItMatters: "Manchester City Council approved the plans after a late-night vote.",
      }),
      CLAIMS
    );
    assert.ok(issues.some((issue) => issue.reason === "no-claim-overlap"));
  });

  it("does not let prompt-injected prose smuggle facts past the check", () => {
    // Article text instructed the model to state the policy was scrapped;
    // the sentence has no claim behind it, so it is refused.
    const hostile = generated({
      whatIsUnclear: [
        "The housing programme was scrapped after a cabinet revolt, ministers confirmed.",
      ],
    });
    const issues = groundingIssues(hostile, CLAIMS);
    assert.ok(issues.length > 0);
  });

  it("accepts the local template composer's own prose", () => {
    const out = generateLocalStory({
      headline: "Government announces £4bn housing programme",
      topic: "UK",
      claims: [
        { statement: "The government announced a £4bn housing programme.", status: "CORROBORATED", claimant: "The government" },
        { statement: "The programme will create 100,000 homes.", status: "UNVERIFIED", claimant: null },
      ],
      agreements: ["A £4bn package was announced."],
      disagreements: [],
      timeline: [],
      sourceNames: ["BBC News", "The Guardian"],
    });
    assert.deepEqual(groundingIssues(out, [
      { statement: "The government announced a £4bn housing programme." },
      { statement: "The programme will create 100,000 homes." },
    ]), []);
  });

  it("normalises figures so £4bn and 4bn compare equal", () => {
    assert.deepEqual(figuresIn("A £4bn package worth 4bn in total."), ["£4bn", "4bn"]);
    assert.deepEqual(figuresIn("no numbers here"), []);
  });
});
