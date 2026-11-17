import { zodResolver } from '@hookform/resolvers/zod';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
} from '@mizan/shared';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/stores/auth';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/mizan.svg" alt="" className="mb-5 size-12" />
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-callout text-label-2">{subtitle}</p>}
        </div>
        <div className="rounded-[var(--radius-sheet)] bg-surface p-6 sm:p-7">{children}</div>
        {footer && <div className="mt-6 text-center text-callout text-label-2">{footer}</div>}
      </main>
    </div>
  );
}

function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-control)] bg-negative-soft px-3 py-2.5 text-callout text-negative">
      {message}
    </p>
  );
}

export function LoginPage() {
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await api<AuthResponse>('/auth/login', { method: 'POST', json: values });
      setSession(res);
      navigate(params.get('next') ?? '/', { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see where your money stands."
      footer={
        <>
          New to Mizan?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={serverError} />
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" autoFocus {...register('email')} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('password')} />}
        </Field>
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="text-subhead font-medium text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), mode: 'onTouched' });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await api<AuthResponse>('/auth/register', { method: 'POST', json: values });
      setSession(res);
      navigate('/', { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Track accounts, spending and budgets in one calm place."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={serverError} />
        <Field label="Name" error={formState.errors.name?.message}>
          {(p) => <Input {...p} autoComplete="name" autoFocus {...register('name')} />}
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message} hint="At least 10 characters, with a letter and a number.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) });
  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const r = await api<{ message: string }>('/auth/forgot-password', { method: 'POST', json: values });
      setSent(r.message);
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center py-2 text-center">
          <MailCheck className="mb-3 size-8 text-accent" aria-hidden />
          <p className="text-callout text-label-2">{sent}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormError message={serverError} />
          <Field label="Email" error={formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" autoFocus {...register('email')} />}
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

const resetFormSchema = resetPasswordSchema
  .pick({ password: true })
  .extend({ confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ['confirm'] });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetFormSchema>>({ resolver: zodResolver(resetFormSchema) });
  const onSubmit = handleSubmit(async ({ password }) => {
    setServerError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', json: { token, password } });
      navigate('/login', { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });
  return (
    <AuthLayout title="Choose a new password" subtitle="You'll be signed out of every other device.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={!token ? 'This reset link is incomplete. Request a new one.' : serverError} />
        <Field label="New password" error={formState.errors.password?.message} hint="At least 10 characters, with a letter and a number.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" autoFocus {...register('password')} />}
        </Field>
        <Field label="Confirm password" error={formState.errors.confirm?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('confirm')} />}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={formState.isSubmitting} disabled={!token}>
          Set new password
        </Button>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState('');
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setState('error');
      setMessage('This verification link is incomplete.');
      return;
    }
    api('/auth/verify-email', { method: 'POST', json: { token } })
      .then(() => {
        setState('ok');
        if (user) setUser({ ...user, emailVerified: true });
      })
      .catch((e) => {
        setState('error');
        setMessage(errorMessage(e));
      });
  }, [token, user, setUser]);

  return (
    <AuthLayout title={state === 'ok' ? 'Email confirmed' : state === 'error' ? "We couldn't confirm your email" : 'Confirming your email…'}>
      <div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
        {state === 'ok' && <CheckCircle2 className="size-9 text-positive" aria-hidden />}
        {state === 'error' && <XCircle className="size-9 text-negative" aria-hidden />}
        {message && <p className="text-callout text-label-2">{message}</p>}
        {state !== 'pending' && (
          <Link to="/" className="text-callout font-medium text-accent hover:underline">
            Continue to Mizan
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}
