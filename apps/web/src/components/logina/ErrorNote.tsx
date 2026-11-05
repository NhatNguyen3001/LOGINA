import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { UpdatedNotice } from '@/components/logina/UpdatedNotice';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/errors';

/** A failed save: the usual message, or, when LOGINA was updated meanwhile, Reload with the typed text kept to copy. */
export function ErrorNote({ error, text }: { error: unknown; text?: string | undefined }) {
  const { t } = useTranslation();
  if (error instanceof ApiError && error.code === 'APP_UPDATED') return <UpdatedNotice text={text} />;
  return <Note kind="err">{t(errorText(error))}</Note>;
}
