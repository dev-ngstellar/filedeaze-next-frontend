'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Invoice } from '@/types';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { ExternalLink } from 'lucide-react';
import dayjs from 'dayjs';
import { formatDate } from '@/lib/utils';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: invoice, isLoading, isError, error, refetch, isFetching } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: async () => (await api.get(`/web/manager/invoices/${id}`)).data.data.invoice,
  });

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />;
  if (!invoice) return <ErrorState title="Invoice not found" message="This invoice may have been removed or the link is incorrect." onRetry={refetch} />;

  return (
    <div className="max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Invoice #{invoice.invoiceNumber}</h2>
        {invoice.pdfUrl && (
          <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><ExternalLink size={14} /> View PDF</Button>
          </a>
        )}
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><span className="text-[var(--color-text-muted)]">Ticket:</span> <span className="font-medium">{invoice.ticket?.ticketNumber ?? invoice.ticketId}</span></div>
          <div><span className="text-[var(--color-text-muted)]">Date:</span> <span className="font-medium">{formatDate(invoice.createdAt)}</span></div>
          <div><span className="text-[var(--color-text-muted)]">Subtotal:</span> <span className="font-medium">₹{invoice.subtotal?.toLocaleString() ?? '0'}</span></div>
          {!!invoice.gstAmount && (
            <div><span className="text-[var(--color-text-muted)]">GST{invoice.gstPercent ? ` (${invoice.gstPercent}%)` : ''}:</span> <span className="font-medium">₹{invoice.gstAmount.toLocaleString()}</span></div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex justify-between items-center">
          <span className="font-semibold text-[var(--color-text-secondary)]">Grand Total</span>
          <span className="text-xl font-bold text-emerald-600">₹{invoice.total?.toLocaleString() ?? '0'}</span>
        </div>
      </div>
    </div>
  );
}
