import { describe, expect, it } from 'vitest';
import type { ChannelMessage, DesktopSessionEvent, DesktopSessionSnapshot, GatewayMember } from '../../api/types';
import {
  currentToolLabel,
  deriveSessionState,
  eventPayloadPreview,
  isCommandOrResultMessage,
  isLiveSession,
  messageEvidenceLink,
  safeEvidenceLink,
  sessionDisplayName,
  sessionModelProfile,
  statusDetail,
} from './sessionDisplayModel';

function snapshot(overrides: Partial<DesktopSessionSnapshot> = {}): DesktopSessionSnapshot {
  return {
    status: 'active',
    is_stale: false,
    exited_at: null,
    exit_code: 0,
    current_command: null,
    current_phase: null,
    session_id: 'sess-1',
    source_instance_id: 'inst-1',
    agent_identity: 'agent-x',
    display_name: null,
    title: null,
    ...overrides,
  } as DesktopSessionSnapshot;
}

function message(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: 1,
    channelId: 10,
    senderType: 'user',
    senderIdentity: 'patch',
    body: 'hello',
    messageKind: 'human_text',
    sourceKind: null,
    deepLink: null,
    metadataJson: null,
    createdAt: '2026-05-19T00:00:00Z',
    ...overrides,
  } as ChannelMessage;
}

const agentMember = { memberType: 'agent', membershipStatus: 'active' } as GatewayMember;

describe('isLiveSession', () => {
  it('is live for a fresh running session', () => {
    expect(isLiveSession(snapshot({ status: 'running' }))).toBe(true);
  });

  it('is not live when stale, exited, or in a terminal status', () => {
    expect(isLiveSession(snapshot({ is_stale: true }))).toBe(false);
    expect(isLiveSession(snapshot({ exited_at: '2026-05-19T00:00:00Z' }))).toBe(false);
    expect(isLiveSession(snapshot({ status: 'completed' }))).toBe(false);
  });
});

describe('deriveSessionState', () => {
  it('uses member presence when there is no snapshot', () => {
    expect(deriveSessionState(null, [agentMember])).toBe('active');
    expect(deriveSessionState(null, [])).toBe('queued');
  });

  it('maps snapshot signals to lane states', () => {
    expect(deriveSessionState(snapshot({ is_stale: true }), [])).toBe('stale');
    expect(deriveSessionState(snapshot({ status: 'crashed' }), [])).toBe('failed');
    expect(deriveSessionState(snapshot({ exit_code: 2 }), [])).toBe('failed');
    expect(deriveSessionState(snapshot({ status: 'reply posted' }), [])).toBe('replied');
    expect(deriveSessionState(snapshot({ status: 'running' }), [])).toBe('working');
    expect(deriveSessionState(snapshot({ status: 'queued' }), [])).toBe('queued');
    expect(deriveSessionState(snapshot({ status: 'idle' }), [])).toBe('active');
  });
});

describe('sessionModelProfile / sessionDisplayName', () => {
  it('joins model and profile from snapshot capability records', () => {
    const s = snapshot({ recent_activity: { model: 'opus', profile: 'fast' } as never });
    expect(sessionModelProfile(s)).toBe('opus / fast');
  });

  it('falls back to backend when no model/profile is present', () => {
    expect(sessionModelProfile(snapshot({ backend: 'hermes' } as never))).toBe('hermes');
  });

  it('prefers display name then title then agent identity then session id', () => {
    expect(sessionDisplayName(snapshot({ display_name: 'D' }))).toBe('D');
    expect(sessionDisplayName(snapshot({ display_name: null, title: 'T' }))).toBe('T');
    expect(sessionDisplayName(snapshot({ display_name: null, title: null, agent_identity: 'A' }))).toBe('A');
  });
});

describe('isCommandOrResultMessage', () => {
  it('flags slash commands and command/result source kinds', () => {
    expect(isCommandOrResultMessage(message({ body: '/new' }))).toBe(true);
    expect(isCommandOrResultMessage(message({ sourceKind: 'gateway_delivery' }))).toBe(true);
    expect(isCommandOrResultMessage(message({ messageKind: 'command' }))).toBe(true);
  });

  it('treats ordinary human text as conversation', () => {
    expect(isCommandOrResultMessage(message({ body: 'just chatting' }))).toBe(false);
  });
});

describe('eventPayloadPreview', () => {
  it('falls back to reason when no payload', () => {
    expect(eventPayloadPreview({ payload: null, reason: 'why' } as DesktopSessionEvent)).toBe('why');
  });

  it('extracts concise keys from a JSON payload', () => {
    const preview = eventPayloadPreview({ payload: JSON.stringify({ status: 'ok', noise: 1 }) } as DesktopSessionEvent);
    expect(preview).toContain('status');
    expect(preview).not.toContain('noise');
  });
});

describe('currentToolLabel', () => {
  it('prefers the snapshot current command', () => {
    expect(currentToolLabel(snapshot({ current_command: 'bash' }), [])).toBe('bash');
  });

  it('scans events for a tool when the snapshot has none', () => {
    const event = { payload: JSON.stringify({ tool: 'grep' }) } as DesktopSessionEvent;
    expect(currentToolLabel(snapshot({ current_command: null }), [event])).toBe('grep');
  });

  it('reports no signal when nothing is available', () => {
    expect(currentToolLabel(null, [])).toBe('No current tool signal');
  });
});

describe('statusDetail', () => {
  it('explains the missing-snapshot case', () => {
    expect(statusDetail(null)).toContain('no durable active-owner session snapshot');
  });

  it('joins present status fields', () => {
    expect(statusDetail(snapshot({ status: 'running', current_phase: 'build', exit_code: null }))).toBe('running · phase build');
  });

  it('includes a non-null exit code', () => {
    expect(statusDetail(snapshot({ status: 'exited', current_phase: null, exit_code: 0 }))).toBe('exited · exit 0');
  });
});

describe('safeEvidenceLink / messageEvidenceLink', () => {
  it('allows root-relative and http(s)/den links', () => {
    expect(safeEvidenceLink('/api/x')).toBe('/api/x');
    expect(safeEvidenceLink('https://x')).toBe('https://x');
    expect(safeEvidenceLink('den:foo')).toBe('den:foo');
  });

  it('rejects protocol-relative and unknown schemes', () => {
    expect(safeEvidenceLink('//evil')).toBeNull();
    expect(safeEvidenceLink('javascript:alert(1)')).toBeNull();
    expect(safeEvidenceLink(null)).toBeNull();
  });

  it('falls back to a gateway message link', () => {
    expect(messageEvidenceLink(message({ id: 7, deepLink: null }))).toBe('/api/gateway/messages/7');
    expect(messageEvidenceLink(message({ id: 7, deepLink: '/deep' }))).toBe('/deep');
  });
});
