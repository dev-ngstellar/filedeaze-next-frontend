'use client';

import { useState, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Ticket, Technician, TicketImage, TicketSparePartUsage, PaymentMethod } from '@/types';
import { Select } from '@/components/ui/Select';
import { TicketStatusBadge, PaymentStatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import Link from 'next/link';
import { Star, CheckCircle, XCircle, RefreshCw, UserCheck, ChevronLeft, CalendarClock, ThumbsUp, ThumbsDown, AlertTriangle, Box, ShieldCheck, ShieldOff, Link2 } from 'lucide-react';
import dayjs from 'dayjs';
import { getMinimumSelectableDateTime, isPastSchedule, getErrorMessage, hasMoreThanTwoDecimals } from '@/lib/utils';
import type { CustomerAsset } from '@/types';

const BUSY_STATUSES = ['ASSIGNED', 'ACCEPTED', 'TRAVELLING', 'REACHED_LOCATION', 'IN_PROGRESS', 'PENDING'];

/** Defaults the Scheduled At field to the ticket's raised/current schedule — but never to a past
 * moment, since the backend rejects past dates. Most tickets are raised "ASAP" and auto-stamped
 * at raise time, so by the time a manager assigns them that timestamp is already in the past;
 * in that case fall back to "now" instead of a value that would fail validation on submit. */
function defaultScheduleValue(scheduledAt?: string): string {
  const candidate = scheduledAt && dayjs(scheduledAt).isAfter(dayjs()) ? dayjs(scheduledAt) : dayjs();
  return candidate.format('YYYY-MM-DDTHH:mm');
}


/** Shown directly under the editable Scheduled At field whenever its pre-fill (see
 * defaultScheduleValue() above) had to fall back to "now" because the ticket's own scheduledAt
 * was already in the past — independent of whether the customer ever specified a
 * requestedScheduleAt, so the manager always sees *why* "now" appears instead of the ticket's
 * stored value, not only on the subset of tickets that happen to have a requested schedule.
 *
 * Shows both the original (now-past) scheduled time and the substituted current time, reusing the
 * exact date format CustomerRequestedSchedule below already uses ("DD MMM YYYY, h:mm A") rather
 * than introducing a new one. "Current Schedule" is recomputed from dayjs() on every render —
 * same as the `show` condition itself — rather than frozen at modal-open time, so it stays
 * accurate for as long as the dialog stays open; purely informational, never written back into
 * the form, so it has no bearing on what the manager can still type into the field above. */
function ScheduleFallbackNotice({ originalScheduledAt, show }: { originalScheduledAt?: string; show: boolean }) {
  if (!show || !originalScheduledAt) return null;
  return (
    <div className="rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] px-3 py-2.5 space-y-2 -mt-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Original Schedule</span>
        <span className="text-[var(--color-text-secondary)] font-medium text-right">{dayjs(originalScheduledAt).format('DD MMM YYYY, h:mm A')}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Current Schedule</span>
        <span className="text-[var(--color-text-secondary)] font-medium text-right">{dayjs().format('DD MMM YYYY, h:mm A')}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] italic pt-2 border-t border-[var(--color-border)]">
        The original scheduled time has already passed, so the system has automatically pre-filled the current time. You can change it before assigning the technician.
      </p>
    </div>
  );
}

/** Read-only reference showing what the customer originally asked for, next to the (editable)
 * Scheduled At field above it — so a manager who nudges the schedule can still see the customer's
 * original request. Always sourced from the immutable requestedScheduleAt, never from the
 * mutable scheduledAt (which assign/reassign overwrite with the current technician schedule).
 * Renders nothing at all when the customer never specified one — not even a "Not specified"
 * placeholder — so the modal stays uncluttered for ASAP/no-preference requests. Whether Scheduled
 * At's own pre-fill fell back to "now" is a separate concern, surfaced unconditionally by
 * ScheduleFallbackNotice above regardless of whether this panel renders at all. */
function CustomerRequestedSchedule({ requestedScheduleAt }: { requestedScheduleAt?: string | null }) {
  if (!requestedScheduleAt) return null;

  return (
    <div className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2.5 space-y-1">
      <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Customer Requested</p>
      <p className="text-sm text-[var(--color-text-secondary)]">{dayjs(requestedScheduleAt).format('DD MMM YYYY, h:mm A')}</p>
    </div>
  );
}

interface SkillMatch { matchedSkillCount: number; matchedSkillNames: string[]; fullMatch: boolean }

