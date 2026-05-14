/**
 * Task → Lucide icon mapping for the Humyn Labs Tasks screen.
 *
 * Source taxonomy: /task-taxonomy.md (65 tasks across 10 categories).
 * Icons: lucide-react (>=0.400.0 recommended for `BrushCleaning`, `ShowerHead`, `Tractor`, `Container`).
 *
 * Each entry exposes:
 *   - id:        stable kebab-case slug (use as React keys / API ids)
 *   - name:      display name (verbatim from taxonomy)
 *   - category:  canonical category name from taxonomy
 *   - setting:   'indoor' | 'outdoor'
 *   - icon:      lucide-react component name (PascalCase, importable as a named export)
 *
 * The icon is exported as a string component-name so this file stays free of React
 * imports — consumer code resolves the component via the `iconRegistry` in TaskIcon.tsx.
 */

export type TaskCategory =
  | 'Cooking'
  | 'Dishwashing'
  | 'Kitchen'
  | 'Cleaning'
  | 'Tidying'
  | 'Laundry'
  | 'Gardening'
  | 'Pet Care'
  | 'Home Maintenance'
  | 'Hobby';

export type TaskSetting = 'indoor' | 'outdoor';

export type TaskIconEntry = {
  id: string;
  name: string;
  category: TaskCategory;
  setting: TaskSetting;
  icon: LucideIconName;
};

/**
 * Every lucide-react icon name referenced below. Listed once so we get a compile-time
 * guarantee that every entry's `icon` field is one of these and nothing else.
 */
export type LucideIconName =
  | 'ChefHat'
  | 'Carrot'
  | 'Grid2x2'
  | 'Slice'
  | 'Banana'
  | 'Croissant'
  | 'UtensilsCrossed'
  | 'Microwave'
  | 'Container'
  | 'Droplets'
  | 'Sparkles'
  | 'Boxes'
  | 'FlaskConical'
  | 'Utensils'
  | 'LayoutDashboard'
  | 'Refrigerator'
  | 'ShoppingBasket'
  | 'LayoutPanelTop'
  | 'Brush'
  | 'BrushCleaning'
  | 'Droplet'
  | 'Wind'
  | 'Feather'
  | 'SprayCan'
  | 'Bath'
  | 'AppWindow'
  | 'Trash2'
  | 'Trash'
  | 'Leaf'
  | 'NotebookPen'
  | 'Shirt'
  | 'Sofa'
  | 'Bed'
  | 'WashingMachine'
  | 'Sun'
  | 'Sunset'
  | 'LayoutGrid'
  | 'Layers'
  | 'BedDouble'
  | 'Flame'
  | 'Archive'
  | 'CloudRain'
  | 'Sprout'
  | 'Flower2'
  | 'Shovel'
  | 'Tractor'
  | 'Trees'
  | 'Apple'
  | 'Cable'
  | 'Bone'
  | 'Cat'
  | 'GlassWater'
  | 'PawPrint'
  | 'ShowerHead'
  | 'Dog'
  | 'Wrench'
  | 'Hammer'
  | 'PaintBucket'
  | 'Car'
  | 'Scissors'
  | 'Pin'
  | 'Spline'
  | 'Gift';

