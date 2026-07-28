'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Eye, EyeOff, Trash2, Search, Copy, CheckCheck, Link2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { Tenant, TenantStatus } from '@/types';
import { TenantStatusBadge, PlanBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { emailSchema, phoneSchema, requiredString, passwordSchema } from '@/lib/validations';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FilterCard } from '@/components/ui/FilterCard';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

const schema = z.object({
  companyName: requiredString('Company name is required'),
  tenantCode: requiredString('Tenant code is required'),
  email: emailSchema,
  phone: phoneSchema,
  address: requiredString('Address is required'),
  adminName: requiredString('Admin name is required'),
  adminEmail: emailSchema,
  adminPassword: passwordSchema,
  plan: z.string().optional(),
});

type Form = z.infer<typeof schema>;



function ActiveToggle({ tenant, onToggle, loading }: { tenant: Tenant; onToggle: (id: string, next: TenantStatus) => void; loading: boolean }) {
  const isActive = tenant.status === 'ACTIVE';
  return (
    <button
      className="flex items-center gap-2 group"
      onClick={() => onToggle(tenant.id, isActive ? 'SUSPENDED' : 'ACTIVE')}
      disabled={loading}
      title={isActive ? 'Click to suspend' : 'Click to activate'}
    >
      <div className={`relative h-5 w-10 rounded-full transition-colors ${isActive ? 'bg-blue-500' : 'bg-gray-300'} ${loading ? 'opacity-50' : ''}`}>
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : ''}`} />
      </div>
      <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    </button>
  );
}

export default function TenantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [params, setParams] = useState({ search: '', status: '', plan: '' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { data: tenants = [], isLoading, isError, error, refetch } = useQuery<Tenant[]>({
    queryKey: ['tenants', params],
    queryFn: async () => (await api.get('/web/super-admin/tenants', {
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
    })).data.data,
  });

  const filteredTenants = tenants.filter(t => {
    const s = params.search.toLowerCase().trim();
    const matchesSearch = !s || 
      t.companyName.toLowerCase().includes(s) || 
      t.tenantCode.toLowerCase().includes(s) ||
      t.email.toLowerCase().includes(s) ||
      t.phone.toLowerCase().includes(s);

    const matchesStatus = !params.status || t.status === params.status;

    const planName = ((t as any).subscription?.plan ?? t.plan ?? (t as any).selectedPlan)?.name;
    const matchesPlan = !params.plan || planName === params.plan;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  const { data: plans = [] } = useQuery<{ id: string; name: string; isActive: boolean }[]>({
    queryKey: ['plans'],
    queryFn: async () => (await api.get('/web/super-admin/plans')).data.data,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isValid } } = useForm<Form>({ 
    resolver: zodResolver(schema),
    mode: 'onChange'
  });
  const [manualCode, setManualCode] = useState(false);
  const watchedCompany = watch('companyName');

  useEffect(() => {
    if (manualCode || !watchedCompany) return;
    setValue('tenantCode', watchedCompany.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20), { shouldValidate: false });
  }, [watchedCompany, manualCode, setValue]);

  const [createdTenant, setCreatedTenant] = useState<{ url: string; companyName: string; adminEmail: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: Form) => api.post('/web/super-admin/tenants', data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      setCreatedTenant({ url: `${baseUrl}/admin/${vars.tenantCode}/login`, companyName: vars.companyName, adminEmail: vars.adminEmail });
      setShowCreate(false);
      reset();
      setManualCode(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create tenant')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TenantStatus }) =>
      api.patch(`/web/super-admin/tenants/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      setTogglingId(null);
    },
    onError: (err) => { toast.error(getErrorMessage(err, 'Failed to update status')); setTogglingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/super-admin/tenants/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); toast.success('Tenant deleted'); setDeleteId(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete tenant')),
  });

  function handleToggle(id: string, next: TenantStatus) {
    setTogglingId(id);
    statusMutation.mutate({ id, status: next });
  }

  const columns: ColumnDef<Tenant>[] = [
    {
      accessorKey: 'companyName',
      header: 'Company',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
            {row.original.companyName.charAt(0).toUpperCase()}
          </div>
          <p className="font-semibold text-[var(--color-text-primary)] leading-tight whitespace-nowrap">{row.original.companyName}</p>
        </div>
      )
    },
    {
      accessorKey: 'tenantCode',
      header: 'Code',
      cell: ({ row }) => (
        <code className="text-xs bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] px-2 py-0.5 rounded-md border border-[var(--color-border)] font-mono">
          {row.original.tenantCode}
        </code>
      )
    },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{row.original.email}</span> },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{row.original.phone}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <TenantStatusBadge status={row.original.status} /> },
    {
      id: 'plan',
      header: 'Plan',
      accessorFn: row => ((row as any).subscription?.plan ?? row.plan ?? (row as any).selectedPlan)?.name,
      cell: ({ row }) => <PlanBadge planName={((row.original as any).subscription?.plan ?? row.original.plan ?? (row.original as any).selectedPlan)?.name} />
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{dayjs(row.original.createdAt).format('DD MMM YYYY')}</span>
    },
    {
      id: 'loginUrl',
      header: 'Login URL',
      cell: ({ row }) => {
        const t = row.original;
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/admin/${t.tenantCode}/login`;
        return (
          <button
            onClick={() => { navigator.clipboard.writeText(loginUrl); toast.success('Copied!'); }}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-mono transition-colors whitespace-nowrap"
            title="Copy login URL"
          >
            /admin/{t.tenantCode}/login <Copy size={11} />
          </button>
        );
      }
    },
    {
      id: 'active',
      header: 'Active',
      cell: ({ row }) => <ActiveToggle tenant={row.original} onToggle={handleToggle} loading={togglingId === row.original.id} />
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link href={`/super-admin/tenants/${row.original.id}`}>
            <button className="h-8 w-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors" title="View detail">
              <Eye size={14} />
            </button>
          </Link>
          <button
            className="h-8 w-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:border-red-300 hover:text-red-500 transition-colors"
            onClick={() => setDeleteId(row.original.id)}
            title="Delete tenant"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Tenants</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Manage all platform tenants</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Tenant
        </Button>
      </div>

      {/* Filter Bar */}
      <FilterCard
        title="Filter Tenants"
        hideDateRange
        onApply={() => { setPage(1); setParams({ search, status: statusFilter, plan: planFilter }); }}
        onReset={() => {
          setSearch('');
          setStatusFilter('');
          setPlanFilter('');
          setPage(1);
          setParams({ search: '', status: '', plan: '' });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Search</span>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              placeholder="Company or code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setParams({ search, status: statusFilter, plan: planFilter }); } }}
              className="w-52 rounded-[10px] border border-[var(--color-border-input)] bg-[var(--color-input-bg)] pl-8 pr-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition-all h-10"
            />
          </div>
        </div>
        <Select label="Status" options={[{ value: '', label: 'All Status' }, { value: 'ACTIVE', label: 'Active' }, { value: 'SUSPENDED', label: 'Suspended' }, { value: 'EXPIRED', label: 'Expired' }, { value: 'TRIAL', label: 'Trial' }]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-36" />
        <Select label="Plan" options={[{ value: '', label: 'All Plans' }, ...plans.map(p => ({ value: p.name, label: p.name }))]} value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="w-40" />
      </FilterCard>

      {/* Table */}
      <DataTable data={filteredTenants} columns={columns} isLoading={isLoading} isError={isError} error={error} onRetry={refetch} />


      {/* Create Tenant Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); reset(); }} title="Create New Tenant" size="lg">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Company Name *" {...register('companyName')} error={errors.companyName?.message} />
            <div className="flex flex-col gap-1">
              <Input label="Tenant Code *" {...register('tenantCode')} error={errors.tenantCode?.message} onInput={() => setManualCode(true)} placeholder="e.g. acmecorp" />
              {!manualCode && watchedCompany && <p className="text-[10px] text-[var(--color-text-muted)]">Auto-generated — edit to customise</p>}
            </div>
            <Input label="Email *" type="email" {...register('email')} error={errors.email?.message} />
            <Input label="Phone *" {...register('phone')} error={errors.phone?.message} />
            <Textarea label="Address *" {...register('address')} error={errors.address?.message} className="sm:col-span-2" />
          </div>

          <div className="pt-1 border-t border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Admin Account</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Admin Name *" {...register('adminName')} error={errors.adminName?.message} />
              <Input label="Admin Email *" type="email" {...register('adminEmail')} error={errors.adminEmail?.message} />
              <Input 
                label="Admin Password *" 
                type={showPassword ? 'text' : 'password'} 
                {...register('adminPassword')} 
                error={errors.adminPassword?.message} 
                suffix={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:text-gray-700 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              <Select label="Plan" options={plans.filter(p => p.isActive).map(p => ({ value: p.name, label: p.name }))} placeholder="Select Plan" {...register('plan')} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowCreate(false); reset(); setManualCode(false); setShowPassword(false); }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting} disabled={!isValid}>Create Tenant</Button>
          </div>
        </form>
      </Modal>

      {/* Tenant Created Success Modal */}
      {createdTenant && (
        <Modal open={!!createdTenant} onClose={() => setCreatedTenant(null)} title="Tenant Created" size="sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-[var(--color-surface-elevated)] border border-emerald-100 rounded-xl p-4">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCheck size={17} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Workspace is ready</p>
                <p className="text-xs text-emerald-600 mt-0.5">Share the login URL and credentials with the admin.</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Workspace</p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{createdTenant.companyName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Login URL</p>
                <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
                  <Link2 size={12} className="text-[var(--color-text-muted)] shrink-0" />
                  <code className="text-xs text-blue-600 flex-1 truncate">{createdTenant.url}</code>
                  <button onClick={() => { navigator.clipboard.writeText(createdTenant.url); toast.success('URL copied!'); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"><Copy size={12} /></button>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Admin Email</p>
                <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
                  <code className="text-xs text-[var(--color-text-secondary)] flex-1">{createdTenant.adminEmail}</code>
                  <button onClick={() => { navigator.clipboard.writeText(createdTenant.adminEmail); toast.success('Email copied!'); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"><Copy size={12} /></button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`Workspace: ${createdTenant.companyName}\nLogin URL: ${createdTenant.url}\nAdmin Email: ${createdTenant.adminEmail}`); toast.success('All details copied!'); }} className="flex-1"><Copy size={13} /> Copy All</Button>
              <Button size="sm" onClick={() => setCreatedTenant(null)} className="flex-1"><CheckCheck size={13} /> Done</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        message="This will soft-delete the tenant and deactivate all users. This action cannot be easily undone."
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
