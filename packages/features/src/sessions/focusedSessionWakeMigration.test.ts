import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('focused session direct-agent wake producer guardrails', () => {
  it('uses the successor wake helper with focused route metadata', () => {
    const source = readFileSync(resolve('packages/features/src/sessions/useFocusedSessionComposerActions.ts'), 'utf8');

    expect(source).toContain('postGatewayDirectAgentMessage({');
    expect(source).toContain('assignmentId: selectedActiveRoute?.assignmentId ?? null');
    expect(source).toContain('workerRunId: selectedActiveRoute?.workerRunId ?? null');
    expect(source).toContain('agentInstanceId: selectedActiveRoute?.agentInstanceId ?? null');
    expect(source).not.toContain('/direct-agent-events');
    expect(source).not.toContain('/direct-conversations/');
  });
});
