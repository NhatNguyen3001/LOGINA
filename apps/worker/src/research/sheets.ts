import { sheets as sheetsApi, auth } from '@googleapis/sheets';
import type { SheetClient } from './export-row.js';

const TAB = 'responses';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/**
 * Uses the service account's identity, no key file. RAW stores what a student typed as plain
 * text, so Q5 text can never run as a Sheet formula.
 */
export function googleSheet(spreadsheetId: string): SheetClient {
  const client = sheetsApi({ version: 'v4', auth: new auth.GoogleAuth({ scopes: [SCOPE] }) });
  return {
    appendRow: async (values) => {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: TAB,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] },
      });
    },
  };
}
