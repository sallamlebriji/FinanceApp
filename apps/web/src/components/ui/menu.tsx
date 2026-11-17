import * as DM from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' | 'center' }) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-48 rounded-xl bg-surface p-1 float animate-[pop-in_var(--dur-fast)_var(--ease-out)]"
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  destructive,
}: {
  children: ReactNode;
  onSelect(): void;
  icon?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-callout outline-none data-[highlighted]:bg-fill',
        destructive ? 'text-negative' : 'text-label',
      )}
    >
      {icon && <span className="flex size-4 items-center justify-center [&>svg]:size-4" aria-hidden>{icon}</span>}
      {children}
    </DM.Item>
  );
}

export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-[var(--separator)]" />;
