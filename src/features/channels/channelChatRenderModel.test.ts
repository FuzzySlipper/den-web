/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentWorkLifecycleEvent, ChannelActivityEvent, ChannelMessage } from '../../api/types';
import {
  activityMatchesChannelMessage,
  channelMessageDeliveryRequestId,
  channelMessagePrimaryBody,
  deriveAssignmentBadge,
  directAgentMessageDisplay,
  findActiveMentionQuery,
  getMentionSuggestions,
  groupActivityEventsForChannelMessages,
  insertMentionToken,
  messageHasCheckpointMetadata,
  parseMessageBodySegments,
  piCrewAgentWorkActivityEventsFromLifecycleEvents,
  piCrewDelegationActivityEventsFromMessages,
  sortActivityEvents,
  toActivityDisplayModel,
} from './channelChatRenderModel';

function activity(overrides: Partial<ChannelActivityEvent>): ChannelActivityEvent {
  return {
    id: 1,
    channelId: 10,
    projectId: 'den-channels',
    agentIdentity: 'den-mcp-runner',
    deliveryRequestId: null,
    hermesSessionKey: null,
    displayBlockId: null,
    parentHermesSessionKey: null,
    parentAgentIdentity: null,
    workerRunId: null,
    workerRole: null,
    taskId: null,
    threadId: null,
    anchorMessageId: null,
    eventType: 'tool_call_completed',
    status: 'completed',
    deliveryStage: 'progress',
    terminal: false,
    sequence: 1,
    updateVersion: 1,
    title: null,
    summary: null,
    previewJson: null,
    metadataJson: null,
    dedupeKey: null,
    finalChannelMessageId: null,
    createdAt: '2026-05-19T00:00:00Z',
    updatedAt: '2026-05-19T00:00:00Z',
    ...overrides,
  };
}

function channelMessage(overrides: Partial<ChannelMessage>): ChannelMessage {
  const base: ChannelMessage = {
    id: 42,
    channelId: 10,
    senderType: 'agent',
    senderIdentity: 'den-mcp-runner',
    body: 'final answer',
    messageKind: 'agent_text',
    sourceKind: 'gateway_delivery',
    sourceId: '228',
    sourceProjectId: 'den-channels',
    summary: null,
    deepLink: null,
    threadRootMessageId: null,
    replyToMessageId: null,
    metadataJson: null,
    deliveryRequestId: null,
    dedupeKey: 'gateway-delivery:228:final',
    finalChannelMessageId: null,
    createdAt: '2026-05-19T00:00:00Z',
    editedAt: null,
    deletedAt: null,
  };
  return { ...base, ...overrides };
}

const message = channelMessage;

describe('parseMessageBodySegments', () => {
  it('turns details/summary artifacts into disclosure segments without raw tag clutter', () => {
    const segments = parseMessageBodySegments('Before\n<details>\n<summary>What I would propose</summary>\n\n1. Take #1308\n2. Store findings\n</details>\nAfter');

    expect(segments).toEqual([
      { type: 'text', text: 'Before\n' },
      { type: 'details', summary: 'What I would propose', body: '1. Take #1308\n2. Store findings' },
      { type: 'text', text: '\nAfter' },
    ]);
  });
});

