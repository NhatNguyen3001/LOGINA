import { useQuery } from '@tanstack/react-query';
import type { LimitsDTO, RateAction } from '@logina/contracts';
import { getLimits } from './api';
import { qk } from './query';

export type Limit = LimitsDTO['limits'][number];

const ALMOST_SHARE = 0.2;

export function limitState({ limit, remaining }: Pick<Limit, 'limit' | 'remaining'>): 'ok' | 'almost' | 'reached' {
  if (remaining <= 0) return 'reached';
  if (limit <= 1) return 'ok';
  return remaining <= Math.max(1, Math.ceil(limit * ALMOST_SHARE)) ? 'almost' : 'ok';
}

export const minutesUntil = (resetsAt: string, now = Date.now()): number => Math.max(1, Math.ceil((new Date(resetsAt).getTime() - now) / 60_000));

export const useLimits = () => useQuery({ queryKey: qk.limits(), queryFn: getLimits });

export function useLimit(action: RateAction): Limit | undefined {
  return useLimits().data?.limits.find((limit) => limit.action === action);
}

export { setBusy, useBusy } from './busy';
