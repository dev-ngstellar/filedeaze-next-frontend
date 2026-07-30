'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/axios';
import { ServiceCategory } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { PaginationMeta } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { getErrorMessage } from '@/lib/utils';

type Form = { name: string; isActive: boolean };

export default function ServiceCategoriesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategory | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: ServiceCategory[]; meta: PaginationMeta }>({
    queryKey: ['service-categories', page, limit],
    queryFn: async () => (await api.get('/web/manager/service-categories', { params: { page, limit } })).data.data,
    placeholderData: keepPreviousData,
  });

  const categories = data?.items ?? [];

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Form>();

  const openEdit = (c: ServiceCategory) => { setEditing(c); reset({ name: c.name, isActive: c.isActive }); };

  const saveMutation = useMutation({
    mutationFn: (d: Form) => editing ? api.patch(`/web/manager/service-categories/${editing.id}`, d) : api.post('/web/manager/service-categories', { name: d.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-categories'] }); toast.success(editing ? 'Updated' : 'Created'); setEditing(null); setShowCreate(false); reset(); },
    onError: (err) => toast.error(getErrorMessage(err, editing ? 'Failed to update category' : 'Failed to create category')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/manager/service-categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-categories'] }); toast.success('Category deleted'); setDeleteTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete category')),
  });

  const columns: ColumnDef<ServiceCategory, unknown>[] = [
    { accessorKey: 'name', header: 'Category Name' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'default'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row.original)} className="text-red-500"><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Service Categories</h2>
        <Button onClick={() => { setShowCreate(true); reset({ name: '', isActive: true }); }}><Plus size={15} /> New Category</Button>
      </div>
      <DataTable
        data={categories}
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

      <Modal open={showCreate || !!editing} onClose={() => { setShowCreate(false); setEditing(null); reset(); }} title={editing ? 'Edit Category' : 'New Category'} size="sm">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
          <Input label="Name" {...register('name', { required: true })} />
          {editing && <div className="flex items-center gap-2"><input type="checkbox" id="isActive" {...register('isActive')} className="h-4 w-4" /><label htmlFor="isActive" className="text-sm text-[var(--color-text-secondary)]">Active</label></div>}
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowCreate(false); setEditing(null); reset(); }}>Cancel</Button><Button type="submit" loading={isSubmitting}>{editing ? 'Save' : 'Create'}</Button></div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Deactivate ${deleteTarget?.name ?? 'this category'}?`}
        message={`"${deleteTarget?.name ?? 'This category'}" will be hidden from the active service catalog. Its sub-categories are not deleted.`}
        confirmLabel="Deactivate"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
