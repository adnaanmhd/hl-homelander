# Humyn Labs — Task Icons

Lucide-react icon mapping for the **65 tasks** in `task-taxonomy.md`. Use these to render task cards on the Tasks screen, task detail sheets, history rows, and any other surface that references a task.

## Install

```bash
pnpm add lucide-react   # or: npm i lucide-react / yarn add lucide-react
```

Recommended `lucide-react` version: **>= 0.400.0**. Older versions are missing `BrushCleaning`, `ShowerHead`, `Tractor`, and `Container`. If you can't upgrade, see the **Fallbacks** section below.

## Files

| File           | Purpose                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `mapping.ts`   | Source of truth: typed entries + lookup helpers. No React deps.        |
| `mapping.json` | Same data, JSON-only (for non-TS consumers, design tools, BE seeding). |
| `TaskIcon.tsx` | React component that resolves a task to its lucide icon.               |
| `index.ts`     | Barrel export. Always import from `'design-system/task-icons'`.        |

## Quick start

```tsx
import { TaskIcon } from 'design-system/task-icons';

<TaskIcon task="chopping" size={28} className="text-accent" strokeWidth={1.75} />
<TaskIcon task="Walking a pet" size={28} />
<TaskIcon task="some-unknown-id" />               {/* renders Sparkles fallback */}
```

`TaskIcon` accepts every prop `lucide-react` accepts (`size`, `strokeWidth`, `color`, `className`, `aria-label`, etc.) plus:

- `task` — slug id (e.g. `"chopping"`) **or** display name (`"Chopping"`); case-insensitive on names.
- `fallback` — `LucideIcon` to render when the task isn't found. Defaults to `Sparkles`.

### Lookup without rendering

```ts
import { getTaskIcon, TASKS_BY_CATEGORY } from 'design-system/task-icons';

const entry = getTaskIcon('mowing-lawn');
//   → { id: 'mowing-lawn', name: 'Mowing the lawn', category: 'Gardening', setting: 'outdoor', icon: 'Tractor' }

const cookingTasks = TASKS_BY_CATEGORY['Cooking']; // 9 entries
```

### Render the entire Tasks grid

```tsx
import { TASK_ICONS, TaskIcon } from 'design-system/task-icons';

<div className="grid grid-cols-2 gap-3">
  {TASK_ICONS.map((t) => (
    <button key={t.id} className="task-card">
      <TaskIcon task={t.id} size={28} />
      <div className="cat">{t.category}</div>
      <div className="nm">{t.name}</div>
    </button>
  ))}
</div>;
```

## Design guidance

Icons render at **28 px** on task cards (matches the prototype). On task-detail sheets and history rows, scale up to 32–40 px. Stroke weight **1.75–2** keeps the lucide line look consistent at small sizes. Colour: `--accent` (`#FF6A2D`) on light surfaces, white on the dark recording surface.

## Mapping

Sorted by category. Repeats are intentional — e.g. `Wrench` covers both furniture assembly and plumbing because both are wrench-driven; `Sparkles` covers anything that finishes "shiny clean". When two tasks share an icon, accompanying text always disambiguates.

### Cooking

| Task                           | Icon              |
| ------------------------------ | ----------------- |
| Cooking a meal (full session)  | `ChefHat`         |
| Chopping                       | `Carrot`          |
| Dicing                         | `Grid2x2`         |
| Slicing                        | `Slice`           |
| Peeling                        | `Banana`          |
| Kneading or rolling dough      | `Croissant`       |
| Plating or serving food/drinks | `UtensilsCrossed` |
| Reheating food                 | `Microwave`       |
| Packing food                   | `Container`       |

### Dishwashing

| Task                    | Icon       |
| ----------------------- | ---------- |
| Washing dishes          | `Droplets` |
| Drying or wiping dishes | `Sparkles` |

### Kitchen

| Task                                   | Icon              |
| -------------------------------------- | ----------------- |
| Organizing kitchen cabinets or drawers | `Boxes`           |
| Organizing spice rack                  | `FlaskConical`    |
| Setting a table                        | `Utensils`        |
| Clearing a table                       | `LayoutDashboard` |
| Organizing or stocking fridge          | `Refrigerator`    |
| Unpacking or sorting groceries         | `ShoppingBasket`  |

### Cleaning

