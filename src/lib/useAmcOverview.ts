'use client';

import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from './axios';
import { AmcSubscription, AmcVisit } from '@/types';

export interface AmcOverview {
  activeCount: number;
  expiringCount: number;
  upcomingVisitCount: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/** Aggregates AMC stats client-side — the backend has no cross-subscription rollup endpoint yet. */
export function useAmcOverview(): AmcOverview {
  const { data: activeSubs = [], isLoading: loadingSubs, isError: errorSubs, error: subsError, refetch: refetchSubs } = useQuery<AmcSubscription[]>({
    queryKey: ['amc-overview-subscriptions'],
    queryFn: async () => (await api.get('/web/manager/amc/subscriptions', { params: { status: 'ACTIVE' } })).data.data,
    staleTime: 60_000,
  });

  const subscriptionIds = activeSubs.map(s => s.id);

  const { data: upcomingVisitCount, isLoading: loadingVisits, isError: errorVisits, error: visitsError, refetch: refetchVisits } = useQuery<number>({
    queryKey: ['amc-overview-upcoming-visits', subscriptionIds],
    queryFn: async () => {
      const lists = await Promise.all(
        subscriptionIds.map(id => api.get(`/web/manager/amc/subscriptions/${id}/visits`).then(r => r.data.data as AmcVisit[]))
      );
      const cutoff = dayjs().add(7, 'day');
      return lists.flat().filter(v => v.status === 'SCHEDULED' && dayjs(v.scheduledDate).isBefore(cutoff)).length;
    },
    enabled: subscriptionIds.length > 0,
    staleTime: 60_000,
  });

  const expiringCutoff = dayjs().add(30, 'day');
  const expiringCount = activeSubs.filter(s => dayjs(s.endDate).isBefore(expiringCutoff)).length;

  return {
    activeCount: activeSubs.length,
    expiringCount,
    upcomingVisitCount: subscriptionIds.length > 0 ? upcomingVisitCount ?? 0 : 0,
    isLoading: loadingSubs || (subscriptionIds.length > 0 && loadingVisits),
    isError: errorSubs || errorVisits,
    error: subsError ?? visitsError,
    refetch: () => { refetchSubs(); refetchVisits(); },
  };
}
