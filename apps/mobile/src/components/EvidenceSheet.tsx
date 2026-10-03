/**
 * The signature interaction: "Why does ETHOS say this?"
 *
 * Everything in here answers one question — what is this sentence standing on? —
 * and nothing in here answers "how sure is the model?". So there is no
 * confidence percentage, no progress bar, no AI mood. There is a verdict, the
 * reason for it, the passage that carries it, who checked it and when, and a door
 * to the original document.
 *
 * Provenance is shown even when it is uncomfortable ("extracted by
 * gemini-2.5-flash"), because a reader who cannot see where a sentence came from
 * cannot discount it.
 */
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "./Typography";
import { ClaimChip } from "./ClaimChip";
import {
  assessmentMethodLabel,
  claimMeaning,
  extractionLabel,
  relationshipLabel,
  updatedLabel,
} from "../model/claim";
import { usePalette, spacing, minTouchTarget } from "../theme";
import type { Claim, PrimaryEvidence } from "../api/types";

const DOCUMENT_LABELS: Record<string, string> = {
  STATISTICAL_RELEASE: "Statistical release",
  GOVERNMENT_DOCUMENT: "Government document",
  COURT_FILING: "Court filing",
  OFFICIAL_STATEMENT: "Official statement",
  PARLIAMENTARY_RECORD: "Parliamentary record",
  ACADEMIC_PAPER: "Academic paper",
};

function documentLabel(type: string): string {
  return DOCUMENT_LABELS[type] ?? "Primary document";
}

function Passage({ text, label }: { text: string; label: string }) {
  const palette = usePalette();
  return (
    <View
      style={{
        borderLeftWidth: 2,
        borderColor: palette.rule,
        paddingLeft: spacing.md,
        marginVertical: spacing.sm,
      }}
    >
      <T variant="caption" tone="tertiary" style={{ marginBottom: spacing.xs }}>
        {label.toUpperCase()}
      </T>
      <T variant="bodySmall" italic>
        {text}
      </T>
    </View>
  );
}

