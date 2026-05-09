/**
 * @doc Icon primitive — thin wrapper over `lucide-react-native` per
 * engineering-handoff §1.7 iconography rules.
 *
 * Default stroke width 1.75 (engineering-handoff §1.7); default size
 * 24 px; default color `colors.text`. Re-exports the lucide
 * `LucideIcon` type alias so consumers can build Icon-by-name lookups.
 *
 * Why thin: Phase 2 screens import dozens of icons by name; centralising
 * the default stroke + color here means a future icon-system migration
 * (e.g., to a custom SVG sheet) only touches one file.
 */
import React from 'react';
import * as LucideIcons from 'lucide-react-native';
import { colors } from '../tokens';

// Lucide exports each icon as a React component plus a few non-component
// helpers. Filter to component lookups via the index signature trick.
type LucideIconMap = typeof LucideIcons;
export type IconName = keyof LucideIconMap;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  accessibilityLabel?: string;
}

export function Icon({
  name,
  size = 24,
  color = colors.text,
  strokeWidth = 1.75,
  accessibilityLabel,
}: IconProps) {
  // Lucide icon components accept `size`, `color`, `strokeWidth`. The
  // index signature in `LucideIconMap` types each entry too loosely; cast
  // to a component and forward.
  const Component = LucideIcons[name] as unknown as React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
    accessibilityLabel?: string;
  }>;
  if (typeof Component !== 'function') {
    // Defensive: returns null rather than throwing if a typo'd icon name
    // slips past TypeScript (e.g., dynamic name lookup).
    return null;
  }
  return (
    <Component
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      accessibilityLabel={accessibilityLabel ?? String(name)}
    />
  );
}

export default Icon;
