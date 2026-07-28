'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { AppNotification } from '@/types';
import { PageSpinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Bell, Check, Trash2, MailOpen } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { cn, getErrorMessage } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

dayjs.extend(relativeTime);

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { data: notifications = [], isLoading, isError, error, refetch } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/mobile/notifications')).data.data,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/mobile/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to mark as read')),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/mobile/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All marked as read');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to mark all as read')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mobile/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification deleted');
      setDeleteId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete notification')),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => api.delete('/mobile/notifications/clear-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications cleared');
      setShowClearConfirm(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to clear notifications')),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--color-surface-elevated)] flex items-center justify-center">
            <Bell size={19} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Notifications</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Manage your alerts and system messages</p>
          </div>
        </div>
        <div className="flex gap-2">
          {notifications.some(n => !n.read) && (
            <Button variant="secondary" onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending}>
              <Check size={14} /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="danger" onClick={() => setShowClearConfirm(true)}>
              <Trash2 size={14} /> Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        {isError ? (
          <ErrorState title="Unable to load notifications" error={error} onRetry={() => refetch()} />
        ) : notifications.length === 0 ? (
          <EmptyState message="No notifications" description="You're all caught up!" icon={Bell} />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {notifications.map(n => (
              <div
                key={n.id}
                className={cn(
                  "p-4 flex items-start gap-4 transition-colors hover:bg-[var(--color-surface-hover)]",
                  n.read ? "bg-[var(--color-surface)]" : "bg-[var(--color-primary-light)]/20"
                )}
              >
                <div className="mt-1">
                  {n.read ? (
                    <MailOpen size={18} className="text-[var(--color-text-muted)]" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] block mt-1.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn(
                    "text-sm",
                    n.read ? "text-[var(--color-text-secondary)]" : "font-semibold text-[var(--color-text-primary)]"
                  )}>
                    {n.title}
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{n.body}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-2 font-medium">
                    {dayjs(n.createdAt).format('DD MMM YYYY, HH:mm')} ({dayjs(n.createdAt).fromNow()})
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.read && (
                    <button
                      onClick={() => markReadMutation.mutate(n.id)}
                      className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-elevated)] rounded-md transition-colors"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteId(n.id)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Delete Notification"
        message="Are you sure you want to delete this notification?"
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => clearAllMutation.mutate()}
        loading={clearAllMutation.isPending}
        title="Clear All Notifications"
        message="Are you sure you want to permanently delete all notifications? This action cannot be undone."
        confirmLabel="Clear All"
      />
    </div>
  );
}
