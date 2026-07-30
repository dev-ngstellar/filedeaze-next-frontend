'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import api from '@/lib/axios';
import { useAuth } from '@/contexts/AuthContext';
import { TenantInfo } from '@/types';
import {
  Eye, EyeOff, Loader2, Clock, AlertTriangle,
  ShieldOff, CreditCard, ChevronLeft, WifiOff, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/utils';

// ── Schema ─────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

const BG_GRID = 'absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]';

// ── Loading screen ─────────────────────────────────────────────────────────
function WorkspaceLoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className={BG_GRID} />
      <div className="relative flex flex-col items-center gap-4">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
        <p className="text-slate-400 text-sm">Checking workspace…</p>
      </div>
    </div>
  );
}

// ── Network error screen ───────────────────────────────────────────────────
function NetworkErrorScreen({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className={BG_GRID} />
      <div className="relative w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-slate-700/60 border border-slate-600 flex items-center justify-center mb-5">
              <WifiOff size={22} className="text-slate-400" />
            </div>
            <h2 className="text-white text-xl font-semibold mb-3">Connection Error</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Unable to reach the server. Please check your internet connection and try again.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors text-sm"
            >
              <RefreshCw size={14} />
              Retry
            </button>
            <button
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/admin/login'))}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              <ChevronLeft size={15} />
              Go Back
            </button>
          </div>
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">Powered by FieldEaze</p>
      </div>
    </div>
  );
}

// ── Workspace error screen ─────────────────────────────────────────────────
type ErrorCode = 'NOT_FOUND' | 'SUSPENDED' | 'UNKNOWN';

const ERROR_CONFIG: Record<ErrorCode, {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  message: string;
  bullets?: string[];
}> = {
  NOT_FOUND: {
    icon: <AlertTriangle size={22} className="text-amber-400" />,
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Workspace Not Found',
    message: "We couldn't find the requested workspace.",
    bullets: [
      'The workspace URL is incorrect.',
      'The workspace has been removed.',
      'The workspace has been disabled.',
    ],
  },
  SUSPENDED: {
    icon: <ShieldOff size={22} className="text-red-400" />,
    iconBg: 'bg-red-500/10 border-red-500/20',
    title: 'Workspace Suspended',
    message: "This workspace has been temporarily suspended. Please contact your organisation's administrator.",
  },
  UNKNOWN: {
    icon: <AlertTriangle size={22} className="text-slate-400" />,
    iconBg: 'bg-slate-700/60 border-slate-600',
    title: 'Workspace Unavailable',
    message: "We couldn't load the requested workspace. Please verify the workspace URL or contact your administrator.",
  },
};

