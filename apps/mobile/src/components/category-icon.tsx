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
  Heart,
  HeartPulse,
  House,
  Laptop,
  type LucideIcon,
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
} from 'lucide-react-native';
import { View } from 'react-native';

/** Same semantic icon keys as the web app (packages/shared CATEGORY_ICONS). */
const MAP: Record<string, LucideIcon> = {
  basket: ShoppingBasket,
  car: Car,
  home: House,
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

/** A tinted rounded square with the category glyph; decorative (the row text names the category). */
export function CategoryIcon({ icon, color, size = 36 }: { icon: string; color: string; size?: number }) {
  const Glyph = MAP[icon] ?? MoreHorizontal;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: `${color}26`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph size={size * 0.5} color={color} strokeWidth={2} />
    </View>
  );
}
