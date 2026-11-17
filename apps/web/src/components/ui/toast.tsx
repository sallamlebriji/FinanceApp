import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/format';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
  action?: { label: string; run(): void };
}

const useToasts = create<{ items: Toast[]; push(t: Omit<Toast, 'id'>): void; dismiss(id: number): void }>((set, get) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set({ items: [...get().items.slice(-2), { ...t, id }] });
    // Kept on screen long enough to read and act (HIG accessibility.md: avoid time-boxed UI).
    setTimeout(() => get().dismiss(id), t.action ? 8000 : 5000);
  },
  dismiss: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}));

export const toast = {
  success: (message: string, action?: Toast['action']) => useToasts.getState().push({ message, tone: 'success', action }),
  error: (message: string) => useToasts.getState().push({ message, tone: 'error' }),
};

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex min-h-11 max-w-md items-center gap-3 rounded-2xl bg-[#1d1d22] py-2 pl-4 pr-2 text-callout text-white float animate-[sheet-up_var(--dur)_var(--ease-out)] dark:bg-[#2a2a31]"
        >
          {t.tone === 'success' ? <CheckCircle2 className="size-4 shrink-0 text-[#4CC38A]" aria-hidden /> : <AlertCircle className="size-4 shrink-0 text-[#FF7B70]" aria-hidden />}
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="rounded-lg px-2 py-1 font-semibold text-[#B7B1FF] hover:bg-white/10"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className={cn('rounded-lg p-1.5 text-white/70 hover:bg-white/10')}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
