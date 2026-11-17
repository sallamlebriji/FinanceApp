import { PERIOD_PRESETS, type NotificationDTO } from '@mizan/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, CalendarRange, Check, LogOut, Plus, Search, Settings as SettingsIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import { queryClient } from '@/lib/query';
import { useAuth } from '@/stores/auth';
import { useComposer } from '@/stores/composer';
import { PERIOD_LABELS, usePeriod } from '@/stores/period';

function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ items: NotificationDTO[]; unread: number }>('/notifications'),
    refetchInterval: 60_000,
  });
}

function Notifications() {
  const { data } = useNotifications();
  const readAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const unread = data?.unread ?? 0;
  return (
    <Menu onOpenChange={(open) => !open && unread > 0 && readAll.mutate()}>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-bold leading-4 text-white dark:text-[#1a0503]" aria-hidden>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <div className="w-80 max-w-[85vw]">
          <p className="px-2.5 pb-1 pt-2 text-subhead font-semibold">Notifications</p>
          {!data?.items.length ? (
            <p className="px-2.5 pb-3 pt-1 text-callout text-label-2">You're all caught up. Budget alerts will appear here.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.items.slice(0, 12).map((n) => (
                <li key={n.id} className="flex gap-2.5 rounded-lg px-2.5 py-2">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent')} aria-hidden />
                  <div>
                    <p className="text-callout font-medium">{n.title}</p>
                    <p className="text-subhead text-label-2">{n.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </MenuContent>
    </Menu>
  );
}

function PeriodSelector() {
  const { preset, setPreset } = usePeriod();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size="md" aria-label={`Period: ${PERIOD_LABELS[preset]}`}>
          <CalendarRange className="size-4 text-label-2" aria-hidden />
          <span className="hidden sm:inline">{PERIOD_LABELS[preset]}</span>
        </Button>
      </MenuTrigger>
      <MenuContent>
        {PERIOD_PRESETS.map((p) => (
          <MenuItem key={p} onSelect={() => setPreset(p)} icon={p === preset ? <Check /> : <span />}>
            {PERIOD_LABELS[p]}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function ProfileMenu() {
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    queryClient.clear();
    clear();
    navigate('/login');
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className="flex size-10 items-center justify-center rounded-full" aria-label="Account menu">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-footnote font-semibold text-accent">{initials}</span>
        </button>
      </MenuTrigger>
      <MenuContent>
        <div className="px-2.5 py-2">
          <p className="text-callout font-semibold">{user?.name}</p>
          <p className="text-subhead text-label-2">{user?.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem icon={<SettingsIcon />} onSelect={() => navigate('/settings')}>
          Settings
        </MenuItem>
        <MenuItem icon={<LogOut />} onSelect={signOut}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const show = useComposer((s) => s.show);
  const [q, setQ] = useState('');
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/transactions${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };
  const showPeriod = location.pathname === '/';

  return (
    <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <img src="/mizan.svg" alt="Mizan" className="mr-1 size-7 lg:hidden" />
        <form role="search" onSubmit={onSearch} className="relative hidden max-w-sm flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-label-3" aria-hidden />
          <label htmlFor="global-search" className="sr-only">
            Search transactions
          </label>
          <input
            id="global-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transactions"
            className="h-10 w-full rounded-[var(--radius-control)] bg-fill pl-9 pr-10 text-callout placeholder:text-label-3 focus:bg-surface focus:shadow-[var(--ring)] focus:outline-none"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border hairline px-1.5 text-caption text-label-3 md:block">/</kbd>
        </form>
        <div className="ml-auto flex items-center gap-1.5">
          {/* Compact width: search lives on the Transactions screen. */}
          <Button variant="ghost" size="icon" className="rounded-full sm:hidden" aria-label="Search transactions" onClick={() => navigate('/transactions?search=1')}>
            <Search className="size-[18px]" />
          </Button>
          {showPeriod && <PeriodSelector />}
          <Notifications />
          <ProfileMenu />
          <Button variant="primary" onClick={() => show()} aria-label="New transaction" className="ml-1 max-sm:size-10 max-sm:px-0" title="New transaction (N)">
            <Plus className="size-[18px]" aria-hidden />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
