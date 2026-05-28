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
  /** Chat vs participants split ratio expressed as chat fraction (0.6–0.9) */
  chatFraction: number;
  /** Whether participants sidebar is visible */
  showParticipants: boolean;
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
}

export interface DenWebPreferences {
  chat: ChatPreferences;
  layout: LayoutPreferences;
  theme: ThemePreferences;
  font: FontPreferences;
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
  },
};
