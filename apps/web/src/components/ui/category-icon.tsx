import {
  ArrowLeftRight,
  Baby,
  BookOpen,
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gift,
  HeartPulse,
  Heart,
  Home,
  Laptop,
  MoreHorizontal,
  PawPrint,
  PiggyBank,
  Plane,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Store,
  Ticket,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/format';

/** Semantic icon keys (shared with mobile, where they map to SF Symbols / Material Symbols). */
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  basket: ShoppingBasket,
  car: Car,
  home: Home,
  health: HeartPulse,
  bag: ShoppingBag,
  ticket: Ticket,
  restaurant: Utensils,
  repeat: Repeat,
  book: BookOpen,
  bolt: Zap,
  plane: Plane,
  dots: MoreHorizontal,
  briefcase: Briefcase,
  laptop: Laptop,
  store: Store,
  trend: TrendingUp,
  gift: Gift,
  coffee: Coffee,
  phone: Smartphone,
  wifi: Wifi,
  fuel: Fuel,
  baby: Baby,
  paw: PawPrint,
  gym: Dumbbell,
  shirt: Shirt,
  tools: Wrench,
  heart: Heart,
  piggy: PiggyBank,
  card: CreditCard,
  cash: Wallet,
  transfer: ArrowLeftRight,
};

/** A small tinted glyph tile. The tint is decorative; the category name is always shown next to it. */
export function CategoryIcon({ icon, color, size = 'md', className }: { icon: string; color: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const Icon = CATEGORY_ICON_MAP[icon] ?? MoreHorizontal;
  const s = { sm: 'size-7 rounded-[8px] [&>svg]:size-3.5', md: 'size-9 rounded-[10px] [&>svg]:size-[18px]', lg: 'size-11 rounded-xl [&>svg]:size-5' }[size];
  return (
    <span className={cn('flex shrink-0 items-center justify-center', s, className)} style={{ backgroundColor: `${color}22`, color }} aria-hidden>
      <Icon strokeWidth={2} />
    </span>
  );
}
