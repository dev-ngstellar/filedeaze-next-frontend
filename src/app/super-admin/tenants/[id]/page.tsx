'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import api from '@/lib/axios';
import { Tenant, Plan, Billing, PlatformUpi } from '@/types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { emailSchema, phoneSchema, requiredString } from '@/lib/validations';

const schema = z.object({
  companyName: requiredString('Company name is required'),
  email: emailSchema,
  phone: phoneSchema,
  address: requiredString('Address is required'),
});

type Form = z.infer<typeof schema>;
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge, TenantStatusBadge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import dayjs from 'dayjs';
import { Users, CreditCard, Calendar, Download, QrCode, Building2, ChevronLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import { cn, getErrorMessage } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type SubAction = 'renew' | 'suspend' | 'resume' | 'cancel' | 'upgrade-downgrade';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showQr, setShowQr] = useState(false);

  const { data: tenant, isLoading, isError, error, refetch, isFetching } = useQuery<Tenant>({
    queryKey: ['tenant', id],
    queryFn: async () => (await api.get(`/web/super-admin/tenants/${id}`)).data.data,
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => (await api.get('/web/super-admin/plans')).data.data,
  });

  const { data: billings = [], isLoading: billingsLoading, isError: billingsError, error: billingsErr, refetch: refetchBillings } = useQuery<Billing[]>({
    queryKey: ['tenant-billings', id],
    queryFn: async () => {
      const res = await api.get(`/web/super-admin/billing`, { params: { tenantId: id } });
      const d = res.data.data;
      return Array.isArray(d) ? d : (d?.billings ?? d?.items ?? []);
    },
  });

  const { data: tenantSubs = [] } = useQuery<any[]>({
    queryKey: ['tenant-subscriptions', id],
    queryFn: async () => {
      const res = await api.get('/web/super-admin/subscriptions', { params: { tenantId: id, limit: 50 } });
      return res.data.data?.subscriptions ?? [];
    },
    enabled: !!id,
  });

  const { data: platformUpi } = useQuery<PlatformUpi>({
    queryKey: ['platform-upi'],
    queryFn: async () => (await api.get('/web/super-admin/platform-upi')).data.data,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isValid, isDirty } } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onChange'
  });

  useEffect(() => {
    if (tenant) reset({ companyName: tenant.companyName, email: tenant.email, phone: tenant.phone, address: tenant.address });
  }, [tenant, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Tenant>) => api.patch(`/web/super-admin/tenants/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant', id] }); toast.success('Tenant updated'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update tenant')),
  });

  const currentSub = tenant?.subscription ?? null;
  const [newPlanId, setNewPlanId] = useState('');
  const [udPaymentStatus, setUdPaymentStatus] = useState('PAID');
  const [confirmAction, setConfirmAction] = useState<SubAction | null>(null);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['tenant', id] });
    qc.invalidateQueries({ queryKey: ['tenant-subscriptions', id] });
    qc.invalidateQueries({ queryKey: ['tenants'] });
  };

  const renewMutation = useMutation({
    mutationFn: () => api.post('/web/super-admin/subscriptions/renew', { tenantId: id, paymentStatus: 'PENDING' }),
    onSuccess: (res) => { toast.success(res.data.message ?? 'Subscription renewed'); invalidateAll(); setConfirmAction(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to renew subscription')),
  });

  const upgradeDowngradeMutation = useMutation({
    mutationFn: () => {
      const newPlan = plans.find(p => p.id === newPlanId);
      const direction = Number(newPlan?.price) > Number(currentPlan?.price ?? 0) ? 'upgrade' : 'downgrade';
      return api.patch(`/web/super-admin/subscriptions/${currentSub!.id}/${direction}`, { planId: newPlanId, paymentStatus: udPaymentStatus });
    },
    onSuccess: (res) => { toast.success(res.data.message ?? 'Plan changed'); setNewPlanId(''); invalidateAll(); setConfirmAction(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to change plan')),
  });

  const suspendSubMutation = useMutation({
    mutationFn: () => api.patch(`/web/super-admin/subscriptions/${currentSub!.id}/suspend`),
    onSuccess: () => { toast.success('Subscription suspended'); invalidateAll(); setConfirmAction(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to suspend subscription')),
  });

  const resumeSubMutation = useMutation({
    mutationFn: () => api.patch(`/web/super-admin/subscriptions/${currentSub!.id}/resume`),
    onSuccess: (res) => { toast.success(res.data.message ?? 'Subscription resumed'); invalidateAll(); setConfirmAction(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to resume subscription')),
  });

  const cancelSubMutation = useMutation({
    mutationFn: () => api.patch(`/web/super-admin/subscriptions/${currentSub!.id}/cancel`),
    onSuccess: () => { toast.success('Subscription cancelled'); invalidateAll(); setConfirmAction(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to cancel subscription')),
  });

  const billingColumns: ColumnDef<Billing, unknown>[] = [
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => <span className="font-semibold text-[var(--color-text-primary)]">₹{row.original.amount.toLocaleString()}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'PAID' ? 'success' : 'warning'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Billed On',
      cell: ({ row }) => dayjs(row.original.createdAt).format('DD MMM YYYY'),
    },
    {
      accessorKey: 'paidAt',
      header: 'Paid At',
      cell: ({ row }) => row.original.paidAt ? dayjs(row.original.paidAt).format('DD MMM YYYY') : '—',
    },
  ];

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />;
  if (!tenant) return <ErrorState title="Tenant not found" message="This tenant may have been removed or the link is incorrect." onRetry={refetch} />;

  const currentPlan = tenant.subscription?.plan ?? tenant.selectedPlan ?? null;
  const currentPlanId = tenant.subscription?.planId ?? tenant.selectedPlanId ?? '';

  const upiQrString = currentPlan && platformUpi?.upiId
    ? `upi://pay?pa=${platformUpi.upiId}&pn=${encodeURIComponent(platformUpi.upiAccountName || 'FieldEaze')}&am=${currentPlan.price}&tn=${tenant.tenantCode}-subscription&cu=INR`
    : '';

  function downloadQr() {
    const canvas = document.querySelector('#tenant-qr-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${tenant!.tenantCode}-payment-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const initials = tenant.companyName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="max-w-3xl space-y-5">
      {/* Back link */}
      <Link
        href="/super-admin/tenants"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <ChevronLeft size={14} />
        Back to Tenants
      </Link>

      {/* Tenant Profile Header */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{tenant.companyName}</h2>
              <TenantStatusBadge status={tenant.status} />
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-[var(--color-text-muted)] flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 size={11} />
                <code className="font-mono">{tenant.tenantCode}</code>
              </span>
              <span>{tenant.email}</span>
              {tenant.phone && <span>{tenant.phone}</span>}
            </div>
            {(tenant.adminName || tenant.adminEmail) && (
              <div className="flex items-center gap-4 mt-1 text-xs flex-wrap">
                <span className="text-[var(--color-text-muted)]">Admin:</span>
                {tenant.adminName && <span className="font-medium text-[var(--color-text-secondary)]">{tenant.adminName}</span>}
                {tenant.adminEmail && <span className="text-[var(--color-text-muted)]">{tenant.adminEmail}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Stats Row — always sourced from the linked subscription, never a separate tenant-level copy */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5 pt-5 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center shrink-0">
              <CreditCard size={15} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Current Plan</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {currentPlan?.name ?? '—'}
                {tenant.durationDays != null && <span className="text-xs font-normal text-[var(--color-text-muted)]"> · {tenant.durationDays}d</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center shrink-0">
              <Calendar size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Start Date</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {tenant.subscription?.startDate ? dayjs(tenant.subscription.startDate).format('DD MMM YYYY') : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center shrink-0">
              <Calendar size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">End Date</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {tenant.subscription?.endDate ? dayjs(tenant.subscription.endDate).format('DD MMM YYYY') : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center shrink-0">
              <Clock size={15} className="text-red-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Days Remaining</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {tenant.daysRemaining != null ? `${tenant.daysRemaining}d` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center shrink-0">
              <Users size={15} className="text-violet-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Billing Records</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{billings.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Details */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-blue-500" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Edit Details</h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Company Name *" {...register('companyName')} error={errors.companyName?.message} />
            <Input label="Email *" type="email" {...register('email')} error={errors.email?.message} />
            <Input label="Phone *" {...register('phone')} error={errors.phone?.message} />
            <Textarea label="Address *" {...register('address')} error={errors.address?.message} />
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" loading={isSubmitting} disabled={!isValid || !isDirty}>Save Changes</Button>
            </div>
          </form>
        </div>
      </div>

      {/* Subscription Actions — everything here operates on the tenant's linked subscription,
          never on the Tenant row directly, so subscription and tenant status can never drift apart. */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-amber-500" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Subscription Actions</h3>
        </div>
        <div className="p-6 space-y-4">
          {!currentSub ? (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              This tenant has no linked subscription on record — contact engineering.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {['ACTIVE', 'TRIAL'].includes(currentSub.status) && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmAction('renew')}>Renew</Button>
                    <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setConfirmAction('suspend')}>Suspend</Button>
                  </>
                )}
                {currentSub.status === 'SUSPENDED' && (
                  <Button size="sm" onClick={() => setConfirmAction('resume')}>Resume</Button>
                )}
                {currentSub.status !== 'CANCELLED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setConfirmAction('cancel')}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {['ACTIVE', 'TRIAL'].includes(currentSub.status) && (
                <div className="pt-3 border-t border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">Upgrade / Downgrade Plan</p>
                  <div className="flex gap-3 items-end flex-wrap">
                    <Select
                      label="New Plan"
                      options={[{ value: '', label: 'Select plan...' }, ...plans.filter(p => p.isActive && p.id !== currentPlanId).map(p => ({ value: p.id, label: `${p.name} — ₹${p.price}` }))]}
                      value={newPlanId}
                      onChange={e => setNewPlanId(e.target.value)}
                      className="w-56"
                    />
                    <Select
                      label="Payment Status"
                      options={[{ value: 'PAID', label: 'Paid' }, { value: 'PENDING', label: 'Pending' }]}
                      value={udPaymentStatus}
                      onChange={e => setUdPaymentStatus(e.target.value)}
                      className="w-32"
                    />
                    <Button size="sm" disabled={!newPlanId} onClick={() => setConfirmAction('upgrade-downgrade')}>Apply</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Payment QR */}
      {currentPlan && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-1 w-4 rounded-full bg-violet-500" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <QrCode size={15} className="text-violet-500" /> Payment QR
              </h3>
            </div>
            {platformUpi?.upiId && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowQr(v => !v)}>
                  {showQr ? 'Hide QR' : 'Generate QR'}
                </Button>
                {showQr && (
                  <Button size="sm" variant="secondary" onClick={downloadQr}>
                    <Download size={13} /> Download
                  </Button>
                )}
              </div>
            )}
          </div>
          {!platformUpi?.upiId ? (
            <div className="p-6">
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <QrCode size={17} className="text-amber-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-amber-800">Platform UPI Settings Missing</p>
                  <p className="text-xs text-amber-600 leading-relaxed max-w-xl">
                    You must configure the platform receiving UPI account details in Settings before you can generate payment QR codes for subscriptions.
                  </p>
                  <Link href="/super-admin/platform-settings" className="inline-block mt-1">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-none text-xs">
                      Go to Platform Settings
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            showQr && (
              <div className="p-6 flex flex-col sm:flex-row gap-6 items-start animate-fe-fade-in">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm">
                    <QRCodeCanvas
                      id="tenant-qr-canvas"
                      value={upiQrString}
                      size={150}
                      level="M"
                      marginSize={2}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">Scan to pay via UPI</p>
                </div>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Plan', value: currentPlan.name },
                    { label: 'Amount', value: `₹${Number(currentPlan.price).toLocaleString()}`, bold: true },
                    { label: 'Tenant', value: tenant.companyName },
                  ].map(({ label, value, bold }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
                      <p className={cn('text-[var(--color-text-primary)]', bold ? 'text-xl font-bold' : 'font-semibold')}>{value}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">UPI String</p>
                    <p className="font-mono text-xs text-[var(--color-text-muted)] break-all max-w-xs bg-[var(--color-surface-elevated)] p-2 rounded-lg">{upiQrString}</p>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Subscription History Table */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Subscriptions</h3>
          {tenantSubs.length > 0 && (
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">{tenantSubs.length} record{tenantSubs.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          {tenantSubs.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                {tenant.subscription ? 'Loading...' : 'No subscriptions yet.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                  {['Plan Name', 'Duration', 'Start Date', 'End Date', 'Days Remaining', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tenantSubs.map((s: any) => {
                  const statusStyle: Record<string, string> = {
                    ACTIVE:    'bg-emerald-100 text-emerald-700',
                    EXPIRED:   'bg-gray-100 text-gray-500',
                    CANCELLED: 'bg-red-100 text-red-600',
                    QUEUED:    'bg-amber-100 text-amber-700',
                    TRIAL:     'bg-blue-100 text-blue-700',
                  };
                  const daysLeft = s.endDate ? Math.max(0, dayjs(s.endDate).diff(dayjs(), 'day')) : 0;
                  const isActive = s.status === 'ACTIVE';
                  return (
                    <tr key={s.id} className={`transition-colors ${isActive ? 'bg-emerald-50/40' : 'hover:bg-[var(--color-surface-elevated)]'}`}>
                      <td className="px-5 py-3 font-medium text-[var(--color-text-primary)]">
                        {s.plan?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                        {s.plan?.durationDays ? `${s.plan.durationDays} days` : '—'}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                        {dayjs(s.startDate).format('DD MMM YYYY')}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={isActive && daysLeft <= 30 ? 'text-amber-600 font-medium' : 'text-[var(--color-text-secondary)]'}>
                          {dayjs(s.endDate).format('DD MMM YYYY')}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={isActive && daysLeft <= 7 ? 'text-red-600 font-medium' : 'text-[var(--color-text-secondary)]'}>
                          {isActive || s.status === 'TRIAL' ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusStyle[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-[var(--color-surface-elevated)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Billing History</h3>
        </div>
        <div className="p-6">
          {billings.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No billing records found.</p>
          ) : (
            <DataTable data={billings} columns={billingColumns} isLoading={billingsLoading} isError={billingsError} error={billingsErr} onRetry={refetchBillings} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === 'renew') renewMutation.mutate();
          else if (confirmAction === 'suspend') suspendSubMutation.mutate();
          else if (confirmAction === 'resume') resumeSubMutation.mutate();
          else if (confirmAction === 'cancel') cancelSubMutation.mutate();
          else if (confirmAction === 'upgrade-downgrade') upgradeDowngradeMutation.mutate();
        }}
        loading={
          renewMutation.isPending || suspendSubMutation.isPending || resumeSubMutation.isPending ||
          cancelSubMutation.isPending || upgradeDowngradeMutation.isPending
        }
        tone={confirmAction === 'suspend' || confirmAction === 'cancel' ? 'danger' : 'neutral'}
        title={
          confirmAction === 'renew' ? `Renew ${tenant.companyName}'s subscription?` :
          confirmAction === 'suspend' ? `Suspend ${tenant.companyName}'s subscription?` :
          confirmAction === 'resume' ? `Resume ${tenant.companyName}'s subscription?` :
          confirmAction === 'cancel' ? `Cancel ${tenant.companyName}'s subscription?` :
          confirmAction === 'upgrade-downgrade' ? `Change ${tenant.companyName}'s plan?` :
          ''
        }
        message={
          confirmAction === 'renew' ? `This renews the current plan (${currentPlan?.name ?? '—'}) for another billing cycle, marked as payment pending.` :
          confirmAction === 'suspend' ? `${tenant.companyName} will immediately lose access until the subscription is resumed.` :
          confirmAction === 'resume' ? `${tenant.companyName} will regain access to their account.` :
          confirmAction === 'cancel' ? `${tenant.companyName} will lose access once cancelled. This does not delete their data.` :
          confirmAction === 'upgrade-downgrade' ? `${tenant.companyName} will move from ${currentPlan?.name ?? 'their current plan'} to ${plans.find(p => p.id === newPlanId)?.name ?? 'the selected plan'}.` :
          ''
        }
        confirmLabel={
          confirmAction === 'renew' ? 'Renew' :
          confirmAction === 'suspend' ? 'Suspend' :
          confirmAction === 'resume' ? 'Resume' :
          confirmAction === 'cancel' ? 'Cancel Subscription' :
          confirmAction === 'upgrade-downgrade' ? 'Apply' : 'Confirm'
        }
      />
    </div>
  );
}