function TechnicianPicker({ techs, busyIds, value, onChange, skillMatches, requiredSkillCount }: {
  techs: Technician[];
  busyIds: Set<string>;
  value: string;
  onChange: (id: string) => void;
  skillMatches: Map<string, SkillMatch>;
  requiredSkillCount: number;
}) {
  // Skill-matched technicians float to the top of each availability group so the best fit
  // for this ticket's service is the first thing a manager sees.
  const byMatchThenName = (a: Technician, b: Technician) => {
    const ma = skillMatches.get(a.id)?.matchedSkillCount ?? 0;
    const mb = skillMatches.get(b.id)?.matchedSkillCount ?? 0;
    if (ma !== mb) return mb - ma;
    return a.name.localeCompare(b.name);
  };

  const available = techs.filter(t => t.isActive && !busyIds.has(t.id)).sort(byMatchThenName);
  const busy = techs.filter(t => t.isActive && busyIds.has(t.id)).sort(byMatchThenName);

  if (techs.length === 0) return <p className="text-sm text-[var(--color-text-muted)] py-2">No active technicians found.</p>;

  const renderTech = (tech: Technician, dotColor: string, statusLabel: string, statusClass: string) => {
    const match = skillMatches.get(tech.id);
    return (
      <button key={tech.id} type="button" onClick={() => onChange(tech.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all ${value === tech.id ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-[var(--color-border)] hover:border-gray-300 hover:bg-gray-50 text-[var(--color-text-secondary)]'}`}>
        <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} />
        <span className="flex-1 text-left min-w-0">
          <span className="font-medium block truncate">{tech.name}</span>
          {match && (
            <span className={`text-[10px] block truncate ${match.fullMatch ? 'text-emerald-600' : 'text-amber-600'}`} title={match.matchedSkillNames.join(', ')}>
              {match.fullMatch ? '★ Skill match' : `${match.matchedSkillCount}/${requiredSkillCount} skills matched`} — {match.matchedSkillNames.join(', ')}
            </span>
          )}
        </span>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusClass}`}>{statusLabel}</span>
      </button>
    );
  };

  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
      {available.length > 0 && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-1 pt-1">
          Available ({available.length})
        </p>
      )}
      {available.map(tech => renderTech(tech, 'bg-emerald-500', 'Available', 'bg-emerald-100 text-emerald-700'))}
      {busy.length > 0 && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-1 pt-2">
          On Job ({busy.length})
        </p>
      )}
      {busy.map(tech => renderTech(tech, 'bg-amber-400', 'On Job', 'bg-amber-100 text-amber-700'))}
    </div>
  );
}

/** Payment card for a COMPLETED ticket with no payment yet — lets a manager collect payment from
 * the web dashboard. Spare parts are shown read-only, grouped by the coverage the technician
 * already recorded at completion (AMC / Warranty / Paid) — this card never lets anyone re-add or
 * re-tag parts here, since TicketSparePart rows are only ever written once, at completeTicket()
 * time (re-introducing a second insertion path here is exactly the duplicate-spare-part bug that
 * was fixed previously). */
function PaymentCollectionCard({ ticketId, spareParts, isAmcCovered, onCollected }: {
  ticketId: string;
  spareParts: TicketSparePartUsage[];
  isAmcCovered: boolean;
  onCollected: () => void;
}) {
  const [serviceCharge, setServiceCharge] = useState('0');
  const [labourCharge, setLabourCharge] = useState('0');
  const [additionalCharge, setAdditionalCharge] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);

  const collectMutation = useMutation({
    mutationFn: (payload: unknown) => api.post(`/web/manager/tickets/${ticketId}/collect-payment`, payload),
    onSuccess: () => { toast.success('Payment collected and invoice generated'); setPendingPayload(null); onCollected(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to collect payment')),
  });

  const amcParts = spareParts.filter(p => p.coverageType === 'AMC');
  const warrantyParts = spareParts.filter(p => p.coverageType === 'WARRANTY');
  const paidParts = spareParts.filter(p => p.coverageType === 'OUT_OF_WARRANTY' || !p.coverageType);

  const serviceChargeWaived = isAmcCovered;
  const effectiveService = serviceChargeWaived ? 0 : Number(serviceCharge) || 0;
  const effectiveLabour = serviceChargeWaived ? 0 : Number(labourCharge) || 0;
  const amcValue = amcParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const warrantyValue = warrantyParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const paidPartsTotal = paidParts.reduce((s, p) => s + p.calculatedAmount, 0);
  const gross = effectiveService + effectiveLabour + paidPartsTotal + (Number(additionalCharge) || 0);
  const grandTotal = Math.max(gross - (Number(discount) || 0), 0);

  const handleSubmit = () => {
    const parsedService = Number(serviceCharge);
    const parsedLabour = Number(labourCharge);
    const parsedAdditional = Number(additionalCharge);
    const parsedDiscount = Number(discount);
    if (
      (serviceCharge.trim() !== '' && (Number.isNaN(parsedService) || parsedService < 0)) ||
      (labourCharge.trim() !== '' && (Number.isNaN(parsedLabour) || parsedLabour < 0)) ||
      (additionalCharge.trim() !== '' && (Number.isNaN(parsedAdditional) || parsedAdditional < 0)) ||
      (discount.trim() !== '' && (Number.isNaN(parsedDiscount) || parsedDiscount < 0))
    ) {
      toast.error('Charges and discount cannot be negative');
      return;
    }
    if (
      hasMoreThanTwoDecimals(parsedService) || hasMoreThanTwoDecimals(parsedLabour) ||
      hasMoreThanTwoDecimals(parsedAdditional) || hasMoreThanTwoDecimals(parsedDiscount)
    ) {
      toast.error('Charges and discount can contain up to 2 decimal places');
      return;
    }
    if (parsedDiscount > gross) {
      toast.error('Discount cannot exceed the billable amount');
      return;
    }

    setPendingPayload({
      serviceCharge: parsedService || 0,
      labourCharge: parsedLabour || 0,
      additionalCharge: parsedAdditional || 0,
      discount: parsedDiscount || 0,
      method,
    });
  };

  const partRow = (p: TicketSparePartUsage) => (
    <div key={p.id} className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-text-secondary)]">{p.sparePart?.partName ?? 'Spare part'} <span className="text-[var(--color-text-muted)]">× {p.quantity}</span></span>
      <span className="font-medium text-[var(--color-text-primary)]">₹{p.calculatedAmount.toLocaleString()}</span>
    </div>
  );

  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm space-y-4">
      <h3 className="font-medium text-[var(--color-text-secondary)]">Payment Details</h3>

      <div className="flex items-center justify-between">
        {isAmcCovered ? (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5"><ShieldCheck size={13} /> This visit uses an AMC visit — service &amp; labour charge are automatically waived.</p>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">Not an AMC visit — service &amp; labour charge billed normally.</p>
        )}
      </div>

      <Select
        label="Payment Method" value={method}
        onChange={e => setMethod(e.target.value as PaymentMethod)}
        options={[
          { value: 'CASH', label: 'Cash' },
          { value: 'UPI', label: 'UPI' },
          { value: 'UPI_QR', label: 'UPI QR' },
          { value: 'RAZORPAY', label: 'Razorpay' },
          { value: 'CARD', label: 'Card' },
          { value: 'NET_BANKING', label: 'Net Banking' },
          { value: 'WALLET', label: 'Wallet' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Service Charge" type="number" min={0} value={serviceCharge}
          onChange={e => setServiceCharge(e.target.value)} disabled={serviceChargeWaived}
          hint={serviceChargeWaived ? 'Waived' : undefined}
        />
        <Input
          label="Labour Charge" type="number" min={0} value={labourCharge}
          onChange={e => setLabourCharge(e.target.value)} disabled={serviceChargeWaived}
          hint={serviceChargeWaived ? 'Waived' : undefined}
        />
      </div>

      {/* Read-only — these were recorded by the technician at completion, not editable here */}
      {!!spareParts.length && (
        <div className="space-y-3">
          {!!amcParts.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 mb-1.5">AMC Covered Parts</p>
              <div className="space-y-1">{amcParts.map(partRow)}</div>
            </div>
          )}
          {!!warrantyParts.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1.5">Warranty Covered Parts</p>
              <div className="space-y-1">{warrantyParts.map(partRow)}</div>
            </div>
          )}
          {!!paidParts.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-1.5">Customer Payable Parts</p>
              <div className="space-y-1">{paidParts.map(partRow)}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Additional Charge" type="number" min={0} value={additionalCharge} onChange={e => setAdditionalCharge(e.target.value)} />
        <Input label="Discount" type="number" min={0} value={discount} onChange={e => setDiscount(e.target.value)} />
      </div>

      <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3 space-y-1 text-sm">
        <p className="font-semibold text-[var(--color-text-secondary)] mb-1">Summary</p>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Service Charge</span><span>₹{effectiveService.toLocaleString()}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Labour Charge</span><span>₹{effectiveLabour.toLocaleString()}</span></div>
        {amcValue > 0 && (
          <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">AMC Covered Parts</span><span>₹0 <span className="text-xs text-[var(--color-text-muted)]">(value ₹{amcValue.toLocaleString()})</span></span></div>
        )}
        {warrantyValue > 0 && (
          <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Warranty Covered Parts</span><span>₹0 <span className="text-xs text-[var(--color-text-muted)]">(value ₹{warrantyValue.toLocaleString()})</span></span></div>
        )}
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Customer Payable Parts</span><span>₹{paidPartsTotal.toLocaleString()}</span></div>
        {Number(additionalCharge) > 0 && <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Additional Charge</span><span>₹{Number(additionalCharge).toLocaleString()}</span></div>}
        {Number(discount) > 0 && <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Discount</span><span>-₹{Number(discount).toLocaleString()}</span></div>}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1 mt-1 font-semibold text-[var(--color-text-primary)]"><span>Grand Total</span><span>₹{grandTotal.toLocaleString()}</span></div>
        <p className="text-[10px] text-[var(--color-text-muted)] pt-1">Tax (if enabled for your tenant) is applied at submission — the invoice total may include GST on top of this.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} loading={collectMutation.isPending} disabled={grandTotal <= 0 && !serviceChargeWaived}>Collect Payment</Button>
      </div>

      <ConfirmDialog
        open={!!pendingPayload}
        onClose={() => setPendingPayload(null)}
        onConfirm={() => pendingPayload && collectMutation.mutate(pendingPayload)}
        tone="neutral"
        title={`Collect ₹${grandTotal.toLocaleString()} via ${method.replace('_', ' ')}?`}
        message="This will record the payment and generate the customer invoice. This cannot be undone from here."
        confirmLabel="Collect Payment"
        loading={collectMutation.isPending}
      />
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const ticketsBase = `/${prefix}/tickets`;
  const qc = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [assignMode, setAssignMode] = useState<'assign' | 'reassign' | 'reschedule'>('assign');
  const [confirmPending, setConfirmPending] = useState<'approve' | 'reject' | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [pickedAssetId, setPickedAssetId] = useState('');
  const [confirmAssetChange, setConfirmAssetChange] = useState<CustomerAsset | null>(null);
  const [confirmConsumeVisit, setConfirmConsumeVisit] = useState(false);

  const { data: ticket, isLoading, isError, error, refetch, isFetching } = useQuery<Ticket>({ queryKey: ['ticket', id], queryFn: async () => (await api.get(`/web/manager/tickets/${id}`)).data.data });
  const { data: techs = [] } = useQuery<Technician[]>({ queryKey: ['technicians'], queryFn: async () => (await api.get('/web/manager/technicians')).data.data });

  const { data: allTickets = [] } = useQuery<Ticket[]>({
    queryKey: ['tickets-availability'],
    queryFn: async () => (await api.get('/web/manager/tickets')).data.data,
    enabled: showAssign,
    staleTime: 60_000,
  });

  // Which technicians match this ticket's service — surfaced in the picker so the manager
  // can prefer a skilled technician over an arbitrary available one.
  const subCategoryId = ticket?.subCategory?.id;
  const { data: recommended } = useQuery<{
    requiredSkills: { id: string; name: string }[];
    matchedTechnicians: { technicianId: string; matchedSkillCount: number; matchedSkillNames: string[]; fullMatch: boolean }[];
  }>({
    queryKey: ['sub-category-recommended-technicians', subCategoryId],
    queryFn: async () => (await api.get(`/web/manager/service-sub-categories/${subCategoryId}/recommended-technicians`)).data.data,
    enabled: showAssign && !!subCategoryId,
  });
  const skillMatches = useMemo(() => {
    const map = new Map<string, SkillMatch>();
    for (const m of recommended?.matchedTechnicians ?? []) {
      map.set(m.technicianId, { matchedSkillCount: m.matchedSkillCount, matchedSkillNames: m.matchedSkillNames, fullMatch: m.fullMatch });
    }
    return map;
  }, [recommended]);
  const requiredSkillCount = recommended?.requiredSkills.length ?? 0;

  const busyTechIds = useMemo(() => new Set(
    allTickets
      .filter(t => BUSY_STATUSES.includes(t.status) && t.technician?.id)
      .map(t => t.technician!.id)
  ), [allTickets]);

  const { register: ra, handleSubmit: ha, reset: resetA, setValue: setAssignValue, watch: watchAssign, formState: { isSubmitting: sa, errors: errorsA } } = useForm<{ technicianId: string; scheduledAt: string }>();
  const selectedTechId = watchAssign('technicianId') ?? '';
  const selectedSchedule = watchAssign('scheduledAt') ?? '';
  const { register: rc, handleSubmit: hc, reset: resetC, formState: { isSubmitting: sc } } = useForm<{ notes: string }>();
  const { register: rx, handleSubmit: hx, reset: resetX, formState: { isSubmitting: sx } } = useForm<{ reason: string }>();

  const assignMutation = useMutation({
    // The datetime-local input's raw value has no timezone marker — converting to a full UTC ISO
    // string here (using the manager's own browser timezone) before it leaves the client means
    // the backend's parsing is unambiguous regardless of what timezone the server itself runs in,
    // rather than relying on server-OS-timezone === browser-timezone by coincidence.
    mutationFn: (d: { technicianId: string; scheduledAt: string }) => api.patch(`/web/manager/tickets/${id}/${assignMode === 'reschedule' ? 'reassign' : assignMode}`, {
      ...d,
      scheduledAt: dayjs(d.scheduledAt).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success(assignMode === 'reassign' ? 'Reassigned' : assignMode === 'reschedule' ? 'Rescheduled' : 'Assigned');
      setShowAssign(false); resetA();
    },
    onError: (err) => toast.error(getErrorMessage(err, assignMode === 'reassign' ? 'Failed to reassign ticket' : assignMode === 'reschedule' ? 'Failed to reschedule ticket' : 'Failed to assign ticket')),
  });

  const closeMutation = useMutation({
    mutationFn: (d: { notes: string }) => api.patch(`/web/manager/tickets/${id}/close`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast.success('Ticket closed'); setShowClose(false); resetC(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to close ticket')),
  });

  const cancelMutation = useMutation({
    mutationFn: (d: { reason: string }) => api.patch(`/web/manager/tickets/${id}/cancel`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast.success('Ticket cancelled'); setShowCancel(false); resetX(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to cancel ticket')),
  });

  const approvePendingMutation = useMutation({
    mutationFn: () => api.patch(`/web/manager/tickets/${id}/approve-pending`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast.success('Pending approved — technician notified'); setConfirmPending(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to approve pending ticket')),
  });

  const rejectPendingMutation = useMutation({
    mutationFn: () => api.patch(`/web/manager/tickets/${id}/reject-pending`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast.success('Pending rejected — ticket resumed'); setConfirmPending(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to reject pending ticket')),
  });

  // Only this ticket's own customer's assets are ever offered — the backend independently
  // enforces the same ownership + tenant check, this is just so the picker doesn't show anyone
  // else's equipment in the first place.
  const customerId = ticket?.customer?.id;
  const { data: customerAssets = [] } = useQuery<CustomerAsset[]>({
    queryKey: ['customer-assets', customerId],
    queryFn: async () => (await api.get('/web/manager/customer-assets', { params: { customerId } })).data.data,
    enabled: showAssetPicker && !!customerId,
  });

  const associateAssetMutation = useMutation({
    mutationFn: (assetId: string) => api.patch(`/web/manager/tickets/${id}/associate-asset`, { customerAssetId: assetId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('Asset linked to this ticket');
      setShowAssetPicker(false); setPickedAssetId(''); setConfirmAssetChange(null);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to link asset')),
  });

  const consumeAmcVisitMutation = useMutation({
    mutationFn: () => api.patch(`/web/manager/tickets/${id}/consume-amc-visit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast.success('This service now counts as one AMC visit'); setConfirmConsumeVisit(false); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to record AMC visit')),
  });

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />;
  if (!ticket) return <ErrorState title="Ticket not found" message="This ticket may have been removed or the link is incorrect." onRetry={refetch} />;

  const canAssign = ticket.status === 'NEW_TICKET';
  const canReassign = ticket.status === 'ASSIGNED' || ticket.status === 'ACCEPTED';
  const canReschedule = ticket.status === 'PENDING';
  const canActOnPending = ticket.status === 'PENDING';
  const canClose = ticket.status === 'INVOICE_GENERATED';
  const canCancel = !['COMPLETED', 'TICKET_CLOSED', 'CANCELLED'].includes(ticket.status);

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back link */}
      <Link
        href={ticketsBase}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <ChevronLeft size={14} />
        Back to Tickets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-[var(--color-text-muted)] font-mono">{ticket.ticketNumber}</p>
            {!!ticket.assignmentCount && ticket.assignmentCount > 1 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
                Reassigned {ticket.assignmentCount} times
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">{ticket.customer?.name}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{ticket.customer?.phone}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <TicketStatusBadge status={ticket.status} />
          <div className="flex flex-wrap justify-end gap-2">
            {canAssign && <Button size="sm" onClick={() => { setAssignMode('assign'); resetA({ scheduledAt: defaultScheduleValue(ticket.scheduledAt) }); setShowAssign(true); }}><UserCheck size={13} /> Assign</Button>}
            {canReassign && <Button size="sm" variant="secondary" onClick={() => { setAssignMode('reassign'); resetA({ scheduledAt: defaultScheduleValue(ticket.scheduledAt) }); setShowAssign(true); }}><RefreshCw size={13} /> Reassign</Button>}
            {canReschedule && <Button size="sm" variant="secondary" onClick={() => { setAssignMode('reschedule'); resetA({ scheduledAt: defaultScheduleValue(ticket.scheduledAt) }); setShowAssign(true); }}><CalendarClock size={13} /> Reschedule</Button>}
            {canActOnPending && (
              <>
                <Button size="sm" variant="secondary" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => setConfirmPending('approve')}><ThumbsUp size={13} /> Approve</Button>
                <Button size="sm" variant="secondary" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmPending('reject')}><ThumbsDown size={13} /> Reject</Button>
              </>
            )}
            {canClose && <Button size="sm" variant="secondary" onClick={() => setShowClose(true)}><CheckCircle size={13} /> Close</Button>}
            {canCancel && <Button size="sm" variant="danger" onClick={() => setShowCancel(true)}><XCircle size={13} /> Cancel</Button>}
          </div>
        </div>
      </div>

      {canActOnPending && ticket.pendingReason && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">Technician marked this ticket as Pending</p>
            <p className="text-amber-700 mt-0.5"><span className="font-medium">Reason:</span> {ticket.pendingReason}</p>
            {ticket.pendingNotes && <p className="text-amber-700"><span className="font-medium">Notes:</span> {ticket.pendingNotes}</p>}
            <p className="text-amber-600 text-xs mt-1">Use <strong>Approve</strong> to acknowledge the delay, or <strong>Reject</strong> to send the technician back to work immediately.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-2">
          <h3 className="font-medium text-[var(--color-text-secondary)]">Service Description</h3>
          <div className="text-[var(--color-text-secondary)] space-y-1">
            <p><span className="text-[var(--color-text-muted)]">Category:</span> {ticket.subCategory?.category?.name ?? '—'}</p>
            <p><span className="text-[var(--color-text-muted)]">Sub Category:</span> {ticket.subCategory?.name ?? '—'}</p>
            {ticket.description && (
              <p className="font-semibold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded inline-block">
                Description: {ticket.description}
              </p>
            )}
          </div>
          {ticket.subCategory?.serviceCharges && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="info" showDot={false}>Service ₹{ticket.subCategory.serviceCharges.serviceCharge.toLocaleString()}</Badge>
              <Badge variant="purple" showDot={false}>Inspection ₹{ticket.subCategory.serviceCharges.inspectionCharge.toLocaleString()}</Badge>
              <Badge variant="orange" showDot={false}>Emergency ₹{ticket.subCategory.serviceCharges.emergencyCharge.toLocaleString()}</Badge>
            </div>
          )}
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5"><Box size={14} /> Affected Asset</h3>
            {ticket.customerAsset && ticket.status !== 'CANCELLED' && ticket.status !== 'TICKET_CLOSED' && (
              <button
                type="button"
                onClick={() => { setPickedAssetId(''); setShowAssetPicker(v => !v); }}
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                Change
              </button>
            )}
          </div>

          {!ticket.customerAsset && !showAssetPicker && ticket.status !== 'CANCELLED' && ticket.status !== 'TICKET_CLOSED' && (
            <div className="pt-1">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">No asset linked yet — identify which of {ticket.customer?.name ?? 'the customer'}&apos;s assets this request is about.</p>
              <Button size="sm" variant="secondary" onClick={() => setShowAssetPicker(true)}><Link2 size={13} /> Link Asset</Button>
            </div>
          )}

          {showAssetPicker && (
            <div className="pt-1 space-y-2">
              <Select
                label="Select Asset"
                value={pickedAssetId}
                onChange={e => setPickedAssetId(e.target.value)}
                placeholder={customerAssets.length ? 'Choose an asset' : 'No assets registered for this customer'}
                options={customerAssets.map(a => ({ value: a.id, label: `${a.name}${a.brand ? ` (${a.brand}${a.model ? ' ' + a.model : ''})` : ''}` }))}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!pickedAssetId}
                  onClick={() => {
                    const asset = customerAssets.find(a => a.id === pickedAssetId);
                    if (!asset) return;
                    // Changing an already-linked asset (as opposed to linking one for the first
                    // time) can affect which AMC/warranty coverage applies, so confirm that case —
                    // linking one for the first time on a still-open ticket doesn't need it.
                    if (ticket.customerAsset) setConfirmAssetChange(asset);
                    else associateAssetMutation.mutate(asset.id);
                  }}
                  loading={associateAssetMutation.isPending}
                >
                  Link
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setShowAssetPicker(false); setPickedAssetId(''); }}>Cancel</Button>
              </div>
            </div>
          )}

          {ticket.customerAsset && !showAssetPicker && (
            <>
              <div className="text-[var(--color-text-secondary)] space-y-1">
                <p><span className="text-[var(--color-text-muted)]">Name:</span> {ticket.customerAsset.name}</p>
                <p><span className="text-[var(--color-text-muted)]">Brand/Model:</span> {[ticket.customerAsset.brand, ticket.customerAsset.model].filter(Boolean).join(' / ') || '—'}</p>
                {ticket.customerAsset.serialNumber && <p><span className="text-[var(--color-text-muted)]">Serial #:</span> {ticket.customerAsset.serialNumber}</p>}
                {ticket.customerAsset.installationDate && <p><span className="text-[var(--color-text-muted)]">Installed:</span> {dayjs(ticket.customerAsset.installationDate).format('DD MMM YYYY')}</p>}
              </div>

              {ticket.customerAsset.warrantyExpiresAt && (
                <div className="pt-1 flex items-center gap-1.5 text-xs">
                  {dayjs(ticket.customerAsset.warrantyExpiresAt).isAfter(dayjs()) ? (
                    <><ShieldCheck size={13} className="text-emerald-600" /> <span className="text-emerald-600 font-medium">Warranty Active</span> <span className="text-[var(--color-text-muted)]">until {dayjs(ticket.customerAsset.warrantyExpiresAt).format('DD MMM YYYY')}</span></>
                  ) : (
                    <><ShieldOff size={13} className="text-[var(--color-text-muted)]" /> <span className="text-[var(--color-text-muted)]">Warranty expired {dayjs(ticket.customerAsset.warrantyExpiresAt).format('DD MMM YYYY')}</span></>
                  )}
                </div>
              )}

              {ticket.amcStatus ? (
                <div className="pt-1 space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-600 font-medium text-xs"><ShieldCheck size={13} /> AMC — {ticket.amcStatus.planName}</div>
                  <p className="text-xs text-[var(--color-text-muted)]">{ticket.amcStatus.remainingVisits} of {ticket.amcStatus.totalVisits} visits remaining</p>
                  {ticket.amcStatus.nextVisitDate && (
                    <p className="text-xs text-[var(--color-text-muted)]">Next scheduled visit: {dayjs(ticket.amcStatus.nextVisitDate).format('DD MMM YYYY')}</p>
                  )}
                  {!ticket.amcVisit && ticket.amcStatus.remainingVisits > 0 && !['NEW_TICKET', 'ASSIGNED', 'ACCEPTED', 'CANCELLED'].includes(ticket.status) && (
                    <Button size="sm" variant="secondary" className="mt-1" onClick={() => setConfirmConsumeVisit(true)}>
                      <ShieldCheck size={13} /> Mark as AMC Visit
                    </Button>
                  )}
                  {ticket.amcVisit && (
                    <Badge variant={ticket.amcVisit.status === 'COMPLETED' ? 'success' : 'purple'} showDot={false}>
                      AMC Visit {ticket.amcVisit.status === 'COMPLETED' ? 'Consumed' : ticket.amcVisit.status}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="pt-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] text-xs"><ShieldOff size={13} /> No active AMC</div>
                  <Link href={`/${prefix}/amc/assign?customerId=${ticket.customer?.id}&assetId=${ticket.customerAsset.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
                    Assign AMC →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-2">
          <h3 className="font-medium text-[var(--color-text-secondary)]">Details</h3>
          <div className="text-[var(--color-text-secondary)] space-y-1">
            <p><span className="text-[var(--color-text-muted)]">Technician:</span> {ticket.technician?.name ?? 'Unassigned'}</p>
            <p><span className="text-[var(--color-text-muted)]">Scheduled:</span> {ticket.scheduledAt ? dayjs(ticket.scheduledAt).format('DD MMM YYYY, HH:mm') : '—'}</p>
            {ticket.serviceAddress && <p><span className="text-[var(--color-text-muted)]">Address:</span> {ticket.serviceAddress}</p>}
            <p><span className="text-[var(--color-text-muted)]">Created:</span> {dayjs(ticket.createdAt).format('DD MMM YYYY, HH:mm')}</p>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm text-sm space-y-2">
          <h3 className="font-medium text-[var(--color-text-secondary)]">Payment</h3>

          {/* Coverage is only truly known once the technician has recorded work/parts — showing
              "AMC Covered" before that just because the asset has active AMC would be finalizing
              coverage too early (the technician might diagnose something the plan doesn't cover). */}
          {!ticket.spareParts?.length && !ticket.payment && (
            <Badge variant="default" showDot={false}>Coverage: Pending Diagnosis</Badge>
          )}

          {ticket.payment ? (
            <div className="space-y-1 text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2 flex-wrap">
                <PaymentStatusBadge status={ticket.payment.status} />
                <Badge variant={ticket.isAmcCovered ? 'purple' : 'info'} showDot={false}>
                  {ticket.isAmcCovered ? 'AMC Visit' : 'Not an AMC Visit'}
                </Badge>
              </div>
              {(ticket.payment.serviceCharge || ticket.payment.labourCharge || ticket.payment.sparePartsAmount || ticket.payment.additionalCharge) ? (
                <>
                  <p className={ticket.payment.serviceChargeWaived ? 'line-through text-[var(--color-text-muted)]' : ''}>
                    <span className="text-[var(--color-text-muted)]">Service Charge:</span> ₹{(ticket.payment.serviceCharge ?? 0).toLocaleString()}
                  </p>
                  <p className={ticket.payment.labourChargeWaived ? 'line-through text-[var(--color-text-muted)]' : ''}>
                    <span className="text-[var(--color-text-muted)]">Labour Charge:</span> ₹{(ticket.payment.labourCharge ?? 0).toLocaleString()}
                  </p>
                  <p className={ticket.payment.sparePartsWaived ? 'line-through text-[var(--color-text-muted)]' : ''}>
                    <span className="text-[var(--color-text-muted)]">Spare Parts:</span> ₹{(ticket.payment.sparePartsAmount ?? 0).toLocaleString()}
                  </p>
                  {!!ticket.payment.additionalCharge && (
                    <p><span className="text-[var(--color-text-muted)]">Additional Charge:</span> ₹{ticket.payment.additionalCharge.toLocaleString()}</p>
                  )}
                  {!!ticket.payment.discount && (
                    <p><span className="text-[var(--color-text-muted)]">Discount:</span> -₹{ticket.payment.discount.toLocaleString()}</p>
                  )}
                  {ticket.paymentSummary ? (
                    <>
                      <p className="border-t border-[var(--color-border)] pt-1 mt-1">
                        <span className="text-[var(--color-text-muted)]">Subtotal:</span> ₹{ticket.paymentSummary.subtotal.toLocaleString()}
                      </p>
                      {ticket.paymentSummary.gstEnabled && (
                        <p>
                          <span className="text-[var(--color-text-muted)]">GST ({ticket.paymentSummary.gstPercent}%):</span> ₹{ticket.paymentSummary.gstAmount.toLocaleString()}
                        </p>
                      )}
                      <p className="font-semibold text-[var(--color-text-primary)]">Grand Total: ₹{ticket.paymentSummary.grandTotal.toLocaleString()}</p>
                    </>
                  ) : (
                    <p className="border-t border-[var(--color-border)] pt-1 mt-1 font-semibold text-[var(--color-text-primary)]">Total: ₹{ticket.payment.amount.toLocaleString()}</p>
                  )}
                </>
              ) : (
                <p><span className="text-[var(--color-text-muted)]">Amount:</span> ₹{ticket.payment.amount.toLocaleString()}</p>
              )}
              <p><span className="text-[var(--color-text-muted)]">Method:</span> {ticket.payment.method ?? '—'}</p>
            </div>
          ) : ticket.status === 'COMPLETED' ? (
            <p className="text-[var(--color-text-muted)]">Not yet collected — see Payment Details below.</p>
          ) : <p className="text-[var(--color-text-muted)]">No payment yet</p>}

          {ticket.feedback && (
            <>
              <h3 className="font-medium text-[var(--color-text-secondary)] mt-3">Feedback</h3>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < ticket.feedback!.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                ))}
                <span className="text-[var(--color-text-muted)] ml-1 text-xs">{ticket.feedback.review}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {ticket.status === 'COMPLETED' && !ticket.payment && (
        <PaymentCollectionCard
          ticketId={ticket.id}
          spareParts={ticket.spareParts ?? []}
          isAmcCovered={!!ticket.isAmcCovered}
          onCollected={() => qc.invalidateQueries({ queryKey: ['ticket', id] })}
        />
      )}

      {!!ticket.spareParts?.length && (() => {
        const amc = ticket.spareParts!.filter(p => p.coverageType === 'AMC');
        const warranty = ticket.spareParts!.filter(p => p.coverageType === 'WARRANTY');
        const chargeable = ticket.spareParts!.filter(p => p.coverageType === 'OUT_OF_WARRANTY' || !p.coverageType);
        const partRow = (p: typeof ticket.spareParts[number]) => (
          <div key={p.id} className="flex items-center justify-between text-[var(--color-text-secondary)]">
            <span>{p.sparePart?.partName ?? 'Spare part'} <span className="text-[var(--color-text-muted)]">× {p.quantity} {p.sparePart?.unitOfMeasure}</span></span>
            <span>₹{p.unitPrice.toLocaleString()} × {p.quantity} = <span className="font-medium text-[var(--color-text-primary)]">₹{p.calculatedAmount.toLocaleString()}</span></span>
          </div>
        );
        return (
          <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
            <h3 className="font-medium text-[var(--color-text-secondary)] mb-3">Spare Parts Used</h3>
            <div className="space-y-3 text-sm">
              {!!amc.length && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-600 mb-1.5">AMC Covered (₹0)</p>
                  <div className="space-y-1.5">{amc.map(partRow)}</div>
                </div>
              )}
              {!!warranty.length && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mb-1.5">Warranty Covered (₹0)</p>
                  <div className="space-y-1.5">{warranty.map(partRow)}</div>
                </div>
              )}
              {!!chargeable.length && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-1.5">Customer Payable</p>
                  <div className="space-y-1.5">{chargeable.map(partRow)}</div>
                </div>
              )}
              <div className="border-t border-[var(--color-border)] pt-2 mt-2 flex items-center justify-between font-semibold text-[var(--color-text-primary)]">
                <span>Customer Payable Total</span>
                <span>₹{chargeable.reduce((sum, p) => sum + p.calculatedAmount, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-[var(--color-text-secondary)]">Work Timeline</h3>
          {typeof ticket.serviceDurationMinutes === 'number' && (
            <Badge variant="teal" showDot={false}>Duration: {ticket.serviceDurationMinutes} min</Badge>
          )}
        </div>
        <div className="space-y-3">
          {(ticket.statusLogs ?? []).map((log, i) => (
            <div key={log.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`h-2.5 w-2.5 rounded-full mt-1 ${i === 0 ? 'bg-blue-500' : 'bg-[var(--color-border-strong)]'}`} />
                {i < (ticket.statusLogs?.length ?? 0) - 1 && <div className="flex-1 w-px bg-[var(--color-border)] mt-1" />}
              </div>
              <div className="pb-3">
                <TicketStatusBadge status={log.status} />
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{dayjs(log.changedAt).format('DD MMM YYYY, HH:mm')}</p>
                {log.notes && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 whitespace-pre-line">{log.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!!ticket.assignmentHistory?.length && (
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
          <h3 className="font-medium text-[var(--color-text-secondary)] mb-3">Assignment History</h3>
          <div className="space-y-3">
            {ticket.assignmentHistory.map((entry, i) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full mt-1 ${i === (ticket.assignmentHistory!.length - 1) ? 'bg-blue-500' : 'bg-[var(--color-border-strong)]'}`} />
                  {i < ticket.assignmentHistory!.length - 1 && <div className="flex-1 w-px bg-[var(--color-border)] mt-1" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Assigned to <span className="font-medium">{entry.technician.name}</span>
                    {entry.assigner && <span className="text-[var(--color-text-muted)]"> by {entry.assigner.name}</span>}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{dayjs(entry.assignedAt).format('DD MMM YYYY, HH:mm')}</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium mt-1 ${
                      entry.status === 'ACCEPTED' || entry.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : entry.status === 'REJECTED' || entry.status === 'EXPIRED'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {entry.status}
                  </span>
                  {entry.reason && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{entry.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ticket.images && ticket.images.some(i => i.type === 'RAISED') && (
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
          <h3 className="font-medium text-[var(--color-text-secondary)] mb-3">Customer Photos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ticket.images.filter(i => i.type === 'RAISED').map(img => (
              <a key={img.id} href={img.imageUrl} target="_blank" rel="noopener noreferrer">
                <img src={img.imageUrl} alt="Customer upload" className="rounded-lg w-full object-cover aspect-video border border-[var(--color-border)] hover:opacity-90 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {ticket.images && ticket.images.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
          <h3 className="font-medium text-[var(--color-text-secondary)] mb-3">Work Photos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['BEFORE', 'AFTER'] as TicketImage['type'][]).map(type => {
              const img = ticket.images!.find(i => i.type === type);
              return (
                <div key={type}>
                  <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">{type}</p>
                  {img ? (
                    <a href={img.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={img.imageUrl} alt={type} className="rounded-lg w-full object-cover aspect-video border border-[var(--color-border)] hover:opacity-90 transition-opacity" />
                    </a>
                  ) : (
                    <div className="rounded-lg bg-[var(--color-surface-elevated)] border border-dashed border-[var(--color-border)] aspect-video flex items-center justify-center">
                      <p className="text-xs text-[var(--color-text-muted)]">No photo</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {ticket.images.find(i => i.type === 'SIGNATURE') && (
            <div className="mt-4">
              <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Customer Signature</p>
              <a href={ticket.images.find(i => i.type === 'SIGNATURE')!.imageUrl} target="_blank" rel="noopener noreferrer">
                <img src={ticket.images.find(i => i.type === 'SIGNATURE')!.imageUrl} alt="Signature" className="rounded-lg h-20 border border-[var(--color-border)] hover:opacity-90 transition-opacity" />
              </a>
            </div>
          )}
        </div>
      )}

      <Modal open={showAssign} onClose={() => { setShowAssign(false); resetA(); }} title={assignMode === 'reassign' ? 'Reassign Ticket' : assignMode === 'reschedule' ? 'Reschedule Ticket' : 'Assign Ticket'} size="sm">
        <form onSubmit={ha(d => assignMutation.mutate(d))} className="space-y-4">
          <Input
            label="Scheduled At"
            type="datetime-local"
            min={getMinimumSelectableDateTime()}
            error={errorsA.scheduledAt?.message}
            {...ra('scheduledAt', {
              required: 'Pick a date & time first',
              validate: (v) => !isPastSchedule(v) || 'This date/time has already passed — please pick a current or future time',
            })}
          />

          <ScheduleFallbackNotice
            originalScheduledAt={ticket.scheduledAt}
            show={!(ticket.scheduledAt && dayjs(ticket.scheduledAt).isAfter(dayjs()))}
          />

          <CustomerRequestedSchedule requestedScheduleAt={ticket.requestedScheduleAt} />

          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-2">Technician</label>
            {!selectedSchedule ? (
              <p className="text-sm text-[var(--color-text-muted)] py-2 px-3 rounded-lg bg-[var(--color-surface-elevated)]">
                Pick a scheduled date &amp; time above to choose a technician.
              </p>
            ) : (
              <>
                {subCategoryId && requiredSkillCount === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">
                    No skills are mapped to this service yet — set them from the Categories page to get skill-based suggestions here.
                  </p>
                )}
                <TechnicianPicker
                  techs={techs.filter(t => t.isActive)}
                  busyIds={busyTechIds}
                  value={selectedTechId}
                  onChange={id => setAssignValue('technicianId', id, { shouldValidate: true })}
                  skillMatches={skillMatches}
                  requiredSkillCount={requiredSkillCount}
                />
                {!selectedTechId && <p className="text-red-400 text-xs mt-1.5">Please select a technician</p>}
              </>
            )}
            <input type="hidden" {...ra('technicianId', { required: true })} />
          </div>

          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowAssign(false); resetA(); }}>Cancel</Button><Button type="submit" loading={sa}>{assignMode === 'reassign' ? 'Reassign' : assignMode === 'reschedule' ? 'Reschedule' : 'Assign'}</Button></div>
        </form>
      </Modal>

      <Modal open={showClose} onClose={() => { setShowClose(false); resetC(); }} title="Close Ticket" size="sm">
        <form onSubmit={hc(d => closeMutation.mutate(d))} className="space-y-4">
          <Textarea label="Notes (optional)" {...rc('notes')} />
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowClose(false); resetC(); }}>Cancel</Button><Button type="submit" loading={sc}>Close Ticket</Button></div>
        </form>
      </Modal>

      <Modal open={showCancel} onClose={() => { setShowCancel(false); resetX(); }} title="Cancel Ticket" size="sm">
        <form onSubmit={hx(d => cancelMutation.mutate(d))} className="space-y-4">
          <Textarea label="Reason" {...rx('reason', { required: true })} />
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowCancel(false); resetX(); }}>Cancel</Button><Button variant="danger" type="submit" loading={sx}>Cancel Ticket</Button></div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmPending}
        onClose={() => setConfirmPending(null)}
        onConfirm={() => confirmPending === 'approve' ? approvePendingMutation.mutate() : rejectPendingMutation.mutate()}
        tone={confirmPending === 'approve' ? 'neutral' : 'danger'}
        title={confirmPending === 'approve' ? `Approve pending on ${ticket.ticketNumber}?` : `Reject pending on ${ticket.ticketNumber}?`}
        message={
          confirmPending === 'approve'
            ? `${ticket.technician?.name ?? 'The technician'} will be notified that the delay is acknowledged. The ticket stays in Pending until they resume work.`
            : `${ticket.technician?.name ?? 'The technician'} will be sent back to work on this ticket immediately, without the reported delay being acknowledged.`
        }
        confirmLabel={confirmPending === 'approve' ? 'Approve' : 'Reject'}
        loading={approvePendingMutation.isPending || rejectPendingMutation.isPending}
      />

      <ConfirmDialog
        open={!!confirmAssetChange}
        onClose={() => setConfirmAssetChange(null)}
        onConfirm={() => confirmAssetChange && associateAssetMutation.mutate(confirmAssetChange.id)}
        tone="neutral"
        title={`Link ${confirmAssetChange?.name ?? 'this asset'} to ${ticket.ticketNumber}?`}
        message={`This replaces ${ticket.customerAsset?.name ?? 'the current asset'} as the affected asset. Warranty and AMC information shown on this ticket will switch to ${confirmAssetChange?.name ?? 'the new asset'}.`}
        confirmLabel="Link Asset"
        loading={associateAssetMutation.isPending}
      />

      <ConfirmDialog
        open={confirmConsumeVisit}
        onClose={() => setConfirmConsumeVisit(false)}
        onConfirm={() => consumeAmcVisitMutation.mutate()}
        tone="neutral"
        title="Mark this service as an AMC visit?"
        message={`This will consume one AMC visit on ${ticket.customerAsset?.name ?? 'this asset'}'s ${ticket.amcStatus?.planName ?? 'AMC'} plan. Remaining visits will go from ${ticket.amcStatus?.remainingVisits ?? 0} to ${(ticket.amcStatus?.remainingVisits ?? 1) - 1}. This cannot be undone.`}
        confirmLabel="Consume AMC Visit"
        loading={consumeAmcVisitMutation.isPending}
      />
    </div>
  );
}
