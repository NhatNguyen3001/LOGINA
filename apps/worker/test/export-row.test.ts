import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RESEARCH_COLUMNS } from '@logina/contracts';
import { liveSetup, testSchoolId, type LiveProject } from '@logina/test-utils';
import { exportRow, pendingRowIds, type SheetClient } from '../src/research/export-row.js';

let live: LiveProject;
const prefix = testSchoolId();
const ids: string[] = [];
let n = 0;

async function seedRow(fields: object = {}): Promise<string> {
  n += 1;
  const id = `${prefix}_${n}`;
  ids.push(id);
  const row = Object.fromEntries(RESEARCH_COLUMNS.map((column) => [column, `value of ${column}`]));
  await live.db.doc(`researchRows/${id}`).set({ ...row, is_simulated: false, first_evidence: null, attemptId: id, exportedAt: null, ...fields });
  return id;
}

const recording = (): SheetClient & { rows: string[][] } => {
  const rows: string[][] = [];
  return { rows, appendRow: async (values) => void rows.push(values) };
};

const exportedAt = async (id: string) => (await live.db.doc(`researchRows/${id}`).get()).data()?.exportedAt;

beforeAll(async () => {
  live = await liveSetup();
});

afterAll(async () => {
  await Promise.all(ids.map((id) => live.db.doc(`researchRows/${id}`).delete()));
});

describe('exportRow', () => {
  it('appends values in RESEARCH_COLUMNS order', async () => {
    const sheet = recording();
    const id = await seedRow();
    await exportRow(live.db, sheet, id);
    expect(sheet.rows[0]).toHaveLength(RESEARCH_COLUMNS.length);
    expect(sheet.rows[0]?.[RESEARCH_COLUMNS.indexOf('participant_code')]).toBe('value of participant_code');
  });

  it('writes booleans as TRUE or FALSE and null as an empty cell', async () => {
    const sheet = recording();
    const id = await seedRow({ is_simulated: true });
    await exportRow(live.db, sheet, id);
    expect(sheet.rows[0]?.[RESEARCH_COLUMNS.indexOf('is_simulated')]).toBe('TRUE');
    expect(sheet.rows[0]?.[RESEARCH_COLUMNS.indexOf('first_evidence')]).toBe('');
  });

  it('retried job appends once', async () => {
    const sheet = recording();
    const id = await seedRow();
    await exportRow(live.db, sheet, id);
    await exportRow(live.db, sheet, id);
    expect(sheet.rows).toHaveLength(1);
  });

  it('permission error leaves exportedAt null and flush resends', async () => {
    const id = await seedRow();
    const denied: SheetClient = { appendRow: async () => { throw new Error('403'); } };
    await expect(exportRow(live.db, denied, id)).rejects.toThrow('403');
    expect(await exportedAt(id)).toBeNull();
    expect(await pendingRowIds(live.db)).toContain(id);
    const sheet = recording();
    await exportRow(live.db, sheet, id);
    expect(sheet.rows).toHaveLength(1);
    expect(await exportedAt(id)).not.toBeNull();
  });

  it('no RESEARCH_SHEET_ID means no append and the row stays', async () => {
    const id = await seedRow();
    await exportRow(live.db, null, id);
    expect(await exportedAt(id)).toBeNull();
  });

  it('a row that no longer exists is skipped', async () => {
    const sheet = recording();
    await exportRow(live.db, sheet, `${prefix}_withdrawn`);
    expect(sheet.rows).toEqual([]);
  });
});