function EvidenceBlock({ evidence }: { evidence: PrimaryEvidence }) {
  const palette = usePalette();
  const relationship = relationshipLabel(evidence.relationship);
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: palette.rule,
        paddingTop: spacing.md,
        marginTop: spacing.md,
      }}
    >
      <T variant="meta" style={{ fontWeight: "600" }}>
        {evidence.title}
      </T>
      <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xxs }}>
        {documentLabel(evidence.documentType)} · {evidence.issuingBody}
        {evidence.date ? ` · ${evidence.date}` : ""}
      </T>
      <T variant="bodySmall" tone="secondary" style={{ marginTop: spacing.sm }}>
        {evidence.summary}
      </T>
      {evidence.supportingPassage ? (
        <Passage text={evidence.supportingPassage} label="What the document says" />
      ) : evidence.excerpt ? (
        <Passage text={evidence.excerpt} label="Excerpt" />
      ) : null}
      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        <T variant="caption" tone="secondary">
          {relationship
            ? `Relationship to this claim: ${relationship}`
            : "Relationship to this claim: not assessed"}
        </T>
        {evidence.relationshipReason ? (
          <T variant="caption" tone="tertiary">
            {evidence.relationshipReason}
          </T>
        ) : null}
        <T variant="caption" tone="tertiary">
          {assessmentMethodLabel(evidence.assessmentMethod)}
          {evidence.assessmentModel ? ` · ${evidence.assessmentModel}` : ""}
        </T>
      </View>
      {evidence.url ? (
        <Pressable
          onPress={() => void Linking.openURL(evidence.url as string)}
          accessibilityRole="link"
          accessibilityLabel={`Open the original document: ${evidence.title}`}
          style={{
            minHeight: minTouchTarget,
            justifyContent: "center",
            marginTop: spacing.xs,
          }}
        >
          <T variant="meta" style={{ textDecorationLine: "underline" }}>
            OPEN ORIGINAL DOCUMENT
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EvidenceSheet({
  claim,
  onClose,
}: {
  claim: Claim | null;
  onClose: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  if (!claim) return null;

  const openableUrl =
    claim.primaryEvidence.find((item) => item.url)?.url ??
    claim.corroboratingSources[0]?.url ??
    claim.disputingSources?.[0]?.url;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.42)" }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close evidence panel"
          style={{ flex: 1 }}
        />
        <View
          style={{
            maxHeight: "86%",
            backgroundColor: palette.surface,
            borderTopWidth: 1,
            borderColor: palette.rule,
            paddingBottom: insets.bottom + spacing.lg,
          }}
        >
          <View
            accessibilityElementsHidden
            style={{
              alignSelf: "center",
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: palette.rule,
              marginVertical: spacing.md,
            }}
          />
          <ScrollView contentContainerStyle={{ padding: spacing.screen }}>
            <T variant="section" tone="secondary">
              WHY DOES ETHOS SAY THIS?
            </T>
            <T variant="h2" serif style={{ marginVertical: spacing.md }}>
              {claim.statement}
            </T>
            <ClaimChip status={claim.status} />
            <T variant="bodySmall" tone="secondary" style={{ marginTop: spacing.md }}>
              {claimMeaning(claim.status)}
            </T>

            <T variant="section" tone="secondary" style={{ marginTop: spacing.xl }}>
              REASON
            </T>
            <T variant="body" style={{ marginTop: spacing.sm }}>
              {claim.explanation}
            </T>
            {claim.claimant ? (
              <T variant="caption" tone="tertiary" style={{ marginTop: spacing.sm }}>
                {"Attributed to: " + claim.claimant}
              </T>
            ) : null}
            {claim.independentSourceCount != null ? (
              <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
                {claim.independentSourceCount +
                  " independent source" +
                  (claim.independentSourceCount === 1 ? "" : "s") +
                  " carry this claim"}
              </T>
            ) : null}
            <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
              <T variant="caption" tone="tertiary">
                {extractionLabel(claim.extractionProvenance)}
              </T>
              <T variant="caption" tone="tertiary">
                {"Last assessed " + updatedLabel(claim.lastVerified)}
              </T>
            </View>
            {claim.sourcingNote ? (
              <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
                {claim.sourcingNote}
              </T>
            ) : null}

            <T variant="section" tone="secondary" style={{ marginTop: spacing.xl }}>
              PRIMARY EVIDENCE
            </T>
            {claim.primaryEvidence.length > 0 ? (
              claim.primaryEvidence.map((evidence) => (
                <EvidenceBlock key={evidence.id} evidence={evidence} />
              ))
            ) : (
              <T variant="bodySmall" tone="secondary" style={{ marginTop: spacing.sm }}>
                No document in ETHOS tests this claim directly. It rests on news
                reporting, which is why the status above is not
                {"\u201CSupported\u201D"}.
              </T>
            )}

            {claim.corroboratingSources.length > 0 ? (
              <>
                <T variant="section" tone="secondary" style={{ marginTop: spacing.xl }}>
                  REPORTING THAT SUPPORTS IT
                </T>
                {claim.corroboratingSources.map((quote, index) => (
                  <View key={quote.url + "-" + index} style={{ marginTop: spacing.sm }}>
                    <T variant="caption" tone="secondary">
                      {quote.publisherName}
                    </T>
                    <T variant="bodySmall" italic>
                      {"\u201C" + quote.quote + "\u201D"}
                    </T>
                  </View>
                ))}
              </>
            ) : null}

            {claim.disputingSources && claim.disputingSources.length > 0 ? (
              <>
                <T variant="section" tone="secondary" style={{ marginTop: spacing.xl }}>
                  REPORTING THAT DISPUTES IT
                </T>
                {claim.disputingSources.map((quote, index) => (
                  <View key={quote.url + "-" + index} style={{ marginTop: spacing.sm }}>
                    <T variant="caption" tone="secondary">
                      {quote.publisherName}
                    </T>
                    <T variant="bodySmall" italic>
                      {"\u201C" + quote.quote + "\u201D"}
                    </T>
                    <T variant="caption" tone="tertiary">
                      {"Why it disputes: " + quote.disputeReason}
                    </T>
                  </View>
                ))}
              </>
            ) : null}

            <Pressable
              onPress={() => {
                if (openableUrl) void Linking.openURL(openableUrl);
              }}
              accessibilityRole="button"
              accessibilityLabel="Open the original source"
              disabled={!openableUrl}
              style={{
                minHeight: 50,
                marginTop: spacing.xl,
                borderWidth: 1,
                borderColor: palette.ink,
                alignItems: "center",
                justifyContent: "center",
                opacity: openableUrl ? 1 : 0.4,
              }}
            >
              <T variant="meta">OPEN ORIGINAL SOURCE</T>
            </Pressable>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close evidence panel"
              style={{
                minHeight: minTouchTarget,
                marginTop: spacing.sm,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T variant="meta" tone="secondary">
                CLOSE
              </T>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}