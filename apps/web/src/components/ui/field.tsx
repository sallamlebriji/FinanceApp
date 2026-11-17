import { ChevronDown } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/format';

const control =
  'w-full rounded-[var(--radius-control)] border border-transparent bg-fill px-3 text-body text-label placeholder:text-label-3 transition-[box-shadow,background] duration-[var(--dur-fast)] focus:bg-surface focus:shadow-[var(--ring)] focus:outline-none aria-[invalid=true]:shadow-[0_0_0_2px_var(--negative)]';

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
  hideLabel?: boolean;
}

/** Label + control + inline validation message, wired for screen readers. */
export function Field({ label, error, hint, children, className, hideLabel }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-subhead font-medium text-label-2', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? msgId : undefined })}
      {(error || hint) && (
        <p id={msgId} className={cn('text-footnote', error ? 'text-negative' : 'text-label-3')} role={error ? 'alert' : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-20 py-2.5', className)} {...p} />;
});

/** Native select: accessible, keyboard friendly and uses the platform picker on touch devices. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-11 appearance-none pr-9', className)} {...p}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-label-3" aria-hidden />
    </div>
  );
});
