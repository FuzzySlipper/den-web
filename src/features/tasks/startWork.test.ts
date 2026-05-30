/**
 * Tests for sendTaskStartWork — the Start Work green-path logic.
 *
 * Coverage targets:
 *   - Unassigned task → blocked with clear explanation
 *   - Assigned + successful send → evidence returned
 *   - Missing membership → blocked with clear recovery hint
 *   - API failure during preflight → graceful error
 *   - API failure during send → graceful error
 *   - Non-active membership status → warning included
 */

/// <reference types="node" />
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ProjectTask } from '../../api/types';
import type { GatewayMemberships, GatewayDirectAgentMessage } from '../../api/gateway/types';

// We mock the gateway client to avoid real network calls.
const mockListGatewayMemberships = vi.fn();
const mockPostGatewayDirectAgentMessage = vi.fn();

vi.mock('../../api/client', () => ({
  listGatewayMemberships: (...args: unknown[]) => mockListGatewayMemberships(...args),
  postGatewayDirectAgentMessage: (...args: unknown[]) => mockPostGatewayDirectAgentMessage(...args),
}));

// Import after mocks are set up
const { sendTaskStartWork } = await import('./startWork');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ASSIGNED_TASK: ProjectTask = {
  id: 42,
  project_id: 'proj-demo',
  title: 'Add Start Work button',
  description: 'Implement the start work action in task detail.',
  status: 'planned',
  priority: 2,
  assigned_to: 'agent-worker-1',
  parent_id: null,
  tags: [],
  created_at: '2026-05-29T00:00:00Z',
  updated_at: '2026-05-29T00:00:00Z',
};

const UNASSIGNED_TASK: ProjectTask = {
  ...ASSIGNED_TASK,
  assigned_to: null,
};

const TASK_WITHOUT_PROJECT: ProjectTask = {
  ...ASSIGNED_TASK,
  project_id: '',
};

const MEMBERSHIPS_ACTIVE: GatewayMemberships = {
  channelId: 7,
  channelSlug: 'project-demo',
  channelKind: 'project',
  projectId: 'proj-demo',
  members: [
    {
      id: 1,
      memberType: 'agent',
      memberIdentity: 'agent-worker-1',
      membershipStatus: 'active',
      wakePolicy: 'wake',
      canSend: true,
      canReact: true,
      canInvite: false,
      cooldownSeconds: 60,
      maxAutoRepliesPerWindow: 5,
      settingsLabel: null,
    },
  ],
};

const MEMBERSHIPS_INACTIVE: GatewayMemberships = {
  ...MEMBERSHIPS_ACTIVE,
  members: [
    {
      ...MEMBERSHIPS_ACTIVE.members[0],
      membershipStatus: 'invited',
      canSend: false,
    },
  ],
};

const MEMBERSHIPS_NO_AGENT: GatewayMemberships = {
  ...MEMBERSHIPS_ACTIVE,
  members: [],
};

const DIRECT_AGENT_RESPONSE: GatewayDirectAgentMessage = {
  status: 'delivered',
  deliveryStatus: 'delivered',
  claimStatus: 'pending',
  completionStatus: 'pending',
  suppressionStatus: 'none',
  memberIdentity: 'agent-worker-1',
  wakePolicy: 'wake',
  messageId: 1001,
  channelId: 7,
  requestId: 'req-start-work-001',
  gatewayMessageUrl: 'https://gateway.den.local/messages/1001',
  gatewayEventsUrl: 'https://gateway.den.local/events/req-start-work-001',
  evidenceSummary: 'Message delivered to agent-worker-1 via channel 7.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendTaskStartWork — guard conditions', () => {
  it('returns blocked with recovery hint when task is unassigned', async () => {
    const ev = await sendTaskStartWork(UNASSIGNED_TASK);

    expect(ev.phase).toBe('failed');
    expect(ev.summary).toContain('not assigned');
    expect(ev.recoveryHint).toContain('Assign');
    expect(mockListGatewayMemberships).not.toHaveBeenCalled();
    expect(mockPostGatewayDirectAgentMessage).not.toHaveBeenCalled();
  });

  it('returns blocked when task has no project_id', async () => {
    const ev = await sendTaskStartWork(TASK_WITHOUT_PROJECT);

    expect(ev.phase).toBe('failed');
    expect(ev.summary).toContain('no project context');
    expect(ev.recoveryHint).toContain('Ensure the task belongs');
    expect(mockListGatewayMemberships).not.toHaveBeenCalled();
    expect(mockPostGatewayDirectAgentMessage).not.toHaveBeenCalled();
  });
});