| Task                            | Icon             |
| ------------------------------- | ---------------- |
| Cleaning kitchen counter-top    | `LayoutPanelTop` |
| Cleaning appliances             | `Brush`          |
| Sweeping                        | `BrushCleaning`  |
| Mopping                         | `Droplet`        |
| Vacuuming                       | `Wind`           |
| Dusting                         | `Feather`        |
| Spraying and wiping surfaces    | `SprayCan`       |
| Bathroom cleaning               | `Bath`           |
| Cleaning windows and mirrors    | `AppWindow`      |
| Emptying or replacing trash bag | `Trash2`         |
| Taking out trash                | `Trash`          |
| Sweeping outdoor area           | `Leaf`           |

### Tidying

| Task                          | Icon          |
| ----------------------------- | ------------- |
| Organizing a desk             | `NotebookPen` |
| Organizing a closet or drawer | `Shirt`       |
| Organizing a room             | `Sofa`        |
| Changing sheets or covers     | `Bed`         |

### Laundry

| Task                                       | Icon             |
| ------------------------------------------ | ---------------- |
| Loading or unloading washing machine       | `WashingMachine` |
| Hanging clothes to dry                     | `Sun`            |
| Removing clothes from drying line          | `Sunset`         |
| Sorting clothes or fabrics                 | `LayoutGrid`     |
| Folding clothes                            | `Layers`         |
| Folding towels or bedsheets                | `BedDouble`      |
| Ironing clothes                            | `Flame`          |
| Post-washing laundry (sort → fold → store) | `Archive`        |

### Gardening

| Task                            | Icon        |
| ------------------------------- | ----------- |
| Watering plants                 | `CloudRain` |
| Planting or repotting           | `Sprout`    |
| Pruning or trimming             | `Flower2`   |
| Hoeing                          | `Shovel`    |
| Mowing the lawn                 | `Tractor`   |
| Raking leaves                   | `Trees`     |
| Harvesting fruits or vegetables | `Apple`     |
| Coiling a hose                  | `Cable`     |

### Pet Care

| Task                              | Icon         |
| --------------------------------- | ------------ |
| Filling a feeding bowl            | `Bone`       |
| Emptying or cleaning feeding bowl | `Sparkles`   |
| Clearing a litter box             | `Cat`        |
| Refilling water bowl              | `GlassWater` |
| Brushing or grooming a pet        | `PawPrint`   |
| Bathing a pet                     | `ShowerHead` |
| Walking a pet                     | `Dog`        |

### Home Maintenance

| Task                                         | Icon          |
| -------------------------------------------- | ------------- |
| Assembling furniture                         | `Wrench`      |
| Using hand tools (screwdriver, hammer, etc.) | `Hammer`      |
| Painting a wall or surface                   | `PaintBucket` |
| Minor plumbing repair                        | `Wrench`      |
| Washing or cleaning a vehicle                | `Car`         |

### Hobby

| Task                      | Icon       |
| ------------------------- | ---------- |
| Sewing or mending clothes | `Scissors` |
| Threading a needle        | `Pin`      |
| Knitting or crocheting    | `Spline`   |
| Gift wrapping             | `Gift`     |

## Fallbacks for older lucide-react

If you're locked to `lucide-react < 0.400`, swap these in `mapping.ts`:

| Missing icon     | Use instead       |
| ---------------- | ----------------- |
| `BrushCleaning`  | `Brush`           |
| `ShowerHead`     | `Bath`            |
| `Tractor`        | `Truck`           |
| `Container`      | `Package`         |
| `Spline`         | `Workflow`        |
| `LayoutPanelTop` | `LayoutDashboard` |

## Notes & open items

- **Categories don't match the prototype.** The taxonomy has 10 categories (Cooking, Dishwashing, Kitchen, Cleaning, Tidying, Laundry, Gardening, Pet Care, Home Maintenance, Hobby); the prototype's pills only show 5 (Cooking, Cleaning, Laundry, Self-care, Outdoor). Decide whether to expand pills, fold categories under super-categories, or filter by `setting` instead. See `design-spec.md` §10.
- **No icon for "Self-care"** because the taxonomy has no Self-care tasks. The prototype's `Brush teeth` example task isn't in the canonical list — confirm whether to drop it or extend the taxonomy.
- **Repeats are deliberate** — `Wrench` (assembling + plumbing) and `Sparkles` (drying dishes + cleaning pet bowl) share visual language because the _action_ shares language. UI should always pair the icon with the task name, never icon-only.
- **Knitting** uses `Spline` (curves) as the closest semantic to looped yarn. If product wants something more literal, request a custom SVG and add it as a one-off in `iconRegistry`.
