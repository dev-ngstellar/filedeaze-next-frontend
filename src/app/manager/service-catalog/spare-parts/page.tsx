'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Pencil, Ban, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { SparePart } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaginationMeta } from '@/components/ui/Pagination';
import { getErrorMessage, validateMonetaryAmount } from '@/lib/utils';

// Backend requires a unitOfMeasure; the manager form no longer collects it, so every part defaults to this.
const DEFAULT_UNIT_OF_MEASURE = 'unit';

type PartForm = {
  partName: string;
  unitPrice: number;
};

const emptyForm: PartForm = { partName: '', unitPrice: 0 };

export default function SparePartsPage() {
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const searchParams = useSearchParams();
  const subCategoryId = searchParams.get('subCategoryId') ?? '';
  const subCategoryName = searchParams.get('subCategoryName') ?? 'Service';
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SparePart | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<SparePart | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PartForm>({ defaultValues: emptyForm });

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: SparePart[]; meta: PaginationMeta }>({
    queryKey: ['spare-parts', subCategoryId, query, page, limit],
    queryFn: async () => (await api.get(`/web/manager/service-sub-categories/${subCategoryId}/spare-parts`, {
      params: { search: query || undefined, page, limit },
    })).data.data,
    enabled: !!subCategoryId,
    placeholderData: keepPreviousData,
  });
  const parts = data?.items ?? [];

  const closeForm = () => { setShowForm(false); setEditing(null); reset(emptyForm); };
  const openCreate = () => { reset(emptyForm); setEditing(null); setShowForm(true); };
  const openEdit = (part: SparePart) => {
    setEditing(part);
    reset({ partName: part.partName, unitPrice: part.unitPrice });
    setShowForm(true);
  };

  const createMutation = useMutation({
    mutationFn: (d: PartForm) => api.post(`/web/manager/service-sub-categories/${subCategoryId}/spare-parts`, {
      partName: d.partName.trim(),
      unitPrice: Number(d.unitPrice),
      unitOfMeasure: DEFAULT_UNIT_OF_MEASURE,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spare-parts'] }); toast.success('Spare part added'); closeForm(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to add spare part')),
  });

  const updateMutation = useMutation({
    mutationFn: (d: PartForm) => api.patch(`/web/manager/service-sub-categories/${subCategoryId}/spare-parts/${editing!.id}`, {
      partName: d.partName.trim(),
      unitPrice: Number(d.unitPrice),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spare-parts'] }); toast.success('Spare part updated'); closeForm(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update spare part')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/manager/service-sub-categories/${subCategoryId}/spare-parts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spare-parts'] }); toast.success('Spare part removed'); setDeactivateTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to remove spare part')),
  });

  if (!subCategoryId) {
    return (
      <EmptyState
        message="No service selected"
        description="Open a service from the Service Catalog to manage its spare parts."
        action={<Link href={`/${prefix}/service-catalog`}><Button variant="secondary"><ChevronLeft size={14} /> Back to Service Catalog</Button></Link>}
      />
    );
  }

  const columns: ColumnDef<SparePart, unknown>[] = [
    { accessorKey: 'partName', header: 'Part Name' },
    { accessorKey: 'unitPrice', header: 'Unit Price', cell: ({ row }) => `₹${row.original.unitPrice.toLocaleString()}` },
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
      <Link href={`/${prefix}/service-catalog`} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors mb-3">
        <ChevronLeft size={14} /> Back to Service Catalog
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Spare Parts — {subCategoryName}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Parts commonly used for this service, with pricing</p>
        </div>
        <Button onClick={openCreate}><Plus size={15} /> Add Spare Part</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <Input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} className="w-80" />
        <Button variant="secondary" onClick={() => { setPage(1); setQuery(search); }}>Search</Button>
      </div>

      <DataTable
        data={parts}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        pagination={data?.meta ? { meta: data.meta, onPageChange: setPage, onLimitChange: (l) => { setPage(1); setLimit(l); } } : undefined}
      />

      <Modal open={showForm} onClose={closeForm} title={editing ? 'Edit Spare Part' : 'Add Spare Part'} size="md">
        <form onSubmit={handleSubmit(d => editing ? updateMutation.mutate(d) : createMutation.mutate(d))} className="space-y-4">
          <Input label="Part Name *" placeholder="e.g. Compressor" error={errors.partName?.message} {...register('partName', { required: 'Part name is required' })} />

          <Input
            label="Unit Price (₹) *"
            type="number"
            min={0}
            step="0.01"
            error={errors.unitPrice?.message}
            {...register('unitPrice', { required: true, valueAsNumber: true, validate: validateMonetaryAmount('Unit price') })}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save Changes' : <><Plus size={14} /> Add Part</>}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
        title="Remove this spare part?"
        message={`"${deactivateTarget?.partName}" will be deactivated and hidden from active lists. This cannot be undone from here.`}
        confirmLabel="Remove"
        loading={deactivateMutation.isPending}
      />
    </div>
  );
}
