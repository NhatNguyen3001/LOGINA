import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { setTheme, useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const THEMES: { theme: Theme; icon: LucideIcon }[] = [
  { theme: 'light', icon: Sun },
  { theme: 'dark', icon: Moon },
  { theme: 'system', icon: Monitor },
];

/** shadcn/ui's mode toggle: the icon shows the current choice, the menu offers all three. */
export function ModeToggle() {
  const { t } = useTranslation();
  const theme = useTheme();
  const Icon = THEMES.find((item) => item.theme === theme)?.icon ?? Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }), 'mode-toggle size-11')} aria-label={t('common.theme.label')}>
        <Icon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common.theme.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEMES.map(({ theme: option, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={option} value={option}>
              <OptionIcon aria-hidden="true" />
              {t(`common.theme.${option}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
