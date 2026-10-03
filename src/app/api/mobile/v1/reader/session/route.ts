/**
 * POST /api/mobile/v1/reader/session — mint the anonymous reader identity.
 *
 * A native app has no cookie jar, so the phone asks for a bearer token once and
 * stores it in the device keychain. Nothing is collected to mint it: no e-mail,
 * no name, no push token, no fingerprint. POST is idempotent when a valid token
 * is replayed, so reinstalling the app against a backed-up token cannot create
 * a second profile.
 *
 * GET reports what is held about this reader, and DELETE forgets it. Both exist
 * so the app can show a reader its data and erase it in one tap — that is the
 * privacy promise, so it has to be an endpoint, not a paragraph.
 */
import { prisma } from "@/lib/prisma";
import { issueReaderToken, readerTokenExpiresIn } from "@/lib/mobile/auth";
import {
  json,
  preflight,
  readerIdFromRequest,
  unauthorized,
} from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  const existing = readerIdFromRequest(request);
  const profile = existing
    ? ((await prisma.readerProfile.findUnique({
        where: { id: existing },
        select: { id: true },
      })) ?? (await prisma.readerProfile.create({ data: {} })))
    : await prisma.readerProfile.create({ data: {} });

  const token = issueReaderToken(profile.id);
  return json(
    {
      readerId: profile.id,
      token,
      expiresInSeconds: readerTokenExpiresIn(token),
      // What the token is allowed to touch, stated so the app never over-asks.
      scopes: ["bookmarks", "topic-preferences", "read-receipts"],
      personalData: false,
    },
    { status: existing ? 200 : 201 }
  );
}

/** Exactly what this device's profile contains — no counts invented, only rows. */
export async function GET(request: Request) {
  const readerId = readerIdFromRequest(request);
  if (!readerId) return unauthorized();

  const [profile, bookmarks, preferences, readingEvents] = await Promise.all([
    prisma.readerProfile.findUnique({
      where: { id: readerId },
      select: { createdAt: true },
    }),
    prisma.storyBookmark.count({ where: { readerId } }),
    prisma.readerPreference.count({ where: { readerId, followed: true } }),
    prisma.readingEvent.count({ where: { readerId } }),
  ]);
  if (!profile) return unauthorized();

  return json(
    {
      readerId,
      createdAt: profile.createdAt.toISOString(),
      stored: { bookmarks, followedTopics: preferences, readReceipts: readingEvents },
      notStored: {
        name: true,
        email: true,
        phoneNumber: true,
        location: true,
        advertisingId: true,
        articleTextRead: true,
      },
    },
    { cache: "private, no-store" }
  );
}

/**
 * Forget this reader. The schema cascades bookmarks, preferences and reading
 * events off the profile, so one delete is a real erasure, not a soft flag.
 */
export async function DELETE(request: Request) {
  const readerId = readerIdFromRequest(request);
  if (!readerId) return unauthorized();

  const deleted = await prisma.readerProfile.deleteMany({
    where: { id: readerId },
  });
  return json(
    { forgotten: deleted.count > 0 },
    { status: 200, cache: "private, no-store" }
  );
}

