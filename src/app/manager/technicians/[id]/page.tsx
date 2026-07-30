'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Technician, TechnicianSkill, Skill } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { MapPin, Route, Star, Trash2, Plus, Key, ChevronLeft } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';
import Link from 'next/link';

export default function TechnicianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const techniciansBase = pathname.startsWith('/admin/') ? '/admin/technicians' : '/manager/technicians';
  const qc = useQueryClient();
  const [showResetPw, setShowResetPw] = useState(false);
  const [removeSkillTarget, setRemoveSkillTarget] = useState<TechnicianSkill | null>(null);
  const [routeDate, setRouteDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data: tech, isLoading, isError, error, refetch, isFetching } = useQuery<Technician>({ queryKey: ['technician', id], queryFn: async () => (await api.get(`/web/manager/technicians/${id}`)).data.data });
  const { data: skills = [] } = useQuery<TechnicianSkill[]>({ queryKey: ['tech-skills', id], queryFn: async () => (await api.get(`/web/manager/technicians/${id}/skills`)).data.data.skills ?? [] });
  // Only active skills are offered for new assignment — an already-assigned skill that's since
  // been deactivated still shows in the technician's own list above, just not re-selectable here.
  const { data: allSkills = [] } = useQuery<Skill[]>({ queryKey: ['skills', 'active'], queryFn: async () => (await api.get('/web/manager/skills', { params: { isActive: true } })).data.data });
  const { data: location } = useQuery({ queryKey: ['tech-location', id], queryFn: async () => (await api.get(`/web/manager/technicians/${id}/location`)).data.data, refetchInterval: 30_000 });
  const { data: route } = useQuery({ queryKey: ['tech-route', id, routeDate], queryFn: async () => (await api.get(`/web/manager/technicians/${id}/route`, { params: { date: routeDate } })).data.data });

  const { register: ri, handleSubmit: hi, reset: resetI, formState: { isSubmitting: si, errors: errorsI } } = useForm<Pick<Technician, 'name' | 'phone' | 'isActive'>>();
  const { register: rp, handleSubmit: hp, reset: resetP, formState: { isSubmitting: sp } } = useForm<{ newPassword: string }>();
  const { register: rs, handleSubmit: hs, reset: resetS, formState: { isSubmitting: ss } } = useForm<{ skillId: string }>();

  useEffect(() => { if (tech) resetI({ name: tech.name, phone: tech.phone, isActive: tech.isActive }); }, [tech, resetI]);

  const updateMutation = useMutation({
    mutationFn: (d: Pick<Technician, 'name' | 'phone' | 'isActive'>) => api.patch(`/web/manager/technicians/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['technician', id] });
      qc.invalidateQueries({ queryKey: ['technicians'] });
      toast.success('Updated');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update technician')),
  });
  const resetPwMutation = useMutation({ mutationFn: (d: { newPassword: string }) => api.patch(`/web/manager/technicians/${id}/reset-password`, d), onSuccess: () => { toast.success('Password reset'); setShowResetPw(false); resetP(); }, onError: (err) => toast.error(getErrorMessage(err, 'Failed to reset password')) });
  const addSkillMutation = useMutation({
    mutationFn: (d: { skillId: string }) =>
      api.post(`/web/manager/technicians/${id}/skills`, {
        skillId: d.skillId,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tech-skills', id] }); toast.success('Skill added'); resetS(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to add skill')),
  });
  const removeSkillMutation = useMutation({ mutationFn: (skillId: string) => api.delete(`/web/manager/technicians/${id}/skills/${skillId}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tech-skills', id] }); toast.success('Skill removed'); setRemoveSkillTarget(null); }, onError: (err) => toast.error(getErrorMessage(err, 'Failed to remove skill')) });

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />;
  if (!tech) return <ErrorState title="Technician not found" message="This technician may have been removed or the link is incorrect." onRetry={refetch} />;

  const skillOptions = allSkills.filter(s => !skills.find(ts => ts.skillId === s.id)).map(s => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back link */}
      <Link
        href={techniciansBase}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <ChevronLeft size={14} />
        Back to Technicians
      </Link>

      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{tech.name}</h2>
        <Badge variant={tech.isActive ? 'success' : 'danger'}>{tech.isActive ? 'Active' : 'Inactive'}</Badge>
        {tech.rating && <div className="flex items-center gap-1 text-sm"><Star size={13} className="fill-yellow-400 text-yellow-400" />{tech.rating.toFixed(1)}</div>}
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)] shadow-sm">
        <h3 className="font-medium text-[var(--color-text-secondary)] mb-4">Edit Info</h3>
        <form onSubmit={hi(d => updateMutation.mutate(d))} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Name" {...ri('name')} />
          <Input
            label="Phone"
            error={errorsI.phone?.message}
            {...ri('phone', {
              pattern: { value: /^[6-9]\d{9}$/, message: 'Please enter a valid 10-digit mobile number' },
            })}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Email</label>
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-muted)] select-all">{tech.email ?? '—'}</p>
          </div>
          <div></div>
          <div className="flex items-center gap-2 col-span-2">
            <input type="checkbox" id="isActive" {...ri('isActive')} className="h-4 w-4" />
            <label htmlFor="isActive" className="text-sm text-[var(--color-text-secondary)]">Active</label>
          </div>
          <div className="col-span-2 flex justify-between">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowResetPw(true)}><Key size={14} /> Reset Password</Button>
            <Button type="submit" loading={si}>Save</Button>
          </div>
        </form>
      </div>



      <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[var(--color-text-secondary)]">Skills</h3>
        </div>
        <form onSubmit={hs(d => addSkillMutation.mutate(d))} className="flex items-start gap-3 mb-6">
          <div className="flex-1">
            <Select options={skillOptions} placeholder="Select skill to add..." {...rs('skillId', { required: true })} />
          </div>
          <Button type="submit" loading={ss}>Add Skill</Button>
        </form>
        {skills.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No skills assigned</p> : (
          <div className="space-y-2">
            {skills.map(ts => (
              <div key={ts.skillId} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{ts.skill.name}</span>
                  {ts.certificationNumber && <span className="ml-2 text-[var(--color-text-muted)] text-xs">{ts.certificationNumber}</span>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setRemoveSkillTarget(ts)} className="text-red-400"><Trash2 size={13} /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showResetPw} onClose={() => { setShowResetPw(false); resetP(); }} title="Reset Password" size="sm">
        <form onSubmit={hp(d => resetPwMutation.mutate(d))} className="space-y-4">
          <Input label="New Password" type="password" {...rp('newPassword', { required: true, minLength: 6 })} />
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => { setShowResetPw(false); resetP(); }}>Cancel</Button><Button type="submit" loading={sp}>Reset</Button></div>
        </form>
      </Modal>


      <ConfirmDialog
        open={!!removeSkillTarget}
        onClose={() => setRemoveSkillTarget(null)}
        onConfirm={() => removeSkillTarget && removeSkillMutation.mutate(removeSkillTarget.skillId)}
        title={`Remove ${removeSkillTarget?.skill.name ?? 'this skill'}?`}
        message={`${tech?.name ?? 'This technician'} will no longer be listed as skilled in ${removeSkillTarget?.skill.name ?? 'this skill'} for job recommendations.`}
        confirmLabel="Remove"
        loading={removeSkillMutation.isPending}
      />
    </div>
  );
}
