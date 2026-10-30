import { z } from 'zod';

/** `GET /demo/snapshots`: the steps "Jump to step…" can restore, for the current DEMO_LOCALE. */
export const DemoSnapshotsDTO = z
  .object({
    snapshots: z.array(z.object({ stepId: z.string(), label: z.string() }).strict()),
  })
  .strict();
export type DemoSnapshotsDTO = z.infer<typeof DemoSnapshotsDTO>;
