import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ulid } from 'ulid';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import {
  isFlavorAllowed,
  gatePhase1Flavor,
  UnsupportedFlavorError,
} from '../../auth/flavor-allowlist.js';
import { evaluateIntegrity, type IntegrityRejectReason } from '../../auth/integrity-policy.js';
import { consumeNonce } from '../../auth/nonce-store.js';
import { verifyGoogleIdToken } from '../../auth/verify-id-token.js';
import { decodeIntegrityToken } from '../../auth/verify-play-integrity.js';
import { mintJwt } from '../../auth/jwt-mint.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';
import { AuthGoogleRequestSchema, AuthGoogleResponseSchema } from '@humyn/shared-types';
import { CONSENT_VERSION } from '../../legal/consent-text.js';
import { CONSENT_TEXT_SHA256 } from '../../legal/consent-text-hash.js';

const PROBLEM_CT = 'application/problem+json';

function rejectReasonToSlug(r: IntegrityRejectReason): string {
  switch (r) {
    case 'integrity-rooted':
      return PROBLEM_SLUGS.integrityRooted;
    case 'integrity-emulator':
      return PROBLEM_SLUGS.integrityEmulator;
    case 'integrity-install-source':
      return PROBLEM_SLUGS.integrityInstallSource;
    case 'integrity-nonce':
      return PROBLEM_SLUGS.integrityNonce;
    case 'integrity-stale':
      return PROBLEM_SLUGS.integrityStale;
    case 'flavor_app_id_mismatch':
    case 'package_name_mismatch':
    case 'app_integrity_package_mismatch':
    default:
      return PROBLEM_SLUGS.forbidden;
  }
}

