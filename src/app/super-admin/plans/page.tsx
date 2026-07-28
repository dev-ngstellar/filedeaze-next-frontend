'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users, Ticket, HardDrive, ShieldCheck } from 'lucide-react';
import api from '@/lib/axios';
import { Plan } from '@/types';
import { PlanBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination, PaginationMeta } from '@/components/ui/Pagination';
import { cn, getErrorMessage, hasMoreThanTwoDecimals } from '@/lib/utils';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { requiredString } from '@/lib/validations';

const planSchema = z.object({
  name: requiredString('Plan name is required').max(50, 'Max 50 characters'),
  price: z.number({ message: 'Price is required' })
    .min(0, 'Price cannot be negative')
    .refine((v) => !hasMoreThanTwoDecimals(v), 'Price can contain up to 2 decimal places'),
  managerLimit: z.number({ message: 'Manager limit is required' }).min(1, 'Manager limit must be greater than 0'),
  technicianLimit: z.number({ message: 'Technician limit is required' }).min(1, 'Technician limit must be greater than 0'),
  ticketLimit: z.number({ message: 'Ticket limit is required' }).min(1, 'Ticket limit must be greater than 0'),
  customerLimit: z.number({ message: 'Customer limit is required' }).min(1, 'Customer limit must be greater than 0'),
  storageLimitGb: z.number({ message: 'Storage limit is required' }).min(1, 'Storage limit must be greater than 0'),
  durationDays: z.number({ message: 'Duration is required' }).min(1, 'Must be at least 1 day').nullable(),
  isTrial: z.boolean(),
  isActive: z.boolean(),
});

type Form = z.infer<typeof planSchema>;

const lim = (v: number) => (v >= 99999 ? 'Unlimited' : v.toLocaleString());


