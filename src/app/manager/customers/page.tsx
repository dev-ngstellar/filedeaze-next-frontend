'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';
import { Eye, Pencil, Plus, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import api from '@/lib/axios';
import { Customer } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { PaginationMeta } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

interface CreateCustomerForm { name: string; phone: string; email?: string; address?: string }
interface EditCustomerForm { name: string; phone: string; email?: string; address?: string }

export default function CustomersPage() {
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Customer[]; meta: PaginationMeta }>({
    queryKey: ['customers', query, page, limit],
    queryFn: async () =>
      (await api.get('/web/manager/customers', { params: { search: query || undefined, page, limit } })).data.data,
    placeholderData: keepPreviousData,
  });

  const customers = data?.items ?? [];

  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<CreateCustomerForm>();
  const emailValue = watch('email');

  const {
    register: registerEdit, handleSubmit: handleEditSubmit, reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<EditCustomerForm>();

  const createMutation = useMutation({
    mutationFn: (d: CreateCustomerForm) => api.post('/web/manager/customers', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created');
      setShowCreate(false); reset();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create customer')),
  });

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    resetEdit({ name: customer.name, phone: customer.phone, email: customer.email ?? '', address: customer.address ?? '' });
  };
  const closeEdit = () => { setEditing(null); resetEdit(); };

  const updateMutation = useMutation({
    mutationFn: (d: EditCustomerForm) => api.patch(`/web/manager/customers/${editing!.id}`, {
      name: d.name,
      phone: d.phone,
      email: d.email || undefined,
      address: d.address || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-history', editing!.id] });
      toast.success('Customer updated');
      closeEdit();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update customer')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/manager/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete customer')),
  });

  const columns: ColumnDef<Customer, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email ?? '—' },
    {
      id: 'portal', header: 'Portal Access',
      cell: ({ row }) => row.original.portalEnabled
        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><ShieldCheck size={13} /> Enabled</span>
        : <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)]"><ShieldOff size={13} /> Not Enabled</span>,
    },
    { accessorKey: 'createdAt', header: 'Since', cell: ({ row }) => dayjs(row.original.createdAt).format('DD MMM YYYY') },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)} aria-label="Edit customer"><Pencil size={14} /></Button>
          <Link href={`/${prefix}/customers/${row.original.id}`}><Button variant="ghost" size="sm" aria-label="View customer"><Eye size={14} /></Button></Link>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row.original)} aria-label="Delete customer" className="text-red-500 hover:text-red-600"><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Customers</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Add Customer</Button>
      </div>
      <div className="flex gap-3 mb-4">
        <Input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="w-72" />
        <Button variant="secondary" onClick={() => { setPage(1); setQuery(search); }}>Search</Button>
      </div>
      <DataTable
        data={customers}
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

      <Modal open={showCreate} onClose={() => { setShowCreate(false); reset(); }} title="Add Customer" size="sm">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <Input label="Name" {...register('name', { required: 'Name is required' })} />
          <Input label="Phone" {...register('phone', { required: 'Phone is required' })} />
          <Input label="Email (optional)" type="email" {...register('email')} />
          <Input label="Address (optional)" {...register('address')} />

          {emailValue ? (
            <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
              An account setup email will be sent to the customer.
            </p>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              No email provided. This customer will not have portal access until an email address is added.
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>Create Customer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={closeEdit} title="Edit Customer" size="sm">
        <form onSubmit={handleEditSubmit(d => updateMutation.mutate(d))} className="space-y-4">
          <Input label="Name" error={editErrors.name?.message} {...registerEdit('name', { required: 'Name is required' })} />
          <Input label="Phone" error={editErrors.phone?.message} {...registerEdit('phone', { required: 'Phone is required' })} />
          <Input label="Email (optional)" type="email" error={editErrors.email?.message} {...registerEdit('email')} />
          <Input label="Address (optional)" error={editErrors.address?.message} {...registerEdit('address')} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={closeEdit}>Cancel</Button>
            <Button type="submit" loading={isEditSubmitting || updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete ${deleteTarget?.name ?? 'customer'}?`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