export default async function googleAuthRoutes(app: FastifyInstance) {
  // We declare ONLY the request body schema for runtime validation. The
  // response schema is intentionally omitted from the type provider so that
  // non-200 problem-detail returns do not collide with the strict
  // ZodTypeProvider-narrowed reply.code(200). The happy-path response shape
  // is enforced manually via the explicit `return reply.status(200).send(...)`
  // payload below — its keys must match AuthGoogleResponseSchema.
  void AuthGoogleResponseSchema;
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/google',
    {
      schema: { body: AuthGoogleRequestSchema },
      config: { idempotency: false }, // anonymous — user does not exist yet
    },
    async (req, reply) => {
      const body = req.body;

      // 0a. Phase-1 flavor gate (W6) — iOS attestation is Phase 7. iosAppStore
      //     must hard-reject with `integrity-flavor-not-supported` until then.
      try {
        gatePhase1Flavor(body.flavor);
      } catch (err) {
        if (err instanceof UnsupportedFlavorError) {
          const pd = buildProblemDetail({
            slug: PROBLEM_SLUGS.integrityFlavorNotSupported,
            title: `Flavor ${body.flavor} not supported until Phase 7 (iOS attestation)`,
            status: 501,
            instance: req.id as string,
          });
          return reply.status(501).type(PROBLEM_CT).send(pd);
        }
        throw err;
      }

      // 0b. Server-side allowlist cross-check (D-AUTH-01) — fast-fail before
      //     any external call.
      if (!isFlavorAllowed(body.flavor, body.applicationId)) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.forbidden,
          title: '(flavor, applicationId) pair not allowlisted',
          status: 403,
          detail: 'The supplied flavor + applicationId pair does not match any known build.',
          instance: req.id as string,
        });
        return reply.status(403).type(PROBLEM_CT).send(pd);
      }

      // a. Google ID token verify (cheap; fails fast on bad token)
      let googlePayload;
      try {
        googlePayload = await verifyGoogleIdToken(body.googleIdToken);
      } catch (err) {
        req.log.warn({ err }, 'google_id_token_verify_failed');
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.unauthorized,
          title: 'Google ID token verification failed',
          status: 401,
          instance: req.id as string,
        });
        return reply.status(401).type(PROBLEM_CT).send(pd);
      }

      // b. Play Integrity decode. The iosAppStore branch below is UNREACHABLE
      //    today because gatePhase1Flavor throws at 0a (W6). Kept defensively
      //    until Phase 7 swaps in App Attest + the actual iOS-side decode flow.
      let payload;
      if (body.flavor === 'iosAppStore') {
        payload = null;
      } else {
        try {
          payload = await decodeIntegrityToken({
            packageName: body.applicationId,
            integrityToken: body.integrityToken,
          });
        } catch (err) {
          req.log.warn({ err }, 'play_integrity_decode_failed');
          const pd = buildProblemDetail({
            slug: PROBLEM_SLUGS.unauthorized,
            title: 'Play Integrity decode failed',
            status: 401,
            instance: req.id as string,
          });
          return reply.status(401).type(PROBLEM_CT).send(pd);
        }
      }

      // c. Consume nonce — must happen after we have the payload nonce to
      //    compare against. Single-use: the row is deleted regardless of match.
      let candidateNonce: string;
      if (payload) {
        candidateNonce = payload.requestDetails.nonce;
      } else {
        // iosAppStore (Phase 7+): no integrity payload. Nonce verification is
        // degenerate; we still consume the nonceId row to prevent replay, but
        // accept any candidate (nothing to verify against).
        candidateNonce = '__ios_no_op__';
      }
      const consume = await consumeNonce({ nonceId: body.nonceId, candidateNonce });
      if (!consume.ok && body.flavor !== 'iosAppStore') {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.integrityNonce,
          title: 'Nonce verification failed',
          status: 401,
          detail: `Nonce check: ${consume.reason}`,
          instance: req.id as string,
        });
        return reply.status(401).type(PROBLEM_CT).send(pd);
      }

      // d. Integrity policy
      let integrity_verdict: 'passed' | 'bypassed_apk' = 'passed';
      if (payload) {
        const result = await evaluateIntegrity({
          flavor: body.flavor,
          applicationId: body.applicationId,
          payload,
          expectedNonce: candidateNonce,
        });
        if (!result.pass) {
          const slug = rejectReasonToSlug(result.reason!);
          // Nonce + stale rejections surface as 401 (auth gate); other
          // integrity rejections are 403 (policy gate).
          const status =
            result.reason === 'integrity-nonce' || result.reason === 'integrity-stale' ? 401 : 403;
          const pd = buildProblemDetail({
            slug,
            title: `Play Integrity rejected: ${result.reason}`,
            status,
            detail: `flavor=${body.flavor} applicationId=${body.applicationId}`,
            instance: req.id as string,
          });
          return reply.status(status).type(PROBLEM_CT).send(pd);
        }
        integrity_verdict = result.verdict;
      }

      // e. Find-or-create user + write consent_log row (atomic, D-LEGAL-03)
      const ip = req.ip;
      const ua = (req.headers['user-agent'] ?? '') as string;
      const userRecord = await db.transaction(async (tx) => {
        // Lookup by google_sub
        const found = await tx
          .select()
          .from(schema.users)
          .where(eq(schema.users.googleSub, googlePayload.sub))
          .limit(1);
        let userId: string;
        let isNewUser = false;
        if (found.length > 0) {
          userId = found[0]!.id;
          // Update consent denorm to current version (re-accept on text bump)
          await tx
            .update(schema.users)
            .set({
              consentVersion: CONSENT_VERSION,
              consentAcceptedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.users.id, userId));
        } else {
          userId = ulid();
          isNewUser = true;
          await tx.insert(schema.users).values({
            id: userId,
            googleSub: googlePayload.sub,
            email: googlePayload.email,
            name: googlePayload.name ?? googlePayload.email,
            age: null,
            gender: null,
            avatarUrl: googlePayload.picture ?? null,
            consentVersion: CONSENT_VERSION,
            consentAcceptedAt: new Date(),
            flavor: body.flavor,
            applicationId: body.applicationId,
          });
          await tx.insert(schema.profiles).values({ userId });
        }
        // Append consent_log row — every sign-in writes one (initial + every re-accept)
        await tx.insert(schema.consentLog).values({
          id: ulid(),
          userId,
          consentVersion: CONSENT_VERSION,
          consentTextHash: CONSENT_TEXT_SHA256,
          acceptedAt: new Date(),
          ip,
          userAgent: ua,
          buildFlavor: body.flavor,
        });
        const refreshed = await tx
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);
        return { user: refreshed[0]!, isNewUser };
      });

      // f. Mint JWT per D-AUTH-03 + D-AUTH-05
      const jwt = await mintJwt({
        app,
        sub: userRecord.user.id,
        flavor: body.flavor,
        applicationId: body.applicationId,
        integrity_verdict,
      });

      return reply.status(200).send({
        jwt,
        user: {
          id: userRecord.user.id,
          email: userRecord.user.email,
          name: userRecord.user.name,
          avatarUrl: userRecord.user.avatarUrl,
          flavor: body.flavor,
          applicationId: body.applicationId,
          consentVersion: CONSENT_VERSION,
        },
      });
    },
  );
}