function WorkspaceErrorScreen({ errorCode }: { errorCode: ErrorCode }) {
  const router = useRouter();
  const config = ERROR_CONFIG[errorCode];
  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/admin/login'));

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className={BG_GRID} />
      <div className="relative w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <div className={`h-14 w-14 rounded-2xl border flex items-center justify-center mb-5 ${config.iconBg}`}>
              {config.icon}
            </div>
            <h2 className="text-white text-xl font-semibold mb-3">{config.title}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{config.message}</p>
          </div>

          {config.bullets && (
            <ul className="space-y-2 mb-6">
              {(config.bullets as string[]).map(b => (
                <li key={b} className="flex items-start gap-2.5 text-slate-400 text-sm">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-600 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          <p className="text-slate-500 text-xs text-center mb-6 leading-relaxed">
            Please contact your organisation&apos;s administrator or verify the workspace URL.
          </p>

          <button
            onClick={goBack}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-medium py-3 rounded-xl transition-colors text-sm"
          >
            <ChevronLeft size={15} />
            Go Back
          </button>
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">Powered by FieldEaze</p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function TenantLoginPage() {
  const { tenantCode } = useParams<{ tenantCode: string }>();
  const { setAuth } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your email');
      return;
    }
    setForgotLoading(true);
    try {
      await api.post('/auth/forgot-password', {
        email: forgotEmail,
        tenantCode
      });
      setForgotSent(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send reset link'));
    } finally {
      setForgotLoading(false);
    }
  };

  const { data: tenant, isLoading, isError, error: queryError, refetch } = useQuery<TenantInfo>({
    queryKey: ['tenant-info', tenantCode],
    queryFn: async () => (await api.get(`/auth/tenant/${tenantCode}/info`)).data.data,
    retry: false,
    staleTime: Infinity,
  });

  // ── 1. Loading gate — login form never mounts until validation completes ──
  if (isLoading) return <WorkspaceLoadingScreen />;

  // ── 2. Error gate — differentiate network vs. workspace error ─────────────
  if (isError) {
    const hasResponse = !!(queryError as any)?.response;
    if (!hasResponse) return <NetworkErrorScreen onRetry={() => refetch()} />;

    const raw = (queryError as any)?.response?.data?.errorCode as string | undefined;
    const errorCode: ErrorCode =
      raw === 'SUSPENDED' ? 'SUSPENDED' :
      raw === 'NOT_FOUND' ? 'NOT_FOUND' :
      'UNKNOWN';
    return <WorkspaceErrorScreen errorCode={errorCode} />;
  }

  // ── 3. Login form — only rendered after successful workspace validation ────
  const onSubmit = async ({ email, password }: LoginForm) => {
    setLoginError('');
    try {
      const res = await api.post(`/auth/tenant/${tenantCode}/login`, { email, password });
      const { user, tokens, redirectPath } = res.data.data;
      flushSync(() => setAuth(user, tokens.accessToken, tokens.refreshToken, 'tenant'));
      if (user.role === 'ADMIN' || user.role === 'MANAGER') {
        router.push(redirectPath ?? (user.role === 'ADMIN' ? '/admin/dashboard' : '/manager/dashboard'));
      } else {
        setLoginError('You are not authorized to access this portal.');
      }
    } catch (err) {
      setLoginError(getErrorMessage(err, 'Invalid email or password.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className={BG_GRID} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Company branding — always populated here since tenant is defined */}
        <div className="flex flex-col items-center mb-8">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.companyName} className="h-20 w-20 rounded-2xl object-contain bg-[var(--color-surface)] p-2 shadow-lg mb-4" />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg mb-4">
              <span className="text-white text-2xl font-bold tracking-tight">{getInitials(tenant!.companyName)}</span>
            </div>
          )}
          <h1 className="text-white text-xl font-bold text-center">{tenant!.companyName}</h1>
          <p className="text-slate-400 text-xs mt-1">Admin &amp; Manager Portal</p>

          {tenant?.status === 'TRIAL' && tenant.trialDaysLeft != null && (
            <div className="mt-3 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
              <Clock size={12} className="text-amber-400 shrink-0" />
              <span className="text-amber-400 text-xs font-medium">
                {tenant.trialDaysLeft > 0
                  ? `Free trial — ${tenant.trialDaysLeft} day${tenant.trialDaysLeft !== 1 ? 's' : ''} left`
                  : 'Trial expired — subscribe to continue'}
              </span>
            </div>
          )}
          {tenant?.status === 'EXPIRED' && (
            <div className="mt-3 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
              <CreditCard size={12} className="text-red-400 shrink-0" />
              <span className="text-red-400 text-xs font-medium">Subscription expired — contact your administrator</span>
            </div>
          )}
          {tenant?.status === 'PAYMENT_PENDING' && (
            <div className="mt-3 flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
              <Clock size={12} className="text-blue-400 shrink-0" />
              <span className="text-blue-400 text-xs font-medium">Payment under review</span>
            </div>
          )}
        </div>

        {/* Login card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-white text-lg font-semibold">Welcome back</h2>
            <p className="text-slate-400 text-sm mt-1">Sign in to continue to your portal.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} autoComplete="on" className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">Email address</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register('email')}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300 block">Password</label>
                <button
                  type="button"
                  onClick={() => { setForgotSent(false); setForgotEmail(getValues('email') || ''); setShowForgotPass(true); }}
                  className="text-xs hover:underline text-blue-500"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-600 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium py-3 rounded-xl transition-colors text-sm mt-2"
            >
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">Powered by FieldEaze</p>
      </div>

      <Modal open={showForgotPass} onClose={() => setShowForgotPass(false)} title="Reset Password" size="sm">
        {forgotSent ? (
          <div className="text-center py-6">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={24} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Check your email</h3>
            <p className="text-sm text-slate-600 mb-6">
              If an account exists with {forgotEmail}, we've sent instructions to reset your password.
            </p>
            <button
              onClick={() => setShowForgotPass(false)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4 py-2">
            <p className="text-sm text-slate-600 mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Email address</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowForgotPass(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={forgotLoading || !forgotEmail}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 bg-blue-600 hover:bg-blue-500"
              >
                {forgotLoading && <Loader2 size={14} className="animate-spin" />}
                Send Reset Link
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
