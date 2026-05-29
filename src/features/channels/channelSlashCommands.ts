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
