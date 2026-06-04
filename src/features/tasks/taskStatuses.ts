/**
 * Shared task status constants used by FilterBar and navigation hotkeys.
 *
 * Extracted from FilterBar.tsx to avoid react-refresh warning about
 * exporting non-component values from a component file.
 */

export const STATUSES = ['planned', 'in_progress', 'review', 'blocked', 'done', 'cancelled'] as const;
export const TASK_AVAILABILITY_FILTERS = ['waiting_on_dependencies'] as const;
export const TASK_FILTERS = [...STATUSES, ...TASK_AVAILABILITY_FILTERS] as const;
export type TaskFilterStatus = (typeof TASK_FILTERS)[number];
