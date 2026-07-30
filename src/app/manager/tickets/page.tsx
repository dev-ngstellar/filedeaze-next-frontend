'use client';

import { useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Eye, Phone, Plus, X } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { Ticket, TicketStatus, Customer, ServiceCategory, ServiceSubCategory, CustomerAsset, AmcSubscription } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { TicketStatusBadge, Badge } from '@/components/ui/Badge';
import { FilterCard } from '@/components/ui/FilterCard';
import { PaginationMeta } from '@/components/ui/Pagination';
import { getMinimumSelectableDateTime, isPastSchedule, getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  ...(['NEW_TICKET', 'ASSIGNED', 'ACCEPTED', 'TRAVELLING', 'REACHED_LOCATION',
    'IN_PROGRESS', 'PENDING', 'COMPLETED', 'INVOICE_GENERATED', 'TICKET_CLOSED', 'CANCELLED'] as TicketStatus[])
    .map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
];

type CreateForm = {
  customerId: string;
  customerAssetId: string;
  categoryId: string;
  subCategoryId: string;
  description: string;
  priority: string;
  serviceMode: 'IMMEDIATE' | 'SCHEDULED';
  scheduledAt: string;
  serviceAddress: string;
};

type NewCustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

// Each of these mirrors a drill-down link from the Admin Dashboard — the query param name and the
// resulting API filter match the exact same rule used to compute that dashboard number, so the
// count shown on the dashboard always agrees with the filtered list here.
type DashboardFilterKind = 'pending-assignment' | 'overdue' | 'completed-today' | 'awaiting-collection' | 'open' | 'expired';

const DASHBOARD_FILTER_LABELS: Record<DashboardFilterKind, string> = {
  'pending-assignment': 'Awaiting Assignment',
  'overdue': 'Overdue',
  'completed-today': 'Completed Today',
  'awaiting-collection': 'Awaiting Payment Collection',
  'open': 'Open Tickets',
  'expired': 'Rework Requests (Expired Assignment)',
};

function readDashboardFilter(sp: URLSearchParams): { kind: DashboardFilterKind; params: Record<string, string>; status: string } | null {
  if (sp.get('overdue') === 'true') return { kind: 'overdue', params: { overdueOnly: 'true' }, status: '' };
  if (sp.get('completedToday') === 'true') return { kind: 'completed-today', params: { completedTodayOnly: 'true' }, status: '' };
  if (sp.get('awaitingCollection') === 'true') return { kind: 'awaiting-collection', params: { awaitingCollectionOnly: 'true' }, status: '' };
  if (sp.get('open') === 'true') return { kind: 'open', params: { openOnly: 'true' }, status: '' };
  if (sp.get('expired') === 'true') return { kind: 'expired', params: { expiredOnly: 'true' }, status: '' };
  if (sp.get('status') === 'NEW_TICKET') return { kind: 'pending-assignment', params: { status: 'NEW_TICKET' }, status: 'NEW_TICKET' };
  return null;
}

