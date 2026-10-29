import type { Routes } from '@angular/router';

export const shellRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tasks' },
  {
    path: 'tasks',
    loadComponent: () =>
      import('@den-web/feature-tasks').then((m) => m.TaskCockpitComponent),
  },
  {
    path: 'messages',
    loadComponent: () =>
      import('@den-web/feature-messages').then(
        (m) => m.MessagesInboxComponent,
      ),
  },
  {
    path: 'documents',
    loadComponent: () =>
      import('@den-web/feature-documents').then(
        (m) => m.DocumentsPanelComponent,
      ),
  },
  {
    path: 'board',
    loadComponent: () =>
      import('@den-web/feature-board').then((m) => m.BoardPanelComponent),
  },
  {
    path: 'knowledge',
    loadComponent: () =>
      import('@den-web/feature-knowledge').then(
        (m) => m.KnowledgePanelComponent,
      ),
  },
  {
    path: 'guidance',
    loadComponent: () =>
      import('@den-web/feature-guidance').then(
        (m) => m.GuidancePanelComponent,
      ),
  },
  {
    path: 'librarian',
    loadComponent: () =>
      import('@den-web/feature-librarian').then(
        (m) => m.LibrarianPanelComponent,
      ),
  },
  {
    path: 'agents',
    loadComponent: () =>
      import('@den-web/feature-agents').then(
        (m) => m.AgentsOverviewComponent,
      ),
  },
  {
    path: 'ops',
    loadComponent: () =>
      import('@den-web/feature-ops').then((m) => m.OpsPanelComponent),
  },
  {
    path: 'resources',
    loadComponent: () =>
      import('@den-web/feature-resources').then(
        (m) => m.ResourcesPanelComponent,
      ),
  },
  {
    path: 'preferences',
    loadComponent: () =>
      import('@den-web/feature-preferences').then(
        (m) => m.PreferencesPanelComponent,
      ),
  },
  { path: '**', redirectTo: 'tasks' },
];