describe('direct agent message display', () => {
  it('uses the human request body as primary content when a wake event also has a generated summary', () => {
    const msg = channelMessage({
      senderType: 'user',
      senderIdentity: 'Patch',
      body: 'lol. Can you add a task for that to den-web? runner is still working through them',
      messageKind: 'human_text',
      sourceKind: 'wake_event',
      sourceId: 'direct-agent-message:672:den-mcp-planner:76c86c5c61e342dab98b2048d642c1fa',
      summary: 'Direct delivery recorded for den-mcp-planner; waiting for claim/completion',
      metadataJson: JSON.stringify({ deliveryMode: 'direct_agent_message', targetMemberIdentity: 'den-mcp-planner' }),
    });

    const display = directAgentMessageDisplay(msg);

    expect(display.isDirectAgentWake).toBe(true);
    expect(display.primaryBody).toBe('lol. Can you add a task for that to den-web? runner is still working through them');
    expect(channelMessagePrimaryBody(msg)).toBe(display.primaryBody);
    expect(display.deliverySummary).toBeNull();
  });

  it('recovers the request body from direct-agent metadata before falling back to generated status', () => {
    const msg = channelMessage({
      body: '',
      sourceKind: 'wake_event',
      sourceId: 'direct-agent-message:672:den-mcp-planner:request-1',
      summary: 'Direct delivery recorded for den-mcp-planner; waiting for claim/completion',
      metadataJson: JSON.stringify({ requestBody: 'Please handle the real request text', deliveryMode: 'direct_agent_message' }),
    });

    expect(directAgentMessageDisplay(msg)).toMatchObject({
      primaryBody: 'Please handle the real request text',
      deliverySummary: null,
      isDirectAgentWake: true,
    });
  });

  it('does not promote generated direct-agent status to the primary body when the request body is missing', () => {
    const msg = channelMessage({
      body: '',
      sourceKind: 'wake_event',
      sourceId: 'direct-agent-message:672:den-mcp-planner:request-2',
      summary: 'Direct delivery recorded for den-mcp-planner; waiting for claim/completion',
      metadataJson: null,
    });

    expect(directAgentMessageDisplay(msg)).toMatchObject({
      primaryBody: '',
      deliverySummary: null,
      isDirectAgentWake: true,
    });
  });

  it('keeps ordinary summary fallback available for non-wake messages without a body', () => {
    const msg = channelMessage({ body: '', sourceKind: null, sourceId: null, summary: 'ordinary imported summary' });

    expect(directAgentMessageDisplay(msg)).toMatchObject({
      primaryBody: 'ordinary imported summary',
      deliverySummary: null,
      isDirectAgentWake: false,
    });
  });
});

