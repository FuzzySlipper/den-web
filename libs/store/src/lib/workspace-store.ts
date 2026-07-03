import { computed, signal, type Signal } from '@angular/core';
import type { ClockPort } from '@den-web/platform';
import { DEN_GLOBAL_PROJECT_ID, type DenProject, type DenResult, type DenSpace } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface WorkspaceVisibilityOptions {
  readonly includeHidden?: boolean;
  readonly includeArchived?: boolean;
}

export interface WorkspaceTransportPort {
  readonly listProjects: (options?: WorkspaceVisibilityOptions) => Promise<DenResult<readonly DenProject[]>>;
  readonly listSpaces: (options?: WorkspaceVisibilityOptions) => Promise<DenResult<readonly DenSpace[]>>;
}

export interface WorkspaceStore {
  readonly projects: Signal<AsyncState<readonly DenProject[]>>;
  readonly spaces: Signal<AsyncState<readonly DenSpace[]>>;
  readonly includeArchivedHidden: Signal<boolean>;
  readonly selectedProjectId: Signal<string | null>;
  readonly selectedSpaceId: Signal<string | null>;
  readonly selectedProject: Signal<DenProject | null>;
  readonly refresh: () => Promise<void>;
  readonly setIncludeArchivedHidden: (enabled: boolean) => void;
  readonly selectProject: (projectId: string | null) => void;
  readonly selectSpace: (spaceId: string | null) => void;
  readonly startPolling: (cadenceMs?: number) => () => void;
}

export function createWorkspaceStore(transport: WorkspaceTransportPort, clock: ClockPort): WorkspaceStore {
  const projects = signal<AsyncState<readonly DenProject[]>>(idleState());
  const spaces = signal<AsyncState<readonly DenSpace[]>>(idleState());
  const includeArchivedHidden = signal(false);
  const selectedProjectId = signal<string | null>(null);
  const selectedSpaceId = signal<string | null>(null);
  let stopped = true;
  let timer: number | null = null;

  const refresh = async (): Promise<void> => {
    const previousProjects = stateValue(projects());
    const previousSpaces = stateValue(spaces());
    if (previousProjects === undefined) projects.set(loadingState());
    if (previousSpaces === undefined) spaces.set(loadingState());
    try {
      const visibilityOptions = visibilityOptionsFor(includeArchivedHidden());
      const [projectResult, spaceResult] = await Promise.all([
        transport.listProjects(visibilityOptions),
        transport.listSpaces(visibilityOptions),
      ]);
      projects.set(resultState(projectResult, previousProjects));
      spaces.set(resultState(spaceResult, previousSpaces));
      if (selectedProjectId() === null || !scopeExists(selectedProjectId(), projectResult, spaceResult)) {
        selectedProjectId.set(initialScopeId(projectResult, spaceResult));
      }
      syncSelectedSpace();
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
    includeArchivedHidden: includeArchivedHidden.asReadonly(),
    selectedProjectId: selectedProjectId.asReadonly(),
    selectedSpaceId: selectedSpaceId.asReadonly(),
    selectedProject: computed(() => stateValue(projects())?.find((project) => project.id === selectedProjectId()) ?? null),
    refresh,
    setIncludeArchivedHidden: (enabled) => {
      includeArchivedHidden.set(enabled);
      void refresh();
    },
    selectProject: (projectId) => {
      selectedProjectId.set(projectId);
      syncSelectedSpace();
    },
    selectSpace: (spaceId) => {
      selectedSpaceId.set(spaceId);
      selectedProjectId.set(spaceId);
    },
    startPolling: (cadenceMs = 5000) => {
      stopped = false;
      void refresh().finally(() => schedule(cadenceMs));
      return () => {
        stopped = true;
        if (timer !== null) clock.clearTimeout(timer);
      };
    },
  };

  function syncSelectedSpace(): void {
    const projectId = selectedProjectId();
    selectedSpaceId.set(stateValue(spaces())?.some((space) => space.id === projectId) ? projectId : null);
  }
}

function initialScopeId(
  projectResult: DenResult<readonly DenProject[]>,
  spaceResult: DenResult<readonly DenSpace[]>,
): string | null {
  if (spaceResult.ok && spaceResult.value.length > 0) return spaceResult.value[0]?.id ?? null;
  if (projectResult.ok && projectResult.value.length > 0) return projectResult.value[0]?.id ?? null;
  return DEN_GLOBAL_PROJECT_ID;
}

function scopeExists(
  projectId: string | null,
  projectResult: DenResult<readonly DenProject[]>,
  spaceResult: DenResult<readonly DenSpace[]>,
): boolean {
  if (projectId === null || projectId === DEN_GLOBAL_PROJECT_ID) return true;
  if (spaceResult.ok && spaceResult.value.some((space) => space.id === projectId)) return true;
  return projectResult.ok && projectResult.value.some((project) => project.id === projectId);
}

function visibilityOptionsFor(enabled: boolean): WorkspaceVisibilityOptions {
  return enabled ? { includeHidden: true, includeArchived: true } : {};
}
