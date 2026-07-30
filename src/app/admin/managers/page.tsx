'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Eye, Trash2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { Manager } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { PaginationMeta } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import dayjs from 'dayjs';
import { formatDate, getErrorMessage } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(1, 'Name is required (e.g. Siva Kumar)'),
  email: z.string().min(1, 'Email is required').refine(v => v.includes('@') && v.includes('.'), 'Enter a valid email (e.g. siva@gmail.com)'),
  phone: z.string().min(10, 'Enter a valid phone number (e.g. 9876543210)').max(15, 'Phone number too long'),
  password: z.string().min(6, 'Password must be at least 6 characters (e.g. Siva@123)'),
});

type Form = z.infer<typeof schema>;

export default function ManagersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Manager | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Manager[]; meta: PaginationMeta }>({
    queryKey: ['managers', page, limit],
    queryFn: async () => (await api.get('/web/admin/managers', { params: { page, limit } })).data.data,
    placeholderData: keepPreviousData,
  });

  const managers = data?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (d: Form) => api.post('/web/admin/managers', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['managers'] }); toast.success('Manager created'); setShowCreate(false); reset(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create manager')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/admin/managers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['managers'] }); toast.success('Manager removed'); setDeleteTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete manager')),
  });

  const columns: ColumnDef<Manager, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'danger'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link href={`/admin/managers/${row.original.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row.original)} className="text-red-500"><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Managers</h2>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Add Manager</Button>
      </div>
      <DataTable
        data={managers}
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

      <Modal open={showCreate} onClose={() => { setShowCreate(false); reset(); }} title="Add Manager">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Input label="Phone" {...register('phone')} error={errors.phone?.message} />
          <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Add</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Remove ${deleteTarget?.name ?? 'this manager'}?`}
        message={`${deleteTarget?.name ?? 'This manager'} will lose access to the manager portal.`}
        confirmLabel="Remove"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