export default function TicketsPage() {
  const qc = useQueryClient();
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDashboardFilter = readDashboardFilter(searchParams);
  const [status, setStatus] = useState(initialDashboardFilter?.status ?? '');
  const [customerName, setCustomerName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilterKind | null>(initialDashboardFilter?.kind ?? null);
  const [params, setParams] = useState<Record<string, string>>(initialDashboardFilter?.params ?? {});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showCreate, setShowCreate] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCust, setNewCust] = useState<NewCustomerForm>({ name: '', phone: '', email: '', address: '' });

  const { data: response, isLoading, isError, error, refetch } = useQuery<{ data: Ticket[]; meta: PaginationMeta }>({
    queryKey: ['tickets', params, page, limit],
    queryFn: async () => (await api.get('/web/manager/tickets', {
      params: { ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), page, limit },
    })).data,
    placeholderData: keepPreviousData,
  });

  const data = response?.data ?? [];
  const meta = response?.meta;

  // Data for the create form dropdowns
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-list'],
    queryFn: async () => (await api.get('/web/manager/customers')).data.data,
    enabled: showCreate,
  });

  const { data: categories = [] } = useQuery<ServiceCategory[]>({
    queryKey: ['service-categories'],
    queryFn: async () => (await api.get('/web/manager/service-categories')).data.data,
    enabled: showCreate,
  });

  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    defaultValues: { priority: 'MEDIUM', serviceMode: 'IMMEDIATE' },
  });

  const selectedCategoryId = watch('categoryId');
  const selectedCustomerId = watch('customerId');
  const selectedAssetId = watch('customerAssetId');
  const serviceMode = watch('serviceMode') ?? 'IMMEDIATE';

  const { data: subCategories = [] } = useQuery<ServiceSubCategory[]>({
    queryKey: ['sub-categories', selectedCategoryId],
    queryFn: async () => (await api.get('/web/manager/service-sub-categories', {
      params: { categoryId: selectedCategoryId },
    })).data.data,
    enabled: showCreate && !!selectedCategoryId,
  });

  // Assets registered to the selected customer, so a call-in request can be tied to a specific unit.
  const { data: customerAssets = [] } = useQuery<CustomerAsset[]>({
    queryKey: ['customer-assets-for-ticket', selectedCustomerId],
    queryFn: async () => (await api.get('/web/manager/customer-assets', { params: { customerId: selectedCustomerId } })).data.data,
    enabled: showCreate && !!selectedCustomerId,
  });

  const { data: assetAmcSubs = [] } = useQuery<AmcSubscription[]>({
    queryKey: ['ticket-asset-amc', selectedAssetId],
    queryFn: async () => (await api.get('/web/manager/amc/subscriptions', { params: { customerAssetId: selectedAssetId, status: 'ACTIVE' } })).data.data,
    enabled: showCreate && !!selectedAssetId,
  });
  const activeAmc = assetAmcSubs[0];

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => api.post('/web/manager/tickets', {
      customerId: d.customerId,
      customerAssetId: d.customerAssetId || undefined,
      categoryId: d.categoryId,
      subCategoryId: d.subCategoryId,
      description: d.description,
      priority: d.priority || undefined,
      // The datetime-local input's raw value has no timezone marker — converting to a full UTC
      // ISO string here (using the manager's own browser timezone) before it leaves the client
      // means the backend's parsing is unambiguous regardless of what timezone the server itself
      // runs in, rather than relying on server-OS-timezone === browser-timezone by coincidence.
      scheduledAt: d.serviceMode === 'SCHEDULED' && d.scheduledAt ? dayjs(d.scheduledAt).toISOString() : undefined,
      serviceAddress: d.serviceAddress || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket created successfully');
      setShowCreate(false);
      reset();
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, 'Failed to create ticket')),
  });

  const createCustomerMutation = useMutation({
    mutationFn: (d: NewCustomerForm) =>
      api.post('/web/manager/customers', {
        name: d.name.trim(),
        phone: d.phone.trim(),
        ...(d.email.trim() && { email: d.email.trim() }),
        ...(d.address.trim() && { address: d.address.trim() }),
      }),
    onSuccess: (res) => {
      const created = res.data.data as Customer;
      qc.invalidateQueries({ queryKey: ['customers-list'] });
      setValue('customerId', created.id);
      if (created.address) setValue('serviceAddress', created.address);
      setShowNewCustomer(false);
      setNewCust({ name: '', phone: '', email: '', address: '' });
      toast.success(`Customer "${created.name}" added`);
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, 'Failed to create customer')),
  });

  const closeModal = () => { setShowCreate(false); setShowNewCustomer(false); setNewCust({ name: '', phone: '', email: '', address: '' }); reset(); };

  const clearDashboardFilter = () => {
    setDashboardFilter(null);
    setStatus('');
    setCustomerName('');
    setFrom('');
    setTo('');
    setParams({});
    setPage(1);
    router.replace(pathname);
  };

  const columns: ColumnDef<Ticket, unknown>[] = [
    { accessorKey: 'ticketNumber', header: 'Ticket #' },
    { accessorKey: 'customer.name', header: 'Customer', cell: ({ row }) => row.original.customer?.name },
    { accessorKey: 'technician.name', header: 'Technician', cell: ({ row }) => row.original.technician?.name ?? '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <TicketStatusBadge status={row.original.status} /> },
    { accessorKey: 'scheduledAt', header: 'Scheduled', cell: ({ row }) => row.original.scheduledAt ? dayjs(row.original.scheduledAt).format('DD MMM, HH:mm') : '—' },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => dayjs(row.original.createdAt).format('DD MMM YYYY') },
    { id: 'actions', header: '', cell: ({ row }) => <Link href={`/${prefix}/tickets/${row.original.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Tickets</h2>
        <Button onClick={() => setShowCreate(true)}>
          <Phone size={15} /> New Ticket (Call)
        </Button>
      </div>

      {dashboardFilter && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-muted)]">Active filter:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-light)] border border-[var(--color-primary-ring)] pl-3 pr-1.5 py-1 text-xs font-medium text-[var(--color-primary)]">
            {DASHBOARD_FILTER_LABELS[dashboardFilter]}
            <button
              type="button"
              onClick={clearDashboardFilter}
              aria-label={`Clear ${DASHBOARD_FILTER_LABELS[dashboardFilter]} filter`}
              className="flex items-center justify-center rounded-full h-4 w-4 hover:bg-[var(--color-primary)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        </div>
      )}

      <FilterCard
        title="Tickets Filter"
        from={from}
        to={to}
        onFromChange={val => setFrom(val)}
        onToChange={val => setTo(val)}
        onApply={() => { setDashboardFilter(null); setPage(1); setParams({ status, customerName, from, to }); }}
        onReset={clearDashboardFilter}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">Status</label>
          <Select options={STATUS_OPTIONS} value={status} onChange={e => setStatus(e.target.value)} className="w-48 h-10" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">Customer</label>
          <Input
            placeholder="Search by customer name..."
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-48 h-10"
          />
        </div>
      </FilterCard>

      <DataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        pagination={meta ? {
          meta,
          onPageChange: setPage,
          onLimitChange: (l) => { setPage(1); setLimit(l); },
        } : undefined}
      />

      {/* Create ticket on behalf of customer */}
      <Modal open={showCreate} onClose={closeModal} title="New Ticket — Customer Call" size="md">
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-surface-elevated)] border border-blue-100 px-3 py-2 mb-4">
          <Phone size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Use this form to raise a service ticket on behalf of a customer who called in.
            The ticket will be created under the selected customer&apos;s account.
          </p>
        </div>

        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <div>
            <Select
              label="Customer *"
              options={customers.map(c => ({ value: c.id, label: `${c.name} — ${c.phone ?? ''}` }))}
              placeholder="Select customer"
              {...register('customerId', { required: true })}
            />
            {!showNewCustomer ? (
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus size={12} /> New Customer
              </button>
            ) : (
              <div className="mt-2 p-3 border border-blue-200 rounded-lg bg-[var(--color-surface-elevated)] space-y-2">
                <Input
                  placeholder="Name *"
                  value={newCust.name}
                  onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))}
                />
                <Input
                  placeholder="Phone *"
                  value={newCust.phone}
                  onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))}
                />
                <Input
                  placeholder="Email * (e.g. ravi@gmail.com)"
                  value={newCust.email}
                  onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))}
                />
                <Input
                  placeholder="Address (e.g. 12 Gandhi Street, Chennai) *"
                  value={newCust.address}
                  onChange={e => setNewCust(p => ({ ...p, address: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    loading={createCustomerMutation.isPending}
                    onClick={() => {
                      if (!newCust.name.trim() || !newCust.phone.trim()) {
                        toast.error('Name and phone are required');
                        return;
                      }
                      if (!newCust.email.trim()) {
                        toast.error('Email is required to send the service request confirmation');
                        return;
                      }
                      if (!newCust.address.trim()) {
                        toast.error('Address is required so the technician knows where to go');
                        return;
                      }
                      createCustomerMutation.mutate(newCust);
                    }}
                  >
                    Add Customer
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShowNewCustomer(false); setNewCust({ name: '', phone: '', email: '', address: '' }); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {selectedCustomerId && (
            <div>
              <Select
                label="Customer Asset"
                options={customerAssets.map(a => ({ value: a.id, label: `${a.name}${a.brand ? ` (${a.brand})` : ''}` }))}
                placeholder="General request (no specific asset)"
                {...register('customerAssetId')}
              />
              {selectedAssetId && (
                <div className="mt-1.5">
                  {activeAmc
                    ? <Badge variant="success">Under AMC — {activeAmc.plan?.name}</Badge>
                    : <Badge variant="default" showDot={false}>No active AMC</Badge>}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Service Category *"
              options={categories.map(c => ({ value: c.id, label: c.name }))}
              placeholder="Select category"
              {...register('categoryId', { required: true })}
            />
            <Select
              label="Sub-Category *"
              options={subCategories.map(s => ({ value: s.id, label: s.name }))}
              placeholder={selectedCategoryId ? 'Select sub-category' : 'Select category first'}
              {...register('subCategoryId', { required: true })}
            />
          </div>

          <Textarea
            label="Description *"
            placeholder="Describe the issue reported by the customer..."
            rows={3}
            {...register('description', { required: true })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Priority"
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
              ]}
              {...register('priority')}
            />
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Service Timing</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={serviceMode === 'IMMEDIATE' ? 'primary' : 'secondary'}
                  onClick={() => setValue('serviceMode', 'IMMEDIATE')}
                  className="flex-1"
                >
                  Immediate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={serviceMode === 'SCHEDULED' ? 'primary' : 'secondary'}
                  onClick={() => setValue('serviceMode', 'SCHEDULED')}
                  className="flex-1"
                >
                  Scheduled
                </Button>
              </div>
              <input type="hidden" {...register('serviceMode')} />
            </div>
          </div>

          {serviceMode === 'SCHEDULED' && (
            <Input
              label="Requested Date *"
              type="datetime-local"
              min={getMinimumSelectableDateTime()}
              error={errors.scheduledAt?.message}
              {...register('scheduledAt', {
                required: serviceMode === 'SCHEDULED' ? 'Pick the date & time the customer requested' : false,
                validate: (v) => !isPastSchedule(v) || 'This date/time has already passed — please pick a current or future time',
              })}
            />
          )}

          <Input
            label="Service Address"
            placeholder="Address where service is needed (leave blank to use customer's default)"
            {...register('serviceAddress')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              <Plus size={14} /> Create Ticket
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