export const TASK_ICONS: readonly TaskIconEntry[] = [
  // ───── Cooking ─────
  {
    id: 'cooking-meal',
    name: 'Cooking a meal (full session)',
    category: 'Cooking',
    setting: 'indoor',
    icon: 'ChefHat',
  },
  { id: 'chopping', name: 'Chopping', category: 'Cooking', setting: 'indoor', icon: 'Carrot' },
  { id: 'dicing', name: 'Dicing', category: 'Cooking', setting: 'indoor', icon: 'Grid2x2' },
  { id: 'slicing', name: 'Slicing', category: 'Cooking', setting: 'indoor', icon: 'Slice' },
  { id: 'peeling', name: 'Peeling', category: 'Cooking', setting: 'indoor', icon: 'Banana' },
  {
    id: 'kneading-dough',
    name: 'Kneading or rolling dough',
    category: 'Cooking',
    setting: 'indoor',
    icon: 'Croissant',
  },
  {
    id: 'plating-serving',
    name: 'Plating or serving food/drinks',
    category: 'Cooking',
    setting: 'indoor',
    icon: 'UtensilsCrossed',
  },
  {
    id: 'reheating-food',
    name: 'Reheating food',
    category: 'Cooking',
    setting: 'indoor',
    icon: 'Microwave',
  },
  {
    id: 'packing-food',
    name: 'Packing food',
    category: 'Cooking',
    setting: 'indoor',
    icon: 'Container',
  },

  // ───── Dishwashing ─────
  {
    id: 'washing-dishes',
    name: 'Washing dishes',
    category: 'Dishwashing',
    setting: 'indoor',
    icon: 'Droplets',
  },
  {
    id: 'drying-dishes',
    name: 'Drying or wiping dishes',
    category: 'Dishwashing',
    setting: 'indoor',
    icon: 'Sparkles',
  },

  // ───── Kitchen ─────
  {
    id: 'organizing-cabinets',
    name: 'Organizing kitchen cabinets or drawers',
    category: 'Kitchen',
    setting: 'indoor',
    icon: 'Boxes',
  },
  {
    id: 'organizing-spice-rack',
    name: 'Organizing spice rack',
    category: 'Kitchen',
    setting: 'indoor',
    icon: 'FlaskConical',
  },
  {
    id: 'setting-table',
    name: 'Setting a table',
    category: 'Kitchen',
    setting: 'indoor',
    icon: 'Utensils',
  },
  {
    id: 'clearing-table',
    name: 'Clearing a table',
    category: 'Kitchen',
    setting: 'indoor',
    icon: 'LayoutDashboard',
  },
  {
    id: 'organizing-fridge',
    name: 'Organizing or stocking fridge',
    category: 'Kitchen',
    setting: 'indoor',
    icon: 'Refrigerator',
  },
  {
    id: 'unpacking-groceries',
    name: 'Unpacking or sorting groceries',
    category: 'Kitchen',
    setting: 'indoor',
    icon: 'ShoppingBasket',
  },

  // ───── Cleaning ─────
  {
    id: 'cleaning-counter-top',
    name: 'Cleaning kitchen counter-top',
    category: 'Cleaning',
    setting: 'indoor',
    icon: 'LayoutPanelTop',
  },
  {
    id: 'cleaning-appliances',
    name: 'Cleaning appliances',
    category: 'Cleaning',
    setting: 'indoor',
    icon: 'Brush',
  },
  {
    id: 'sweeping',
    name: 'Sweeping',
    category: 'Cleaning',
    setting: 'indoor',
    icon: 'BrushCleaning',
  },
  { id: 'mopping', name: 'Mopping', category: 'Cleaning', setting: 'indoor', icon: 'Droplet' },
  { id: 'vacuuming', name: 'Vacuuming', category: 'Cleaning', setting: 'indoor', icon: 'Wind' },
  { id: 'dusting', name: 'Dusting', category: 'Cleaning', setting: 'indoor', icon: 'Feather' },
  {
    id: 'spraying-wiping',
    name: 'Spraying and wiping surfaces',
    category: 'Cleaning',
    setting: 'indoor',
    icon: 'SprayCan',
  },
  {
    id: 'bathroom-cleaning',
    name: 'Bathroom cleaning',
    category: 'Cleaning',
    setting: 'indoor',
    icon: 'Bath',
  },
  {
    id: 'cleaning-windows',
    name: 'Cleaning windows and mirrors',
    category: 'Cleaning',
    setting: 'indoor',
    icon: 'AppWindow',
  },
  {
    id: 'emptying-trash-bag',
    name: 'Emptying or replacing trash bag',
    category: 'Cleaning',
    setting: 'indoor',
    icon: 'Trash2',
  },
  {
    id: 'taking-out-trash',
    name: 'Taking out trash',
    category: 'Cleaning',
    setting: 'outdoor',
    icon: 'Trash',
  },
  {
    id: 'sweeping-outdoor',
    name: 'Sweeping outdoor area',
    category: 'Cleaning',
    setting: 'outdoor',
    icon: 'Leaf',
  },

  // ───── Tidying ─────
  {
    id: 'organizing-desk',
    name: 'Organizing a desk',
    category: 'Tidying',
    setting: 'indoor',
    icon: 'NotebookPen',
  },
  {
    id: 'organizing-closet',
    name: 'Organizing a closet or drawer',
    category: 'Tidying',
    setting: 'indoor',
    icon: 'Shirt',
  },
  {
    id: 'organizing-room',
    name: 'Organizing a room',
    category: 'Tidying',
    setting: 'indoor',
    icon: 'Sofa',
  },
  {
    id: 'changing-sheets',
    name: 'Changing sheets or covers',
    category: 'Tidying',
    setting: 'indoor',
    icon: 'Bed',
  },

  // ───── Laundry ─────
  {
    id: 'loading-washer',
    name: 'Loading or unloading washing machine',
    category: 'Laundry',
    setting: 'indoor',
    icon: 'WashingMachine',
  },
  {
    id: 'hanging-clothes',
    name: 'Hanging clothes to dry',
    category: 'Laundry',
    setting: 'outdoor',
    icon: 'Sun',
  },
  {
    id: 'removing-from-line',
    name: 'Removing clothes from drying line',
    category: 'Laundry',
    setting: 'outdoor',
    icon: 'Sunset',
  },
  {
    id: 'sorting-clothes',
    name: 'Sorting clothes or fabrics',
    category: 'Laundry',
    setting: 'indoor',
    icon: 'LayoutGrid',
  },
  {
    id: 'folding-clothes',
    name: 'Folding clothes',
    category: 'Laundry',
    setting: 'indoor',
    icon: 'Layers',
  },
  {
    id: 'folding-towels',
    name: 'Folding towels or bedsheets',
    category: 'Laundry',
    setting: 'indoor',
    icon: 'BedDouble',
  },
  {
    id: 'ironing-clothes',
    name: 'Ironing clothes',
    category: 'Laundry',
    setting: 'indoor',
    icon: 'Flame',
  },
  {
    id: 'post-washing-laundry',
    name: 'Post-washing laundry (sort → fold → store)',
    category: 'Laundry',
    setting: 'indoor',
    icon: 'Archive',
  },

  // ───── Gardening ─────
  {
    id: 'watering-plants',
    name: 'Watering plants',
    category: 'Gardening',
    setting: 'outdoor',
    icon: 'CloudRain',
  },
  {
    id: 'planting',
    name: 'Planting or repotting',
    category: 'Gardening',
    setting: 'outdoor',
    icon: 'Sprout',
  },
  {
    id: 'pruning',
    name: 'Pruning or trimming',
    category: 'Gardening',
    setting: 'outdoor',
    icon: 'Flower2',
  },
  { id: 'hoeing', name: 'Hoeing', category: 'Gardening', setting: 'outdoor', icon: 'Shovel' },
  {
    id: 'mowing-lawn',
    name: 'Mowing the lawn',
    category: 'Gardening',
    setting: 'outdoor',
    icon: 'Tractor',
  },
  {
    id: 'raking-leaves',
    name: 'Raking leaves',
    category: 'Gardening',
    setting: 'outdoor',
    icon: 'Trees',
  },
  {
    id: 'harvesting',
    name: 'Harvesting fruits or vegetables',
    category: 'Gardening',
    setting: 'outdoor',
    icon: 'Apple',
  },
  {
    id: 'coiling-hose',
    name: 'Coiling a hose',
    category: 'Gardening',
    setting: 'outdoor',
    icon: 'Cable',
  },

  // ───── Pet Care ─────
  {
    id: 'filling-feeding-bowl',
    name: 'Filling a feeding bowl',
    category: 'Pet Care',
    setting: 'indoor',
    icon: 'Bone',
  },
  {
    id: 'cleaning-feeding-bowl',
    name: 'Emptying or cleaning feeding bowl',
    category: 'Pet Care',
    setting: 'indoor',
    icon: 'Sparkles',
  },
  {
    id: 'clearing-litter-box',
    name: 'Clearing a litter box',
    category: 'Pet Care',
    setting: 'indoor',
    icon: 'Cat',
  },
  {
    id: 'refilling-water-bowl',
    name: 'Refilling water bowl',
    category: 'Pet Care',
    setting: 'indoor',
    icon: 'GlassWater',
  },
  {
    id: 'brushing-pet',
    name: 'Brushing or grooming a pet',
    category: 'Pet Care',
    setting: 'indoor',
    icon: 'PawPrint',
  },
  {
    id: 'bathing-pet',
    name: 'Bathing a pet',
    category: 'Pet Care',
    setting: 'indoor',
    icon: 'ShowerHead',
  },
  {
    id: 'walking-pet',
    name: 'Walking a pet',
    category: 'Pet Care',
    setting: 'outdoor',
    icon: 'Dog',
  },

  // ───── Home Maintenance ─────
  {
    id: 'assembling-furniture',
    name: 'Assembling furniture',
    category: 'Home Maintenance',
    setting: 'indoor',
    icon: 'Wrench',
  },
  {
    id: 'using-hand-tools',
    name: 'Using hand tools (screwdriver, hammer, etc.)',
    category: 'Home Maintenance',
    setting: 'indoor',
    icon: 'Hammer',
  },
  {
    id: 'painting',
    name: 'Painting a wall or surface',
    category: 'Home Maintenance',
    setting: 'indoor',
    icon: 'PaintBucket',
  },
  {
    id: 'plumbing-repair',
    name: 'Minor plumbing repair',
    category: 'Home Maintenance',
    setting: 'indoor',
    icon: 'Wrench',
  },
  {
    id: 'washing-vehicle',
    name: 'Washing or cleaning a vehicle',
    category: 'Home Maintenance',
    setting: 'outdoor',
    icon: 'Car',
  },

  // ───── Hobby ─────
  {
    id: 'sewing',
    name: 'Sewing or mending clothes',
    category: 'Hobby',
    setting: 'indoor',
    icon: 'Scissors',
  },
  {
    id: 'threading-needle',
    name: 'Threading a needle',
    category: 'Hobby',
    setting: 'indoor',
    icon: 'Pin',
  },
  {
    id: 'knitting',
    name: 'Knitting or crocheting',
    category: 'Hobby',
    setting: 'indoor',
    icon: 'Spline',
  },
  {
    id: 'gift-wrapping',
    name: 'Gift wrapping',
    category: 'Hobby',
    setting: 'indoor',
    icon: 'Gift',
  },
] as const;

