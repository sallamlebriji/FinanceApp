import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './button';

interface ConfirmProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm(): void;
  loading?: boolean;
  destructive?: boolean;
}

/** Alert for destructive, irreversible actions. Cancel is the default focus (HIG alerts.md). */
export function Confirm({ open, onOpenChange, title, message, confirmLabel, onConfirm, loading, destructive = true }: ConfirmProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] animate-[fade-in_var(--dur)_var(--ease-out)]" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-sheet)] bg-surface p-6 float animate-[pop-in_var(--dur)_var(--ease-out)] focus:outline-none"
        >
          <Dialog.Title className="text-body font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-callout text-label-2">{message}</Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button autoFocus>Cancel</Button>
            </Dialog.Close>
            <Button variant={destructive ? 'destructive' : 'primary'} loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
