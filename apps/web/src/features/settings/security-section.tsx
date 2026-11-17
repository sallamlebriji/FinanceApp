import { passwordSchema } from '@mizan/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Laptop, Smartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Confirm } from '@/components/ui/confirm';
import { Field, Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { fmtDate, useLocale } from '@/lib/format';
import { queryClient } from '@/lib/query';
import { useAuth } from '@/stores/auth';
import { SettingsRow, SettingsSection } from './settings-ui';

interface Session {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

function deviceName(ua: string | null) {
  if (!ua) return 'Unknown device';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /Expo|okhttp|CFNetwork/.test(ua) ? 'Mizan app' : 'Browser';
  return `${browser} on ${os}`;
}

function ChangePasswordSheet({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string>();
  const m = useMutation({ mutationFn: () => api('/auth/change-password', { method: 'POST', json: { currentPassword: current, newPassword: next } }) });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const check = passwordSchema.safeParse(next);
    if (!check.success) return setError(check.error.issues[0]?.message);
    try {
      await m.mutateAsync();
      toast.success('Password changed. Other devices were signed out.');
      setCurrent('');
      setNext('');
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (setError(undefined), onOpenChange(o))}
      title="Change password"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="pw-form" loading={m.isPending}>
            Change password
          </Button>
        </>
      }
    >
      <form id="pw-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Current password">{(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
        <Field label="New password" error={error} hint="At least 10 characters, with a letter and a number.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
      </form>
    </Sheet>
  );
}

export function SecuritySection() {
  const locale = useLocale();
  const clear = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteErr, setDeleteErr] = useState<string>();
  const [confirmAll, setConfirmAll] = useState(false);
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<{ items: Session[] }>('/auth/sessions').then((r) => r.items) });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  async function signOutEverywhere() {
    await api('/auth/logout-all', { method: 'POST' }).catch(() => undefined);
    queryClient.clear();
    clear();
    navigate('/login');
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/auth/me', { method: 'DELETE', json: { password: deletePw } });
      queryClient.clear();
      clear();
      navigate('/register');
    } catch (err) {
      setDeleteErr(errorMessage(err));
    }
  }

  return (
    <>
      <SettingsSection id="security" title="Security">
        <SettingsRow label="Password" detail="Changing it signs out your other devices.">
          <Button size="sm" onClick={() => setPwOpen(true)}>
            Change
          </Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection id="sessions" title="Signed-in devices" footer="Sessions expire after 30 days without use.">
        <ul className="divide-y divide-[var(--separator)]">
          {(sessions.data ?? []).map((s) => {
            const Icon = /iPhone|Android|Expo|okhttp/.test(s.userAgent ?? '') ? Smartphone : Laptop;
            return (
              <li key={s.id} className="flex min-h-14 items-center gap-3 px-5 py-2.5">
                <Icon className="size-5 text-label-2" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-body">
                    {deviceName(s.userAgent)} {s.current && <Badge tone="accent">This device</Badge>}
                  </p>
                  <p className="text-subhead text-label-2">
                    Signed in {fmtDate(s.createdAt.slice(0, 10), locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                {!s.current && (
                  <Button variant="destructive-plain" size="sm" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="border-t hairline px-5 py-3">
          <Button variant="destructive-plain" size="sm" onClick={() => setConfirmAll(true)}>
            Sign out of all devices
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection id="danger" title="Delete account" footer="Permanently removes your accounts, transactions, budgets and settings. This cannot be undone.">
        <SettingsRow label="Delete my account and data">
          <Button variant="destructive-plain" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete…
          </Button>
        </SettingsRow>
      </SettingsSection>

      <ChangePasswordSheet open={pwOpen} onOpenChange={setPwOpen} />
      <Confirm
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out of all devices?"
        message="You'll need to sign in again everywhere, including here."
        confirmLabel="Sign out everywhere"
        onConfirm={signOutEverywhere}
      />
      <Sheet
        open={deleteOpen}
        onOpenChange={(o) => (setDeleteOpen(o), setDeleteErr(undefined), setDeletePw(''))}
        title="Delete your account?"
        description="All your financial data will be permanently erased. Enter your password to confirm."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" type="submit" form="delete-form" disabled={!deletePw}>
              Delete permanently
            </Button>
          </>
        }
      >
        <form id="delete-form" onSubmit={deleteAccount} noValidate>
          <Field label="Password" error={deleteErr}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />}
          </Field>
        </form>
      </Sheet>
    </>
  );
}
