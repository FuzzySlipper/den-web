/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  sourceLabel,
  sourceClass,
  classifyPhase,
  phaseLabel,
  phaseClass,
  classifyDeliveryStatus,
  deliveryStatusLabel,
  deliveryStatusClass,
  checkpointStatusClass,
  isCoreAvailable,
  isGatewayAvailable,
  hasMessages,
  hasActivityEvents,
  formatTraceTimestamp,
  buildTraceSummary,
  fakeAssignmentTrace,
} from './assignmentTraceModel';

describe('sourceLabel / sourceClass', () => {
  it('returns human-readable labels for each availability value', () => {
    expect(sourceLabel('available')).toBe('Available');
    expect(sourceLabel('core_unavailable')).toBe('Core Unavailable');
    expect(sourceLabel('gateway_unavailable')).toBe('Gateway Unavailable');
    expect(sourceLabel('no_assignment_messages')).toBe('No Channel Messages');
    expect(sourceLabel('no_activity_events')).toBe('No Activity Events');
    expect(sourceLabel('delivery_missing')).toBe('Delivery Record Missing');
    expect(sourceLabel('pending')).toBe('Pending');
  });

  it('returns appropriate CSS classes', () => {
    expect(sourceClass('available')).toBe('trace-source-available');
    expect(sourceClass('core_unavailable')).toBe('trace-source-unavailable');
    expect(sourceClass('gateway_unavailable')).toBe('trace-source-unavailable');
    expect(sourceClass('no_assignment_messages')).toBe('trace-source-missing');
    expect(sourceClass('delivery_missing')).toBe('trace-source-missing');
    expect(sourceClass('pending')).toBe('trace-source-pending');
  });
});

describe('phase classification', () => {
  it('classifies all expected phase strings', () => {
    expect(classifyPhase('assigned')).toBe('assigned');
    expect(classifyPhase('leased')).toBe('leased');
    expect(classifyPhase('working')).toBe('working');
    expect(classifyPhase('checkpointing')).toBe('checkpointing');
    expect(classifyPhase('checkpoint')).toBe('checkpointing');
    expect(classifyPhase('releasing')).toBe('releasing');
    expect(classifyPhase('release')).toBe('releasing');
    expect(classifyPhase('quarantined')).toBe('quarantined');
    expect(classifyPhase('completed')).toBe('completed');
    expect(classifyPhase('complete')).toBe('completed');
    expect(classifyPhase('done')).toBe('completed');
    expect(classifyPhase(null)).toBe('unknown');
    expect(classifyPhase('unrecognized')).toBe('unknown');
  });

  it('renders stable labels and classes', () => {
    expect(phaseLabel('assigned')).toBe('Assigned');
    expect(phaseLabel('completed')).toBe('Completed');
    expect(phaseClass('working')).toBe('trace-phase-working');
    expect(phaseClass('quarantined')).toBe('trace-phase-quarantined');
  });
});

describe('delivery status classification', () => {
  it('classifies delivery status values', () => {
    expect(classifyDeliveryStatus('delivered')).toBe('delivered');
    expect(classifyDeliveryStatus('delivered_waiting_completion')).toBe('delivered');
    expect(classifyDeliveryStatus('completed')).toBe('completed');
    expect(classifyDeliveryStatus('failed')).toBe('failed');
    expect(classifyDeliveryStatus('error')).toBe('failed');
    expect(classifyDeliveryStatus('pending')).toBe('pending');
    expect(classifyDeliveryStatus('claimed')).toBe('pending');
    expect(classifyDeliveryStatus(null)).toBe('missing');
  });

  it('renders delivery labels and classes', () => {
    expect(deliveryStatusLabel('delivered')).toBe('Delivered');
    expect(deliveryStatusLabel('completed')).toBe('Completed');
    expect(deliveryStatusLabel('failed')).toBe('Failed');
    expect(deliveryStatusClass('delivered')).toBe('trace-delivery-delivered');
    expect(deliveryStatusClass('completed')).toBe('trace-delivery-completed');
    expect(deliveryStatusClass('failed')).toBe('trace-delivery-failed');
  });
});

describe('checkpoint status class', () => {
  it('classifies checkpoint status values', () => {
    expect(checkpointStatusClass('success')).toBe('checkpoint-success');
    expect(checkpointStatusClass('ok')).toBe('checkpoint-success');
    expect(checkpointStatusClass('completed')).toBe('checkpoint-success');
    expect(checkpointStatusClass('error')).toBe('checkpoint-error');
    expect(checkpointStatusClass('failed')).toBe('checkpoint-error');
    expect(checkpointStatusClass('progress')).toBe('checkpoint-pending');
    expect(checkpointStatusClass('in_progress')).toBe('checkpoint-pending');
    expect(checkpointStatusClass(null)).toBe('checkpoint-unknown');
  });
});