/**
 * Indexed lookups. Generated once on module load.
 */
export const TASK_ICON_BY_ID: Readonly<Record<string, TaskIconEntry>> = Object.freeze(
  Object.fromEntries(TASK_ICONS.map((t) => [t.id, t])),
);

export const TASK_ICON_BY_NAME: Readonly<Record<string, TaskIconEntry>> = Object.freeze(
  Object.fromEntries(TASK_ICONS.map((t) => [t.name.toLowerCase(), t])),
);

/**
 * Look up an icon by either the slug id ("chopping") or the full task name
 * ("Chopping"). Case-insensitive on names. Returns undefined if not found —
 * callers should provide a fallback icon (recommended: `Sparkles` or `Circle`).
 */
export function getTaskIcon(idOrName: string): TaskIconEntry | undefined {
  return TASK_ICON_BY_ID[idOrName] ?? TASK_ICON_BY_NAME[idOrName.toLowerCase()];
}

/**
 * Group entries by category. Order of categories matches the taxonomy.
 */
export const TASK_CATEGORIES: readonly TaskCategory[] = [
  'Cooking',
  'Dishwashing',
  'Kitchen',
  'Cleaning',
  'Tidying',
  'Laundry',
  'Gardening',
  'Pet Care',
  'Home Maintenance',
  'Hobby',
] as const;

export const TASKS_BY_CATEGORY: Readonly<Record<TaskCategory, readonly TaskIconEntry[]>> =
  Object.freeze(
    TASK_CATEGORIES.reduce(
      (acc, cat) => {
        acc[cat] = TASK_ICONS.filter((t) => t.category === cat);
        return acc;
      },
      {} as Record<TaskCategory, readonly TaskIconEntry[]>,
    ),
  );
