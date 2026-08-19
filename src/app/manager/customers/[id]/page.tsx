'use client';

import { useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Ticket, CustomerAsset, Customer } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { TicketStatusBadge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Eye, Plus, Box, ShieldCheck, ShieldOff, Send, Pencil, Trash2 } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

export default function CustomerHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const qc = useQueryClient();
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: detail, isLoading, isError, error, refetch } = useQuery<Customer & { tickets: Ticket[] }>({
    queryKey: ['customer-history', id],
    queryFn: async () => (await api.get(`/web/manager/customers/${id}/history`)).data.data,
  });
  const history = detail?.tickets ?? [];

  const { data: assets = [] } = useQuery<CustomerAsset[]>({
    queryKey: ['customer-assets-summary', id],
    queryFn: async () => (await api.get('/web/manager/customer-assets', { params: { customerId: id } })).data.data,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{ email: string }>();

  const invitationMutation = useMutation({
    mutationFn: (email?: string) => api.post(`/web/manager/customers/${id}/portal-invitation`, { email }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['customer-history', id] });
      toast.success(res.data?.data?.message ?? res.data?.message ?? 'Invitation sent');
      setShowAddEmail(false); reset();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to send portal invitation')),
  });

  interface EditCustomerForm { name: string; phone: string; email?: string; address?: string }
  const {
    register: registerEdit, handleSubmit: handleEditSubmit, reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<EditCustomerForm>();

  const openEdit = () => {
    if (!detail) return;
    resetEdit({ name: detail.name, phone: detail.phone, email: detail.email ?? '', address: detail.address ?? '' });
    setShowEdit(true);
  };

  const updateMutation = useMutation({
    mutationFn: (d: EditCustomerForm) => api.patch(`/web/manager/customers/${id}`, {
      name: d.name,
      phone: d.phone,
      email: d.email || undefined,
      address: d.address || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-history', id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
      setShowEdit(false); resetEdit();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update customer')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/web/manager/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
      router.push(`/${prefix}/customers`);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete customer')),
  });

  const columns: ColumnDef<Ticket, unknown>[] = [
    { accessorKey: 'ticketNumber', header: 'Ticket #' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <TicketStatusBadge status={row.original.status} /> },
    { accessorKey: 'technician.name', header: 'Technician', cell: ({ row }) => row.original.technician?.name ?? '—' },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => dayjs(row.original.createdAt).format('DD MMM YYYY') },
    { id: 'actions', header: '', cell: ({ row }) => <Link href={`/${prefix}/tickets/${row.original.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link> },
  ];

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {detail && (
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{detail.name}</h2>
                <Button variant="ghost" size="sm" onClick={openEdit} aria-label="Edit customer"><Pencil size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDelete(true)} aria-label="Delete customer" className="text-red-500 hover:text-red-600"><Trash2 size={14} /></Button>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">{detail.phone}{detail.email ? ` · ${detail.email}` : ''}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {detail.portalEnabled ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600"><ShieldCheck size={15} /> Portal Access: Enabled</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)]"><ShieldOff size={15} /> Portal Access: Not Enabled</span>
              )}
              {detail.portalEnabled ? (
                <Button size="sm" variant="secondary" loading={invitationMutation.isPending} onClick={() => invitationMutation.mutate(undefined)}>
                  <Send size={13} /> Send Portal Invitation
                </Button>
              ) : (
                <Button
                  size="sm"
                  loading={invitationMutation.isPending}
                  onClick={() => detail.email ? invitationMutation.mutate(undefined) : setShowAddEmail(true)}
                >
                  <ShieldCheck size={13} /> Enable Portal Access
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5"><Box size={15} /> Customer Assets</h3>
          <div className="flex items-center gap-2">
            <Link href={`/${prefix}/assets?customerId=${id}&openCreate=true`}>
              <Button size="sm" variant="secondary"><Plus size={13} /> Add Asset</Button>
            </Link>
            <Link href={`/${prefix}/assets?customerId=${id}`} className="text-xs text-[var(--color-primary)] hover:underline">
              View all →
            </Link>
          </div>
        </div>
        {assets.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No assets registered for this customer yet.</p>
        ) : (
          <div className="space-y-2">
            {assets.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-[var(--color-border)] last:border-0 pb-2 last:pb-0">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{a.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{[a.brand, a.model].filter(Boolean).join(' / ') || a.category?.name || '—'}</p>
                </div>
                <Link href={`/${prefix}/assets/${a.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Customer Ticket History</h2>
        <DataTable data={history} columns={columns} isError={isError} error={error} onRetry={refetch} />
      </div>

      <Modal open={showAddEmail} onClose={() => { setShowAddEmail(false); reset(); }} title="Enable Portal Access" size="sm">
        <form onSubmit={handleSubmit(d => invitationMutation.mutate(d.email))} className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            This customer has no email on file. Add one to send them a portal setup invitation.
          </p>
          <Input label="Email" type="email" {...register('email', { required: 'Email is required' })} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => { setShowAddEmail(false); reset(); }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || invitationMutation.isPending}>Send Invitation</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => { setShowEdit(false); resetEdit(); }} title="Edit Customer" size="sm">
        <form onSubmit={handleEditSubmit(d => updateMutation.mutate(d))} className="space-y-4">
          <Input label="Name" error={editErrors.name?.message} {...registerEdit('name', { required: 'Name is required' })} />
          <Input label="Phone" error={editErrors.phone?.message} {...registerEdit('phone', { required: 'Phone is required' })} />
          <Input label="Email (optional)" type="email" error={editErrors.email?.message} {...registerEdit('email')} />
          <Input label="Address (optional)" error={editErrors.address?.message} {...registerEdit('address')} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => { setShowEdit(false); resetEdit(); }}>Cancel</Button>
            <Button type="submit" loading={isEditSubmitting || updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title={`Delete ${detail?.name ?? 'customer'}?`}
        message={`Are you sure you want to delete "${detail?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
