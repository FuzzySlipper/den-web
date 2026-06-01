/**
 * Client-local preferences for Den Web UI.
 *
 * V1 persistence model: localStorage only.
 * Why not server-side shared settings?
 *   - Den Web is a standalone static web UI; it connects to multiple backends
 *     (Den Core, Channels, Gateway) that don't share a unified preferences API.
 *   - Client-local avoids adding a write API, auth scoping, conflict resolution,
 *     and schema migration overhead in V1.
 *   - Preferences are per-browser/per-device, which is reasonable for a development
 *     tool — different team members often want different layout/theme/zoom.
 *   - TODO: If server/shared preferences are needed later, lift this to a Den Core
 *     `preferences` resource with profile scoping and a sync strategy. For now,
 *     localStorage is sufficient and zero-latency.
 */

/** Chat transcript density controls */
export interface ChatPreferences {
  /** Gap between message rows (px) */
  rowGap: number;
  /** Vertical padding inside each message card (px) */
  messagePadding: number;
  /** Horizontal gap between time/sender/body columns (px) — only if grid layout */
  columnGap: number;
}

/** Layout controls */
export interface LayoutPreferences {
  /** Chat vs participants split ratio expressed as chat fraction (clamped 0.55–0.95) */
  chatFraction: number;
  /** Whether participants sidebar is visible */
  showParticipants: boolean;
  /** Notification history display mode: named popup window or in-app side panel */
  notificationHistoryMode: 'window' | 'sidePanel';
  /** Spaces/sidebar width in px (clamped 140–500) */
  sidebarWidth: number;
  /** Notification side panel width in px (clamped 280–800) */
  notificationPanelWidth: number;
  /** Detail drawer/panel width in px (clamped 200–1200) */
  detailPanelWidth: number;
}

/** Theme controls — V1 covers accent and background colors; more surfaces can be added. */
export interface ThemePreferences {
  /** Primary accent color (hex) */
  accent: string;
  /** Background color (hex) */
  background: string;
  /** Surface/panel background (hex) */
  surface: string;
  /** Text color (hex) */
  text: string;
  /** Text muted color (hex) */
  textMuted: string;
  /**
   * TODO: Cover more color surfaces:
   *  - border, bg-hover, bg-selected
   *  - per-status colors (green, yellow, red, orange, purple, cyan)
   *  - syntax highlighting palette (token colors, brackets, strings, keywords)
   * For now the V1 five-colour set provides a meaningful visual change.
   */
}

/** Font controls */
export interface FontPreferences {
  /** Monospace font family stack */
  monoStack: string;
  /** Sans-serif font family stack */
  sansStack: string;
  /** Base font size (px) */
  baseSize: number;
  /** Chat transcript font size (px) */
  chatSize: number;
  /** List/spaces/task list font size (px) */
  listSize: number;
  /** Detail panel/drawer font size (px) */
  detailSize: number;
}

/** Keyboard shortcuts. Empty strings disable the binding. */
export interface KeyboardPreferences {
  /** Close the most recently opened panel/sub-panel */
  closePanel: string;
  /** Open the preferences/options panel */
  openPreferences: string;

  /** Cycle through spaces/projects (left sidebar) forward */
  switchProject: string;
  /** Cycle through main panel modes forward */
  cycleMainPanel: string;
  /** Cycle task status filter (Tasks mode only) */
  cycleTaskFilter: string;

  /** Direct jump to Tasks panel */
  jumpToTasks: string;
  /** Direct jump to Agents panel */
  jumpToAgents: string;
  /** Direct jump to Messages panel */
  jumpToMessages: string;
  /** Direct jump to Docs panel */
  jumpToDocs: string;
  /** Direct jump to Git panel */
  jumpToGit: string;
  /** Direct jump to Sessions panel */
  jumpToSessions: string;
  /** Direct jump to Librarian panel */
  jumpToLibrarian: string;
  /** Direct jump to Agent Stream panel */
  jumpToAgentStream: string;

  /**
   * Composer-local: cycle send mode between channel post and direct-agent message.
   * Only fires when composer textarea has focus.
   */
  composerCycleSendMode: string;
  /**
   * Composer-local: cycle direct-agent target when in direct mode.
   * Only fires when composer textarea has focus.
   */
  composerCycleTarget: string;
}

export interface DenWebPreferences {
  chat: ChatPreferences;
  layout: LayoutPreferences;
  theme: ThemePreferences;
  font: FontPreferences;
  keyboard: KeyboardPreferences;
}

export const DEFAULT_PREFERENCES: DenWebPreferences = {
  chat: {
    rowGap: 4,
    messagePadding: 0,
    columnGap: 8,
  },
  layout: {
    chatFraction: 0.8,
    showParticipants: true,
    notificationHistoryMode: 'window',
    sidebarWidth: 200,
    notificationPanelWidth: 400,
    detailPanelWidth: 500,
  },
  theme: {
    accent: '#7aa2f7',
    background: '#1a1b26',
    surface: '#1f2029',
    text: '#c0caf5',
    textMuted: '#6b7089',
  },
  font: {
    monoStack: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    sansStack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    baseSize: 13,
    chatSize: 12,
    listSize: 12,
    detailSize: 12,
  },
  keyboard: {
    closePanel: 'Escape',
    openPreferences: '',
    switchProject: 'Ctrl+Tab',
    cycleMainPanel: 'Shift+Tab',
    cycleTaskFilter: 'F3',
    jumpToTasks: '',
    jumpToAgents: '',
    jumpToMessages: '',
    jumpToDocs: '',
    jumpToGit: '',
    jumpToSessions: '',
    jumpToLibrarian: '',
    jumpToAgentStream: '',
    composerCycleSendMode: 'Alt+C',
    composerCycleTarget: 'Alt+T',
  },
};
