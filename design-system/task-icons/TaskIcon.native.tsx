/**
 * Phase 6 — RN variant of design-system/task-icons/TaskIcon.tsx.
 *
 * Metro's platform-specific module resolution picks `.native.tsx` over `.tsx`
 * for React Native consumers (06-RESEARCH Q-2). The web `TaskIcon.tsx` stays
 * alive for §v2 ARCH-V2-02 (web/desktop/tablet review-only client).
 *
 * The component shape matches the web sibling: pass `task` (slug id or display
 * name) plus any standard lucide prop (size, strokeWidth, color, etc.). The
 * underlying lucide-react-native icon registry is built by name-lookup on
 * `LucideRN` — this avoids enumerating all 65 icons as named imports and keeps
 * the file roughly half the LOC of the web variant.
 *
 * Icon-availability note (06-RESEARCH Pitfall 7): lucide-react-native@1.14.0
 * ships every name the 65-task `LucideIconName` union references — verified
 * for the four flagged names (`BrushCleaning`, `ShowerHead`, `Tractor`,
 * `Container`) and `SearchX` (the no-results glyph) on 2026-05-14. If a future
 * upgrade drops one, the runtime fallback below logs a `__DEV__` warning and
 * renders the fallback icon (Sparkles by default).
 */
import * as React from 'react';
import * as LucideRN from 'lucide-react-native';

import { getTaskIcon, type LucideIconName, type TaskIconEntry } from './mapping';

type LucideRNComponent = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  color?: string;
}>;

export interface TaskIconProps {
  /** Slug id (e.g. "chopping") or display name ("Chopping"). */
  task: string;
  /** Defaults to 28 per design-spec §10 task-card icon. */
  size?: number;
  /** Defaults to 1.75 per design-spec §10. */
  strokeWidth?: number;
  /** Defaults to lucide's `currentColor` semantics — `undefined` lets the icon inherit. */
  color?: string;
  /** Name of the icon to render when the task isn't in the taxonomy. Defaults to `Sparkles`. */
  fallback?: LucideIconName;
}

function pickIcon(name: string): LucideRNComponent | undefined {
  // Index by name into the lucide-react-native namespace. The cast narrows the
  // namespace object (which exposes types alongside components) to a plain
  // name→component dictionary; `undefined` falls through to the fallback.
  return (LucideRN as unknown as Record<string, LucideRNComponent | undefined>)[name];
}

/**
 * Render the lucide-react-native icon for a given task (slug or name). Mirrors
 * the web `TaskIcon.tsx` contract without the named-import registry.
 *
 *   <TaskIcon task="chopping" size={28} />
 *   <TaskIcon task="Walking a pet" size={28} strokeWidth={1.75} />
 */
export function TaskIcon({
  task,
  size = 28,
  strokeWidth = 1.75,
  color,
  fallback = 'Sparkles',
}: TaskIconProps): React.ReactElement | null {
  const entry: TaskIconEntry | undefined = getTaskIcon(task);
  const iconName: string = entry?.icon ?? fallback;
  const Icon = pickIcon(iconName) ?? pickIcon(fallback);
  if (!Icon) {
    if (__DEV__) {
      console.warn(
        `[TaskIcon] lucide-react-native missing icon "${iconName}" (task="${task}"); fallback "${fallback}" also missing — rendering null.`,
      );
    }
    return null;
  }
  return <Icon size={size} strokeWidth={strokeWidth} color={color} />;
}

export default TaskIcon;
