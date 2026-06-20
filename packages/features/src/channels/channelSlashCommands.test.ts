import { describe, expect, it } from 'vitest';
import {
  findSlashCommandSuggestions,
  getSlashCommandHelpLines,
  getSlashCommands,
  type SlashCommand,
} from './channelSlashCommands';

// ---------------------------------------------------------------------------
// getSlashCommands
// ---------------------------------------------------------------------------

describe('getSlashCommands', () => {
  it('returns the static command list', () => {
    const commands = getSlashCommands();
    expect(commands.length).toBeGreaterThanOrEqual(2);

    const names = commands.map(c => c.command);
    expect(names).toContain('/help');
    expect(names).toContain('/clear');
  });

  it('every command has a label and description', () => {
    for (const cmd of getSlashCommands()) {
      expect(typeof cmd.command).toBe('string');
      expect(cmd.command).toMatch(/^\//);
      expect(typeof cmd.label).toBe('string');
      expect(typeof cmd.description).toBe('string');
    }
  });
});

describe('getSlashCommandHelpLines', () => {
  it('renders visible help lines with command names and descriptions', () => {
    const lines = getSlashCommandHelpLines([
      { command: '/help', label: '/help', description: 'Show help' },
      { command: '/clear', label: '/clear', description: 'Clear composer' },
    ]);

    expect(lines).toEqual([
      '/help — Show help',
      '/clear — Clear composer',
    ]);
  });
});

// ---------------------------------------------------------------------------
// findSlashCommandSuggestions
// ---------------------------------------------------------------------------

describe('findSlashCommandSuggestions', () => {
  const testCommands: SlashCommand[] = [
    { command: '/help', label: '/help', description: 'Show help' },
    { command: '/clear', label: '/clear', description: 'Clear composer' },
    { command: '/wake', label: '/wake', description: 'Wake agent' },
  ];

  it('returns empty when draft does not start with /', () => {
    expect(findSlashCommandSuggestions('hello', testCommands)).toHaveLength(0);
    expect(findSlashCommandSuggestions('', testCommands)).toHaveLength(0);
  });

  it('returns all commands when draft is just "/"', () => {
    const results = findSlashCommandSuggestions('/', testCommands);
    expect(results).toHaveLength(3);
  });

  it('filters by prefix match', () => {
    const results = findSlashCommandSuggestions('/cl', testCommands);
    expect(results).toHaveLength(1);
    expect(results[0].command).toBe('/clear');
  });

  it('matches case-insensitively', () => {
    const results = findSlashCommandSuggestions('/HELP', testCommands);
    expect(results).toHaveLength(1);
    expect(results[0].command).toBe('/help');
  });

  it('returns empty when no command matches', () => {
    const results = findSlashCommandSuggestions('/xyz', testCommands);
    expect(results).toHaveLength(0);
  });

  it('uses default static list when no commands argument', () => {
    const results = findSlashCommandSuggestions('/');
    const defaults = getSlashCommands();
    expect(results).toEqual(defaults);
  });
});