describe('availability checks', () => {
  const happyTrace = fakeAssignmentTrace();

  it('detects available core state', () => {
    expect(isCoreAvailable(happyTrace)).toBe(true);
  });

  it('detects available gateway evidence', () => {
    expect(isGatewayAvailable(happyTrace)).toBe(true);
  });

  it('detects channel messages', () => {
    expect(hasMessages(happyTrace)).toBe(true);
  });

  it('detects activity events', () => {
    expect(hasActivityEvents(happyTrace)).toBe(true);
  });

  it('returns false when core is unavailable', () => {
    const trace = fakeAssignmentTrace({
      coreAvailability: 'core_unavailable',
      coreState: null,
    });
    expect(isCoreAvailable(trace)).toBe(false);
  });

  it('returns false when gateway is unavailable', () => {
    const trace = fakeAssignmentTrace({
      gatewayAvailability: 'gateway_unavailable',
      gatewayEvidence: null,
    });
    expect(isGatewayAvailable(trace)).toBe(false);
  });

  it('returns false when there are no messages', () => {
    const trace = fakeAssignmentTrace({ channelMessages: 0 });
    expect(hasMessages(trace)).toBe(false);
  });

  it('returns false when there are no activity events', () => {
    const trace = fakeAssignmentTrace({ activityEvents: 0 });
    expect(hasActivityEvents(trace)).toBe(false);
  });
});

describe('formatTraceTimestamp', () => {
  it('returns placeholder for null/undefined', () => {
    expect(formatTraceTimestamp(null)).toBe('—');
    expect(formatTraceTimestamp(undefined)).toBe('—');
  });

  it('formats a valid ISO timestamp', () => {
    const result = formatTraceTimestamp('2026-05-29T10:00:00Z');
    expect(result).not.toBe('—');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('buildTraceSummary', () => {
  it('builds a summary from happy path data', () => {
    const trace = fakeAssignmentTrace();
    const summary = buildTraceSummary(trace);
    expect(summary).toContain('Worker Pool Core');
    expect(summary).toContain('Task #1729');
    expect(summary).toContain('coder');
    expect(summary).toContain('Working');
    expect(summary).toContain('Delivered');
  });

  it('mentions quarantine when present', () => {
    const trace = fakeAssignmentTrace({
      coreState: { phase: 'quarantined', quarantined: true },
    });
    const summary = buildTraceSummary(trace);
    expect(summary).toContain('Quarantined');
  });
});

describe('fakeAssignmentTrace variants', () => {
  it('produces a happy-path fixture', () => {
    const trace = fakeAssignmentTrace();
    expect(trace.assignmentId).toBe('del-abc-123');
    expect(trace.coreState).not.toBeNull();
    expect(trace.gatewayEvidence).not.toBeNull();
    expect(trace.channelMessages).toHaveLength(2);
    expect(trace.activityEvents).toHaveLength(3);
    expect(trace.coreAvailability).toBe('available');
    expect(trace.gatewayAvailability).toBe('available');
  });

  it('produces a missing-gateway fixture', () => {
    const trace = fakeAssignmentTrace({
      gatewayAvailability: 'gateway_unavailable',
      gatewayEvidence: null,
    });
    expect(trace.gatewayAvailability).toBe('gateway_unavailable');
    expect(trace.gatewayEvidence).toBeNull();
  });

  it('produces a no-messages fixture', () => {
    const trace = fakeAssignmentTrace({
      messagesAvailability: 'no_assignment_messages',
      channelMessages: 0,
    });
    expect(trace.messagesAvailability).toBe('no_assignment_messages');
    expect(trace.channelMessages).toHaveLength(0);
  });

  it('produces a no-activity fixture', () => {
    const trace = fakeAssignmentTrace({
      activityAvailability: 'no_activity_events',
      activityEvents: 0,
    });
    expect(trace.activityAvailability).toBe('no_activity_events');
    expect(trace.activityEvents).toHaveLength(0);
  });

  it('produces a cleanup-pending fixture', () => {
    const trace = fakeAssignmentTrace({
      coreState: {
        phase: 'releasing',
        cleanupState: 'triggered',
        cleanupTriggeredAt: '2026-05-29T11:00:00Z',
        cleanupCompletedAt: null,
      },
    });
    expect(trace.coreState?.phase).toBe('releasing');
    expect(trace.coreState?.cleanupState).toBe('triggered');
    expect(trace.coreState?.cleanupCompletedAt).toBeNull();
  });

  it('produces a quarantined fixture', () => {
    const trace = fakeAssignmentTrace({
      coreState: {
        phase: 'quarantined',
        quarantined: true,
        quarantinedAt: '2026-05-29T11:30:00Z',
      },
    });
    expect(trace.coreState?.quarantined).toBe(true);
    expect(trace.coreState?.phase).toBe('quarantined');
  });
});
