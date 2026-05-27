export {
  TASK_ICONS,
  TASK_ICON_BY_ID,
  TASK_ICON_BY_NAME,
  TASK_CATEGORIES,
  TASKS_BY_CATEGORY,
  getTaskIcon,
} from './mapping';

export type { TaskIconEntry, TaskCategory, TaskSetting, LucideIconName } from './mapping';

// `iconRegistry` is web-only (`TaskIcon.tsx`); the React-Native variant
// (`TaskIcon.native.tsx`, picked by Metro / `moduleSuffixes: [".native", ""]`)
// resolves icons by name-lookup against the `lucide-react-native` namespace
// instead, so the registry has no native analogue. Web consumers that need
// it can import it directly from `./TaskIcon`.
export { TaskIcon } from './TaskIcon';
export type { TaskIconProps } from './TaskIcon';
