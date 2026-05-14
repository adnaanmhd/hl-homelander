import {
  AppWindow,
  Apple,
  Archive,
  Banana,
  Bath,
  Bed,
  BedDouble,
  Bone,
  Boxes,
  Brush,
  BrushCleaning,
  Cable,
  Car,
  Carrot,
  Cat,
  ChefHat,
  CloudRain,
  Container,
  Croissant,
  Dog,
  Droplet,
  Droplets,
  Feather,
  FlaskConical,
  Flame,
  Flower2,
  Gift,
  GlassWater,
  Grid2x2,
  Hammer,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LayoutPanelTop,
  Leaf,
  Microwave,
  NotebookPen,
  PaintBucket,
  PawPrint,
  Pin,
  Refrigerator,
  Scissors,
  Shirt,
  ShoppingBasket,
  Shovel,
  ShowerHead,
  Slice,
  Sofa,
  SprayCan,
  Sparkles,
  Spline,
  Sprout,
  Sun,
  Sunset,
  Tractor,
  Trash,
  Trash2,
  Trees,
  Utensils,
  UtensilsCrossed,
  WashingMachine,
  Wind,
  Wrench,
  type LucideProps,
  type LucideIcon,
} from 'lucide-react';

import { getTaskIcon, type LucideIconName, type TaskIconEntry } from './mapping';

/**
 * Single source-of-truth registry mapping our `LucideIconName` union to the
 * actual lucide-react components. If the union grows, add the import + the
 * registry entry — TypeScript will fail on a missing key.
 */
export const iconRegistry: Record<LucideIconName, LucideIcon> = {
  AppWindow,
  Apple,
  Archive,
  Banana,
  Bath,
  Bed,
  BedDouble,
  Bone,
  Boxes,
  Brush,
  BrushCleaning,
  Cable,
  Car,
  Carrot,
  Cat,
  ChefHat,
  CloudRain,
  Container,
  Croissant,
  Dog,
  Droplet,
  Droplets,
  Feather,
  FlaskConical,
  Flame,
  Flower2,
  Gift,
  GlassWater,
  Grid2x2,
  Hammer,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LayoutPanelTop,
  Leaf,
  Microwave,
  NotebookPen,
  PaintBucket,
  PawPrint,
  Pin,
  Refrigerator,
  Scissors,
  Shirt,
  ShoppingBasket,
  Shovel,
  ShowerHead,
  Slice,
  Sofa,
  SprayCan,
  Sparkles,
  Spline,
  Sprout,
  Sun,
  Sunset,
  Tractor,
  Trash,
  Trash2,
  Trees,
  Utensils,
  UtensilsCrossed,
  WashingMachine,
  Wind,
  Wrench,
};

export type TaskIconProps = Omit<LucideProps, 'ref'> & {
  /** Slug id (e.g. "chopping") or display name ("Chopping"). */
  task: string;
  /** Component to render when the task isn't in the mapping. Defaults to <Sparkles />. */
  fallback?: LucideIcon;
};

/**
 * Render the lucide icon for a given task. Pass any standard lucide prop
 * (size, strokeWidth, color, className, etc.).
 *
 *   <TaskIcon task="chopping" size={28} className="text-accent" />
 *   <TaskIcon task="Walking a pet" size={28} />
 */
export function TaskIcon({ task, fallback = Sparkles, ...props }: TaskIconProps) {
  const entry: TaskIconEntry | undefined = getTaskIcon(task);
  const Icon = entry ? iconRegistry[entry.icon] : fallback;
  return <Icon aria-label={entry?.name ?? 'Task'} {...props} />;
}
