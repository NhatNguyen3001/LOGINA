import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface PickProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  label?: string;
  state?: 'default' | 'new' | 'orig';
  children: ReactNode;
}

/** A native radio, so arrow keys and screen readers work without extra code. */
export function Pick({ name, value, checked, onSelect, label, state = 'default', children }: PickProps) {
  const { t } = useTranslation();
  const classes = ['pick', checked && state === 'default' ? 'on' : '', state === 'new' ? 'new' : '', state === 'orig' ? 'orig' : ''];
  return (
    <label className={classes.filter(Boolean).join(' ')}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onSelect(value)} className="vh" />
      <span className={`radio ${checked ? 'on' : ''}`} aria-hidden="true" />
      <span className="grow">
        {label ? <span className="lbl">{label}</span> : null}
        {children}
        {state === 'new' ? <span className="newtag">{t('student.new')}</span> : null}
        {state === 'orig' ? <span className="newtag">{t('student.original')}</span> : null}
      </span>
    </label>
  );
}
