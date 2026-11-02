import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { applySessionLocale, setUserLocaleSaver } from '@/i18n';
import { getMe, updateMe } from './api';
import { qk, queryClient } from './query';

/** Applies the saved language once the session is known, and saves later switches. */
export function useSessionLocale(): void {
  const me = useQuery({ queryKey: qk.me(), queryFn: getMe });
  const uiLocale = me.data?.uiLocale;
  useEffect(() => {
    if (!uiLocale) return;
    void applySessionLocale(uiLocale);
    setUserLocaleSaver(async (lang) => {
      await updateMe({ uiLocale: lang });
      /** Questions and answers come from the server in the saved language. */
      await queryClient.invalidateQueries();
    });
  }, [uiLocale]);
}
