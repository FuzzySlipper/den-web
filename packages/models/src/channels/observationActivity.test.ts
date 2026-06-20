import { describe, expect, it } from 'vitest';
import type { ObservationLaneEvent } from '@den-web/api/types';
import {
  observationActiveWorkIncludesMember,
  observationEventsToChannelActivityEvents,
} from './observationActivity';

function event(overrides: Partial<ObservationLaneEvent>): ObservationLaneEvent {
  return {
    event_id: 'observation:1',
    source_domain: 'runtime',
    event_type: 'work_completed',
    agent_identity: { profile: 'pi-crew-reviewer', instance_id: 'pi-crew-reviewer@pool-1' },
    runtime_instance_id: 'pi-crew-reviewer@pool-1',
    payload: {
      kind: 'agent_activity.v1',
      schema_version: 1,
      summary: 'Reviewer completed task 2813.',
      severity: 'success',
      visibility: 'task',
      adapter: 'pi-crew',
      surface: 'review',
      work_ref: {
        project_id: 'den-web',
        task_id: 2813,
        assignment_id: '42',
        run_id: 'run-pi-crew-1',
        channel_id: 604,
        channel_message_id: 15743,
      },
      result_ref: {
        message_id: 15744,
        document_slug: 'agent-activity-observation-contract-2026-06-19',
        artifact_path: '/tmp/result.json',
      },
    },
    display_only: true,
    created_at: '2026-06-20T01:00:00Z',
    ...overrides,
  };
}

describe('observationEventsToChannelActivityEvents', () => {
  it('normalizes known observation events into display-only channel breadcrumbs with refs', () => {
    const [activity] = observationEventsToChannelActivityEvents([event({})], { channelId: 604, projectId: 'den-web' });

    expect(activity).toMatchObject({
      agentIdentity: 'pi-crew-reviewer',
      channelId: 604,
      projectId: 'den-web',
      taskId: 2813,
      assignmentId: '42',
      workerRunId: 'run-pi-crew-1',
      anchorMessageId: 15743,
      finalChannelMessageId: 15744,
      eventType: 'work_completed',
      status: 'success',
      deliveryStage: 'task',
      terminal: true,
      title: 'Work Completed',
      summary: 'Reviewer completed task 2813.',
      dedupeKey: 'observation:observation:1',
    });
    expect(activity.id).toBeLessThan(0);
    expect(JSON.parse(activity.metadataJson ?? '{}')).toMatchObject({
      source: 'observation',
      severity: 'success',
      visibility: 'task',
      displayOnly: true,
      adapter: 'pi-crew',
      surface: 'review',
      workRef: { task_id: 2813 },
      resultRef: { document_slug: 'agent-activity-observation-contract-2026-06-19' },
    });
  });

  it('renders unknown future event types generically from payload summary', () => {
    const [activity] = observationEventsToChannelActivityEvents([
      event({
        event_id: 'observation:future',
        event_type: 'adapter_magic_happened',
        payload: {
          kind: 'agent_activity.v1',
          schema_version: 1,
          summary: 'Adapter did something new.',
          severity: 'warning',
          visibility: 'agent',
          adapter: 'hermes',
          surface: 'worker',
          future_field: { nested: true },
        },
      }),
    ]);

    expect(activity).toMatchObject({
      eventType: 'adapter_magic_happened',
      status: 'warning',
      deliveryStage: 'agent',
      title: 'Adapter Magic Happened',
      summary: 'Adapter did something new.',
    });
  });

  it('hides debug visibility by default but can expose it for diagnostics', () => {
    const debugEvent = event({
      event_id: 'observation:debug',
      payload: {
        kind: 'agent_activity.v1',
        schema_version: 1,
        summary: 'Verbose adapter detail.',
        severity: 'info',
        visibility: 'debug',
        adapter: 'hermes',
        surface: 'worker',
      },
    });

    expect(observationEventsToChannelActivityEvents([debugEvent])).toHaveLength(0);
    expect(observationEventsToChannelActivityEvents([debugEvent], { hideDebug: false })).toHaveLength(1);
  });

  it('filters task-scoped breadcrumbs to matching project or channel refs', () => {
    const matched = event({ event_id: 'observation:matched' });
    const other = event({
      event_id: 'observation:other',
      payload: {
        ...(event({}).payload as object),
        work_ref: { project_id: 'den-services', task_id: 2810 },
      },
    });

    expect(observationEventsToChannelActivityEvents([matched, other], { projectId: 'den-web' })).toHaveLength(1);
    expect(observationEventsToChannelActivityEvents([matched], { channelId: 999 })).toHaveLength(0);
  });
});

describe('observationActiveWorkIncludesMember', () => {
  it('marks participants working from active observation readback but ignores terminal states', () => {
    expect(observationActiveWorkIncludesMember([
      {
        intent_id: 1,
        target_identity: { profile: 'spawned-coder', instance_id: 'spawned-coder@host' },
        state: 'claimed',
        created_at: '2026-06-20T01:00:00Z',
      },
      {
        intent_id: 2,
        target_identity: { profile: 'spawned-reviewer', instance_id: 'spawned-reviewer@host' },
        state: 'completed',
        created_at: '2026-06-20T01:01:00Z',
      },
    ], 'spawned-coder')).toBe(true);
    expect(observationActiveWorkIncludesMember([
      {
        intent_id: 2,
        target_identity: { profile: 'spawned-reviewer', instance_id: 'spawned-reviewer@host' },
        state: 'completed',
        created_at: '2026-06-20T01:01:00Z',
      },
    ], 'spawned-reviewer')).toBe(false);
  });
});
