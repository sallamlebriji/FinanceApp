import { SUPPORTED_CURRENCIES, type ExchangeRateDTO, type SettingsDTO, type UpdateSettingsInput, type UserDTO } from '@mizan/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { fmtDate, useLocale } from '@/lib/format';
import { invalidateFinance, queryClient } from '@/lib/query';
import { useAuth } from '@/stores/auth';
import { CategoriesSection } from './categories-section';
import { SecuritySection } from './security-section';
import { SettingsRow, SettingsSection, Toggle } from './settings-ui';

const TIMEZONES = ['Africa/Casablanca', 'Europe/Paris', 'Europe/London', 'Europe/Madrid', 'America/New_York', 'America/Montreal', 'Asia/Dubai', 'UTC'];

function ProfileSection() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const [name, setName] = useState(user.name);
  const save = useMutation({
    mutationFn: () => api<{ user: UserDTO }>('/auth/me', { method: 'PATCH', json: { name } }),
    onSuccess: (r) => {
      setUser(r.user);
      toast.success('Name updated');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resend = useMutation({
    mutationFn: () => api<{ sent: boolean }>('/auth/resend-verification', { method: 'POST' }),
    onSuccess: () => toast.success('Verification email sent'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== user.name) save.mutate();
  };
  return (
    <SettingsSection id="profile" title="Profile">
      <form onSubmit={onSubmit} className="flex min-h-14 items-center gap-3 px-5 py-2.5">
        <label htmlFor="profile-name" className="w-24 shrink-0 text-body">
          Name
        </label>
        <Input id="profile-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Button type="submit" size="sm" variant="tinted" disabled={!name.trim() || name.trim() === user.name} loading={save.isPending}>
          Save
        </Button>
      </form>
      <div className="border-t hairline">
        <SettingsRow label="Email" detail={user.email}>
          {user.emailVerified ? (
            <Badge tone="positive">Verified</Badge>
          ) : (
            <Button size="sm" variant="plain" loading={resend.isPending} onClick={() => resend.mutate()}>
              Resend verification
            </Button>
          )}
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}

function PreferencesSection() {
  const settings = useAuth((s) => s.settings)!;
  const setSettings = useAuth((s) => s.setSettings);
  const save = useMutation({
    mutationFn: (patch: UpdateSettingsInput) => api<SettingsDTO>('/settings', { method: 'PATCH', json: patch }),
    onSuccess: (s) => {
      setSettings(s);
      void invalidateFinance();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <SettingsSection id="preferences" title="Preferences" footer="Totals in other currencies are converted with the exchange rates below.">
      <ul className="divide-y divide-[var(--separator)]">
        <li>
          <SettingsRow label="Main currency" detail="Used for net worth and dashboard totals">
            <Select aria-label="Main currency" className="w-28" value={settings.baseCurrency} onChange={(e) => save.mutate({ baseCurrency: e.target.value as SettingsDTO['baseCurrency'] })}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </SettingsRow>
        </li>
        <li>
          <SettingsRow label="Time zone" detail="Defines when your day, week and month start">
            <Select aria-label="Time zone" className="w-52" value={settings.timezone} onChange={(e) => save.mutate({ timezone: e.target.value })}>
              {[...new Set([settings.timezone, ...TIMEZONES])].map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          </SettingsRow>
        </li>
        <li>
          <SettingsRow label="Number format">
            <Select aria-label="Number format" className="w-52" value={settings.locale} onChange={(e) => save.mutate({ locale: e.target.value as SettingsDTO['locale'] })}>
              <option value="fr-MA">Français (Maroc) — 1 234,56</option>
              <option value="en-US">English — 1,234.56</option>
              <option value="ar-MA">العربية (المغرب)</option>
            </Select>
          </SettingsRow>
        </li>
        <li>
          <SettingsRow label="Week starts on">
            <Select aria-label="Week starts on" className="w-32" value={settings.weekStartsOn} onChange={(e) => save.mutate({ weekStartsOn: Number(e.target.value) as 0 | 1 })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          </SettingsRow>
        </li>
        <li>
          <SettingsRow label="Budget alerts" detail="Notify me at 50, 75, 90 and 100% of a budget">
            <Toggle label="Budget alerts" checked={settings.budgetAlerts} onChange={(v) => save.mutate({ budgetAlerts: v })} />
          </SettingsRow>
        </li>
      </ul>
    </SettingsSection>
  );
}

function ExchangeRatesSection() {
  const locale = useLocale();
  const { data = [] } = useQuery({ queryKey: ['rates'], queryFn: () => api<{ items: ExchangeRateDTO[] }>('/exchange-rates').then((r) => r.items) });
  const [base, setBase] = useState('EUR');
  const [quote, setQuote] = useState('MAD');
  const [rate, setRate] = useState('');
  const onDone = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['rates'] }), invalidateFinance()]);
  const add = useMutation({
    mutationFn: () => api('/exchange-rates', { method: 'POST', json: { base, quote, rate } }),
    onSuccess: () => {
      setRate('');
      toast.success('Rate saved');
      return onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/exchange-rates/${id}`, { method: 'DELETE' }), onSuccess: onDone });

  return (
    <SettingsSection id="rates" title="Exchange rates" footer="Mizan never mixes currencies without a rate. Transfers between currencies record their own rate automatically.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
        className="flex flex-wrap items-center gap-2 px-5 py-3"
      >
        <span className="text-body">1</span>
        <Select aria-label="From currency" className="w-24" value={base} onChange={(e) => setBase(e.target.value)}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <span className="text-body">=</span>
        <Input aria-label="Rate" inputMode="decimal" placeholder="10.85" className="tabular w-28" value={rate} onChange={(e) => setRate(e.target.value)} />
        <Select aria-label="To currency" className="w-24" value={quote} onChange={(e) => setQuote(e.target.value)}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="tinted" disabled={!rate || base === quote} loading={add.isPending}>
          Save rate
        </Button>
      </form>
      {data.length > 0 && (
        <ul className="divide-y divide-[var(--separator)] border-t hairline">
          {data.slice(0, 10).map((r) => (
            <li key={r.id} className="flex min-h-12 items-center gap-3 px-5 py-2">
              <span className="tabular flex-1 text-body">
                1 {r.base} = {r.rate} {r.quote}
              </span>
              <span className="text-subhead text-label-2">
                {fmtDate(r.date, locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {r.source === 'transfer' ? 'from a transfer' : 'manual'}
              </span>
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Delete rate ${r.base} to ${r.quote} on ${r.date}`} onClick={() => remove.mutate(r.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7">
      <header className="pt-2">
        <h1 className="text-title1 font-semibold tracking-[-0.01em]">Settings</h1>
      </header>
      <ProfileSection />
      <PreferencesSection />
      <CategoriesSection />
      <ExchangeRatesSection />
      <SecuritySection />
    </div>
  );
}
