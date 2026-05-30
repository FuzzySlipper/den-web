/**
 * channelSlashCommands.ts — Static slash-command suggestion/help for the
 * chat composer. These are purely client-side suggestions; no backend
 * slash-command API is involved.
 */

export interface SlashCommand {
  command: string;
  label: string;
  description: string;
}

const STATIC_COMMANDS: SlashCommand[] = [
  {
    command: '/help',
    label: '/help',
    description: 'Show this slash-command help',
  },
  {
    command: '/clear',
    label: '/clear',
    description: 'Clear the composer textarea',
  },
];

/**
 * Return the list of known static slash commands.
 */
export function getSlashCommands(): SlashCommand[] {
  return STATIC_COMMANDS;
}

export function getSlashCommandHelpLines(commands: SlashCommand[] = STATIC_COMMANDS): string[] {
  return commands.map(command => `${command.command} — ${command.description}`);
}

/**
 * Return suggestions that match a partial slash-command string.
 * The `draft` should contain a leading `/` at the start.
 */
export function findSlashCommandSuggestions(
  draft: string,
  commands?: SlashCommand[],
): SlashCommand[] {
  const list = commands ?? STATIC_COMMANDS;

  // Only show suggestions when the draft starts with `/`
  if (!draft.startsWith('/')) return [];

  const normalized = draft.toLowerCase();
  return list.filter(cmd => cmd.command.toLowerCase().startsWith(normalized));
}

/**
 * Cycle the slash-command suggestion index in a given direction.
 * Returns the new active index (wraps modularly). No-op when suggestionCount is 0.
 */
export function cycleSlashIndex(
  currentIndex: number,
  suggestionCount: number,
  direction: 'up' | 'down',
): number {
  if (suggestionCount === 0) return currentIndex;
  if (direction === 'down') {
    return (currentIndex + 1) % suggestionCount;
  }
  return (currentIndex - 1 + suggestionCount) % suggestionCount;
}

/**
 * Compute the draft text that should result from selecting a slash-command
 * suggestion at the given active index. Falls back to the first suggestion
 * when the index is out of range. /clear yields empty string; others yield
 * the command text.
 */
export function applySlashSelection(
  suggestions: SlashCommand[],
  activeIndex: number,
): string {
  const cmd = suggestions[activeIndex] ?? suggestions[0];
  if (!cmd) return '';
  if (cmd.command === '/clear') return '';
  return cmd.command;
}

/**
 * Returns true when the draft text should trigger the slash command help panel.
 * The condition is: trimmed draft equals exactly '/help'.
 */
export function isSlashHelpTrigger(draft: string): boolean {
  return draft.trim() === '/help';
}
