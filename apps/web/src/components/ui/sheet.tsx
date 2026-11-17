import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/format';
import { Button } from './button';

interface SheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A focused, single-task modal. Slides from the trailing edge on wide screens and up from the
 * bottom on compact widths. Always has a visible Close button besides Esc/overlay (HIG sheets.md).
 */
export function Sheet({ open, onOpenChange, title, description, children, footer }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)] animate-[fade-in_var(--dur)_var(--ease-out)]" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface float focus:outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-sheet)] animate-[sheet-up_var(--dur)_var(--ease-out)]',
            'md:inset-y-3 md:right-3 md:left-auto md:bottom-3 md:max-h-none md:w-[440px] md:rounded-[var(--radius-sheet)] md:animate-[sheet-in_var(--dur)_var(--ease-out)]',
          )}
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-fill-strong md:hidden" aria-hidden />
          <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-4 md:pt-6">
            <div>
              <Dialog.Title className="text-title3 font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-subhead text-label-2">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-2 rounded-full">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-3">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t hairline px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
