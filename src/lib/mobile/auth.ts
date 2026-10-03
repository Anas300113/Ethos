/**
 * Mobile reader identity — stateless, cookie-free, credential-free.
 *
 * The web app stores a ReaderProfile id in an HttpOnly cookie. A native app has
 * no cookie jar worth trusting, so the mobile API hands out a signed bearer
 * token instead: `v1.<readerId>.<expiresAt>.<hmac>`. The token is a capability
 * over ONE anonymous profile's own data (bookmarks, topics, read receipts) and
 * nothing else — no e-mail, no name, no device fingerprint.
 *
 * It is stateless on purpose: no schema change, no migration on the eve of a
 * launch, and revocation is a secret rotation. The signature is verified with a
 * constant-time comparison, and an expired token is refused rather than
 * silently refreshed, so a stolen bundle cannot keep reading forever.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** A cuid is all word characters; anything else is not a profile id. */
const READER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Raised for a malformed, tampered or expired token — never with the token in it. */
export class ReaderTokenError extends Error {
  constructor() {
    super("reader token invalid");
    this.name = "ReaderTokenError";
  }
}

function signingSecret(): string {
  const configured = process.env.READER_TOKEN_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === "production") {
    // Fail closed: an unsigned-or-guessable identity token would let anyone
    // rewrite a stranger's saved list. Configure the secret before shipping.
    throw new Error(
      "READER_TOKEN_SECRET must be set to a random value of 16+ characters in production"
    );
  }
  return "ethos-development-only-reader-token-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function stableEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on length mismatch; differing length is already a
  // rejection, so short-circuiting first keeps the comparison constant-time.
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Mint a token for an existing ReaderProfile id. */
export function issueReaderToken(readerId: string, now = Date.now()): string {
  if (!READER_ID.test(readerId)) throw new Error("unexpected reader profile id shape");
  const payload = `${VERSION}.${readerId}.${now + TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** The reader profile id behind a token, or null when it cannot be trusted. */
export function verifyReaderToken(
  token: string | null | undefined,
  now = Date.now()
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, readerId, expiry, signature] = parts;
  if (version !== VERSION || !READER_ID.test(readerId)) return null;
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  if (!stableEqual(signature, sign(`${VERSION}.${readerId}.${expiry}`))) return null;
  return readerId;
}

/** Seconds until a token expires — the app warns before it needs a new one. */
export function readerTokenExpiresIn(token: string, now = Date.now()): number {
  const expiry = Number(token.split(".")[2]);
  if (!Number.isFinite(expiry)) return 0;
  return Math.max(0, Math.round((expiry - now) / 1000));
}
