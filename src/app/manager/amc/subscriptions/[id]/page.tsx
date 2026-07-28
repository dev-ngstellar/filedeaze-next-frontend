'use client';

import { useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Link from 'next/link';
import { ChevronLeft, RefreshCw, Ban, CalendarPlus, CalendarClock, ExternalLink } from 'lucide-react';
import api from '@/lib/axios';
import { AmcSubscription, AmcVisit, ServiceCategory, ServiceSubCategory } from '@/types';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { AmcSubscriptionStatusBadge, AmcVisitStatusBadge } from '@/components/ui/Badge';
import { getMinimumSelectableDate, isPastSchedule, getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

type ScheduleForm = { categoryId: string; subCategoryId: string; scheduledDate: string; description: string };
type RescheduleForm = { scheduledDate: string };
type RenewForm = { planId?: string; startDate: string };
type CancelForm = { reason: string };

export default function AmcSubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const qc = useQueryClient();

  const [showSchedule, setShowSchedule] = useState(false);
  const [rescheduleVisitId, setRescheduleVisitId] = useState<string | null>(null);
  const [showRenew, setShowRenew] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const { data: sub, isLoading, isError, error, refetch, isFetching } = useQuery<AmcSubscription>({
    queryKey: ['amc-subscription', id],
    queryFn: async () => (await api.get(`/web/manager/amc/subscriptions/${id}`)).data.data,
  });

  const { data: visits = [] } = useQuery<AmcVisit[]>({
    queryKey: ['amc-subscription-visits', id],
    queryFn: async () => (await api.get(`/web/manager/amc/subscriptions/${id}/visits`)).data.data,
  });

  const { register: rs, handleSubmit: hs, reset: resetS, watch: watchS, formState: { isSubmitting: ss, errors: errorsS } } = useForm<ScheduleForm>();
  const selectedCategoryId = watchS('categoryId');
  const { data: categories = [] } = useQuery<ServiceCategory[]>({
    queryKey: ['service-categories'],
    queryFn: async () => (await api.get('/web/manager/service-categories')).data.data,
    enabled: showSchedule,
  });
  const { data: subCategories = [] } = useQuery<ServiceSubCategory[]>({
    queryKey: ['sub-categories', selectedCategoryId],
    queryFn: async () => (await api.get('/web/manager/service-sub-categories', { params: { categoryId: selectedCategoryId } })).data.data,
    enabled: showSchedule && !!selectedCategoryId,
  });

  const { register: rr, handleSubmit: hr, reset: resetR, formState: { isSubmitting: sr, errors: errorsR } } = useForm<RescheduleForm>();
  const { register: rn, handleSubmit: hn, reset: resetN, formState: { isSubmitting: sn, errors: errorsN } } = useForm<RenewForm>({ defaultValues: { planId: sub?.planId ?? '' } });
  const { register: rc, handleSubmit: hc, reset: resetC, formState: { isSubmitting: sc } } = useForm<CancelForm>();

  const scheduleMutation = useMutation({
    mutationFn: (d: ScheduleForm) => api.post(`/web/manager/amc/subscriptions/${id}/visits`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['amc-subscription-visits', id] });
      qc.invalidateQueries({ queryKey: ['amc-subscription', id] });
      toast.success('Visit scheduled');
      setShowSchedule(false); resetS();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to schedule visit')),
  });

  const rescheduleMutation = useMutation({
    mutationFn: (d: RescheduleForm) => api.patch(`/web/manager/amc/subscriptions/${id}/visits/${rescheduleVisitId}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['amc-subscription-visits', id] });
      toast.success('Visit rescheduled');
      setRescheduleVisitId(null); resetR();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to reschedule visit')),
  });

  const renewMutation = useMutation({
    mutationFn: (d: RenewForm) => api.post(`/web/manager/amc/subscriptions/${id}/renew`, { planId: d.planId || undefined, startDate: d.startDate || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['amc-subscription', id] });
      toast.success('AMC renewed');
      setShowRenew(false); resetN();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to renew AMC')),
  });

  const cancelMutation = useMutation({
    mutationFn: (d: CancelForm) => api.post(`/web/manager/amc/subscriptions/${id}/cancel`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['amc-subscription', id] });
      toast.success('AMC subscription cancelled');
      setShowCancel(false); resetC();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to cancel AMC')),
  });

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />;
  if (!sub) return <ErrorState title="Subscription not found" onRetry={refetch} />;

  const canScheduleVisit = sub.status === 'ACTIVE' && (sub.remainingVisits ?? 0) > visits.filter(v => v.status === 'SCHEDULED').length;
  const canRenew = sub.status === 'ACTIVE' || sub.status === 'EXPIRED';
  const canCancel = sub.status === 'ACTIVE';

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href={`/${prefix}/amc/history`} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
        <ChevronLeft size={14} /> Back to AMC History
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{sub.plan?.name}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{sub.customer?.name} — {sub.customerAsset?.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AmcSubscriptionStatusBadge status={sub.status} />
          <div className="flex flex-wrap justify-end gap-2">
            {canScheduleVisit && <Button size="sm" onClick={() => setShowSchedule(true)}><CalendarPlus size={13} /> Schedule Visit</Button>}
            {canRenew && <Button size="sm" variant="secondary" onClick={() => setShowRenew(true)}><RefreshCw size={13} /> Renew</Button>}
            {canCancel && <Button size="sm" variant="danger" onClick={() => setShowCancel(true)}><Ban size={13} /> Cancel</Button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-1.5">
          <h3 className="font-medium text-[var(--color-text-secondary)] mb-1">Contract</h3>
          <p><span className="text-[var(--color-text-muted)]">Start:</span> {dayjs(sub.startDate).format('DD MMM YYYY')}</p>
          <p><span className="text-[var(--color-text-muted)]">End:</span> {dayjs(sub.endDate).format('DD MMM YYYY')}</p>
          <p><span className="text-[var(--color-text-muted)]">Visits:</span> {sub.remainingVisits ?? '—'} of {sub.totalVisits} remaining</p>
          {sub.cancelReason && <p><span className="text-[var(--color-text-muted)]">Cancel reason:</span> {sub.cancelReason}</p>}
        </div>
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-1.5">
          <h3 className="font-medium text-[var(--color-text-secondary)] mb-1">Asset</h3>
          <p><span className="text-[var(--color-text-muted)]">Name:</span> {sub.customerAsset?.name}</p>
          <p><span className="text-[var(--color-text-muted)]">Brand/Model:</span> {[sub.customerAsset?.brand, sub.customerAsset?.model].filter(Boolean).join(' / ') || '—'}</p>
          <Link href={`/${prefix}/assets/${sub.customerAssetId}`} className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline mt-1">
            View asset <ExternalLink size={11} />
          </Link>
        </div>
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
        <h3 className="font-medium text-[var(--color-text-secondary)] mb-3">Visits</h3>
        {visits.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No visits scheduled yet.</p>
        ) : (
          <div className="space-y-3">
            {visits.map(v => (
              <div key={v.id} className="flex items-center justify-between border-b border-[var(--color-border)] last:border-0 pb-3 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">Visit #{v.visitNumber}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{dayjs(v.scheduledDate).format('DD MMM YYYY')}</p>
                  {v.ticket && (
                    <Link href={`/${prefix}/tickets/${v.ticket.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
                      {v.ticket.ticketNumber} →
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <AmcVisitStatusBadge status={v.status} />
                  {v.status === 'SCHEDULED' && (
                    <Button size="sm" variant="ghost" onClick={() => { setRescheduleVisitId(v.id); resetR({ scheduledDate: dayjs(v.scheduledDate).format('YYYY-MM-DD') }); }}>
                      <CalendarClock size={13} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showSchedule} onClose={() => { setShowSchedule(false); resetS(); }} title="Schedule Next Visit" size="sm">
        <form onSubmit={hs(d => scheduleMutation.mutate(d))} className="space-y-4">
          <Select label="Category *" options={categories.map(c => ({ value: c.id, label: c.name }))} placeholder="Select category" {...rs('categoryId', { required: true })} />
          <Select label="Sub-Category *" options={subCategories.map(s => ({ value: s.id, label: s.name }))} placeholder={selectedCategoryId ? 'Select sub-category' : 'Select category first'} {...rs('subCategoryId', { required: true })} />
          <Input
            label="Scheduled Date *"
            type="date"
            min={getMinimumSelectableDate()}
            error={errorsS.scheduledDate?.message}
            {...rs('scheduledDate', {
              required: 'Pick a date',
              validate: (v) => !isPastSchedule(v) || 'This date has already passed — please pick today or a future date',
            })}
          />
          <Textarea label="Description" rows={2} placeholder="Routine AMC maintenance visit" {...rs('description')} />
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowSchedule(false); resetS(); }}>Cancel</Button><Button type="submit" loading={ss}>Schedule</Button></div>
        </form>
      </Modal>

      <Modal open={!!rescheduleVisitId} onClose={() => { setRescheduleVisitId(null); resetR(); }} title="Reschedule Visit" size="sm">
        <form onSubmit={hr(d => rescheduleMutation.mutate(d))} className="space-y-4">
          <Input
            label="New Scheduled Date *"
            type="date"
            min={getMinimumSelectableDate()}
            error={errorsR.scheduledDate?.message}
            {...rr('scheduledDate', {
              required: 'Pick a date',
              validate: (v) => !isPastSchedule(v) || 'This date has already passed — please pick today or a future date',
            })}
          />
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setRescheduleVisitId(null); resetR(); }}>Cancel</Button><Button type="submit" loading={sr}>Reschedule</Button></div>
        </form>
      </Modal>

      <Modal open={showRenew} onClose={() => { setShowRenew(false); resetN(); }} title="Renew AMC Subscription" size="sm">
        <form onSubmit={hn(d => renewMutation.mutate(d))} className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">Renews onto the same plan starting the day after the current contract ends, unless overridden below.</p>
          <Input
            label="Start Date" type="date" hint="Leave blank to auto-continue from the current end date"
            min={getMinimumSelectableDate()}
            error={errorsN.startDate?.message}
            {...rn('startDate', { validate: (v) => !isPastSchedule(v) || 'This date has already passed — please pick today or a future date' })}
          />
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowRenew(false); resetN(); }}>Cancel</Button><Button type="submit" loading={sn}>Renew</Button></div>
        </form>
      </Modal>

      <Modal open={showCancel} onClose={() => { setShowCancel(false); resetC(); }} title="Cancel AMC Subscription" size="sm">
        <form onSubmit={hc(d => cancelMutation.mutate(d))} className="space-y-4">
          <Textarea label="Reason" {...rc('reason')} />
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowCancel(false); resetC(); }}>Cancel</Button><Button variant="danger" type="submit" loading={sc}>Cancel Subscription</Button></div>
        </form>
      </Modal>
    </div>
  );
}
