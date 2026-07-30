'use client';

import { useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import Link from 'next/link';
import { ChevronLeft, Pencil, Trash2, ShieldCheck, ShieldOff, Eye, ImagePlus, X } from 'lucide-react';
import api from '@/lib/axios';
import { CustomerAsset, Ticket } from '@/types';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable } from '@/components/ui/DataTable';
import { TicketStatusBadge } from '@/components/ui/Badge';
import { getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const qc = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: asset, isLoading, isError, error, refetch, isFetching } = useQuery<CustomerAsset>({
    queryKey: ['customer-asset', id],
    queryFn: async () => (await api.get(`/web/manager/customer-assets/${id}`)).data.data,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<Ticket[]>({
    queryKey: ['customer-asset-history', id],
    queryFn: async () => (await api.get(`/web/manager/customer-assets/${id}/service-history`)).data.data,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/web/manager/customer-assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-assets'] });
      toast.success('Asset removed');
      router.push(`/${prefix}/assets`);
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, 'Failed to remove asset')),
  });

  const uploadImagesMutation = useMutation({
    // Takes a plain File[], not the input's live FileList — react-query dispatches mutationFn
    // asynchronously, and by the time it ran, the onChange handler's `e.target.value = ''` (which
    // runs synchronously, immediately after) had already cleared the input, and since FileList is a
    // *live* view of the input's current selection, the same object had been drained to empty by
    // the time this function's body executed. Confirmed via runtime logging — input files: [].
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      files.forEach((file) => fd.append('images', file));

      // 'Content-Type': false (not undefined!) — axios's dispatchRequest.js unconditionally runs
      // `headers.setContentType('application/x-www-form-urlencoded', false)` for every POST/PUT/PATCH
      // request, AFTER transformRequest, and that call only skips overwriting when the header's
      // current value is NOT undefined. Setting it to `undefined` looks "unset" to that check, so it
      // still gets stamped to x-www-form-urlencoded. `false` is axios's actual "never auto-fill this
      // header" sentinel: it survives that later check AND is still stripped from the final
      // serialized headers, so no Content-Type is sent at all and the browser computes the real
      // multipart boundary itself.
      return api.post(`/web/manager/customer-assets/${id}/images`, fd, { headers: { 'Content-Type': false } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-asset', id] });
      toast.success('Photos uploaded');
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, 'Failed to upload photos')),
  });

  const removeImageMutation = useMutation({
    mutationFn: (imageId: string) => api.delete(`/web/manager/customer-assets/${id}/images/${imageId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-asset', id] });
      toast.success('Photo removed');
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, 'Failed to remove photo')),
  });

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />;
  if (!asset) return <ErrorState title="Asset not found" message="This asset may have been removed or the link is incorrect." onRetry={refetch} />;

  const columns: ColumnDef<Ticket, unknown>[] = [
    { accessorKey: 'ticketNumber', header: 'Ticket #' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <TicketStatusBadge status={row.original.status} /> },
    { accessorKey: 'technician.name', header: 'Technician', cell: ({ row }) => row.original.technician?.name ?? '—' },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => dayjs(row.original.createdAt).format('DD MMM YYYY') },
    { id: 'actions', header: '', cell: ({ row }) => <Link href={`/${prefix}/tickets/${row.original.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link> },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href={`/${prefix}/assets`} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
        <ChevronLeft size={14} /> Back to Assets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{asset.name}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {asset.customer?.name} — {asset.customer?.phone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${prefix}/assets?edit=${asset.id}`}><Button size="sm" variant="secondary"><Pencil size={13} /> Edit</Button></Link>
          <Button size="sm" variant="danger" onClick={() => setShowDelete(true)}><Trash2 size={13} /> Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-2">
          <h3 className="font-medium text-[var(--color-text-secondary)]">Asset Details</h3>
          <div className="text-[var(--color-text-secondary)] space-y-1">
            <p><span className="text-[var(--color-text-muted)]">Category:</span> {asset.category?.name ?? '—'}</p>
            <p><span className="text-[var(--color-text-muted)]">Brand:</span> {asset.brand ?? '—'}</p>
            <p><span className="text-[var(--color-text-muted)]">Model:</span> {asset.model ?? '—'}</p>
            <p><span className="text-[var(--color-text-muted)]">Serial #:</span> {asset.serialNumber ?? '—'}</p>
            <p><span className="text-[var(--color-text-muted)]">Purchase Date:</span> {asset.purchaseDate ? dayjs(asset.purchaseDate).format('DD MMM YYYY') : '—'}</p>
            <p><span className="text-[var(--color-text-muted)]">Installed At:</span> {asset.installationAddress ?? '—'}</p>
            {asset.notes && <p><span className="text-[var(--color-text-muted)]">Notes:</span> {asset.notes}</p>}
            <p><span className="text-[var(--color-text-muted)]">Service Requests:</span> {asset.ticketCount ?? history.length}</p>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-3">
          <h3 className="font-medium text-[var(--color-text-secondary)]">AMC Coverage</h3>
          {asset.amcStatus ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <ShieldCheck size={15} /> Active — {asset.amcStatus.planName}
              </div>
              <p className="text-[var(--color-text-muted)]">Valid until {dayjs(asset.amcStatus.endDate).format('DD MMM YYYY')}</p>
              <p className="text-[var(--color-text-muted)]">{asset.amcStatus.remainingVisits ?? '—'} of {asset.amcStatus.totalVisits} visits remaining</p>
              <Link href={`/${prefix}/amc/subscriptions/${asset.amcStatus.subscriptionId}`} className="inline-block mt-1 text-xs text-[var(--color-primary)] hover:underline">
                View subscription →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <ShieldOff size={15} /> No active AMC
              </div>
              <Link href={`/${prefix}/amc/assign?customerId=${asset.customerId}&assetId=${asset.id}`}>
                <Button size="sm" variant="secondary">Assign AMC</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-[var(--color-text-secondary)]">Photos</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              // Snapshot into a plain array before resetting the input — e.target.files is a live
              // FileList tied to the input's current selection, and clearing e.target.value drains
              // it, which happens before react-query's async mutationFn ever gets to read it.
              const selected = Array.from(e.target.files ?? []);
              if (selected.length) uploadImagesMutation.mutate(selected);
              e.target.value = '';
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploadImagesMutation.isPending}>
            <ImagePlus size={13} /> Add Photos
          </Button>
        </div>
        {asset.images?.length ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {asset.images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-[var(--color-border)]">
                <img src={img.imageUrl} alt="Asset" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImageMutation.mutate(img.id)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove photo"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-text-muted)]">No photos uploaded yet</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Service History</h3>
        <DataTable data={history} columns={columns} isLoading={historyLoading} />
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Remove this asset?"
        message={`"${asset.name}" will be deactivated and hidden from active lists. This cannot be undone from here.`}
        confirmLabel="Remove"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
