import type { Routes } from '@angular/router';

export const shellRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tasks' },
  {
    path: 'tasks',
    loadComponent: () =>
      import('@den-web/feature-tasks').then((m) => m.TaskCockpitComponent),
  },
  {
    path: 'conversation',
    loadComponent: () =>
      import('@den-web/feature-conversation').then(
        (m) => m.ConversationCockpitComponent,
      ),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('@den-web/feature-notifications').then(
        (m) => m.NotificationsPanelComponent,
      ),
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
    path: 'visual-contract',
    loadComponent: () =>
      import('@den-web/feature-visual-contract').then(
        (m) => m.VisualContractWorkspaceComponent,
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
