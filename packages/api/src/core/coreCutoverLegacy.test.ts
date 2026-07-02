import { describe, expect, it, vi } from 'vitest';
import {
  approveDispatch,
  controlSubagentRun,
  getDispatch,
  getSubagentRun,
  listAgentStream,
  listDispatches,
  listStaleWorkerConditions,
  listSubagentRuns,
  rejectDispatch,
} from './client';

describe('core cutover legacy helpers', () => {
  it('does not fetch Core for retired agent stream and dispatch list surfaces', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(listAgentStream()).resolves.toEqual([]);
    await expect(listSubagentRuns()).resolves.toEqual([]);
    await expect(listDispatches()).resolves.toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('fails closed without fetching Core for retired detail/control surfaces', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getSubagentRun('run-1')).rejects.toThrow('disabled after the den-core cutover');
    await expect(controlSubagentRun('run-1', { action: 'abort' })).rejects.toThrow('disabled after the den-core cutover');
    await expect(getDispatch(1)).rejects.toThrow('disabled after the den-core cutover');
    await expect(approveDispatch(1, 'web-ui')).rejects.toThrow('disabled after the den-core cutover');
    await expect(rejectDispatch(1, 'web-ui')).rejects.toThrow('disabled after the den-core cutover');
    await expect(listStaleWorkerConditions()).rejects.toThrow('disabled after the den-core cutover');

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
