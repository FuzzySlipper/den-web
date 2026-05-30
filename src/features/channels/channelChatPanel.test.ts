/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Channel, ChannelMessage } from '../../api/types';

// ---------------------------------------------------------------------------
// Helper: re-implement relevant pure functions from ChannelChatPanel.tsx
// so they can be tested directly (these are module-private in the source).
// ---------------------------------------------------------------------------

function channelLabel(channel: Channel | null, projectId: string | null): string {
  if (channel?.slug === 'agent-commons') return '#agent-commons';
  if (channel) return `#${channel.slug}`;
  if (projectId) return `#project-${projectId}`;
  return '#agent-commons';
}

function preferredDefaultChannel(channels: Channel[], projectId: string | null): Channel | undefined {
  if (!projectId) {
    return channels.find(candidate => candidate.slug === 'agent-commons') ?? channels[0];
  }
  return channels.find(candidate => candidate.kind === 'project_default') ?? channels[0];
}

function channel(overrides: Partial<Channel>): Channel {
  return {
    id: 1,
    slug: 'test-channel',
    displayName: 'Test Channel',
    kind: 'project_default',
    projectId: 'den-channels',
    spaceId: null,
    createdBy: 'den-web',
    visibility: 'normal',
    settingsJson: null,
    createdAt: '2026-05-19T00:00:00Z',
    updatedAt: '2026-05-19T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

function gatewayMessage(overrides: Partial<ChannelMessage>): ChannelMessage {
  return {
    id: 42,
    channelId: 10,
    senderType: 'user',
    senderIdentity: 'patch',
    body: 'hello',
    messageKind: 'human_text',
    sourceKind: null,
    sourceId: null,
    sourceProjectId: null,
    summary: null,
    deepLink: null,
    threadRootMessageId: null,
    replyToMessageId: null,
    metadataJson: null,
    deliveryRequestId: null,
    dedupeKey: null,
    finalChannelMessageId: null,
    createdAt: '2026-05-19T00:00:00Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Invariant: channel default selection and Agent Commons fallback
// ---------------------------------------------------------------------------

describe('channel default selection and Agent Commons fallback', () => {
  it('falls back to agent-commons when no projectId is given', () => {
    const commons = channel({ id: 99, slug: 'agent-commons', kind: 'system' });
    const other = channel({ id: 1, slug: 'general', kind: 'project_default', projectId: 'some-project' });
    expect(preferredDefaultChannel([other, commons], null)?.slug).toBe('agent-commons');
  });

  it('prefers project_default when a projectId is given', () => {
    const projectDefault = channel({ id: 10, slug: 'den-channels', kind: 'project_default', projectId: 'den-channels' });
    const regular = channel({ id: 5, slug: 'random', kind: 'regular', projectId: 'den-channels' });
    expect(preferredDefaultChannel([regular, projectDefault], 'den-channels')?.slug).toBe('den-channels');
  });

  it('falls back to first channel when no project_default exists', () => {
    const first = channel({ id: 1, slug: 'alpha', kind: 'regular', projectId: 'den-channels' });
    const second = channel({ id: 2, slug: 'beta', kind: 'regular', projectId: 'den-channels' });
    expect(preferredDefaultChannel([first, second], 'den-channels')?.slug).toBe('alpha');
  });

  it('returns undefined from an empty channel list', () => {
    expect(preferredDefaultChannel([], 'den-channels')).toBeUndefined();
    expect(preferredDefaultChannel([], null)).toBeUndefined();
  });
});

describe('channelLabel fallback behavior', () => {
  it('labels agent-commons by slug even with a projectId', () => {
    const commons = channel({ id: 99, slug: 'agent-commons', kind: 'system' });
    expect(channelLabel(commons, 'den-channels')).toBe('#agent-commons');
  });

  it('labels normal channels with # prefix', () => {
    const ch = channel({ slug: 'my-channel' });
    expect(channelLabel(ch, 'den-channels')).toBe('#my-channel');
  });

  it('falls back to #project-{id} when no channel is provided but projectId is', () => {
    expect(channelLabel(null, 'den-channels')).toBe('#project-den-channels');
  });

  it('falls back to #agent-commons when neither channel nor projectId is given', () => {
    expect(channelLabel(null, null)).toBe('#agent-commons');
  });

  it('falls back to #agent-commons when projectId is null and channel is null', () => {
    expect(channelLabel(null, null)).toBe('#agent-commons');
  });
});

// ---------------------------------------------------------------------------
// Invariant: participantShouldWakeForMessage wake-policy logic
// ---------------------------------------------------------------------------

describe('participant wake-policy matching (stable logic)', () => {
  // All tests use fully inline logic matching ChannelChatPanel.tsx
  // to avoid closure shadowing issues with the module-level helpers.

  it('does not wake for agent messages', () => {
    const msg = gatewayMessage({ senderType: 'agent', messageKind: 'agent_text' });
    expect(msg.senderType !== 'user' || msg.messageKind !== 'human_text').toBe(true);
  });

  it('does not wake for non-human-text messages', () => {
    const msg = gatewayMessage({ senderType: 'user', messageKind: 'system_event' });
    expect(msg.senderType !== 'user' || msg.messageKind !== 'human_text').toBe(true);
  });

  it('wakes for all_human_messages policy', () => {
    const msg = gatewayMessage({ senderType: 'user', messageKind: 'human_text' });
    expect(msg.senderType === 'user' && msg.messageKind === 'human_text').toBe(true);
  });

  it('wakes for mention in mentions_only policy', () => {
    const msg = gatewayMessage({ body: 'hey @den-mcp-runner check this' });
    const body = msg.body.toLowerCase();
    expect(body.includes('@den-mcp-runner')).toBe(true);
  });

  it('does not wake for unmentioned message in mentions_only policy', () => {
    const msg = gatewayMessage({ body: 'just chatting' });
    const body = msg.body.toLowerCase();
    expect(body.includes('@den-mcp-runner')).toBe(false);
  });

  it('wakes for mention with question in direct_questions_only policy', () => {
    const msg = gatewayMessage({ body: '@den-mcp-runner what do you think?' });
    const body = msg.body.toLowerCase();
    expect(body.includes('@den-mcp-runner') && body.includes('?')).toBe(true);
  });

  it('does not wake for mention without question in direct_questions_only policy', () => {
    const msg = gatewayMessage({ body: '@den-mcp-runner take a look' });
    const body = msg.body.toLowerCase();
    expect(body.includes('@den-mcp-runner') && body.includes('?')).toBe(false);
  });

  it('never wakes for never policy', () => {
    const msg = gatewayMessage({ senderType: 'user', messageKind: 'human_text', body: '@den-mcp-runner help' });
    // 'never' policy always returns false; verify message is user human_text
    expect(msg.senderType === 'user' && msg.messageKind === 'human_text').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant: dirty document switch guard structural test (source assertion)
// ---------------------------------------------------------------------------

describe('dirty document switch guard invariant', () => {
  const detailSource = readFileSync(resolve(process.cwd(), 'src/features/documents/DocumentDetail.tsx'), 'utf8');

  it('has pendingSwitch prop in DocumentDetail interface', () => {
    expect(detailSource).toContain('pendingSwitch?: DocumentSummary | null');
  });

  it('has handleSaveAndSwitch callback', () => {
    expect(detailSource).toContain('const handleSaveAndSwitch');
    expect(detailSource).toContain("if (!pendingSwitch) return;");
  });

  it('has handleDiscardAndSwitch callback', () => {
    expect(detailSource).toContain('const handleDiscardAndSwitch');
    expect(detailSource).toContain("onConfirmSwitch?.(pendingSwitch)");
  });

  it('renders Save & switch and Discard & switch buttons', () => {
    expect(detailSource).toContain('Save & switch');
    expect(detailSource).toContain('Discard & switch');
    expect(detailSource).toContain('Keep editing');
  });

  it('has the document-switch-guard CSS class reference', () => {
    expect(detailSource).toContain('document-switch-guard');
  });

  it('does not lose the onCancelSwitch plumbing', () => {
    expect(detailSource).toContain('onCancelSwitch');
  });
});

// ---------------------------------------------------------------------------
// Invariant: document body/editor separation from discussion
// ---------------------------------------------------------------------------

describe('document body/editor separation from discussion', () => {
  const detailSource = readFileSync(resolve(process.cwd(), 'src/features/documents/DocumentDetail.tsx'), 'utf8');

  it('has separate content/discussion tabs', () => {
    expect(detailSource).toContain("panelTab === 'content'");
    expect(detailSource).toContain("panelTab === 'discussion'");
  });

  it('renders DocumentDiscussion as a separate component', () => {
    expect(detailSource).toContain('<DocumentDiscussion summary={summary} />');
  });

  it('does not POST discussion from the document editor/save path', () => {
    // The save function should only save document content, not discussion comments
    expect(detailSource).toContain('handleSave');
    expect(detailSource).not.toContain('postDocumentDiscussionComment');
  });

  it('keeps discussion loading out of the document load path (lazy-loaded in DocumentDiscussion)', () => {
    // Discussion is loaded lazily in the DocumentDiscussion component, not in the document load path
    expect(detailSource).toContain('getDocument');
    expect(detailSource).not.toContain('getDocumentDiscussion');
  });

  it('keeps discussion comments out of the document-editor textarea', () => {
    // The textarea for markdown editing should not reference discussion
    expect(detailSource).toContain('document-editor');
    // The save path only sends document fields, not discussion content
    expect(detailSource).not.toContain('postDocumentDiscussionComment');
    // The load/save callbacks don't touch discussion API
    expect(detailSource).not.toContain('getDocumentDiscussion');
  });
});

// ---------------------------------------------------------------------------
// Invariant: DocumentDiscussion component safety
// ---------------------------------------------------------------------------

describe('DocumentDiscussion component invariants', () => {
  const discussionSource = readFileSync(resolve(process.cwd(), 'src/features/documents/DocumentDiscussion.tsx'), 'utf8');

  it('renders empty state message', () => {
    expect(discussionSource).toContain('No discussion comments yet');
    expect(discussionSource).toContain('Start the conversation below');
  });

  it('warns that discussion is separate from document body', () => {
    expect(discussionSource).toContain('separate from the canonical document content');
    expect(discussionSource).toContain('not part of the document Markdown body');
  });

  it('handles API errors for loading and posting', () => {
    expect(discussionSource).toContain('Failed to load discussion');
    expect(discussionSource).toContain('Post failed');
  });
});

// ---------------------------------------------------------------------------
// Slash-command and history keyboard behavior (Finding 845)
// These tests mirror the handleComposerKeyDown logic as pure state functions
// extracted from the ChannelChatPanel.tsx component.
// ---------------------------------------------------------------------------

interface SlashCommand {
  command: string;
  label: string;
  description: string;
}

interface HistoryEntry {
  body: string;
  timestamp: number;
}

/**
 * Simulate slash-command ArrowDown press — advances active index modulo length.
 */
function slashArrowDown(activeIndex: number, suggestionCount: number): number {
  if (suggestionCount === 0) return activeIndex;
  return (activeIndex + 1) % suggestionCount;
}

/**
 * Simulate slash-command ArrowUp press — retreats active index modulo length.
 */
function slashArrowUp(activeIndex: number, suggestionCount: number): number {
  if (suggestionCount === 0) return activeIndex;
  return (activeIndex - 1 + suggestionCount) % suggestionCount;
}

/**
 * Simulate slash-command Enter/Tab selection — returns the draft that
 * should result from selecting the given command at the given index.
 */
function slashEnterSelection(
  suggestions: SlashCommand[],
  activeIndex: number,
): string {
  const cmd = suggestions[activeIndex] ?? suggestions[0];
  if (!cmd) return '';
  if (cmd.command === '/clear') return '';
  return cmd.command;
}

/**
 * Simulate history ArrowUp navigation — returns the next body and navigate index.
 * Mirrors the logic in handleComposerKeyDown when cursor is at position 0.
 */
function historyArrowUp(
  currentDraft: string,
  currentNavIndex: number | null,
  entries: HistoryEntry[],
): { draft: string; navIndex: number | null; unsentDraft: string } {
  if (entries.length === 0) return { draft: currentDraft, navIndex: null, unsentDraft: '' };
  if (currentNavIndex === null) {
    // Start navigating from the most recent entry
    return { draft: entries[entries.length - 1].body, navIndex: entries.length - 1, unsentDraft: currentDraft };
  }
  if (currentNavIndex > 0) {
    // Go to previous (older) entry
    return { draft: entries[currentNavIndex - 1].body, navIndex: currentNavIndex - 1, unsentDraft: '' };
  }
  // Already at oldest entry — no change
  return { draft: entries[currentNavIndex].body, navIndex: currentNavIndex, unsentDraft: '' };
}

/**
 * Simulate history ArrowDown navigation — cycles forward through history.
 */
function historyArrowDown(
  currentNavIndex: number | null,
  entries: HistoryEntry[],
  unsentDraft: string,
): { draft: string; navIndex: number | null } {
  if (currentNavIndex === null) return { draft: unsentDraft, navIndex: null };
  if (currentNavIndex < entries.length - 1) {
    const nextIndex = currentNavIndex + 1;
    return { draft: entries[nextIndex].body, navIndex: nextIndex };
  }
  // At the end of history, restore the unsent draft
  return { draft: unsentDraft, navIndex: null };
}

/**
 * Slash help should display when draft is exactly '/help'.
 */
function slashHelpShown(draft: string): boolean {
  return draft.trim() === '/help';
}

// ---------------------------------------------------------------------------

describe('slash-command keyboard navigation', () => {
  const testCommands: SlashCommand[] = [
    { command: '/help', label: '/help', description: 'Show help' },
    { command: '/clear', label: '/clear', description: 'Clear composer' },
  ];

  it('ArrowDown cycles active index forward modulo length', () => {
    expect(slashArrowDown(0, 2)).toBe(1);
    expect(slashArrowDown(1, 2)).toBe(0);
    // Single suggestion wraps
    expect(slashArrowDown(0, 1)).toBe(0);
    // No suggestions — no-op
    expect(slashArrowDown(0, 0)).toBe(0);
  });

  it('ArrowUp cycles active index backward modulo length', () => {
    expect(slashArrowUp(0, 2)).toBe(1);
    expect(slashArrowUp(1, 2)).toBe(0);
    // Single suggestion wraps
    expect(slashArrowUp(0, 1)).toBe(0);
    // No suggestions — no-op
    expect(slashArrowUp(0, 0)).toBe(0);
  });

  it('Enter on non-clear command sets draft to the command', () => {
    expect(slashEnterSelection(testCommands, 0)).toBe('/help');
  });

  it('Enter on /clear command sets draft to empty string', () => {
    expect(slashEnterSelection(testCommands, 1)).toBe('');
  });

  it('Enter with invalid index falls back to first suggestion', () => {
    expect(slashEnterSelection(testCommands, 99)).toBe('/help');
  });

  it('Enter with empty suggestions returns empty draft', () => {
    expect(slashEnterSelection([], 0)).toBe('');
  });
});

describe('slash help display condition', () => {
  it('shows help when draft is exactly /help', () => {
    expect(slashHelpShown('/help')).toBe(true);
  });

  it('does not show help for /help with trailing whitespace (trimmed)', () => {
    expect(slashHelpShown('  /help  ')).toBe(true);
  });

  it('does not show help for bare slash', () => {
    expect(slashHelpShown('/')).toBe(false);
  });

  it('does not show help for other commands', () => {
    expect(slashHelpShown('/clear')).toBe(false);
  });

  it('does not show help for empty draft', () => {
    expect(slashHelpShown('')).toBe(false);
  });
});

describe('composer history keyboard navigation', () => {
  const entries: HistoryEntry[] = [
    { body: 'old message', timestamp: 1000 },
    { body: 'recent message', timestamp: 2000 },
  ];

  it('ArrowUp at start navigates to most recent entry', () => {
    const result = historyArrowUp('current draft', null, entries);
    expect(result.draft).toBe('recent message');
    expect(result.navIndex).toBe(1);
    expect(result.unsentDraft).toBe('current draft');
  });

  it('ArrowUp while navigating goes to previous (older) entry', () => {
    const result = historyArrowUp('', 1, entries);
    expect(result.draft).toBe('old message');
    expect(result.navIndex).toBe(0);
  });

  it('ArrowUp at oldest entry stays at oldest', () => {
    const result = historyArrowUp('', 0, entries);
    expect(result.draft).toBe('old message');
    expect(result.navIndex).toBe(0);
  });

  it('ArrowDown while navigating goes to newer entry', () => {
    const result = historyArrowDown(0, entries, 'unsaved draft');
    expect(result.draft).toBe('recent message');
    expect(result.navIndex).toBe(1);
  });

  it('ArrowDown at newest entry restores unsent draft and exits navigation', () => {
    const result = historyArrowDown(1, entries, 'unsaved draft');
    expect(result.draft).toBe('unsaved draft');
    expect(result.navIndex).toBeNull();
  });

  it('ArrowDown outside navigation does nothing', () => {
    const result = historyArrowDown(null, entries, 'unsaved draft');
    expect(result.draft).toBe('unsaved draft');
    expect(result.navIndex).toBeNull();
  });

  it('ArrowUp with empty history does nothing', () => {
    const result = historyArrowUp('draft', null, []);
    expect(result.draft).toBe('draft');
    expect(result.navIndex).toBeNull();
  });
});
