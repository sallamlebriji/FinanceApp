import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { TransactionComposer } from '@/features/transactions/transaction-composer';
import { cn } from '@/lib/format';
import { useComposer } from '@/stores/composer';
import { NAV, PLAN_PAGES } from './nav';
import { Topbar } from './topbar';

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <img src="/mizan.svg" alt="" className="size-7" />
      <span className="text-[17px] font-semibold tracking-[-0.01em]">Mizan</span>
    </div>
  );
}

export function AppShell() {
  const show = useComposer((s) => s.show);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inPlan = PLAN_PAGES.some((p) => pathname.startsWith(p.to));

  // Keyboard: N = new transaction, / = search (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        show();
      } else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, navigate]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Sidebar — regular width */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 px-3 py-5 lg:flex" aria-label="Primary">
        <Wordmark />
        <nav>
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-3 rounded-[10px] px-3 text-callout font-medium transition-colors duration-[var(--dur-fast)]',
                      isActive ? 'bg-accent-soft text-accent' : 'text-label-2 hover:bg-fill hover:text-label',
                    )
                  }
                >
                  <item.icon className="size-[18px]" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <Topbar />
        <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-28 pt-2 sm:px-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Tab bar — compact width. Navigation only; never hidden, never disabled. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t hairline bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((n) => n.tab).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex h-[52px] flex-col items-center justify-center gap-0.5 text-caption font-medium',
                    isActive || (item.to === '/budgets' && inPlan) ? 'text-accent' : 'text-label-2',
                  )
                }
              >
                {({ isActive: active }) => {
                  const isActive = active || (item.to === '/budgets' && inPlan);
                  return (
                  <>
                    <item.icon className="size-[22px]" strokeWidth={isActive ? 2.3 : 1.8} aria-hidden />
                    {item.short}
                  </>
                  );
                }}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <TransactionComposer />
    </div>
  );
}
