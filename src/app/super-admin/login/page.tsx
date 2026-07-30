'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Zap } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import { emailSchema, requiredString } from '@/lib/validations';

const schema = z.object({
  email: emailSchema,
  password: requiredString('Password is required'),
});

type Form = z.infer<typeof schema>;

export default function SuperAdminLogin() {
  const { register, handleSubmit, formState: { errors, isSubmitting, isValid } } = useForm<Form>({ 
    resolver: zodResolver(schema),
    mode: 'onChange'
  });
  const { setAuth } = useAuth();
  const router = useRouter();

  useEffect(() => { router.replace('/login'); }, [router]);

  const onSubmit = async (data: Form) => {
    try {
      const res = await api.post('/auth/super-admin/login', data);
      const { user, tokens } = res.data.data;
      flushSync(() => setAuth(user, tokens.accessToken, tokens.refreshToken, 'sa'));
      router.push('/super-admin/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invalid email or password.'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-violet-500 flex items-center justify-center mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">FieldEaze</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Super Admin Portal</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-2xl space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Sign In</h2>
          <Input label="Email *" type="email" placeholder="admin@fieldeaze.com" {...register('email')} error={errors.email?.message} />
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide select-none">Password *</label>
              <Link href="/super-admin/forgot-password" className="text-xs text-violet-500 hover:text-violet-600 font-medium transition-colors">
                Forgot Password?
              </Link>
            </div>
            <Input type="password" placeholder="••••••••" {...register('password')} error={errors.password?.message} className="mt-1.5" />
          </div>
          <Button type="submit" loading={isSubmitting} disabled={!isValid} className="w-full mt-2">Sign In</Button>
        </form>
      </div>
    </div>
  );
}
