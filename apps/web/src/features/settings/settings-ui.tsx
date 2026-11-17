import type { ReactNode } from 'react';
import { Card } from '@/components/ui/primitives';

/** Grouped settings section with a title outside the card, like iOS Settings. */
export function SettingsSection({ id, title, footer, children }: { id: string; title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20">
      <h2 id={id} className="mb-2 px-1 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">
        {title}
      </h2>
      <Card className="overflow-hidden">{children}</Card>
      {footer && <p className="mt-2 px-1 text-footnote text-label-3">{footer}</p>}
    </section>
  );
}

export function SettingsRow({ label, detail, children }: { label: string; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5">
      <div className="min-w-0">
        <p className="text-body">{label}</p>
        {detail && <p className="text-subhead text-label-2">{detail}</p>}
      </div>
      {children}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-[var(--dur)] ${checked ? 'bg-positive' : 'bg-fill-strong'}`}
    >
      <span
        className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-[var(--dur)] ease-[var(--ease-out)] ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
      />
    </button>
  );
}
