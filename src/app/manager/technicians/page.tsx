'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Eye, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { Technician, Skill } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { PaginationMeta } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Star } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

const schema = z.object({
  name: z.string().min(1, 'Name is required (e.g. Siva Kumar)'),
  email: z.string().min(1, 'Email is required').refine(v => v.includes('@') && v.includes('.'), 'Enter a valid email (e.g. siva@gmail.com)'),
  // Matches the backend's exact accepted format (create-technician.dto.ts: /^[6-9]\d{9}$/) —
  // a 10-digit Indian mobile number starting with 6-9 — so a value valid here is never rejected
  // by the API, and vice versa.
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters (e.g. Siva@123)'),
});

type Form = z.infer<typeof schema>;

export default function TechniciansPage() {
  const qc = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Technician | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  // Drill-down from the Admin Dashboard's "Available Technicians" card — same isActive + no
  // active-status-ticket rule as AdminService.getDashboard(), enforced server-side.
  const [availableOnly, setAvailableOnly] = useState(searchParams.get('available') === 'true');

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Technician[]; meta: PaginationMeta }>({
    queryKey: ['technicians', page, limit, availableOnly],
    queryFn: async () => (await api.get('/web/manager/technicians', {
      params: { page, limit, ...(availableOnly && { available: 'true' }) },
    })).data.data,
    placeholderData: keepPreviousData,
  });

  const techs = data?.items ?? [];

  const clearAvailableFilter = () => {
    setAvailableOnly(false);
    setPage(1);
    router.replace(pathname);
  };

  // Onboarding offers only active Master Skills — creating a technician has no dedicated
  // "with skills" endpoint, so skills are attached right after creation succeeds.
  const { data: activeSkills = [] } = useQuery<Skill[]>({
    queryKey: ['skills', 'active'],
    queryFn: async () => (await api.get('/web/manager/skills', { params: { isActive: true } })).data.data,
    enabled: showCreate,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const closeCreate = () => { setShowCreate(false); reset(); setSelectedSkillIds([]); };

  const createMutation = useMutation({
    mutationFn: async (d: Form) => {
      const res = await api.post('/web/manager/technicians', d);
      const techId = res.data.data.id as string;
      if (selectedSkillIds.length) {
        const results = await Promise.allSettled(
          selectedSkillIds.map(skillId => api.post(`/web/manager/technicians/${techId}/skills`, { skillId })),
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        return { failed };
      }
      return { failed: 0 };
    },
    onSuccess: ({ failed }) => {
      qc.invalidateQueries({ queryKey: ['technicians'] });
      if (failed > 0) {
        toast.warning(`Technician added, but ${failed} skill${failed > 1 ? 's' : ''} couldn't be attached — add ${failed > 1 ? 'them' : 'it'} from the technician's profile.`);
      } else {
        toast.success('Technician added');
      }
      closeCreate();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to add technician')),
  });

  const toggleSkill = (id: string) => {
    setSelectedSkillIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/manager/technicians/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['technicians'] }); toast.success('Technician removed'); setDeleteTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete technician')),
  });

  const columns: ColumnDef<Technician, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'danger'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    { accessorKey: 'rating', header: 'Rating', cell: ({ row }) => row.original.rating ? <div className="flex items-center gap-1"><Star size={12} className="fill-yellow-400 text-yellow-400" />{row.original.rating.toFixed(1)}</div> : '—' },
    { accessorKey: 'createdAt', header: 'Joined', cell: ({ row }) => dayjs(row.original.createdAt).format('DD MMM YYYY') },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link href={`/${prefix}/technicians/${row.original.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row.original)} className="text-red-500"><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Technicians</h2>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Add Technician</Button>
      </div>

      {availableOnly && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-muted)]">Active filter:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-light)] border border-[var(--color-primary-ring)] pl-3 pr-1.5 py-1 text-xs font-medium text-[var(--color-primary)]">
            Available Technicians
            <button
              type="button"
              onClick={clearAvailableFilter}
              aria-label="Clear Available Technicians filter"
              className="flex items-center justify-center rounded-full h-4 w-4 hover:bg-[var(--color-primary)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        </div>
      )}

      <DataTable
        data={techs}
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

      <Modal open={showCreate} onClose={closeCreate} title="Add Technician">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Input label="Phone" {...register('phone')} error={errors.phone?.message} />
          <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Skills (optional)</label>
            {activeSkills.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] mt-1.5">No active skills in the Master Skills list yet.</p>
            ) : (
              <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2 space-y-1">
                {activeSkills.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-[var(--color-surface-elevated)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.includes(s.id)}
                      onChange={() => toggleSkill(s.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-[var(--color-text-secondary)]">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Experience level and certification can be added later from the technician&apos;s profile.
            </p>
          </div>

          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={closeCreate}>Cancel</Button><Button type="submit" loading={isSubmitting}>Add</Button></div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Remove ${deleteTarget?.name ?? 'this technician'}?`}
        message={`${deleteTarget?.name ?? 'This technician'} will no longer be able to access technician features or be assigned new tickets.`}
        confirmLabel="Remove"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
