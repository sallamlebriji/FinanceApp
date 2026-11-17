import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/format';

/**
 * Prominent (filled accent) is reserved for the single primary action of a view. Everything
 * else is tinted or plain so the accent keeps its meaning (HIG branding.md, color.md).
 */
export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-[background,color,box-shadow,transform] duration-[var(--dur-fast)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:brightness-110',
        secondary: 'bg-fill text-label hover:bg-fill-strong',
        tinted: 'bg-accent-soft text-accent hover:brightness-95 dark:hover:brightness-125',
        plain: 'text-accent hover:bg-accent-soft',
        ghost: 'text-label-2 hover:bg-fill hover:text-label',
        destructive: 'bg-negative text-white hover:brightness-110 dark:text-[#1a0503]',
        'destructive-plain': 'text-negative hover:bg-negative-soft',
      },
      size: {
        sm: 'h-8 px-3 text-subhead',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-5 text-body font-semibold',
        icon: 'size-10 text-body',
        'icon-sm': 'size-8 text-subhead',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
