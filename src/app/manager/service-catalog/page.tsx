'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Search, X, LayoutGrid, ArrowLeft, Tag, Wrench
} from 'lucide-react';
import api from '@/lib/axios';
import { ServiceCategory, ServiceSubCategory, Skill, SubCategorySkill, SparePart } from '@/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { useRoleAccent } from '@/lib/useRoleAccent';
import { cn, getErrorMessage, hasMoreThanTwoDecimals } from '@/lib/utils';
import Select from 'react-select'; // They use react-select for multi-select

// ─── Inline Drawer Wrapper ──────────────────────────────────────────────────
function RightDrawer({
  open,
  onClose,
  title,
  children,
  width = '600px',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div className={`fixed inset-0 z-[100] flex justify-end transition-all duration-300 ${open ? 'opacity-100 pointer-events-auto visible' : 'opacity-0 pointer-events-none invisible'}`}>
      <div
        className={`absolute inset-0 bg-black/1 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative bg-[var(--color-surface)] shadow-2xl flex flex-col h-full overflow-hidden transition-transform duration-300 ease-in-out rounded-l-2xl ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: '100%', maxWidth: width }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0 bg-[var(--color-surface)]">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-[var(--color-background)] p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Draft State Types ──────────────────────────────────────────────────────
interface SubCatDraft {
  id?: string;
  name: string;
  serviceCharge: number;
  inspectionCharge: number;
  emergencyCharge: number;
  isActive: boolean;
  skills: string[]; // Skill IDs
  isDeleted?: boolean; // For tracking removals during edit
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function ServiceCatalogPage() {
  const qc = useQueryClient();
  const accent = useRoleAccent();
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';

  // ── UI Layout State
  const [searchQ, setSearchQ] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // ── Queries
  const {
    data: categories = [], isLoading: catsLoading,
    isError: catsError, error: catsErr, refetch: refetchCats,
  } = useQuery<ServiceCategory[]>({
    queryKey: ['service-categories'],
    queryFn: async () => (await api.get('/web/manager/service-categories')).data.data,
  });

  const {
    data: allSubs = [], isLoading: subsLoading,
    isError: subsError, error: subsErr, refetch: refetchSubs,
  } = useQuery<ServiceSubCategory[]>({
    queryKey: ['sub-categories', ''],
    queryFn: async () => (await api.get('/web/manager/service-sub-categories')).data.data,
  });

  const { data: activeSkills = [] } = useQuery<Skill[]>({
    queryKey: ['skills', 'active'],
    queryFn: async () => (await api.get('/web/manager/skills', { params: { isActive: true } })).data.data,
  });

  const isLoading = catsLoading || subsLoading;
  const isError = catsError || subsError;
  const listError = catsErr ?? subsErr;
  const refetchList = () => { refetchCats(); refetchSubs(); };

  // ── Filtered Master List
  const filteredCategories = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(cat => {
      const matchCat = cat.name.toLowerCase().includes(q);
      const matchSub = allSubs.some(s => s.categoryId === cat.id && s.name.toLowerCase().includes(q));
      return matchCat || matchSub;
    });
  }, [categories, allSubs, searchQ]);

  // Auto-select first category if none selected
  useEffect(() => {
    if (!selectedCatId && filteredCategories.length > 0 && !isLoading) {
      setSelectedCatId(filteredCategories[0].id);
    }
  }, [filteredCategories, selectedCatId, isLoading]);

  // ── Selected Category Details
  const selectedCat = useMemo(() => categories.find(c => c.id === selectedCatId), [categories, selectedCatId]);
  const selectedCatSubs = useMemo(() => allSubs.filter(s => s.categoryId === selectedCatId), [allSubs, selectedCatId]);

  // Fetch skills concurrently for the selected category's subcategories
  const skillQueries = useQueries({
    queries: selectedCatSubs.map(sub => ({
      queryKey: ['sub-category-skills', sub.id],
      queryFn: async () => (await api.get(`/web/manager/service-sub-categories/${sub.id}/skills`)).data.data.skills as SubCategorySkill[],
    }))
  });

  // Map subCategoryId -> SubCategorySkill[]
  const skillsMap = useMemo(() => {
    const map: Record<string, SubCategorySkill[]> = {};
    selectedCatSubs.forEach((sub, i) => {
      map[sub.id] = skillQueries[i]?.data ?? [];
    });
    return map;
  }, [selectedCatSubs, skillQueries]);

  // Fetch spare parts concurrently for the selected category's subcategories
  const sparePartQueries = useQueries({
    queries: selectedCatSubs.map(sub => ({
      queryKey: ['sub-category-spare-parts', sub.id],
      queryFn: async () => (await api.get(`/web/manager/service-sub-categories/${sub.id}/spare-parts`)).data.data as SparePart[],
    }))
  });

  // Map subCategoryId -> SparePart[]
  const sparePartsMap = useMemo(() => {
    const map: Record<string, SparePart[]> = {};
    selectedCatSubs.forEach((sub, i) => {
      map[sub.id] = sparePartQueries[i]?.data ?? [];
    });
    return map;
  }, [selectedCatSubs, sparePartQueries]);

  // ── Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const [draftCatName, setDraftCatName] = useState('');
  const [draftCatIsActive, setDraftCatIsActive] = useState(true);
  const [draftSubs, setDraftSubs] = useState<SubCatDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // ── Confirm Dialogs
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/web/manager/service-categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-categories'] });
      toast.success('Category deleted');
      setDeleteCatId(null);
      if (selectedCatId === deleteCatId) setSelectedCatId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete category')),
  });

  // ── Actions
  const openCreateDrawer = () => {
    setDrawerMode('create');
    setEditingCatId(null);
    setDraftCatName('');
    setDraftCatIsActive(true);
    setDraftSubs([]);
    setDrawerOpen(true);
  };

  const openEditDrawer = async (cat: ServiceCategory) => {
    setDrawerMode('edit');
    setEditingCatId(cat.id);
    setDraftCatName(cat.name);
    setDraftCatIsActive(cat.isActive);

    const subs = allSubs.filter(s => s.categoryId === cat.id);

    // We need to fetch all skills for these subs before opening to pre-fill the form properly
    const loadedSubs: SubCatDraft[] = await Promise.all(subs.map(async sub => {
      let mappedSkills: SubCategorySkill[] = [];
      try {
        const res = await api.get(`/web/manager/service-sub-categories/${sub.id}/skills`);
        mappedSkills = res.data.data.skills ?? [];
      } catch (e) {
        // ignore
      }
      return {
        id: sub.id,
        name: sub.name,
        serviceCharge: sub.serviceCharges?.serviceCharge ?? 0,
        inspectionCharge: sub.serviceCharges?.inspectionCharge ?? 0,
        emergencyCharge: sub.serviceCharges?.emergencyCharge ?? 0,
        isActive: sub.isActive,
        skills: mappedSkills.map(ms => ms.skillId),
      };
    }));

    setDraftSubs(loadedSubs);
    setDrawerOpen(true);
  };

  const addDraftSub = () => {
    setDraftSubs(prev => [...prev, {
      name: '',
      serviceCharge: 0,
      inspectionCharge: 0,
      emergencyCharge: 0,
      isActive: true,
      skills: [],
    }]);
  };

  const updateDraftSub = (index: number, field: keyof SubCatDraft, value: any) => {
    setDraftSubs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeDraftSub = (index: number) => {
    setDraftSubs(prev => {
      const copy = [...prev];
      if (copy[index].id) {
        copy[index].isDeleted = true; // Mark for deletion if it exists on backend
      } else {
        copy.splice(index, 1); // Remove immediately if just a local draft
      }
      return copy;
    });
  };

  const handleSave = async () => {
    if (!draftCatName.trim()) {
      toast.error('Category name is required');
      return;
    }

    for (const sub of draftSubs) {
      if (sub.isDeleted) continue;
      if (!sub.name.trim()) {
        toast.error('All active services must have a name');
        return;
      }
      if (sub.serviceCharge < 0 || sub.inspectionCharge < 0 || sub.emergencyCharge < 0) {
        toast.error(`"${sub.name || 'Untitled service'}" has a negative charge — charges cannot be negative`);
        return;
      }
      if (hasMoreThanTwoDecimals(sub.serviceCharge) || hasMoreThanTwoDecimals(sub.inspectionCharge) || hasMoreThanTwoDecimals(sub.emergencyCharge)) {
        toast.error(`"${sub.name || 'Untitled service'}" has a charge with more than 2 decimal places`);
        return;
      }
    }

    setIsSaving(true);
    let targetCatId = editingCatId;

    try {
      // 1. Create or Update Category
      if (drawerMode === 'create') {
        const catRes = await api.post('/web/manager/service-categories', { name: draftCatName });
        targetCatId = catRes.data.data.id;
      } else {
        await api.patch(`/web/manager/service-categories/${targetCatId}`, { name: draftCatName, isActive: draftCatIsActive });
      }

      // 2. Process Sub-Categories
      for (const sub of draftSubs) {
        if (sub.isDeleted && sub.id) {
          // Delete removed sub-category
          await api.delete(`/web/manager/service-sub-categories/${sub.id}`);
          continue;
        }

        if (sub.isDeleted) continue;

        let subId = sub.id;

        // Create or Update Sub-category
        if (!subId) {
          const subRes = await api.post('/web/manager/service-sub-categories', { categoryId: targetCatId, name: sub.name });
          subId = subRes.data.data.id;
        } else {
          await api.patch(`/web/manager/service-sub-categories/${subId}`, { name: sub.name, isActive: sub.isActive });
        }

        // Set Charges
        await api.post(`/web/manager/service-charges/${subId}`, {
          serviceCharge: sub.serviceCharge,
          inspectionCharge: sub.inspectionCharge,
          emergencyCharge: sub.emergencyCharge,
        });

        // Manage Skills (Diffing logic: fetch current, add new, remove missing)
        // For simplicity and safety, we fetch current mapped skills, then unmap removed ones, and map new ones.
        if (subId) {
          const currentSkillsRes = await api.get(`/web/manager/service-sub-categories/${subId}/skills`);
          const currentMapped: SubCategorySkill[] = currentSkillsRes.data.data.skills ?? [];
          const currentSkillIds = currentMapped.map(ms => ms.skillId);

          const toAdd = sub.skills.filter(id => !currentSkillIds.includes(id));
          const toRemove = currentSkillIds.filter(id => !sub.skills.includes(id));

          for (const sId of toRemove) {
            await api.delete(`/web/manager/service-sub-categories/${subId}/skills/${sId}`);
          }
          for (const sId of toAdd) {
            await api.post(`/web/manager/service-sub-categories/${subId}/skills`, { skillId: sId });
          }
        }
      }

      toast.success(drawerMode === 'create' ? 'Category created successfully' : 'Category updated successfully');
      setDrawerOpen(false);
      qc.invalidateQueries({ queryKey: ['service-categories'] });
      qc.invalidateQueries({ queryKey: ['sub-categories'] });
      qc.invalidateQueries({ queryKey: ['sub-category-skills'] });

    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4 animate-fe-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Categories & Services</h2>
            {!isLoading && (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-muted)]">
                <span>{categories.length} Categories</span>
                <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                <span>{allSubs.length} Services</span>
              </div>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Manage your service categories, sub-categories, pricing and required skills from one place.
          </p>
        </div>
        <Button onClick={openCreateDrawer} style={{ background: accent }} className="shrink-0 font-semibold border-none text-white hover:brightness-110">
          <Plus size={15} className="mr-1.5" />
          New Category
        </Button>
      </div>

      {/* ── Master / Detail Layout ── */}
      <div className="flex flex-1 min-h-0 gap-5 overflow-hidden">

        {/* Left Panel: Category Master List */}
        <div className={cn(
          "w-full sm:w-80 flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden shrink-0 transition-all",
          selectedCatId ? "hidden sm:flex" : "flex"
        )}>
          {/* Search Bar */}
          <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search categories..."
                className="w-full h-9 pl-9 pr-8 text-[13px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all"
                onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}18`; }}
                onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
              />
              {searchQ && (
                <button
                  onClick={() => setSearchQ('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-[var(--color-surface-elevated)] animate-pulse" />
                ))}
              </div>
            ) : isError ? (
              <ErrorState title="Unable to load service catalog" error={listError} onRetry={refetchList} />
            ) : filteredCategories.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                <LayoutGrid size={24} className="text-[var(--color-text-muted)] mb-3 opacity-50" />
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">No categories found</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Try a different search or create a new one.</p>
              </div>
            ) : (
              filteredCategories.map(cat => {
                const subCount = allSubs.filter(s => s.categoryId === cat.id).length;
                const isSelected = selectedCatId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatId(cat.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left border border-transparent",
                      isSelected ? "bg-[var(--color-surface-elevated)]" : "hover:bg-[var(--color-surface-elevated)]/50"
                    )}
                    style={isSelected ? { borderColor: `${accent}30`, background: `${accent}0C` } : {}}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                        style={isSelected ? { background: accent, color: '#fff' } : { background: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)' }}
                      >
                        <LayoutGrid size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-[13px] truncate transition-colors",
                          isSelected ? "font-bold text-[var(--color-text-primary)]" : "font-medium text-[var(--color-text-secondary)]"
                        )}>
                          {cat.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                          {subCount} {subCount === 1 ? 'service' : 'services'}
                        </p>
                      </div>
                    </div>
                    {!cat.isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 ml-2" title="Inactive" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Category Details Workspace */}
        <div className={cn(
          "flex-1 flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden transition-all min-w-0",
          !selectedCatId ? "hidden sm:flex" : "flex"
        )}>
          {selectedCat ? (
            <>
              {/* Workspace Header */}
              <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setSelectedCatId(null)}
                    className="sm:hidden p-2 -ml-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${accent}DD, ${accent}88)` }}
                  >
                    <LayoutGrid size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-extrabold text-[var(--color-text-primary)]">{selectedCat.name}</h2>
                      <Badge variant={selectedCat.isActive ? 'success' : 'default'} className="px-2 py-0.5 text-[10px]">
                        {selectedCat.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      {selectedCatSubs.length} services configured in this category.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => openEditDrawer(selectedCat)} className="text-[12px] h-8 px-3">
                    <Pencil size={13} className="mr-1.5" /> Edit Category
                  </Button>
                  <Button variant="secondary" onClick={() => setDeleteCatId(selectedCat.id)} className="text-[12px] h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>

              {/* Sub-categories List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--color-background)]">
                {selectedCatSubs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-4 shadow-sm">
                      <Tag size={28} className="text-[var(--color-text-muted)] opacity-50" />
                    </div>
                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">No services configured</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1.5 mb-6">
                      Add services to this category to configure their charges and required skills.
                    </p>
                    <Button onClick={() => openEditDrawer(selectedCat)} style={{ background: accent }} className="text-white border-none shadow-sm">
                      <Plus size={14} className="mr-1.5" /> Add Service
                    </Button>
                  </div>
                ) : (
                  selectedCatSubs.map(sub => {
                    const mappedSkills = skillsMap[sub.id] ?? [];
                    const mappedParts = sparePartsMap[sub.id] ?? [];
                    return (
                      <div key={sub.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 flex flex-col lg:flex-row gap-5 hover:border-[var(--color-border-hover)] transition-colors shadow-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="text-[15px] font-bold text-[var(--color-text-primary)] truncate">{sub.name}</h4>
                            {!sub.isActive && (
                              <Badge variant="default" className="text-[9px] py-0 px-1.5">Inactive</Badge>
                            )}
                          </div>

                          {/* Skills display */}
                          <div className="mt-3">
                            <p className="text-[11px] font-semibold tracking-wider uppercase text-[var(--color-text-muted)] mb-2">Required Skills</p>
                            {mappedSkills.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {mappedSkills.map(ms => (
                                  <span key={ms.skillId} className="px-2 py-1 rounded-md bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text-secondary)]">
                                    {ms.skill.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[12px] text-[var(--color-text-muted)] italic">No skills assigned</span>
                            )}
                          </div>

                          {/* Spare parts display */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[11px] font-semibold tracking-wider uppercase text-[var(--color-text-muted)]">Spare Parts</p>
                              <Link href={`/${prefix}/service-catalog/spare-parts?subCategoryId=${sub.id}&subCategoryName=${encodeURIComponent(sub.name)}`}>
                                <Button variant="secondary" size="sm"><Wrench size={12} /> Manage</Button>
                              </Link>
                            </div>
                            {mappedParts.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {mappedParts.map(part => (
                                  <span key={part.id} className="px-2 py-1 rounded-md bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text-secondary)]">
                                    {part.partName} <span className="text-[var(--color-text-muted)]">— ₹{part.unitPrice.toLocaleString()}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <Link href={`/${prefix}/service-catalog/spare-parts?subCategoryId=${sub.id}&subCategoryName=${encodeURIComponent(sub.name)}`}>
                                <Button variant="secondary" size="sm"><Wrench size={13} /> Add Spare Parts</Button>
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Charges display */}
                        <div className="lg:w-64 shrink-0 bg-[var(--color-surface-elevated)]/30 rounded-lg p-3.5 border border-[var(--color-border)]/50">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-[13px]">
                              <span className="text-[var(--color-text-secondary)] font-medium">Service Charge</span>
                              <span className="font-bold text-[var(--color-text-primary)]">{sub.serviceCharges?.serviceCharge ? `₹${sub.serviceCharges.serviceCharge}` : '—'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[12px]">
                              <span className="text-[var(--color-text-muted)]">Inspection</span>
                              <span className="font-semibold text-[var(--color-text-secondary)]">{sub.serviceCharges?.inspectionCharge ? `₹${sub.serviceCharges.inspectionCharge}` : '—'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[12px]">
                              <span className="text-[var(--color-text-muted)]">Emergency</span>
                              <span className="font-semibold text-[var(--color-text-secondary)]">{sub.serviceCharges?.emergencyCharge ? `₹${sub.serviceCharges.emergencyCharge}` : '—'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
              <LayoutGrid size={32} className="opacity-20 mb-3" />
              <p className="text-sm font-medium">Select a category to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Unified Right-Side Drawer ── */}
      <RightDrawer
        open={drawerOpen}
        onClose={() => !isSaving && setDrawerOpen(false)}
        title={drawerMode === 'create' ? 'Create New Category' : 'Edit Category'}
      >
        <div className="space-y-6 pb-20">

          {/* Category Section */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
            <h4 className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Category Profile</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1.5">Category Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={draftCatName}
                  onChange={e => setDraftCatName(e.target.value)}
                  placeholder="e.g. AC Mechanic"
                  className="w-full h-10 px-3 text-[14px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none transition-shadow"
                  style={{ '--tw-ring-color': `${accent}33` } as React.CSSProperties}
                  onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}22`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                />
              </div>
              {drawerMode === 'edit' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="catActiveState"
                    checked={draftCatIsActive}
                    onChange={e => setDraftCatIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--color-border)] text-primary focus:ring-primary"
                    style={{ accentColor: accent }}
                  />
                  <label htmlFor="catActiveState" className="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">Active Category</label>
                </div>
              )}
            </div>
          </div>

          {/* Sub-Categories Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Services / Sub-Categories</h4>
            </div>

            <div className="space-y-4">
              {draftSubs.map((sub, index) => {
                if (sub.isDeleted) return null;
                return (
                  <div key={index} className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5 relative group">
                    <button
                      onClick={() => removeDraftSub(index)}
                      className="absolute top-4 right-4 p-1.5 text-[var(--color-text-muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 rounded-md transition-colors"
                      title="Remove service"
                    >
                      <Trash2 size={15} />
                    </button>

                    <div className="pr-10 mb-4">
                      <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5">Service Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={sub.name}
                        onChange={e => updateDraftSub(index, 'name', e.target.value)}
                        placeholder="e.g. AC Gas Refilling"
                        className="w-full h-9 px-3 text-[13px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">Service Charge (₹)</label>
                        <input
                          type="number"
                          value={sub.serviceCharge || ''}
                          onChange={e => updateDraftSub(index, 'serviceCharge', parseFloat(e.target.value) || 0)}
                          min={0}
                          className="w-full h-9 px-3 text-[13px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">Inspection (₹)</label>
                        <input
                          type="number"
                          value={sub.inspectionCharge || ''}
                          onChange={e => updateDraftSub(index, 'inspectionCharge', parseFloat(e.target.value) || 0)}
                          min={0}
                          className="w-full h-9 px-3 text-[13px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">Emergency (₹)</label>
                        <input
                          type="number"
                          value={sub.emergencyCharge || ''}
                          onChange={e => updateDraftSub(index, 'emergencyCharge', parseFloat(e.target.value) || 0)}
                          min={0}
                          className="w-full h-9 px-3 text-[13px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5">Required Skills</label>
                      <Select
                        isMulti
                        options={activeSkills.map(s => ({ value: s.id, label: s.name }))}
                        value={sub.skills.map(id => {
                          const s = activeSkills.find(sk => sk.id === id);
                          return { value: id, label: s?.name ?? 'Unknown' };
                        })}
                        onChange={(selected: any) => {
                          const ids = selected ? selected.map((s: any) => s.value) : [];
                          updateDraftSub(index, 'skills', ids);
                        }}
                        className="text-[13px]"
                      />
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id={`subActive-${index}`}
                        checked={sub.isActive}
                        onChange={e => updateDraftSub(index, 'isActive', e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-[var(--color-border)] text-primary focus:ring-primary"
                        style={{ accentColor: accent }}
                      />
                      <label htmlFor={`subActive-${index}`} className="text-[12px] font-medium text-[var(--color-text-primary)] cursor-pointer">Active Service</label>
                    </div>
                  </div>
                );
              })}

              <Button type="button" variant="secondary" onClick={addDraftSub} className="w-full py-6 border-dashed bg-transparent hover:bg-[var(--color-surface-elevated)] border-2">
                <Plus size={15} className="mr-2" />
                Add Sub-category
              </Button>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex justify-end gap-3 z-10">
          <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} style={{ background: accent }} className="text-white border-none min-w-[120px]">
            {isSaving ? 'Saving...' : 'Save Category'}
          </Button>
        </div>
      </RightDrawer>

      {/* Delete Confirms */}
      <ConfirmDialog
        open={!!deleteCatId}
        onClose={() => setDeleteCatId(null)}
        onConfirm={() => deleteCatId && deleteCatMutation.mutate(deleteCatId)}
        message="Delete this category? All associated services will also be removed."
        loading={deleteCatMutation.isPending}
      />
    </div>
  );
}
