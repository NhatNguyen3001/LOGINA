import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

export async function renderWithI18n(ui: ReactElement, { lang = 'en' }: { lang?: 'en' | 'vi' } = {}) {
  await i18n.changeLanguage(lang);
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}