describe('sendTaskStartWork — preflight failures', () => {
  it('returns blocked when listGatewayMemberships API fails', async () => {
    mockListGatewayMemberships.mockRejectedValue(new Error('Network error'));

    const ev = await sendTaskStartWork(ASSIGNED_TASK);

    expect(ev.phase).toBe('failed');
    expect(ev.summary).toContain('Could not check gateway memberships');
    expect(ev.recoveryHint).toContain('Den Channels/Gateway');
    expect(mockListGatewayMemberships).toHaveBeenCalledWith({ projectId: 'proj-demo' });
    expect(mockPostGatewayDirectAgentMessage).not.toHaveBeenCalled();
  });

  it('returns blocked when assigned agent is not a channel member', async () => {
    mockListGatewayMemberships.mockResolvedValue(MEMBERSHIPS_NO_AGENT);

    const ev = await sendTaskStartWork(ASSIGNED_TASK);

    expect(ev.phase).toBe('failed');
    expect(ev.summary).toContain('not a member');
    expect(ev.recoveryHint).toContain('Add');
    expect(ev.channelSlug).toBe('project-demo');
    expect(mockPostGatewayDirectAgentMessage).not.toHaveBeenCalled();
  });

  it('returns sent with warning when agent membership is not active', async () => {
    mockListGatewayMemberships.mockResolvedValue(MEMBERSHIPS_INACTIVE);
    mockPostGatewayDirectAgentMessage.mockResolvedValue(DIRECT_AGENT_RESPONSE);

    const ev = await sendTaskStartWork(ASSIGNED_TASK);

    expect(ev.phase).toBe('sent');
    expect(ev.warning).toBeDefined();
    expect(ev.warning).toContain('invited');
    expect(ev.deliveryStatus).toBe('delivered');
    expect(ev.messageId).toBe(1001);
  });
});

describe('sendTaskStartWork — send failures', () => {
  it('returns blocked when postGatewayDirectAgentMessage fails', async () => {
    mockListGatewayMemberships.mockResolvedValue(MEMBERSHIPS_ACTIVE);
    mockPostGatewayDirectAgentMessage.mockRejectedValue(new Error('500 Internal Server Error'));

    const ev = await sendTaskStartWork(ASSIGNED_TASK);

    expect(ev.phase).toBe('failed');
    expect(ev.summary).toContain('Failed to send wake message');
    expect(ev.error).toContain('500');
    expect(ev.recoveryHint).toContain('try again');
  });
});

describe('sendTaskStartWork — successful send', () => {
  it('returns sent with full evidence for assigned, active agent', async () => {
    mockListGatewayMemberships.mockResolvedValue(MEMBERSHIPS_ACTIVE);
    mockPostGatewayDirectAgentMessage.mockResolvedValue(DIRECT_AGENT_RESPONSE);

    const ev = await sendTaskStartWork(ASSIGNED_TASK);

    expect(ev.phase).toBe('sent');
    expect(ev.summary).toContain('agent-worker-1');
    expect(ev.summary).toContain('#project-demo');
    expect(ev.messageId).toBe(1001);
    expect(ev.channelId).toBe(7);
    expect(ev.requestId).toBe('req-start-work-001');
    expect(ev.deliveryStatus).toBe('delivered');
    expect(ev.claimStatus).toBe('pending');
    expect(ev.gatewayMessageUrl).toBe('https://gateway.den.local/messages/1001');
    expect(ev.evidenceSummary).toBe('Message delivered to agent-worker-1 via channel 7.');
    expect(ev.warning).toBeUndefined();

    // Verify the message body includes task context
    const sentArgs = mockPostGatewayDirectAgentMessage.mock.calls[0][0];
    expect(sentArgs.memberIdentity).toBe('agent-worker-1');
    expect(sentArgs.senderIdentity).toBe('web-ui');
    expect(sentArgs.channelId).toBe(7);
    expect(sentArgs.projectId).toBe('proj-demo');
    expect(sentArgs.body).toContain('Task #42');
    expect(sentArgs.body).toContain('Add Start Work button');
  });

  it('uses custom senderIdentity when provided', async () => {
    mockListGatewayMemberships.mockResolvedValue(MEMBERSHIPS_ACTIVE);
    mockPostGatewayDirectAgentMessage.mockResolvedValue(DIRECT_AGENT_RESPONSE);

    const ev = await sendTaskStartWork(ASSIGNED_TASK, 'den-bot');

    expect(ev.phase).toBe('sent');
    const sentArgs = mockPostGatewayDirectAgentMessage.mock.calls[0][0];
    expect(sentArgs.senderIdentity).toBe('den-bot');
  });
});
