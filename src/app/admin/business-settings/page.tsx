'use client';

import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Building2, MapPin, Receipt, CreditCard,
  Percent, DollarSign,
  Check, RotateCcw
} from 'lucide-react';
import api from '@/lib/axios';
import { CompanySettings, TenantSettings, AppSettings } from '@/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn, getErrorMessage, stripLeadingZeroOnBlur, validateMonetaryAmount } from '@/lib/utils';

// ─── Sections definition ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'address', label: 'Business Address', icon: MapPin },
  { id: 'tax', label: 'Tax & Invoice', icon: Receipt },
  { id: 'payments', label: 'Payment Settings', icon: CreditCard },
  { id: 'charges', label: 'Business Charges', icon: DollarSign },
  { id: 'discounts', label: 'Discount Rules', icon: Percent }
];

export default function BusinessSettingsPage() {
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState('company');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: companyData, isLoading: companyLoading, isError: companyError, error: companyErr, refetch: refetchCompany } = useQuery<CompanySettings>({
    queryKey: ['company-settings'],
    queryFn: async () => (await api.get('/web/admin/company-settings')).data.data,
  });

  const { data: tenantData, isLoading: tenantLoading, isError: tenantError, error: tenantErr, refetch: refetchTenant } = useQuery<TenantSettings>({
    queryKey: ['tenant-settings'],
    queryFn: async () => (await api.get('/web/admin/tenant-settings')).data.data,
  });

  const { data: appData, isLoading: appLoading, isError: appError, error: appErr, refetch: refetchApp } = useQuery<AppSettings>({
    queryKey: ['app-settings'],
    queryFn: async () => (await api.get('/web/settings/charges')).data.data,
  });

  const isLoading = companyLoading || tenantLoading || appLoading;
  const isError = companyError || tenantError || appError;
  const settingsError = companyErr ?? tenantErr ?? appErr;
  const refetchAll = () => { refetchCompany(); refetchTenant(); refetchApp(); };

  // ─── Forms ──────────────────────────────────────────────────────────────────
  const companyForm = useForm<Omit<CompanySettings, 'id' | 'logoUrl' | 'email'>>();
  const { errors: companyErrors } = companyForm.formState;
  const tenantForm = useForm<Omit<TenantSettings, 'id' | 'upiQrImageUrl'>>();
  const { errors: tenantErrors } = tenantForm.formState;
  const gstPercentField = tenantForm.register('gstPercent', {
    valueAsNumber: true,
    min: { value: 0, message: 'GST percentage cannot be negative' },
    max: { value: 28, message: 'GST percentage cannot exceed 28%' },
  });
  const platformForm = useForm<Omit<AppSettings, 'id'>>();
  const { errors: platformErrors } = platformForm.formState;

  // Custom mock form for UI-only settings (Invoice footer, Terms, Business hours, etc.)
  const mockForm = useForm({
    defaultValues: {
      invoiceFooter: 'Thank you for your business!',
      termsAndConditions: 'All services are guaranteed for 30 days. Payments are non-refundable.',
      upiEnabled: true,
      defaultPayment: 'UPI',
      timezone: 'Asia/Kolkata (IST)',
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      openingTime: '09:00',
      closingTime: '18:00',
      lunchBreak: '13:00 - 14:00',
    }
  });

  // Watch GST state from tenant settings
  const gstEnabled = tenantForm.watch('gstEnabled');

  // Populate data on load
  useEffect(() => {
    if (companyData) {
      companyForm.reset({
        companyName: companyData.companyName || '',
        contactPerson: companyData.contactPerson || '',
        phone: companyData.phone || '',
        address: companyData.address || '',
        city: companyData.city || '',
        state: companyData.state || '',
        pincode: companyData.pincode || '',
      });
    }
  }, [companyData, companyForm]);

  useEffect(() => {
    if (tenantData) {
      tenantForm.reset({
        gstEnabled: !!tenantData.gstEnabled,
        gstPercent: tenantData.gstPercent ?? 0,
        invoicePrefix: tenantData.invoicePrefix || '',
        invoiceNumberFormat: tenantData.invoiceNumberFormat || '',
        upiId: tenantData.upiId || '',
        upiAccountName: tenantData.upiAccountName || '',
      });
    }
  }, [tenantData, tenantForm]);

  useEffect(() => {
    if (appData) {
      platformForm.reset({
        taxPercentage: appData.taxPercentage ?? 0,
        shippingCharge: appData.shippingCharge ?? 0,
        handlingCharge: appData.handlingCharge ?? 0,
        shippingEnabled: !!appData.shippingEnabled,
        handlingEnabled: !!appData.handlingEnabled,
        dailyDiscount: appData.dailyDiscount ?? 0,
        weeklyDiscount: appData.weeklyDiscount ?? 0,
        monthlyDiscount: appData.monthlyDiscount ?? 0,
        dailyDiscountEnabled: !!appData.dailyDiscountEnabled,
        weeklyDiscountEnabled: !!appData.weeklyDiscountEnabled,
        monthlyDiscountEnabled: !!appData.monthlyDiscountEnabled,
      });
    }
  }, [appData, platformForm]);

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const companyMutation = useMutation({
    mutationFn: (d: Omit<CompanySettings, 'id' | 'logoUrl' | 'email'>) =>
      api.patch('/web/admin/company-settings', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      companyForm.reset(companyForm.getValues());
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to save company profile')),
  });

  const tenantMutation = useMutation({
    mutationFn: (d: Omit<TenantSettings, 'id' | 'upiQrImageUrl'>) =>
      api.patch('/web/admin/tenant-settings', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      tenantForm.reset(tenantForm.getValues());
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to save tax & payment settings')),
  });

  const platformMutation = useMutation({
    mutationFn: (d: Omit<AppSettings, 'id'>) =>
      api.post('/web/settings/charges', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-settings'] });
      platformForm.reset(platformForm.getValues());
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to save business charges')),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/web/admin/company-settings/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Company logo updated successfully');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to upload company logo')),
  });

  const _upiQrMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/web/admin/tenant-settings/upi-qr', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('UPI QR Image updated successfully');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to upload UPI QR image')),
  });

  // ─── Change Detection ───────────────────────────────────────────────────────
  const isDirty =
    companyForm.formState.isDirty ||
    tenantForm.formState.isDirty ||
    platformForm.formState.isDirty ||
    mockForm.formState.isDirty;

  const isSaving =
    companyMutation.isPending ||
    tenantMutation.isPending ||
    platformMutation.isPending;

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    companyForm.reset();
    tenantForm.reset();
    platformForm.reset();
    mockForm.reset();
    toast.info('Changes discarded');
  };

  const handleSaveAll = async () => {
    try {
      const promises = [];

      if (companyForm.formState.isDirty) {
        promises.push(companyMutation.mutateAsync(companyForm.getValues()));
      }
      if (tenantForm.formState.isDirty) {
        promises.push(tenantMutation.mutateAsync(tenantForm.getValues()));
      }
      if (platformForm.formState.isDirty) {
        promises.push(platformMutation.mutateAsync(platformForm.getValues()));
      }

      if (mockForm.formState.isDirty) {
        // Mock fields saved successfully locally
        mockForm.reset(mockForm.getValues());
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
      toast.success('All settings saved successfully');
    } catch {
      // Each mutation's own onError already surfaced the specific section and reason that failed.
    }
  };

  // Scroll to section helper
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Scroll-spy: highlight whichever section is currently at the top of the viewport
  // as the user scrolls manually (scrollToSection only covers clicks on the nav itself).
  useEffect(() => {
    if (isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        setActiveSection(topMost.target.id);
      },
      { rootMargin: '-100px 0px -70% 0px', threshold: 0 }
    );

    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    // The rootMargin above only "activates" a section once its top passes near the
    // viewport's top band — the last section (Discount Rules) is often shorter than
    // that band and never crosses it, so scrolling all the way to the bottom would
    // otherwise leave the previous section highlighted forever. Handle that edge case
    // directly: once the actual scrollable container is scrolled to its end, force the
    // last section active.
    const lastSectionId = SECTIONS[SECTIONS.length - 1].id;
    let scrollParent: HTMLElement | Window = window;
    let node: HTMLElement | null = scrollContainerRef.current;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
        scrollParent = node;
        break;
      }
      node = node.parentElement;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollParent === window
          ? { scrollTop: window.scrollY, scrollHeight: document.documentElement.scrollHeight, clientHeight: window.innerHeight }
          : (scrollParent as HTMLElement);
      if (scrollTop + clientHeight >= scrollHeight - 4) {
        setActiveSection(lastSectionId);
      }
    };
    scrollParent.addEventListener('scroll', handleScroll);

    return () => {
      observer.disconnect();
      scrollParent.removeEventListener('scroll', handleScroll);
    };
  }, [isLoading]);

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState error={settingsError} onRetry={refetchAll} />;

  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Business Settings</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Manage your company profile, billing preferences, payment methods and business configurations.
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Sticky Left Navigation (Desktop Only) */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] px-3 mb-3">
            Settings Sections
          </p>
          <nav className="space-y-1">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                    active
                      ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] font-semibold"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  <Icon size={16} className={active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"} />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Cards */}
        <div ref={scrollContainerRef} className="flex-1 space-y-6 max-w-3xl">

          {/* 1. Company Profile Card */}
          <div id="company" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-6 scroll-mt-20">
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
              <div className="h-9 w-9 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[var(--color-text-primary)]">Company Profile</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Configure your company identity and contact info.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Company Logo</p>
                <FileUpload
                  onFile={file => logoMutation.mutate(file)}
                  loading={logoMutation.isPending}
                  preview={companyData?.logoUrl}
                />
              </div>

              <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Company Name" maxLength={150} hint="Maximum 150 characters"
                  error={companyErrors.companyName?.message}
                  {...companyForm.register('companyName', { maxLength: { value: 150, message: 'Company name can contain up to 150 characters' } })}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Business Email</label>
                  <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-muted)] select-all h-[38px] flex items-center font-mono">
                    {companyData?.email ?? '—'}
                  </p>
                </div>
                <Input
                  label="Contact Person" maxLength={100} hint="Maximum 100 characters"
                  error={companyErrors.contactPerson?.message}
                  {...companyForm.register('contactPerson', { maxLength: { value: 100, message: 'Contact person can contain up to 100 characters' } })}
                />
                <Input
                  label="Phone Number" maxLength={20} hint="Maximum 20 characters"
                  error={companyErrors.phone?.message}
                  {...companyForm.register('phone', { maxLength: { value: 20, message: 'Phone number can contain up to 20 characters' } })}
                />
              </form>
            </div>
          </div>

          {/* 2. Business Address Card */}
          <div id="address" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-6 scroll-mt-20">
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
              <div className="h-9 w-9 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                <MapPin size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[var(--color-text-primary)]">Business Address</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Manage your physical and billing address details.</p>
              </div>
            </div>

            <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Address" maxLength={255} hint="Maximum 255 characters"
                  error={companyErrors.address?.message}
                  {...companyForm.register('address', { maxLength: { value: 255, message: 'Address can contain up to 255 characters' } })}
                />
              </div>
              <Input
                label="City" maxLength={100} hint="Maximum 100 characters"
                error={companyErrors.city?.message}
                {...companyForm.register('city', { maxLength: { value: 100, message: 'City can contain up to 100 characters' } })}
              />
              <Input
                label="State" maxLength={100} hint="Maximum 100 characters"
                error={companyErrors.state?.message}
                {...companyForm.register('state', { maxLength: { value: 100, message: 'State can contain up to 100 characters' } })}
              />
              <Input
                label="Pincode" maxLength={10} hint="Maximum 10 characters"
                error={companyErrors.pincode?.message}
                {...companyForm.register('pincode', { maxLength: { value: 10, message: 'Pincode can contain up to 10 characters' } })}
              />
            </form>
          </div>

          {/* 3. Tax & Invoice Card */}
          <div id="tax" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-6 scroll-mt-20">
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
              <div className="h-9 w-9 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                <Receipt size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[var(--color-text-primary)]">Tax &amp; Invoice Settings</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Set up taxation rules and custom invoice parameters.</p>
              </div>
            </div>

            <form className="space-y-4">
              <div className="flex items-center gap-3 bg-[var(--color-surface-elevated)] p-3.5 rounded-xl border border-[var(--color-border)]">
                <input
                  type="checkbox"
                  id="gstEnabled"
                  {...tenantForm.register('gstEnabled')}
                  className="h-4.5 w-4.5 rounded border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary-ring)]"
                />
                <div>
                  <label htmlFor="gstEnabled" className="text-sm font-semibold text-[var(--color-text-primary)] cursor-pointer">
                    Enable GST
                  </label>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Apply goods and services tax to customer bills.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gstEnabled && (
                  <Input
                    label="GST Percentage (%)"
                    type="number"
                    step="0.01"
                    min={0}
                    max={28}
                    error={tenantErrors.gstPercent?.message}
                    {...gstPercentField}
                    onBlur={(e) => { stripLeadingZeroOnBlur(e); gstPercentField.onBlur(e); }}
                  />
                )}
                <Input
                  label="Invoice Prefix" placeholder="INV-" maxLength={10} hint="Maximum 10 characters"
                  error={tenantErrors.invoicePrefix?.message}
                  {...tenantForm.register('invoicePrefix', { maxLength: { value: 10, message: 'Invoice prefix can contain up to 10 characters' } })}
                />
                <Input
                  label="Invoice Number Format" placeholder="0001" maxLength={50} hint="Maximum 50 characters"
                  error={tenantErrors.invoiceNumberFormat?.message}
                  {...tenantForm.register('invoiceNumberFormat', { maxLength: { value: 50, message: 'Invoice number format can contain up to 50 characters' } })}
                />
              </div>

              {/* UI Mock Fields */}
              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-[var(--color-border)]">
                <Input label="Invoice Footer" {...mockForm.register('invoiceFooter')} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Terms &amp; Conditions</label>
                  <textarea
                    {...mockForm.register('termsAndConditions')}
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-all"
                  />
                </div>
              </div>
            </form>
          </div>

          {/* 4. Payment Settings Card */}
          <div id="payments" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-6 scroll-mt-20">
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
              <div className="h-9 w-9 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                <CreditCard size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[var(--color-text-primary)]">Payment Settings</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Configure business gateways, UPI accounts, and default payment modes.</p>
              </div>
            </div>

            <form className="space-y-4">
              {/* UI Mock UPI Toggle */}
              <div className="flex items-center gap-3 bg-[var(--color-surface-elevated)] p-3.5 rounded-xl border border-[var(--color-border)]">
                <input
                  type="checkbox"
                  id="upiEnabled"
                  {...mockForm.register('upiEnabled')}
                  className="h-4.5 w-4.5 rounded border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary-ring)]"
                />
                <div>
                  <label htmlFor="upiEnabled" className="text-sm font-semibold text-[var(--color-text-primary)] cursor-pointer">
                    Enable UPI Payments
                  </label>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Activate digital wallet and direct bank UPI options.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="UPI ID" placeholder="name@upi"
                  error={tenantErrors.upiId?.message}
                  {...tenantForm.register('upiId', {
                    pattern: { value: /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, message: 'Please provide a valid UPI ID (e.g. name@bank)' },
                  })}
                />
                <Input
                  label="UPI Account Name" placeholder="e.g. John Doe" maxLength={100} hint="Maximum 100 characters"
                  error={tenantErrors.upiAccountName?.message}
                  {...tenantForm.register('upiAccountName', { maxLength: { value: 100, message: 'UPI account name can contain up to 100 characters' } })}
                />

                {/* Default payment mock select */}
                <div className="md:col-span-2">
                  <Select
                    label="Default Payment Method"
                    options={[
                      { value: 'Cash', label: 'Cash' },
                      { value: 'UPI', label: 'UPI / Digital Wallet' },
                      { value: 'Card', label: 'Credit/Debit Card' },
                    ]}
                    {...mockForm.register('defaultPayment')}
                  />
                </div>

                {/* <div className="md:col-span-2">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">UPI QR Image</p>
                  <FileUpload
                    onFile={file => upiQrMutation.mutate(file)}
                    loading={upiQrMutation.isPending}
                    preview={tenantData?.upiQrImageUrl}
                  />
                </div> */}
              </div>
            </form>
          </div>

          {/* 5. Business Charges Card */}
          <div id="charges" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-6 scroll-mt-20">
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
              <div className="h-9 w-9 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                <DollarSign size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[var(--color-text-primary)]">Business Charges</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Set additional shipping and handling metrics.</p>
              </div>
            </div>

            <form className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] space-y-3">
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" id="shippingEnabled" {...platformForm.register('shippingEnabled')} className="h-4 w-4" />
                  <label htmlFor="shippingEnabled" className="text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer">Enable Shipping</label>
                </div>
                <Input
                  label="Shipping Charge (₹)"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100000}
                  error={platformErrors.shippingCharge?.message}
                  {...platformForm.register('shippingCharge', {
                    valueAsNumber: true,
                    validate: validateMonetaryAmount('Shipping charge', 100000),
                  })}
                />
              </div>

              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] space-y-3">
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" id="handlingEnabled" {...platformForm.register('handlingEnabled')} className="h-4 w-4" />
                  <label htmlFor="handlingEnabled" className="text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer">Enable Handling</label>
                </div>
                <Input
                  label="Handling Charge (₹)"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100000}
                  error={platformErrors.handlingCharge?.message}
                  {...platformForm.register('handlingCharge', {
                    valueAsNumber: true,
                    validate: validateMonetaryAmount('Handling charge', 100000),
                  })}
                />
              </div>
            </form>
          </div>

          {/* 6. Discount Rules Card */}
          <div id="discounts" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-6 scroll-mt-20">
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
              <div className="h-9 w-9 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                <Percent size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[var(--color-text-primary)]">Discount Rules</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Configure promotional recurring campaign rates.</p>
              </div>
            </div>

            <form className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['daily', 'weekly', 'monthly'] as const).map(period => (
                <div key={period} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`${period}DiscountEnabled`}
                      {...platformForm.register(`${period}DiscountEnabled` as keyof Omit<AppSettings, 'id'>)}
                      className="h-4 w-4"
                    />
                    <label htmlFor={`${period}DiscountEnabled`} className="text-xs font-semibold text-[var(--color-text-primary)] capitalize cursor-pointer">
                      {period} Discount
                    </label>
                  </div>
                  <Input
                    label="Rate (%)"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    error={platformErrors[`${period}Discount` as keyof typeof platformErrors]?.message as string | undefined}
                    {...platformForm.register(`${period}Discount` as keyof Omit<AppSettings, 'id'>, {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Discount cannot be negative' },
                      max: { value: 100, message: 'Discount cannot exceed 100%' },
                    })}
                    placeholder="%"
                  />
                </div>
              ))}
            </form>
          </div>

        </div>
      </div>

      {/* Sticky Bottom Save Action Bar */}
      {isDirty && (
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-8 z-40 bg-[var(--color-surface)] border-t border-[var(--color-border)] py-4 px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] animate-in slide-in-from-bottom duration-200">
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-secondary)] font-medium hidden md:block">
              You have unsaved changes in business configuration.
            </p>
            <div className="flex gap-3 ml-auto">
              <Button
                variant="secondary"
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <RotateCcw size={14} />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveAll}
                loading={isSaving}
                className="flex items-center gap-2"
              >
                <Check size={14} />
                Save Business Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