describe('channel chat panel sizing contract', () => {
  const layoutCss = readFileSync(resolve(process.cwd(), 'src/styles/layout.css'), 'utf8');
  const chCss = readFileSync(resolve(process.cwd(), 'src/styles/features/channels.css'), 'utf8');

  it('keeps size controls as viewport-relative chat expansion presets', () => {
    expect(layoutCss).toMatch(/\.dashboard-channel-size-small \{\s*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*minmax\(200px,\s*25vh\);/);
    expect(layoutCss).toMatch(/\.dashboard-channel-size-medium \{\s*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*minmax\(200px,\s*50vh\);/);
    expect(layoutCss).toMatch(/\.dashboard-channel-size-large \{\s*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*minmax\(200px,\s*80vh\);/);
    expect(chCss).toMatch(/@media\s*\(max-width:\s*900px\)\s*\{\s*\.dashboard-channel-size-large\s*\{\s*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*minmax\(200px,\s*55vh\);/);
    expect(layoutCss).not.toMatch(/\.dashboard-channel-size-small \{\s*grid-template-rows: minmax\(0, 1fr\) 230px;/);
    expect(layoutCss).not.toMatch(/\.dashboard-channel-size-medium \{\s*grid-template-rows: minmax\(0, 1fr\) 300px;/);
    expect(layoutCss).not.toMatch(/\.dashboard-channel-size-large \{\s*grid-template-rows: minmax\(0, 1fr\) 420px;/);
  });
});

describe('activity/message delivery matching', () => {
  it('resolves delivery ids from final gateway messages without terminalizing anything in the UI', () => {
    expect(channelMessageDeliveryRequestId(channelMessage({}))).toBe('228');
    expect(channelMessageDeliveryRequestId(channelMessage({
      sourceId: null,
      dedupeKey: null,
      metadataJson: JSON.stringify({ delivery_request_id: 229 }),
    }))).toBe('229');
  });

  it('detects checkpoint metadata keys for assignment badges', () => {
    expect(messageHasCheckpointMetadata(message({ metadataJson: JSON.stringify({ checkpoint_status: 'success' }) }))).toBe(true);
    expect(messageHasCheckpointMetadata(message({ metadataJson: JSON.stringify({ assignment_checkpoint: { sequence: 2 } }) }))).toBe(true);
    expect(messageHasCheckpointMetadata(message({ metadataJson: JSON.stringify({ deliveryRequestId: 'del-1' }) }))).toBe(false);
    expect(messageHasCheckpointMetadata(message({ metadataJson: 'not json' }))).toBe(false);
  });

  it('derives assignment badge labels from delivery ids, checkpoints, and final delivery metadata', () => {
    expect(deriveAssignmentBadge(message({
      deliveryRequestId: 'first-class-delivery',
      sourceKind: 'agent_message',
      sourceId: null,
      dedupeKey: null,
    }))).toEqual({
      assignmentId: 'first-class-delivery',
      hasCheckpointMetadata: false,
      isFinalDelivery: false,
      label: 'delivery',
    });

    expect(deriveAssignmentBadge(message({
      deliveryRequestId: null,
      sourceKind: 'external_adapter_message',
      sourceId: 'source-delivery',
      dedupeKey: null,
      metadataJson: JSON.stringify({ checkpoint_sequence: 4 }),
    }))).toEqual({
      assignmentId: 'source-delivery',
      hasCheckpointMetadata: true,
      isFinalDelivery: false,
      label: 'checkpoint',
    });

    expect(deriveAssignmentBadge(message({
      deliveryRequestId: null,
      sourceKind: 'gateway_delivery',
      sourceId: '228',
      dedupeKey: 'gateway-delivery:228:final',
      metadataJson: JSON.stringify({ checkpoint_status: 'success' }),
    }))).toEqual({
      assignmentId: '228',
      hasCheckpointMetadata: true,
      isFinalDelivery: true,
      label: 'final',
    });

    expect(deriveAssignmentBadge(message({
      deliveryRequestId: null,
      sourceKind: 'agent_message',
      sourceId: null,
      dedupeKey: null,
      metadataJson: null,
    }))).toBeNull();
  });

  it('matches unanchored activity to the visible final message by delivery id', () => {
    const message = channelMessage({ id: 398, sourceId: '228', dedupeKey: 'gateway-delivery:228:final' });

    expect(activityMatchesChannelMessage(activity({ deliveryRequestId: '228', anchorMessageId: null }), message)).toBe(true);
    expect(activityMatchesChannelMessage(activity({ deliveryRequestId: '999', finalChannelMessageId: 398 }), message)).toBe(true);
    expect(activityMatchesChannelMessage(activity({ deliveryRequestId: '999', anchorMessageId: null }), message)).toBe(false);
  });
});

describe('toActivityDisplayModel', () => {
  it('shows coalesced tool entries such as skill_view den-mcp x2', () => {
    const model = toActivityDisplayModel(activity({
      title: 'skill_view: "den-mcp"',
      metadataJson: JSON.stringify({ count: 2, toolName: 'skill_view: "den-mcp"' }),
      previewJson: JSON.stringify({ preview: 'Loaded den-mcp reference' }),
      taskId: 1528,
    }));

    expect(model.title).toBe('skill_view: "den-mcp"');
    expect(model.count).toBe(2);
    expect(model.preview).toBe('Loaded den-mcp reference');
    expect(model.taskId).toBe(1528);
    expect(model.deliveryStage).toBe('progress');
    expect(model.terminal).toBe(false);
  });

  it('surfaces terminal delivery metadata separately from progress rows', () => {
    const model = toActivityDisplayModel(activity({
      status: 'completed',
      deliveryStage: 'final',
      terminal: true,
      finalChannelMessageId: 4242,
    }));

    expect(model.deliveryStage).toBe('final');
    expect(model.terminal).toBe(true);
    expect(model.finalChannelMessageId).toBe(4242);
  });

  it('truncates long terminal previews for compact timeline rows', () => {
    const model = toActivityDisplayModel(activity({
      title: 'terminal',
      previewJson: JSON.stringify({ command: `pytest ${'very-long-output '.repeat(30)}` }),
    }));

    expect(model.preview?.length).toBeLessThanOrEqual(180);
    expect(model.preview?.endsWith('…')).toBe(true);
  });

  it('preserves camelCase display block, worker, and parent fields for spawned worker headers', () => {
    const model = toActivityDisplayModel(activity({
      displayBlockId: 'parent-1567',
      workerRunId: 'coder-1567',
      workerRole: 'coder',
      parentAgentIdentity: 'orchestrator',
      parentHermesSessionKey: 'parent-session-1567',
    }));

    expect(model.displayBlockId).toBe('parent-1567');
    expect(model.workerRunId).toBe('coder-1567');
    expect(model.workerRole).toBe('coder');
    expect(model.parentAgentIdentity).toBe('orchestrator');
    expect(model.parentHermesSessionKey).toBe('parent-session-1567');
    expect('displayDeliveryRequestId' in (model as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe('activity/message grouping', () => {
  it('matches displayBlockId to a final message first-class deliveryRequestId even when child deliveryRequestId differs', () => {
    const parentMessage = message({ id: 42, deliveryRequestId: 'parent-1567' });
    const childEvent = activity({ deliveryRequestId: 'coder-1567', displayBlockId: 'parent-1567', workerRunId: 'coder-1567' });

    expect(activityMatchesChannelMessage(childEvent, parentMessage)).toBe(true);
  });

  it('keeps existing deliveryRequestId matching and legacy fallback matching working', () => {
    const firstClassMessage = message({ id: 42, deliveryRequestId: 'first-class-delivery' });
    const legacyMetadataMessage = message({ id: 43, deliveryRequestId: null, metadataJson: JSON.stringify({ deliveryRequestId: 'metadata-delivery' }) });
    const legacyDedupeMessage = message({ id: 44, deliveryRequestId: null, metadataJson: null, dedupeKey: 'gateway-delivery:dedupe-delivery:final' });

    expect(activityMatchesChannelMessage(activity({ deliveryRequestId: 'first-class-delivery' }), firstClassMessage)).toBe(true);
    expect(activityMatchesChannelMessage(activity({ deliveryRequestId: 'metadata-delivery' }), legacyMetadataMessage)).toBe(true);
    expect(activityMatchesChannelMessage(activity({ displayBlockId: 'dedupe-delivery' }), legacyDedupeMessage)).toBe(true);
    expect(channelMessageDeliveryRequestId(legacyDedupeMessage)).toBe('dedupe-delivery');
  });

  it('matches explicit anchors and final channel message metadata', () => {
    const parentMessage = message({ id: 42, deliveryRequestId: null });

    expect(activityMatchesChannelMessage(activity({ anchorMessageId: 42 }), parentMessage)).toBe(true);
    expect(activityMatchesChannelMessage(activity({ metadataJson: JSON.stringify({ finalChannelMessageId: 42 }) }), parentMessage)).toBe(true);
  });

  it('attaches coder/reviewer displayBlockId activity to an interim block when no final parent message exists', () => {
    const grouped = groupActivityEventsForChannelMessages([], [
      activity({ id: 1, deliveryRequestId: 'coder-1567', displayBlockId: 'parent-1567', workerRunId: 'coder-1567', workerRole: 'coder', createdAt: '2026-05-19T00:00:02Z' }),
      activity({ id: 2, deliveryRequestId: 'reviewer-1567', displayBlockId: 'parent-1567', workerRunId: 'reviewer-1567', workerRole: 'reviewer', createdAt: '2026-05-19T00:00:01Z' }),
      activity({ id: 3 }),
    ]);

    expect(grouped.byMessageId.size).toBe(0);
    expect(grouped.displayBlocks).toHaveLength(1);
    expect(grouped.displayBlocks[0].displayBlockId).toBe('parent-1567');
    expect(grouped.displayBlocks[0].events.map(event => event.id)).toEqual([2, 1]);
    expect(grouped.displayBlocks[0].events.map(event => event.workerRunId)).toEqual(['reviewer-1567', 'coder-1567']);
    expect(grouped.unanchoredEvents.map(event => event.id)).toEqual([3]);
  });

  it('consumes coder/reviewer displayBlockId activity into the final parent delivery message', () => {
    const parentMessage = message({ id: 42, deliveryRequestId: 'parent-1567' });
    const grouped = groupActivityEventsForChannelMessages([parentMessage], [
      activity({ id: 1, deliveryRequestId: 'coder-1567', displayBlockId: 'parent-1567', workerRunId: 'coder-1567', workerRole: 'coder', createdAt: '2026-05-19T00:00:02Z' }),
      activity({ id: 2, deliveryRequestId: 'reviewer-1567', displayBlockId: 'parent-1567', workerRunId: 'reviewer-1567', workerRole: 'reviewer', createdAt: '2026-05-19T00:00:01Z' }),
    ]);

    expect(grouped.byMessageId.get(42)?.map(event => event.id)).toEqual([2, 1]);
    expect(grouped.byMessageId.get(42)?.map(event => event.workerRunId)).toEqual(['reviewer-1567', 'coder-1567']);
    expect(grouped.displayBlocks).toEqual([]);
    expect(grouped.unanchoredEvents).toEqual([]);
  });

  it('orders cross-worker activity by createdAt while sequence remains per workerRunId', () => {
    const sorted = sortActivityEvents([
      activity({ id: 3, workerRunId: 'run-a', sequence: 2, createdAt: '2026-05-19T00:00:01Z' }),
      activity({ id: 2, workerRunId: 'run-b', sequence: 1, createdAt: '2026-05-19T00:00:00Z' }),
      activity({ id: 1, workerRunId: 'run-a', sequence: 1, createdAt: '2026-05-19T00:00:01Z' }),
    ]);

    expect(sorted.map(event => event.id)).toEqual([2, 1, 3]);
  });
});


function lifecycleEvent(overrides: Partial<AgentWorkLifecycleEvent>): AgentWorkLifecycleEvent {
  return {
    id: 149725,
    channelId: 642,
    projectId: 'pi-crew',
    taskId: null,
    agentIdentity: 'pi-orchestrator',
    eventType: 'runtime_received',
    state: 'started',
    workerRunId: null,
    assignmentId: null,
    deliveryRequestId: null,
    sessionId: null,
    evidenceLink: '/channels/642/messages/4977',
    summary: 'pi-crew runtime_received direct-agent event 4977',
    createdAt: '2026-06-12T12:04:26Z',
    ...overrides,
  };
}

describe('pi-crew delegation channel-message activity', () => {
  const projectionMessage = (id: number, eventName: string, details: Record<string, unknown>) => message({
    id,
    channelId: 642,
    senderIdentity: 'pi-crew-runner',
    body: `**${eventName}**`,
    messageKind: 'agent_text',
    sourceKind: 'pi_crew_projection',
    sourceId: `projection-${id}`,
    sourceProjectId: 'pi-crew',
    metadataJson: JSON.stringify({ eventName, ...details }),
    createdAt: `2026-06-12T09:00:0${id - 4788}Z`,
  });

  it('turns pi-crew delegation projection messages into grouped activity breadcrumbs', () => {
    const events = piCrewDelegationActivityEventsFromMessages([
      projectionMessage(4789, 'delegation.spawned', {
        childSessionId: 'delegated-session-1',
        parentSessionId: 'parent-session-1',
        rootSessionId: 'root-session-1',
        profileId: 'pi-crew-coder',
      }),
      projectionMessage(4791, 'delegation.tool_visible', {
        childSessionId: 'delegated-session-1',
        parentSessionId: 'parent-session-1',
        phase: 'called',
        toolName: 'get_task_workflow_summary',
        toolCallId: 'yz9iPxkh1op9uMYQ70EZ3EGY9yiS4Ncr',
      }),
      projectionMessage(4792, 'delegation.tool_visible', {
        childSessionId: 'delegated-session-1',
        parentSessionId: 'parent-session-1',
        phase: 'completed',
        toolName: 'get_task_workflow_summary',
        toolCallId: 'yz9iPxkh1op9uMYQ70EZ3EGY9yiS4Ncr',
        durationMs: 20,
      }),
      projectionMessage(4793, 'delegation.completed', {
        childSessionId: 'delegated-session-1',
        outcome: 'success',
        turnsUsed: 2,
        tokensConsumed: 1234,
      }),
    ]);

    expect(events).toHaveLength(4);
    expect(events.map(event => event.displayBlockId)).toEqual([
      'pi-crew-delegation:delegated-session-1',
      'pi-crew-delegation:delegated-session-1',
      'pi-crew-delegation:delegated-session-1',
      'pi-crew-delegation:delegated-session-1',
    ]);
    expect(events.map(event => toActivityDisplayModel(event).title)).toEqual([
      'Subagent spawned · delegated-session-1',
      'Tool called · get_task_workflow_summary',
      'Tool completed · get_task_workflow_summary',
      'Subagent completed · success',
    ]);
    expect(toActivityDisplayModel(events[2])).toMatchObject({
      toolName: 'get_task_workflow_summary',
      toolCallId: 'yz9iPxkh1op9uMYQ70EZ3EGY9yiS4Ncr',
      durationMs: 20,
      sourceMessageId: 4792,
      status: 'tool_completed',
    });
    expect(toActivityDisplayModel(events[3])).toMatchObject({ terminal: true, finalChannelMessageId: null, sourceMessageId: 4793 });

    const grouped = groupActivityEventsForChannelMessages([], events);
    expect(grouped.displayBlocks).toHaveLength(1);
    expect(grouped.displayBlocks[0].events.map(event => event.id)).toEqual([-4789, -4791, -4792, -4793]);
  });

  it('parses live pi-crew delegation bodies without metadata and keeps them in their own activity bubble', () => {
    const liveMessage = message({
      id: 4928,
      channelId: 642,
      senderIdentity: 'pi-crew-service',
      body: '**delegation.tool_visible**\nSubagent tool called: query_librarian\n- childSessionId: `delegated-session-2`\n- phase: `called`\n- toolName: `query_librarian`\n- toolCallId: `call_00_FslvhwHwyXzYnMZhK5SJ9029`\n- coalescedToolCallCount: `157`\n- coalescedCompletedCount: `76`',
      messageKind: 'agent_text',
      sourceKind: 'gateway_delivery',
      sourceId: 'http-delivery-1781264296219',
      deliveryRequestId: 'http-delivery-1781264296219',
      metadataJson: null,
    });

    const events = piCrewDelegationActivityEventsFromMessages([liveMessage]);
    expect(events).toHaveLength(1);
    expect(events[0].deliveryRequestId).toBeNull();
    expect(events[0].finalChannelMessageId).toBeNull();

    const model = toActivityDisplayModel(events[0]);
    expect(model).toMatchObject({
      title: 'Tool called · query_librarian',
      childSessionId: 'delegated-session-2',
      toolName: 'query_librarian',
      toolCallId: 'call_00_FslvhwHwyXzYnMZhK5SJ9029',
      status: 'tool_called',
      sourceMessageId: 4928,
    });

    const grouped = groupActivityEventsForChannelMessages([liveMessage], events);
    expect(grouped.byMessageId.size).toBe(0);
    expect(grouped.displayBlocks).toHaveLength(1);
    expect(grouped.displayBlocks[0].displayBlockId).toBe('pi-crew-delegation:delegated-session-2');
  });

  it('keeps native pi-crew agent activity as a standalone activity bubble instead of appending to the final Hermes message', () => {
    const finalMessage = message({ id: 4801, deliveryRequestId: '4757' });
    const piActivity = activity({
      id: 149115,
      agentIdentity: 'pi-crew-runner',
      deliveryRequestId: '4757',
      eventType: 'tool_call_completed',
      title: 'patch',
      createdAt: '2026-06-12T09:00:12Z',
    });

    expect(activityMatchesChannelMessage(piActivity, finalMessage)).toBe(true);
    const grouped = groupActivityEventsForChannelMessages([finalMessage], [piActivity]);
    expect(grouped.byMessageId.size).toBe(0);
    expect(grouped.displayBlocks).toHaveLength(1);
    expect(grouped.displayBlocks[0].displayBlockId).toBe('pi-crew-agent:pi-crew-runner:4757');
  });

  it('does not promote arbitrary non-pi delegation-looking messages or non-pi native activity into standalone pi bubbles', () => {
    const finalMessage = message({ id: 5001, deliveryRequestId: 'delivery-1' });
    const ordinaryMessage = message({
      id: 5002,
      senderIdentity: 'den-mcp-runner',
      sourceProjectId: 'den-web',
      body: '**delegation.tool_visible**\n- childSessionId: `not-pi`',
    });
    const ordinaryActivity = activity({
      id: 5003,
      agentIdentity: 'den-mcp-runner',
      deliveryRequestId: 'delivery-1',
    });

    expect(piCrewDelegationActivityEventsFromMessages([ordinaryMessage])).toEqual([]);
    const grouped = groupActivityEventsForChannelMessages([finalMessage], [ordinaryActivity]);
    expect(grouped.byMessageId.get(5001)?.map(event => event.id)).toEqual([5003]);
    expect(grouped.displayBlocks).toEqual([]);
  });

  it('creates pi-crew parent lifecycle bubbles from agent-work lifecycle events', () => {
    const events = piCrewAgentWorkActivityEventsFromLifecycleEvents([
      lifecycleEvent({ id: 149725, eventType: 'runtime_received', state: 'started', evidenceLink: '/channels/642/messages/4965' }),
      lifecycleEvent({ id: 149729, eventType: 'completed', state: 'completed', evidenceLink: '/channels/642/messages/4965' }),
      lifecycleEvent({ id: 999, projectId: 'den-web', agentIdentity: 'den-mcp-runner', eventType: 'runtime_received', state: 'started' }),
    ]);

    expect(events).toHaveLength(2);
    expect(events.map(event => event.displayBlockId)).toEqual([
      'pi-crew-agent:pi-orchestrator:4965',
      'pi-crew-agent:pi-orchestrator:4965',
    ]);
    expect(events[0]).toMatchObject({
      anchorMessageId: 4965,
      title: 'runtime received',
      terminal: false,
      deliveryRequestId: null,
    });
    expect(events[1]).toMatchObject({
      anchorMessageId: 4965,
      title: 'completed',
      terminal: true,
      deliveryStage: 'final',
    });
  });

  it('renders structured pi-crew parent/delegation/tool agent-work rows without debug channel messages', () => {
    const events = piCrewAgentWorkActivityEventsFromLifecycleEvents([
      lifecycleEvent({
        id: 'parent-1',
        agentIdentity: 'prime-coder',
        source: 'pi-crew',
        eventFamily: 'parent',
        eventType: 'pi_crew.parent.turn_started',
        state: null,
        status: 'completed',
        sessionId: 'sess-prime-coder',
        profileId: 'prime-coder',
        evidenceLink: null,
      }),
      lifecycleEvent({
        id: 'child-1',
        agentIdentity: null,
        source: 'pi-crew',
        eventFamily: 'delegation',
        eventType: 'pi_crew.delegation.spawned',
        state: 'started',
        parentAgentIdentity: 'pi-orchestrator',
        parentSessionId: 'sess-pi-orchestrator',
        rootSessionId: 'sess-pi-orchestrator',
        childSessionId: 'delegated-session-7',
        profileId: 'coder-worker',
        provider: 'den-router',
        model: 'minimax',
      }),
      lifecycleEvent({
        id: 'tool-1',
        agentIdentity: null,
        source: 'pi-crew',
        eventFamily: 'tool',
        eventType: 'pi_crew.delegation.tool_called',
        state: 'completed',
        toolName: 'get_task',
        toolCallId: 'call-1',
        ownerSessionId: 'delegated-session-7',
        durationMs: 17,
      }),
    ]);

    expect(events.map(event => event.displayBlockId)).toEqual([
      'pi-crew-agent:prime-coder:sess-prime-coder',
      'pi-crew-delegation:delegated-session-7',
      'pi-crew-delegation:delegated-session-7',
    ]);
    expect(events[0]).toMatchObject({ status: 'completed', terminal: true, deliveryStage: 'final' });
    expect(toActivityDisplayModel(events[1])).toMatchObject({
      childSessionId: 'delegated-session-7',
      parentSessionId: 'sess-pi-orchestrator',
      profileId: 'coder-worker',
      status: 'spawned',
    });
    expect(toActivityDisplayModel(events[2])).toMatchObject({
      childSessionId: 'delegated-session-7',
      toolName: 'get_task',
      toolCallId: 'call-1',
      durationMs: 17,
      status: 'tool_completed',
    });
  });

  it('renders canonical Den Channels metadata-only lifecycle rows without pi-crew admin fallback fields', () => {
    const events = piCrewAgentWorkActivityEventsFromLifecycleEvents([
      lifecycleEvent({
        id: 156509,
        eventType: 'heartbeat',
        state: null,
        status: 'started',
        source: null,
        eventFamily: null,
        metadata: {
          source: 'pi-crew',
          eventFamily: 'delegation',
          piCrewEventType: 'delegation.spawned',
          childSessionId: 'delegated-session-canonical',
          parentSessionId: 'sess-parent',
          rootSessionId: 'sess-root',
          profileId: 'prime-coder',
          depth: 1,
          tokensConsumed: 123,
          artifactCount: 1,
        },
      }),
      lifecycleEvent({
        id: 156510,
        eventType: 'heartbeat',
        state: null,
        status: 'completed',
        source: null,
        eventFamily: null,
        metadata: {
          source: 'pi-crew',
          eventFamily: 'tool',
          piCrewEventType: 'tool.completed',
          childSessionId: 'delegated-session-canonical',
          toolName: 'list_assignments',
          toolCallId: 'tool-canonical',
          durationMs: 77,
          isError: false,
          resultClass: 'success',
        },
      }),
    ]);

    expect(events).toHaveLength(2);
    expect(events.map(event => event.displayBlockId)).toEqual([
      'pi-crew-delegation:delegated-session-canonical',
      'pi-crew-delegation:delegated-session-canonical',
    ]);
    expect(toActivityDisplayModel(events[0])).toMatchObject({
      childSessionId: 'delegated-session-canonical',
      parentSessionId: 'sess-parent',
      profileId: 'prime-coder',
      status: 'spawned',
    });
    expect(toActivityDisplayModel(events[1])).toMatchObject({
      toolName: 'list_assignments',
      toolCallId: 'tool-canonical',
      durationMs: 77,
      status: 'tool_completed',
    });
  });

  it('summarizes child delegation from pi-crew final replies when service debug projection messages are suppressed', () => {
    const finalReply = message({
      id: 4979,
      channelId: 642,
      senderIdentity: 'pi-orchestrator',
      body: 'Retry completed, but **review is still not approval-quality**.\n\n- Parent session: `sess-pi-orchestrator`\n- Delegated child: `delegated-session-1`\n- Child outcome: `success` wrapper only\n- Child `toolsUsed`:\n  - `get_task`\n  - `list_review_rounds`',
      metadataJson: null,
    });

    const events = piCrewDelegationActivityEventsFromMessages([finalReply]);
    expect(events).toHaveLength(1);
    const model = toActivityDisplayModel(events[0]);
    expect(model).toMatchObject({
      displayBlockId: 'pi-crew-delegation:delegated-session-1',
      childSessionId: 'delegated-session-1',
      sourceMessageId: 4979,
      terminal: true,
    });
    expect(model.preview).toContain('tools used get_task, list_review_rounds');
    const nonSessionReply = message({
      id: 4983,
      channelId: 642,
      senderIdentity: 'pi-orchestrator',
      body: 'Final result:\n- Delegated child wrapper only\n- Child `evidenceChecked`: `false`',
      metadataJson: null,
    });

    expect(piCrewDelegationActivityEventsFromMessages([nonSessionReply])).toEqual([]);
  });

  it('keeps parent final toolsUsed searchable and displayable from metadata', () => {
    const events = piCrewDelegationActivityEventsFromMessages([
      projectionMessage(4794, 'delegation.completed', {
        childSessionId: 'delegated-session-1',
        outcome: 'success',
        toolsUsed: ['get_task_workflow_summary'],
      }),
    ]);

    const model = toActivityDisplayModel(events[0]);
    expect(model.preview).toContain('tools used get_task_workflow_summary');
    expect(model.sourceMessageId).toBe(4794);
  });
});


describe('mention suggestions', () => {
  const members = [
    {
      id: 1,
      memberType: 'user',
      memberIdentity: 'patch',
      membershipStatus: 'active',
      wakePolicy: 'never',
      canSend: true,
      canReact: true,
      canInvite: false,
      cooldownSeconds: 60,
      maxAutoRepliesPerWindow: 1,
      settingsLabel: null,
    },
    {
      id: 2,
      memberType: 'agent',
      memberIdentity: 'den-desktop-runner',
      membershipStatus: 'active',
      wakePolicy: 'mentions_only',
      canSend: true,
      canReact: true,
      canInvite: false,
      cooldownSeconds: 60,
      maxAutoRepliesPerWindow: 1,
      settingsLabel: null,
    },
    {
      id: 3,
      memberType: 'agent',
      memberIdentity: 'muted-agent',
      membershipStatus: 'left',
      wakePolicy: 'mentions_only',
      canSend: true,
      canReact: true,
      canInvite: false,
      cooldownSeconds: 60,
      maxAutoRepliesPerWindow: 1,
      settingsLabel: null,
    },
  ];

  it('filters active members and sorts agents first for @ queries', () => {
    const mention = findActiveMentionQuery('please ask @den');
    expect(mention).toEqual({ start: 11, end: 15, query: 'den' });

    const suggestions = getMentionSuggestions(members, mention?.query ?? '');
    expect(suggestions.map(suggestion => suggestion.identity)).toEqual(['den-desktop-runner']);
    expect(suggestions[0].label).toContain('agent · active · mentions_only');
  });

  it('inserts a stable @memberIdentity token for keyboard selection', () => {
    const mention = findActiveMentionQuery('please ask @de');
    expect(mention).not.toBeNull();
    expect(insertMentionToken('please ask @de', mention!, 'den-desktop-runner')).toBe('please ask @den-desktop-runner ');
  });
});
