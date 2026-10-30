import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { Hono, type Context } from 'hono';
import { ConsentReq, ConsentResultDTO, CURRENT_CONSENT_VERSION, MeDTO, UpdateMeReq } from '@logina/contracts';
import { AppError } from '@logina/db';
import { newParticipantCode } from '@logina/domain';
import type { AppDeps, AppEnv } from '../context.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { respond } from '../middleware/respond.js';

const CODE_ATTEMPTS = 5;

/** The registry doc is what keeps two sessions from sharing a code. */
async function issueCode(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = newParticipantCode();
    const claimed = await db
      .doc(`participantCodes/${code}`)
      .create({ at: FieldValue.serverTimestamp() })
      .then(() => true)
      .catch(() => false);
    if (claimed) return code;
  }
  throw new Error('Could not issue a participant code');
}

export function meRoutes({ db, config }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  const toMe = async (c: Context<AppEnv>) => {
    const { uid, schoolId, classIds, role } = c.var.user;
    const [school, participant] = await Promise.all([db.doc(`schools/${schoolId}`).get(), db.doc(`participants/${uid}`).get()]);
    const person = participant.data();
    return {
      uid,
      role,
      displayName: '',
      schoolId,
      classIds,
      uiLocale: school.data()?.uiLocale ?? 'en',
      demoMenu: config.demoMode,
      consentRequired: person?.consentVersion !== CURRENT_CONSENT_VERSION,
      currentConsentVersion: CURRENT_CONSENT_VERSION,
      ...(person?.participantCode ? { participantCode: person.participantCode } : {}),
    };
  };

  routes.get('/', async (c) => respond(c, MeDTO, await toMe(c)));

  routes.patch(
    '/',
    withIdempotency(db, async (c) => {
      const req = UpdateMeReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      await db.doc(`schools/${c.var.user.schoolId}`).update({ uiLocale: req.data.uiLocale });
      return respond(c, MeDTO, await toMe(c));
    }),
  );

  routes.post(
    '/consent',
    withIdempotency(db, async (c) => {
      const req = ConsentReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      const { consentVersion, choice } = req.data;
      if (consentVersion !== CURRENT_CONSENT_VERSION) throw new AppError('CONSENT_VERSION_STALE', 400, 'Please review the current text.');

      const ref = db.doc(`participants/${c.var.user.uid}`);
      const existing = (await ref.get()).data();
      if (existing?.consentVersion === consentVersion && existing.consent !== choice) {
        throw new AppError('CONSENT_ALREADY_SET', 409, 'This choice was already made.');
      }
      const participantCode = (existing?.participantCode as string | undefined) ?? (choice === 'AGREED' ? await issueCode(db) : undefined);
      await ref.set(
        {
          consent: choice,
          consentVersion,
          consentAt: FieldValue.serverTimestamp(),
          ...(participantCode ? { participantCode } : {}),
        },
        { merge: true },
      );
      return respond(c, ConsentResultDTO, { consent: choice, ...(participantCode && choice === 'AGREED' ? { participantCode } : {}) });
    }),
  );

  return routes;
}