export default function PlansPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ items: Plan[]; meta: PaginationMeta }>({
    queryKey: ['plans', 'paged', page, limit],
    queryFn: async () => (await api.get('/web/super-admin/plans', { params: { page, limit } })).data.data,
    placeholderData: keepPreviousData,
  });

  const plans = data?.items ?? [];
  const meta = data?.meta;

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting, isValid, isDirty } } = useForm<Form>({
    resolver: zodResolver(planSchema),
    defaultValues: { isTrial: false, isActive: true, durationDays: null },
    mode: 'onChange',
  });
  const watchIsTrial = watch('isTrial');
  const watchIsActive = watch('isActive');

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    reset({
      name: plan.name,
      price: plan.price,
      managerLimit: plan.managerLimit,
      technicianLimit: plan.technicianLimit,
      ticketLimit: plan.ticketLimit,
      customerLimit: (plan as any).customerLimit ?? 99999,
      storageLimitGb: plan.storageLimitGb,
      durationDays: (plan as any).durationDays ?? null,
      isTrial: (plan as any).isTrial ?? false,
      isActive: plan.isActive ?? true,
    });
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['plans'] });
    qc.invalidateQueries({ queryKey: ['tenants'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: (data: Form) => {
      const clean = { ...data, durationDays: data.durationDays || undefined, isTrial: data.isTrial ?? false, isActive: data.isActive ?? true };
      if (editing) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { name: _n, ...payload } = clean;
        return api.patch(`/web/super-admin/plans/${editing.id}`, payload);
      }
      return api.post('/web/super-admin/plans', clean);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? 'Plan updated' : 'Plan created');
      setEditing(null); setShowCreate(false); reset();
    },
    onError: (err) => toast.error(getErrorMessage(err, editing ? 'Failed to update plan' : 'Failed to create plan')),
  });

  const toggleMutation = useMutation({
    mutationFn: (plan: Plan) => api.patch(`/web/super-admin/plans/${plan.id}`, { isActive: !plan.isActive }),
    onSuccess: () => { invalidate(); toast.success('Plan status updated'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update plan status')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/super-admin/plans/${id}`),
    onSuccess: () => { invalidate(); toast.success('Plan deleted'); setDeleteTarget(null); },
    onError: (err) => { toast.error(getErrorMessage(err, 'Failed to delete plan')); setDeleteTarget(null); },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Subscription Plans</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Manage plan tiers, limits, and pricing</p>
        </div>
        <Button onClick={() => { setShowCreate(true); reset(); }}>
          <Plus size={15} /> New Plan
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                {['Plan', 'Price', 'Duration', 'Managers', 'Technicians', 'Tickets', 'Customers', 'Storage', 'Active', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-[var(--color-surface-elevated)] rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : isError ? (
                <tr><td colSpan={10}><ErrorState error={error} onRetry={refetch} isRetrying={isFetching} /></td></tr>
              ) : plans.length === 0 ? (
                <tr><td colSpan={10}><EmptyState message="No plans yet" description="Create one to get started." /></td></tr>
              ) : plans.map(plan => (
                <tr key={plan.id} className="hover:bg-[var(--color-surface-elevated)] transition-colors">
                  {/* Plan name */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <PlanBadge planName={plan.name} />
                      {(plan as any).isTrial && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">Trial</span>
                      )}
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-5 py-4 font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                    ₹{Number(plan.price).toLocaleString()}
                  </td>

                  {/* Duration */}
                  <td className="px-5 py-4 text-[var(--color-text-secondary)] whitespace-nowrap">
                    {(plan as any).durationDays ? `${(plan as any).durationDays} days` : '—'}
                  </td>

                  {/* Managers */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <Users size={12} className="text-[var(--color-text-muted)]" />
                      {lim(plan.managerLimit)}
                    </div>
                  </td>

                  {/* Technicians */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <Users size={12} className="text-[var(--color-text-muted)]" />
                      {lim(plan.technicianLimit)}
                    </div>
                  </td>

                  {/* Tickets */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <Ticket size={12} className="text-[var(--color-text-muted)]" />
                      {lim(plan.ticketLimit)}
                    </div>
                  </td>

                  {/* Customers */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <Users size={12} className="text-[var(--color-text-muted)]" />
                      {lim((plan as any).customerLimit ?? 99999)}
                    </div>
                  </td>

                  {/* Storage */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <HardDrive size={12} className="text-[var(--color-text-muted)]" />
                      {plan.storageLimitGb} GB
                    </div>
                  </td>

                  {/* Active toggle */}
                  <td className="px-5 py-4">
                    <button
                      className="flex items-center gap-2"
                      onClick={() => toggleMutation.mutate(plan)}
                      disabled={toggleMutation.isPending}
                      title={plan.isActive ? 'Click to deactivate' : 'Click to activate'}
                    >
                      <div className={`relative h-5 w-10 rounded-full transition-colors ${plan.isActive ? 'bg-blue-500' : 'bg-gray-300'} ${toggleMutation.isPending ? 'opacity-50' : ''}`}>
                        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${plan.isActive ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className={`text-xs font-medium ${plan.isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(plan)}
                        className="h-8 w-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                        title="Edit plan"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(plan)}
                        className="h-8 w-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:border-red-300 hover:text-red-500 transition-colors"
                        title="Delete plan"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && meta && meta.total > 0 && (
          <div className="px-4 border-t border-[var(--color-border)]">
            <Pagination
              page={meta.currentPage}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={setPage}
              onLimitChange={(l) => { setPage(1); setLimit(l); }}
            />
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={showCreate || !!editing}
        onClose={() => { setShowCreate(false); setEditing(null); reset(); }}
        title={editing ? 'Edit Plan' : 'Create Subscription Plan'}
      >
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-5">
          {editing ? (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3">
              <ShieldCheck size={14} className="text-[var(--color-primary)]" />
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{editing.name}</span>
              <span className="text-xs text-[var(--color-text-muted)] ml-1">— name cannot be changed</span>
            </div>
          ) : (
            <Input
              label="Plan Name *"
              placeholder="e.g. STARTER, GOLD, ENTERPRISE"
              {...register('name')}
              error={errors.name?.message}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Price (₹) *" type="number" {...register('price', { valueAsNumber: true })} error={errors.price?.message} />
            <Input label="Manager Limit *" type="number" {...register('managerLimit', { valueAsNumber: true })} error={errors.managerLimit?.message} />
            <Input label="Technician Limit *" type="number" {...register('technicianLimit', { valueAsNumber: true })} error={errors.technicianLimit?.message} />
            <Input label="Ticket Limit *" type="number" {...register('ticketLimit', { valueAsNumber: true })} error={errors.ticketLimit?.message} />
            <Input label="Customer Limit *" type="number" {...register('customerLimit', { valueAsNumber: true })} error={errors.customerLimit?.message} />
            <Input label="Storage (GB) *" type="number" {...register('storageLimitGb', { valueAsNumber: true })} error={errors.storageLimitGb?.message} />
          </div>

          {/* Make Active + Free Trial toggles — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Make Active?</p>
                <p className="text-xs text-[var(--color-text-muted)]">Visible to tenants</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="sr-only peer" {...register('isActive')} />
                <div className={cn(
                  'relative h-5 w-10 rounded-full bg-gray-200 transition-colors',
                  'after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[""]',
                  'peer-checked:bg-blue-500 peer-checked:after:translate-x-5',
                )} />
                <span className={`text-xs font-medium ${watchIsActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {watchIsActive ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Free Trial Plan?</p>
                <p className="text-xs text-[var(--color-text-muted)]">{watchIsTrial ? 'Trial period' : 'Paid plan'}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="sr-only peer" {...register('isTrial')} />
                <div className={cn(
                  'relative h-5 w-10 rounded-full bg-gray-200 transition-colors',
                  'after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[""]',
                  'peer-checked:bg-blue-500 peer-checked:after:translate-x-5',
                )} />
                <span className={`text-xs font-medium ${watchIsTrial ? 'text-blue-600' : 'text-gray-400'}`}>
                  {watchIsTrial ? 'Trial' : 'Standard'}
                </span>
              </label>
            </div>
          </div>

          {/* Duration — same field for trial and paid plans; the Free Trial toggle above only changes subscription status, not the duration math */}
          <Input
            label="Duration (Days) *"
            type="number"
            placeholder="e.g. 30"
            {...register('durationDays', {
              setValueAs: v => (v === '' || v === null || v === undefined ? null : isNaN(Number(v)) ? null : Number(v)),
            })}
            error={errors.durationDays?.message}
          />

          <div className="flex justify-end gap-3 pt-1 border-t border-[var(--color-border)]">
            <Button variant="outline" type="button" onClick={() => { setShowCreate(false); setEditing(null); reset(); }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting} disabled={!isValid || (!isDirty && !editing)}>
              {editing ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        title="Delete Plan"
        message={`Delete "${deleteTarget?.name}"? Plans with active subscriptions cannot be deleted — deactivate instead.`}
        confirmLabel="Delete Plan"
      />
    </div>
  );
}
