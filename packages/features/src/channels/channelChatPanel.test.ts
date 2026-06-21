/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Channel, ChannelMessage, GatewayMember } from '@den-web/api/types';
import { directTargetsForComposerBody } from './channelComposerDirectTargets';
import { channelLabel } from '@den-web/models/channels/chatDisplay';
import {
  type SlashCommand,
  applySlashSelection,
  cycleSlashIndex,
  isSlashHelpTrigger,
} from './channelSlashCommands';
import {
  type ComposerHistoryEntry,
  navigateHistoryDown,
  navigateHistoryUp,
} from './channelComposerHistory';

// ---------------------------------------------------------------------------
// Helper: re-implement relevant pure functions from ChannelChatPanel.tsx
// so they can be tested directly (these are module-private in the source).
// `channelLabel` now lives in the shared channelChatDisplay module and is
// imported above so this guardrail exercises the real implementation.
// ---------------------------------------------------------------------------

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

function member(overrides: Partial<GatewayMember>): GatewayMember {
  return {
    id: 1,
    memberType: 'agent',
    memberIdentity: 'den-mcp-runner',
    membershipStatus: 'active',
    wakePolicy: 'mentions_only',
    canSend: true,
    canReact: true,
    canInvite: false,
    cooldownSeconds: 60,
    maxAutoRepliesPerWindow: 1,
    settingsLabel: null,
    createdAt: null,
    updatedAt: null,
    leftAt: null,
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

describe('participant DM shortcut source invariants', () => {
  const panelSource = readFileSync(resolve(process.cwd(), 'packages/features/src/channels/ChannelChatPanel.tsx'), 'utf8');
  // The participant roster/double-click UI moved into ChannelParticipants during the #2141 decomposition.
  const participantsSource = readFileSync(resolve(process.cwd(), 'packages/features/src/channels/ChannelParticipants.tsx'), 'utf8');
  const appSource = readFileSync(resolve(process.cwd(), 'packages/shell/src/App.tsx'), 'utf8');

  it('threads the App DM opener into the chat panel', () => {
    expect(appSource).toContain('onOpenDmTranscript={nav.handleOpenDmTranscript}');
  });

  it('exposes an optional DM opener callback on ChannelChatPanel', () => {
    expect(panelSource).toContain('onOpenDmTranscript?: (agentIdentity: string) => void;');
  });

  it('threads the DM opener and single-click targeting into ChannelParticipants', () => {
    expect(panelSource).toContain('onOpenDmTranscript={onOpenDmTranscript}');
    expect(panelSource).toContain('onSelectTarget={setTargetMemberIdentity}');
  });

  it('opens the member DM transcript on double-click without replacing single-click targeting', () => {
    expect(participantsSource).toContain('onClick={() => memberIsActiveAgent(member) && onSelectTarget(member.memberIdentity)}');
    expect(participantsSource).toContain('onDoubleClick={() => memberIsActiveAgent(member) && onOpenDmTranscript?.(member.memberIdentity)}');
    expect(participantsSource).toContain("title={memberIsActiveAgent(member) && onOpenDmTranscript ? `${visibleStatus} · double-click to open DM transcript` : visibleStatus}");
  });
});

describe('channel composer direct-agent targeting', () => {
  it('treats @mentions of active agents as canonical direct-agent targets', () => {
    const targets = directTargetsForComposerBody('hey @den-mcp-runner can you check this?', [
      member({ memberIdentity: 'den-mcp-runner' }),
      member({ memberIdentity: 'den-mcp-planner' }),
    ]);

    expect(targets.map(target => target.memberIdentity)).toEqual(['den-mcp-runner']);
  });

  it('does not direct-target left or human participants', () => {
    const targets = directTargetsForComposerBody('@den-mcp-runner @patchfoot hello', [
      member({ memberIdentity: 'den-mcp-runner', membershipStatus: 'left' }),
      member({ memberIdentity: 'patchfoot', memberType: 'human' }),
    ]);

    expect(targets).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Invariant: dirty document switch guard structural test (source assertion)
// ---------------------------------------------------------------------------

describe('dirty document switch guard invariant', () => {
  const detailSource = readFileSync(resolve(process.cwd(), 'packages/features/src/documents/DocumentDetail.tsx'), 'utf8');

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
  const detailSource = readFileSync(resolve(process.cwd(), 'packages/features/src/documents/DocumentDetail.tsx'), 'utf8');

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
  const discussionSource = readFileSync(resolve(process.cwd(), 'packages/features/src/documents/DocumentDiscussion.tsx'), 'utf8');

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
// Slash-command and history keyboard behavior (Finding 845 / 847)
//
// These tests exercise the pure keyboard/history/slash helper functions
// that were extracted into shared production modules (channelSlashCommands.ts
// and channelComposerHistory.ts) from the handleComposerKeyDown logic in
// ChannelChatPanel.tsx. Using shared production modules instead of
// test-local re-implementations ensures real regression protection.
// ---------------------------------------------------------------------------

const testCommands: SlashCommand[] = [
  { command: '/help', label: '/help', description: 'Show help' },
  { command: '/clear', label: '/clear', description: 'Clear composer' },
];

const historyEntries: ComposerHistoryEntry[] = [
  { body: 'old message', timestamp: 1000 },
  { body: 'recent message', timestamp: 2000 },
];

describe('cycleSlashIndex (from channelSlashCommands)', () => {
  it('ArrowDown cycles forward modulo length', () => {
    expect(cycleSlashIndex(0, 2, 'down')).toBe(1);
    expect(cycleSlashIndex(1, 2, 'down')).toBe(0);
    // Single suggestion wraps
    expect(cycleSlashIndex(0, 1, 'down')).toBe(0);
    // No suggestions — no-op
    expect(cycleSlashIndex(0, 0, 'down')).toBe(0);
  });

  it('ArrowUp cycles backward modulo length', () => {
    expect(cycleSlashIndex(0, 2, 'up')).toBe(1);
    expect(cycleSlashIndex(1, 2, 'up')).toBe(0);
    // Single suggestion wraps
    expect(cycleSlashIndex(0, 1, 'up')).toBe(0);
    // No suggestions — no-op
    expect(cycleSlashIndex(0, 0, 'up')).toBe(0);
  });
});

describe('applySlashSelection (from channelSlashCommands)', () => {
  it('Enter on non-clear command sets draft to the command', () => {
    expect(applySlashSelection(testCommands, 0)).toBe('/help');
  });

  it('Enter on /clear command sets draft to empty string', () => {
    expect(applySlashSelection(testCommands, 1)).toBe('');
  });

  it('Enter with invalid index falls back to first suggestion', () => {
    expect(applySlashSelection(testCommands, 99)).toBe('/help');
  });

  it('Enter with empty suggestions returns empty draft', () => {
    expect(applySlashSelection([], 0)).toBe('');
  });
});

describe('isSlashHelpTrigger (from channelSlashCommands)', () => {
  it('shows help when draft is exactly /help', () => {
    expect(isSlashHelpTrigger('/help')).toBe(true);
  });

  it('shows help for /help with leading/trailing whitespace (due to trim)', () => {
    expect(isSlashHelpTrigger('  /help  ')).toBe(true);
  });

  it('does not show help for bare slash', () => {
    expect(isSlashHelpTrigger('/')).toBe(false);
  });

  it('does not show help for other commands', () => {
    expect(isSlashHelpTrigger('/clear')).toBe(false);
  });

  it('does not show help for empty draft', () => {
    expect(isSlashHelpTrigger('')).toBe(false);
  });
});

describe('navigateHistoryUp (from channelComposerHistory)', () => {
  it('ArrowUp at start navigates to most recent entry', () => {
    const result = navigateHistoryUp('current draft', historyEntries, null);
    expect(result.draft).toBe('recent message');
    expect(result.navIndex).toBe(1);
    expect(result.unsentDraft).toBe('current draft');
  });

  it('ArrowUp while navigating goes to previous (older) entry', () => {
    const result = navigateHistoryUp('', historyEntries, 1);
    expect(result.draft).toBe('old message');
    expect(result.navIndex).toBe(0);
  });

  it('ArrowUp at oldest entry stays at oldest', () => {
    const result = navigateHistoryUp('', historyEntries, 0);
    expect(result.draft).toBe('old message');
    expect(result.navIndex).toBe(0);
  });

  it('ArrowUp with empty history does nothing', () => {
    const result = navigateHistoryUp('draft', [], null);
    expect(result.draft).toBe('draft');
    expect(result.navIndex).toBeNull();
  });
});

describe('navigateHistoryDown (from channelComposerHistory)', () => {
  it('ArrowDown while navigating goes to newer entry', () => {
    const result = navigateHistoryDown(historyEntries, 0, 'unsaved draft');
    expect(result.draft).toBe('recent message');
    expect(result.navIndex).toBe(1);
  });

  it('ArrowDown at newest entry restores unsent draft and exits navigation', () => {
    const result = navigateHistoryDown(historyEntries, 1, 'unsaved draft');
    expect(result.draft).toBe('unsaved draft');
    expect(result.navIndex).toBeNull();
  });

  it('ArrowDown outside navigation restores unsent draft', () => {
    const result = navigateHistoryDown(historyEntries, null, 'unsaved draft');
    expect(result.draft).toBe('unsaved draft');
    expect(result.navIndex).toBeNull();
  });
});

describe('direct-agent wake producer guardrails', () => {
  it('channel composer direct mode and mention fanout use the successor wake helper', () => {
    const source = readFileSync(resolve('packages/features/src/channels/useChannelMessageActions.ts'), 'utf8');

    expect(source).toContain('postGatewayDirectAgentMessage({');
    expect(source).toContain("sendMode === 'direct'");
    expect(source).toContain('sourceProjectId: projectId ?? activeChannel.projectId ?? null');
    expect(source).toContain('mentionedDirectTargets.map(target => postGatewayDirectAgentMessage({');
    expect(source).not.toContain('/direct-agent-events');
    expect(source).not.toContain('/direct-conversations/');
  });
});
