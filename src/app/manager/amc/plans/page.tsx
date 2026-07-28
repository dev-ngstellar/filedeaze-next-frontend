'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Pencil, Ban } from 'lucide-react';
import api from '@/lib/axios';
import { AmcPlan, ServiceCategory } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { PaginationMeta } from '@/components/ui/Pagination';
import { getErrorMessage, stripLeadingZeroOnBlur, validateMonetaryAmount } from '@/lib/utils';

type PlanForm = {
  name: string;
  description: string;
  categoryId: string;
  durationMonths: number;
  visitCount: number;
  visitIntervalMonths: number;
  price: number;
};

const emptyForm: PlanForm = { name: '', description: '', categoryId: '', durationMonths: 12, visitCount: 4, visitIntervalMonths: 3, price: 0 };

export default function AmcPlansPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AmcPlan | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AmcPlan | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<PlanForm>({ defaultValues: emptyForm });
  const priceField = register('price', { required: true, validate: validateMonetaryAmount('Price') });

  // Cross-field validation, mirrored from the backend (amc-plan.service.ts's validateVisitInterval):
  // the interval can't exceed the duration, and the last generated visit — (visitCount-1) intervals
  // after the start date — can't fall after the contract ends either. Watches the same fields the
  // form already tracks, so it re-validates live as Duration/Visit Count change too, not just on
  // Visit Interval's own input.
  const watchedDuration = Number(watch('durationMonths'));
  const watchedVisitCount = Number(watch('visitCount'));
  const validateVisitInterval = (value: number) => {
    const v = Number(value);
    if (!Number.isInteger(v)) return 'Must be a whole number';
    if (v <= 0) return 'Must be a positive number';
    if (watchedDuration > 0 && v > watchedDuration) return 'Cannot exceed the AMC duration';
    const lastVisitMonth = v * (watchedVisitCount - 1);
    if (watchedDuration > 0 && lastVisitMonth > watchedDuration) {
      return `Last visit would fall at month ${lastVisitMonth}, after the ${watchedDuration}-month contract ends`;
    }
    return true;
  };

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: AmcPlan[]; meta: PaginationMeta }>({
    queryKey: ['amc-plans', page, limit],
    queryFn: async () => (await api.get('/web/manager/amc/plans', { params: { page, limit } })).data.data,
    placeholderData: keepPreviousData,
  });
  const plans = data?.items ?? [];

  const { data: categories = [] } = useQuery<ServiceCategory[]>({
    queryKey: ['service-categories'],
    queryFn: async () => (await api.get('/web/manager/service-categories')).data.data,
    enabled: showForm,
  });

  const closeForm = () => { setShowForm(false); setEditing(null); reset(emptyForm); };
  const openCreate = () => { reset(emptyForm); setEditing(null); setShowForm(true); };
  const openEdit = (plan: AmcPlan) => {
    setEditing(plan);
    reset({
      name: plan.name,
      description: plan.description ?? '',
      categoryId: plan.categoryId ?? '',
      durationMonths: plan.durationMonths,
      visitCount: plan.visitCount,
      visitIntervalMonths: plan.visitIntervalMonths,
      price: plan.price,
    });
    setShowForm(true);
  };

  const createMutation = useMutation({
    mutationFn: (d: PlanForm) => api.post('/web/manager/amc/plans', {
      name: d.name.trim(),
      description: d.description.trim() || undefined,
      categoryId: d.categoryId || undefined,
      durationMonths: Number(d.durationMonths),
      visitCount: Number(d.visitCount),
      visitIntervalMonths: Number(d.visitIntervalMonths),
      price: Number(d.price),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['amc-plans'] }); toast.success('AMC plan created'); closeForm(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create plan')),
  });

  const updateMutation = useMutation({
    mutationFn: (d: PlanForm) => api.patch(`/web/manager/amc/plans/${editing!.id}`, {
      name: d.name.trim(),
      description: d.description.trim() || undefined,
      categoryId: d.categoryId || undefined,
      durationMonths: Number(d.durationMonths),
      visitCount: Number(d.visitCount),
      visitIntervalMonths: Number(d.visitIntervalMonths),
      price: Number(d.price),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['amc-plans'] }); toast.success('AMC plan updated'); closeForm(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update plan')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/manager/amc/plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['amc-plans'] }); toast.success('AMC plan deactivated'); setDeactivateTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to deactivate plan')),
  });

  const columns: ColumnDef<AmcPlan, unknown>[] = [
    { accessorKey: 'name', header: 'Plan Name' },
    { accessorKey: 'category.name', header: 'Category', cell: ({ row }) => row.original.category?.name ?? 'Any' },
    { accessorKey: 'durationMonths', header: 'Duration', cell: ({ row }) => `${row.original.durationMonths} mo` },
    { accessorKey: 'visitCount', header: 'Visits' },
    { accessorKey: 'price', header: 'Price', cell: ({ row }) => `₹${row.original.price.toLocaleString()}` },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => row.original.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="default" showDot={false}>Inactive</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}><Pencil size={14} /></Button>
          {row.original.isActive && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setDeactivateTarget(row.original)}><Ban size={14} /></Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">AMC Plans</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Define the maintenance contracts customers can subscribe their assets to</p>
        </div>
        <Button onClick={openCreate}><Plus size={15} /> New Plan</Button>
      </div>

      <DataTable
        data={plans}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        pagination={data?.meta ? { meta: data.meta, onPageChange: setPage, onLimitChange: (l) => { setPage(1); setLimit(l); } } : undefined}
      />

      <Modal open={showForm} onClose={closeForm} title={editing ? 'Edit AMC Plan' : 'New AMC Plan'} size="lg">
        <form onSubmit={handleSubmit(d => editing ? updateMutation.mutate(d) : createMutation.mutate(d))} className="space-y-4">
          <Input label="Plan Name *" placeholder="e.g. Gold AC Care" error={errors.name?.message} {...register('name', { required: 'Name is required' })} />
          <Select
            label="Restrict to Category"
            options={categories.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Any category"
            {...register('categoryId')}
          />
          <Textarea label="Description" rows={2} {...register('description')} />
          {/* min-h reserves the same vertical space on every field whether or not its own
              validation message is currently showing, so an error on one field never shifts its
              siblings out of alignment — all four stay equal-height and level regardless. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-start">
            <div className="min-h-[86px]">
              <Input label="Duration (months) *" type="number" min={1} step={1} error={errors.durationMonths?.message} {...register('durationMonths', { required: true, min: { value: 1, message: 'At least 1 month' } })} />
            </div>
            <div className="min-h-[86px]">
              <Input label="Visit Count *" type="number" min={1} step={1} error={errors.visitCount?.message} {...register('visitCount', { required: true, min: { value: 1, message: 'At least 1 visit' } })} />
            </div>
            <div className="min-h-[86px]">
              <Input
                label="Interval (months) *" type="number" min={1} step={1}
                hint="Months between each scheduled visit"
                error={errors.visitIntervalMonths?.message}
                {...register('visitIntervalMonths', { required: 'Required', min: { value: 1, message: 'Must be at least 1' }, validate: validateVisitInterval })}
              />
            </div>
            <div className="min-h-[86px]">
              <Input
                label="Price (₹) *" type="number" min={0} error={errors.price?.message}
                {...priceField}
                onBlur={(e) => { stripLeadingZeroOnBlur(e); priceField.onBlur(e); }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save Changes' : <><Plus size={14} /> Create Plan</>}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
        title="Deactivate this plan?"
        message={`"${deactivateTarget?.name}" will no longer be available for new AMC assignments. Existing subscriptions are unaffected.`}
        confirmLabel="Deactivate"
        loading={deactivateMutation.isPending}
      />
    </div>
  );
}
