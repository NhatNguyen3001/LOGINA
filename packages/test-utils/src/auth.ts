import { webApiKey, type Env } from './live.js';

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts';
const REFERER = { Referer: 'https://logina-dev.web.app/' };

export interface AnonSession {
  uid: string;
  idToken: string;
  close: () => Promise<void>;
}

/** A real anonymous Firebase session, the same one a browser gets. `close` deletes the user. */
export async function anonToken(env: Env = process.env): Promise<AnonSession> {
  const key = webApiKey(env);
  const headers = { 'Content-Type': 'application/json', ...REFERER };
  const response = await fetch(`${IDENTITY}:signUp?key=${key}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Anonymous sign-up failed: HTTP ${response.status}`);
  const { localId, idToken } = (await response.json()) as { localId: string; idToken: string };
  return {
    uid: localId,
    idToken,
    close: async () => {
      await fetch(`${IDENTITY}:delete?key=${key}`, { method: 'POST', headers, body: JSON.stringify({ idToken }) });
    },
  };
}
