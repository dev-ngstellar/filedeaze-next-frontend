'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, DollarSign, Tag, X } from 'lucide-react';
import api from '@/lib/axios';
import { ServiceCategory, ServiceSubCategory, Skill, SubCategorySkill } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { PaginationMeta } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { getErrorMessage, validateMonetaryAmount } from '@/lib/utils';

type SubForm = { categoryId: string; name: string; isActive?: boolean };
type ChargesForm = { serviceCharge: number; inspectionCharge: number; emergencyCharge: number };

export default function ServiceSubCategoriesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ServiceSubCategory | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceSubCategory | null>(null);
  const [unmapTarget, setUnmapTarget] = useState<SubCategorySkill | null>(null);
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [skillsFor, setSkillsFor] = useState<ServiceSubCategory | null>(null);
  const [addSkillId, setAddSkillId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: categories = [] } = useQuery<ServiceCategory[]>({ queryKey: ['service-categories'], queryFn: async () => (await api.get('/web/manager/service-categories')).data.data });
  const { data, isLoading, isError, error, refetch } = useQuery<{ items: ServiceSubCategory[]; meta: PaginationMeta }>({
    queryKey: ['sub-categories', categoryFilter, page, limit],
    queryFn: async () => (await api.get('/web/manager/service-sub-categories', { params: { categoryId: categoryFilter || undefined, page, limit } })).data.data,
    placeholderData: keepPreviousData,
  });

  const subCategories = data?.items ?? [];

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<SubForm>();
  const { register: rc, handleSubmit: hc, reset: resetC, formState: { isSubmitting: sc, errors: errorsC } } = useForm<ChargesForm>();

  const openEdit = (s: ServiceSubCategory) => { setEditing(s); reset({ categoryId: s.categoryId, name: s.name, isActive: s.isActive }); };

  const saveMutation = useMutation({
    mutationFn: (d: SubForm) => editing
      ? api.patch(`/web/manager/service-sub-categories/${editing.id}`, d)
      : api.post('/web/manager/service-sub-categories', { categoryId: d.categoryId, name: d.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sub-categories'] }); toast.success(editing ? 'Updated' : 'Created'); setEditing(null); setShowCreate(false); reset(); },
    onError: (err) => toast.error(getErrorMessage(err, editing ? 'Failed to update sub-category' : 'Failed to create sub-category')),
  });

  const chargesMutation = useMutation({
    mutationFn: (d: ChargesForm) => api.post(`/web/manager/service-charges/${chargingId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sub-categories'] }); toast.success('Charges saved'); setChargingId(null); resetC(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to save charges')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/manager/service-sub-categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sub-categories'] }); toast.success('Sub-category deactivated'); setDeleteTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete sub-category')),
  });

  // ── Skill mapping — sub-categories select from the Master Skills list only ──

  const { data: mappedSkills = [] } = useQuery<SubCategorySkill[]>({
    queryKey: ['sub-category-skills', skillsFor?.id],
    queryFn: async () => (await api.get(`/web/manager/service-sub-categories/${skillsFor!.id}/skills`)).data.data.skills ?? [],
    enabled: !!skillsFor,
  });
  const { data: activeSkills = [] } = useQuery<Skill[]>({
    queryKey: ['skills', 'active'],
    queryFn: async () => (await api.get('/web/manager/skills', { params: { isActive: true } })).data.data,
    enabled: !!skillsFor,
  });

  const mapSkillMutation = useMutation({
    mutationFn: (skillId: string) => api.post(`/web/manager/service-sub-categories/${skillsFor!.id}/skills`, { skillId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sub-category-skills', skillsFor?.id] }); toast.success('Skill mapped'); setAddSkillId(''); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to map skill')),
  });
  const unmapSkillMutation = useMutation({
    mutationFn: (skillId: string) => api.delete(`/web/manager/service-sub-categories/${skillsFor!.id}/skills/${skillId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sub-category-skills', skillsFor?.id] }); toast.success('Skill removed'); setUnmapTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to remove skill')),
  });

  const catOptions = categories.map(c => ({ value: c.id, label: c.name }));
  // Only active, not-already-mapped skills are offered — matches Master Skills governance
  // (sub-categories select from the list, they never define their own).
  const unmappedActiveSkillOptions = activeSkills
    .filter(s => !mappedSkills.some(ms => ms.skillId === s.id))
    .map(s => ({ value: s.id, label: s.name }));

  const columns: ColumnDef<ServiceSubCategory, unknown>[] = [
    { accessorKey: 'name', header: 'Sub Category' },
    { accessorKey: 'category.name', header: 'Category', cell: ({ row }) => row.original.category?.name ?? '—' },
    { accessorKey: 'serviceCharges', header: 'Service ₹', cell: ({ row }) => { const c = row.original.serviceCharges; return c ? `₹${c.serviceCharge}` : '—'; } },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'default'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => setSkillsFor(row.original)} title="Manage Skills"><Tag size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => { const c = row.original.serviceCharges; setChargingId(row.original.id); resetC({ serviceCharge: c?.serviceCharge ?? 0, inspectionCharge: c?.inspectionCharge ?? 0, emergencyCharge: c?.emergencyCharge ?? 0 }); }} title="Set Charges"><DollarSign size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row.original)} className="text-red-500"><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Sub Categories</h2>
        <Button onClick={() => { setShowCreate(true); reset({ name: '', isActive: true }); }}><Plus size={15} /> New Sub Category</Button>
      </div>
      <div className="mb-4">
        <Select options={[{ value: '', label: 'All Categories' }, ...catOptions]} value={categoryFilter} onChange={e => { setPage(1); setCategoryFilter(e.target.value); }} className="w-56" />
      </div>
      <DataTable
        data={subCategories}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        pagination={data?.meta ? {
          meta: data.meta,
          onPageChange: setPage,
          onLimitChange: (l) => { setPage(1); setLimit(l); },
        } : undefined}
      />

      <Modal open={showCreate || !!editing} onClose={() => { setShowCreate(false); setEditing(null); reset(); }} title={editing ? 'Edit Sub Category' : 'New Sub Category'} size="sm">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
          <Select label="Category" options={catOptions} placeholder="Select category" {...register('categoryId', { required: true })} />
          <Input label="Name" {...register('name', { required: true })} />
          {editing && <div className="flex items-center gap-2"><input type="checkbox" id="isActive" {...register('isActive')} className="h-4 w-4" /><label htmlFor="isActive" className="text-sm text-[var(--color-text-secondary)]">Active</label></div>}
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowCreate(false); setEditing(null); reset(); }}>Cancel</Button><Button type="submit" loading={isSubmitting}>{editing ? 'Save' : 'Create'}</Button></div>
        </form>
      </Modal>

      <Modal open={!!chargingId} onClose={() => { setChargingId(null); resetC(); }} title="Set Service Charges" size="sm">
        <form onSubmit={hc(d => chargesMutation.mutate(d))} className="space-y-4">
          <Input
            label="Service Charge (₹)" type="number" step="0.01" min={0}
            error={errorsC.serviceCharge?.message}
            {...rc('serviceCharge', { valueAsNumber: true, validate: validateMonetaryAmount('Service charge') })}
          />
          <Input
            label="Inspection Charge (₹)" type="number" step="0.01" min={0}
            error={errorsC.inspectionCharge?.message}
            {...rc('inspectionCharge', { valueAsNumber: true, validate: validateMonetaryAmount('Inspection charge') })}
          />
          <Input
            label="Emergency Charge (₹)" type="number" step="0.01" min={0}
            error={errorsC.emergencyCharge?.message}
            {...rc('emergencyCharge', { valueAsNumber: true, validate: validateMonetaryAmount('Emergency charge') })}
          />
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setChargingId(null); resetC(); }}>Cancel</Button><Button type="submit" loading={sc}>Save</Button></div>
        </form>
      </Modal>

      <Modal open={!!skillsFor} onClose={() => { setSkillsFor(null); setAddSkillId(''); }} title={`Skills — ${skillsFor?.name ?? ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            Select which skills a technician needs for this sub-category. Skills come from the Master Skills list — add new ones there first.
          </p>

          {mappedSkills.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-2">No skills required yet.</p>
          ) : (
            <div className="space-y-2">
              {mappedSkills.map(ms => (
                <div key={ms.skillId} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                  <span className="font-medium">{ms.skill.name}</span>
                  <button
                    type="button"
                    onClick={() => setUnmapTarget(ms)}
                    disabled={unmapSkillMutation.isPending}
                    className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Remove"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end pt-2 border-t border-[var(--color-border)]">
            <Select
              label="Add a skill"
              options={[{ value: '', label: unmappedActiveSkillOptions.length ? 'Select skill...' : 'No more active skills to add' }, ...unmappedActiveSkillOptions]}
              value={addSkillId}
              onChange={e => setAddSkillId(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => addSkillId && mapSkillMutation.mutate(addSkillId)}
              disabled={!addSkillId || mapSkillMutation.isPending}
              loading={mapSkillMutation.isPending}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Deactivate ${deleteTarget?.name ?? 'this sub-category'}?`}
        message={`"${deleteTarget?.name ?? 'This sub-category'}" will be hidden from the active service catalog.`}
        confirmLabel="Deactivate"
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={!!unmapTarget}
        onClose={() => setUnmapTarget(null)}
        onConfirm={() => unmapTarget && unmapSkillMutation.mutate(unmapTarget.skillId)}
        title={`Remove ${unmapTarget?.skill.name ?? 'this skill'}?`}
        message={`${unmapTarget?.skill.name ?? 'This skill'} will no longer be required for ${skillsFor?.name ?? 'this sub-category'}, which may change which technicians are recommended for it.`}
        confirmLabel="Remove"
        loading={unmapSkillMutation.isPending}
      />
    </div>
  );
}
