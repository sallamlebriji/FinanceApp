import { NavLink } from 'react-router';
import { cn } from '@/lib/format';
import { PLAN_PAGES } from './nav';

/**
 * Compact widths reach Budgets, Goals and Debts through one "Plan" tab; this segmented
 * switcher moves between them. The sidebar lists them separately, so it hides at lg.
 */
export function PlanSwitcher() {
  return (
    <nav aria-label="Plan" className="lg:hidden">
      <ul className="flex rounded-[var(--radius-control)] bg-fill p-0.5">
        {PLAN_PAGES.map((p) => (
          <li key={p.to} className="flex-1">
            <NavLink
              to={p.to}
              className={({ isActive }) =>
                cn(
                  'flex h-8 items-center justify-center rounded-[8px] text-subhead font-medium transition-[background,color] duration-[var(--dur-fast)]',
                  isActive ? 'bg-surface text-label shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-fill-strong' : 'text-label-2',
                )
              }
            >
              {p.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
