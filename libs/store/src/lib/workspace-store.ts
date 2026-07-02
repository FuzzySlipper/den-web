import { computed, signal, type Signal } from '@angular/core';
import type { ClockPort } from '@den-web/platform';
import type { DenProject, DenResult, DenSpace } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface WorkspaceTransportPort {
  readonly listProjects: () => Promise<DenResult<readonly DenProject[]>>;
  readonly listSpaces: (options?: { readonly includeHidden?: boolean; readonly includeArchived?: boolean }) => Promise<DenResult<readonly DenSpace[]>>;
}

export interface WorkspaceStore {
  readonly projects: Signal<AsyncState<readonly DenProject[]>>;
  readonly spaces: Signal<AsyncState<readonly DenSpace[]>>;
  readonly selectedProjectId: Signal<string | null>;
  readonly selectedSpaceId: Signal<string | null>;
  readonly selectedProject: Signal<DenProject | null>;
  readonly refresh: () => Promise<void>;
  readonly selectProject: (projectId: string | null) => void;
  readonly selectSpace: (spaceId: string | null) => void;
  readonly startPolling: (cadenceMs?: number) => () => void;
}

export function createWorkspaceStore(transport: WorkspaceTransportPort, clock: ClockPort): WorkspaceStore {
  const projects = signal<AsyncState<readonly DenProject[]>>(idleState());
  const spaces = signal<AsyncState<readonly DenSpace[]>>(idleState());
  const selectedProjectId = signal<string | null>(null);
  const selectedSpaceId = signal<string | null>(null);
  let stopped = true;
  let timer: number | null = null;

  const refresh = async (): Promise<void> => {
    const previousProjects = stateValue(projects());
    const previousSpaces = stateValue(spaces());
    projects.set(loadingState(previousProjects));
    spaces.set(loadingState(previousSpaces));
    try {
      const [projectResult, spaceResult] = await Promise.all([transport.listProjects(), transport.listSpaces()]);
      projects.set(resultState(projectResult, previousProjects));
      spaces.set(resultState(spaceResult, previousSpaces));
      if (projectResult.ok && selectedProjectId() === null) selectedProjectId.set(projectResult.value[0]?.id ?? null);
    } catch (error) {
      const classified = unknownStoreError(error);
      projects.set(errorState(classified, previousProjects));
      spaces.set(errorState(classified, previousSpaces));
    }
  };

  const schedule = (cadenceMs: number): void => {
    timer = clock.setTimeout(() => {
      if (stopped) return;
      void refresh().finally(() => schedule(cadenceMs));
    }, cadenceMs);
  };

  return {
    projects: projects.asReadonly(),
    spaces: spaces.asReadonly(),
    selectedProjectId: selectedProjectId.asReadonly(),
    selectedSpaceId: selectedSpaceId.asReadonly(),
    selectedProject: computed(() => stateValue(projects())?.find((project) => project.id === selectedProjectId()) ?? null),
    refresh,
    selectProject: (projectId) => selectedProjectId.set(projectId),
    selectSpace: (spaceId) => selectedSpaceId.set(spaceId),
    startPolling: (cadenceMs = 5000) => {
      stopped = false;
      void refresh().finally(() => schedule(cadenceMs));
      return () => {
        stopped = true;
        if (timer !== null) clock.clearTimeout(timer);
      };
    },
  };
}
