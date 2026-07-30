'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  /** 'danger' (default) is for destructive/irreversible actions — red warning icon, red confirm
   * button. 'neutral' is for friendly, non-destructive confirmations (Add, Assign, Approve,
   * Verify, Activate, Resume, Renew) — a calm icon and the app's normal primary button color,
   * so a positive action never reads as a warning. */
  tone?: 'danger' | 'neutral';
}

export function ConfirmDialog({
  open, onClose, onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  loading,
  tone = 'danger',
}: ConfirmDialogProps) {
  const isDanger = tone === 'danger';
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="h-12 w-12 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center">
          {isDanger
            ? <AlertTriangle size={22} className="text-red-500" />
            : <CheckCircle2 size={22} className="text-[var(--color-primary)]" />}
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1.5">{title}</h3>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 w-full mt-1">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
