import type { Page, Route } from '@playwright/test';

const project = { id: 'den-web', name: 'Den Web', visibility: 'normal' };
const hiddenProject = { id: 'archive-mine', name: 'Archive Mine', visibility: 'archived' };
const spaces = [
  { id: 'den-web', name: 'Den Web', kind: 'project', visibility: 'normal' },
  { id: 'asha', name: 'Asha Studio', kind: 'project', visibility: 'normal' },
];
const archivedSpace = { id: 'old-space', name: 'Old Space', kind: 'project', visibility: 'archived' };
const primaryTask = {
  id: 3993,
  project_id: 'den-web',
  title: 'Den Web Angular successor Phase 4: first vertical cockpit slice',
  status: 'in_progress',
  priority: 2,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['successor', 'angular', 'phase-4'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 1,
  description: 'Ship the first usable Angular successor slice.',
  updated_at: '2026-07-29T00:57:23.730966Z',
};
const nestedTask = {
  id: 4001,
  project_id: 'den-web',
  title: 'Nested fixture task',
  status: 'planned',
  priority: 3,
  assigned_to: 'codex',
  parent_id: 3993,
  tags: ['fixture'],
  availability: 'waiting_on_dependencies',
  dependency_count: 1,
  unfinished_dependency_count: 1,
  subtask_count: 0,
};
const longDescription = Array.from(
  { length: 44 },
  (_, index) => `Long detail paragraph ${index + 1}. This fixture gives the task detail panel enough content to require internal scrolling without moving the workspace shell.`,
).join('\n\n');
const longDetailTask = {
  id: 4177,
  project_id: 'den-web',
  title: 'Long detail fixture task',
  status: 'in_progress',
  priority: 2,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['fixture', 'scroll'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 0,
  description: `${longDescription}\n\nLong detail bottom sentinel.`,
};
const exactReviewTask = {
  id: 4250,
  project_id: 'den-web',
  title: 'Exact review fixture task',
  status: 'review',
  priority: 5,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['fixture', 'review'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 0,
  description: 'A review task with an exact source revision.',
  updated_at: '2026-08-12T00:00:00Z',
};
const bestEffortReviewTask = {
  ...exactReviewTask,
  id: 4251,
  title: 'Best-effort review fixture task',
  description: 'A review task without a connected source revision.',
};
const extraTasks = Array.from({ length: 80 }, (_, index) => ({
  id: 4300 + index,
  project_id: 'den-web',
  title: `Long task list fixture ${index + 1}`,
  status: 'planned',
  priority: 4,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['fixture', 'scroll'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 0,
}));
const tasks = [primaryTask, nestedTask, longDetailTask, exactReviewTask, bestEffortReviewTask, ...extraTasks];
const ashaTask = {
  id: 4100,
  project_id: 'asha',
  title: 'Asha Studio space task',
  status: 'planned',
  priority: 2,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['fixture'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 0,
  description: 'Loaded through space selection.',
};
const archivedTask = {
  ...ashaTask,
  id: 4200,
  project_id: 'archive-mine',
  title: 'Archived read-only fixture task',
  status: 'review',
};
const artifactRef = 'den-artifact://art_fixture_image';
const artifactMetadata = {
  artifact_id: 'art_fixture_image',
  artifact_ref: artifactRef,
  project_id: 'den-web',
  task_id: 3993,
  logical_name: 'visual-evidence-overview.png',
  mime_type: 'image/png',
  byte_count: 70,
  sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  width: 1,
  height: 1,
  sensitive: false,
  storage_backend: 'filesystem',
  storage_key: 'sha256/fixture',
  created_by: 'codex',
  created_at: '2026-07-02T00:00:00Z',
};
const artifactPacket = {
  packet_type: 'visual_inspect_result',
  schema_version: 'visual-inspect-review-packet/v0',
  artifact_refs: [{ screenshot_id: 'Visual evidence overview', ref: artifactRef, mime_type: 'image/png', sensitive: false }],
  result: { verdict: 'pass', confidence: 0.86 },
};
const artifactPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
const taskDetail = {
  task: primaryTask,
  dependencies: [],
  subtasks: [nestedTask, ashaTask],
  recent_messages: [],
};
const olderTaskMessage = { id: 1, project_id: 'den-web', task_id: 3993, thread_id: 1, sender: 'den-web', intent: 'note', content: 'Oldest task fixture note', metadata: null, created_at: '2026-07-01T23:59:00Z' };
const taskMessages = [{ id: 2, project_id: 'den-web', task_id: 3993, thread_id: 1, sender: 'codex', intent: 'handoff', content: 'Phase 4 fixture loaded', metadata: artifactPacket, created_at: '2026-07-02T00:01:00Z' }, olderTaskMessage];
const primaryMessage = { id: 10, project_id: 'den-web', task_id: 3993, thread_id: 1, sender: 'codex', intent: 'handoff', content: 'Message fixture loaded', metadata: artifactPacket, created_at: '2026-07-02T00:00:00Z' };
const extraMessages = Array.from({ length: 48 }, (_, index) => ({
  id: 100 + index,
  project_id: 'den-web',
  task_id: null,
  thread_id: 100 + index,
  sender: 'codex',
  intent: 'status_update',
  content: `Long inbox scroll fixture message ${index + 1} with enough body text to prove rows stay compact inside the panel.`,
  metadata: null,
  created_at: `2026-07-02T00:${String(index + 2).padStart(2, '0')}:00Z`,
}));
const messages = [primaryMessage, ...extraMessages];
const threadMessages = { root: primaryMessage, replies: [] };
const knowledgeEntries = [
  {
    id: 7001,
    slug: 'successor-boundaries',
    title: 'Successor boundaries',
    summary: 'Keep domain ownership explicit while migrating legacy services.',
    kind: 'architecture_note',
    status: 'reviewed',
    curation_state: 'human_curated',
    tags: ['architecture', 'successor'],
    audience: ['agents'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-05T00:00:00Z',
    source_refs: [{ source_kind: 'document', source_id: 'architecture-guidelines', project_id: 'den-services' }],
  },
  {
    id: 7002,
    slug: 'global-entry-long-body',
    title: 'Global entry with long body',
    summary: 'Long content fixture for detail scrolling.',
    kind: 'reference',
    status: 'reviewed',
    curation_state: 'agent_curated',
    tags: ['fixture', 'scroll'],
    audience: ['agents', 'humans'],
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-08-04T00:00:00Z',
  },
] as const;
const knowledgeDetails = [
  {
    ...knowledgeEntries[0],
    body_markdown: '# Successor boundaries\n\nKnowledge is global and remains independent from the selected Den Web workspace.',
  },
  {
    ...knowledgeEntries[1],
    body_markdown: `${Array.from({ length: 42 }, (_, index) => `Long knowledge paragraph ${index + 1}. This fixture keeps the detail panel internally scrollable.`).join('\n\n')}\n\nKnowledge detail bottom sentinel.`,
  },
];
const documents = [
  { project_id: 'den-web', slug: 'successor-brief', title: 'Successor Brief', updated_at: '2026-07-02T00:00:00Z' },
  {
    project_id: 'den-web',
    slug: 'a-very-long-document-slug-used-to-keep-the-list-row-height-stable',
    title: 'Long Fixture Document Title Used For Stable Row Layout',
    doc_type: 'reference',
    updated_at: '2026-07-02T00:00:00Z',
  },
];
const documentDetail = {
  ...documents[0],
  content_markdown: '# Successor Brief\n\nDocument fixture loaded.\n\n| Surface | Owner |\n|---|---|\n| Runtime | ASHA main |\n| Demo | asha-demo |',
  tags: ['successor'],
};
const longDocumentDetail = { ...documents[1], content_markdown: '# Stable Rows\n\nSecond fixture loaded.', tags: ['successor', 'layout'] };
const ashaDocuments = [{ project_id: 'asha', slug: 'asha-brief', title: 'Asha Brief', updated_at: '2026-07-02T00:00:00Z' }];
const ashaDocumentDetail = { ...ashaDocuments[0], content_markdown: '# Asha Brief\n\nAsha document fixture loaded.', tags: ['space'] };
const globalDocuments = [{ project_id: '_global', slug: 'global-brief', title: 'Global Brief', updated_at: '2026-07-02T00:00:00Z' }];
const globalDocumentDetail = { ...globalDocuments[0], content_markdown: '# Global Brief\n\nGlobal document fixture loaded.', tags: ['global'] };
const projectGuidanceEntry = {
  id: 601,
  project_id: 'den-web',
  document_project_id: 'den-web',
  document_slug: 'successor-brief',
  importance: 'required',
  audience: ['planner', 'runner'],
  sort_order: 10,
  notes: 'Project guidance fixture',
  created_at: '2026-07-02T00:00:00Z',
  updated_at: '2026-07-02T00:00:00Z',
};
const globalGuidanceEntry = {
  id: 602,
  project_id: '_global',
  document_project_id: '_global',
  document_slug: 'global-brief',
  importance: 'important',
  audience: ['all'],
  sort_order: 1,
  notes: 'Global guidance fixture',
  created_at: '2026-07-02T00:00:00Z',
  updated_at: '2026-07-02T00:00:00Z',
};
const discussion = { comments: [{ id: 1, author_identity: 'codex', body_markdown: 'Discussion fixture loaded', parent_comment_id: null, created_at: '2026-07-02T00:00:00Z' }] };
const publication = {
  publication_id: 'pub-1',
  status: 'previewed',
  dry_run: true,
  title: 'Successor Brief',
  slug: 'successor-brief',
  post_path: '_posts/successor-brief.md',
  public_url: 'https://blog.example.test/successor-brief',
  git_commit: '1234567890abcdef',
  preview_markdown: '# Successor Brief\n\nDocument fixture loaded.',
  warnings: [],
};
const observation = {
  items: [{ id: 'agent-1', agent_identity: 'den-mcp-runner', title: 'Agent fixture loaded', summary: 'Observation-backed overview', status: 'active', project_id: 'den-web', task_id: 3993 }],
  source_health: [{ source: 'observation', status: 'degraded', detail: 'Fixture degraded state' }],
};

export async function mockDenServices(page: Page): Promise<void> {
  let acceptedTask = primaryTask;
  let humanAcceptanceReviews: readonly Readonly<Record<string, unknown>>[] = [];
  await page.route('**/api/v1/projects', (route) => json(route, [project]));
  await page.route('**/api/v1/projects?**', (route) => json(route, includeArchivedHidden(route) ? [project, hiddenProject] : [project]));
  await page.route('**/api/v1/spaces', (route) => json(route, spaces));
  await page.route('**/api/v1/spaces?**', (route) => json(route, includeArchivedHidden(route) ? [...spaces, archivedSpace] : spaces));
  await page.route('**/api/v1/projects/den-web/tasks?**', (route) => json(route, tasks));
  await page.route('**/api/v1/projects/asha/tasks?**', (route) => json(route, [ashaTask]));
  await page.route('**/api/v1/projects/archive-mine/tasks?**', (route) => json(route, [archivedTask]));
  await page.route('**/api/v1/projects/den-web/tasks/3993', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { readonly status?: string };
      await json(route, { ...primaryTask, status: body.status ?? primaryTask.status });
      return;
    }
    await json(route, { ...taskDetail, task: acceptedTask, human_acceptance_reviews: humanAcceptanceReviews });
  });
  await page.route('**/api/v1/projects/den-web/tasks/3993/human-acceptance-reviews', async (route) => {
    const body = route.request().postDataJSON() as Readonly<Record<string, unknown>>;
    const lifecycleEffect = typeof body['lifecycle_effect'] === 'string' ? body['lifecycle_effect'] : 'record_only';
    const taskStatusAfter = lifecycleEffect === 'record_only' ? acceptedTask.status : 'done';
    acceptedTask = { ...acceptedTask, status: taskStatusAfter, updated_at: '2026-08-11T08:15:00Z' };
    const acceptance = {
      id: 901,
      task_id: acceptedTask.id,
      project_id: acceptedTask.project_id,
      reviewer_identity: body['reviewer_identity'],
      verdict: 'looks_good',
      rationale: body['rationale'] || 'Looks good.',
      reviewed_revision: body['reviewed_revision'],
      reviewed_build: body['reviewed_build'],
      reviewed_environment: body['reviewed_environment'],
      evidence_links: body['evidence_links'],
      lifecycle_effect: lifecycleEffect,
      note_markdown: '## Human acceptance: Looks good',
      task_status_before: primaryTask.status,
      task_status_after: taskStatusAfter,
      created_at: '2026-08-11T08:15:00Z',
    };
    humanAcceptanceReviews = [acceptance];
    await json(route, {
      acceptance,
      task: acceptedTask,
      changed_task_ids: lifecycleEffect === 'record_only' ? [] : [acceptedTask.id],
      unchanged_task_ids: lifecycleEffect === 'record_only' ? [acceptedTask.id] : [],
      independent_review_state: {
        agent_review_rounds_changed: false,
        agent_findings_changed: false,
        github_gates_changed: false,
      },
      warnings: ['Independent agent review rounds, findings, and GitHub gates were not changed.'],
      audit_handle: 'human-acceptance:901',
    });
  });
  await page.route('**/api/v1/projects/den-web/tasks/4001', (route) => json(route, {
    task: nestedTask,
    dependencies: [primaryTask],
    subtasks: [],
    recent_messages: [],
  }));
  await page.route('**/api/v1/projects/den-web/tasks/4177', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { readonly status?: string };
      await json(route, {
        task: { ...longDetailTask, status: body.status ?? longDetailTask.status },
        dependencies: [],
        subtasks: [],
        recent_messages: [],
      });
      return;
    }
    await json(route, {
      task: longDetailTask,
      dependencies: [],
      subtasks: [],
      recent_messages: [],
    });
  });
  await page.route('**/api/v1/projects/den-web/tasks/4177/manual-review', (route) => json(route, {
    eligible: true,
    mode: 'best_effort',
    label: 'Request best-effort review',
    detail: 'Review current main against the task context.',
  }));
  await page.route('**/api/v1/projects/den-web/tasks/4250', (route) => json(route, {
    task: exactReviewTask,
    dependencies: [],
    subtasks: [],
    recent_messages: [],
  }));
  await page.route('**/api/v1/projects/den-web/tasks/4251', (route) => json(route, {
    task: bestEffortReviewTask,
    dependencies: [],
    subtasks: [],
    recent_messages: [],
  }));
  await page.route('**/api/v1/projects/den-web/tasks/4250/manual-review', async (route) => {
    if (route.request().method() === 'POST') {
      await json(route, {
        mode: 'exact',
        status: 'queued',
        message: 'Exact review queued.',
        job_id: 'job-exact-4250',
        round_id: 4250,
      });
      return;
    }
    await json(route, {
      eligible: true,
      mode: 'exact',
      label: 'Send to review queue',
      detail: 'The connected commit will be reviewed.',
      source: {
        repository: 'openai/den-web',
        commit_sha: 'a'.repeat(40),
        ref: 'main',
      },
    });
  });
  await page.route('**/api/v1/projects/den-web/tasks/4251/manual-review', async (route) => {
    if (route.request().method() === 'POST') {
      await json(route, {
        mode: 'best_effort',
        status: 'queued',
        message: 'Best-effort review queued against current main.',
        job_id: 'job-best-effort-4251',
        round_id: 4251,
      });
      return;
    }
    await json(route, {
      eligible: true,
      mode: 'best_effort',
      label: 'Request best-effort review',
      detail: 'Review current main against the task description and messages.',
    });
  });
  await page.route('**/api/v1/projects/asha/tasks/4100', (route) => json(route, {
    task: ashaTask,
    dependencies: [],
    subtasks: [],
    recent_messages: [],
  }));
  await page.route('**/api/v1/projects/archive-mine/tasks/4200', (route) => json(route, {
    task: archivedTask,
    dependencies: [],
    subtasks: [],
    recent_messages: [],
    human_acceptance_reviews: [],
  }));
  await page.route('**/api/v1/projects/archive-mine/tasks/4200/manual-review', (route) => json(route, {
    eligible: true,
    mode: 'exact',
    label: 'Send to review queue',
    detail: 'The connected commit will be reviewed.',
    source: {
      repository: 'openai/den-web',
      commit_sha: 'b'.repeat(40),
      ref: 'main',
    },
  }));
  await page.route('**/api/v1/projects/den-web/messages?**', (route) => json(route, messagesFor(route)));
  await page.route('**/api/v1/projects/asha/messages?**', (route) => json(route, []));
  await page.route('**/api/v1/projects/archive-mine/messages?**', (route) => json(route, []));
  await page.route('**/api/v1/projects/den-web/messages/threads/1', (route) => json(route, threadMessages));
  await page.route('**/api/v1/artifacts/resolve?**', (route) => json(route, artifactMetadata));
  await page.route('**/api/v1/artifacts/art_fixture_image/metadata', (route) => json(route, artifactMetadata));
  await page.route('**/api/v1/artifacts/art_fixture_image/content', (route) => route.fulfill({
    contentType: 'image/png',
    body: artifactPng,
  }));
  await page.route('**/api/v1/projects/den-web/documents', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { readonly slug?: string; readonly content?: string };
      await json(route, { ...documentDetail, slug: body.slug ?? 'successor-brief', content: body.content ?? documentDetail.content_markdown });
      return;
    }
    await json(route, documents);
  });
  await page.route('**/api/v1/projects/_global/documents', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { readonly slug?: string; readonly content?: string };
      await json(route, { ...globalDocumentDetail, slug: body.slug ?? 'global-brief', content: body.content ?? globalDocumentDetail.content_markdown });
      return;
    }
    await json(route, globalDocuments);
  });
  await page.route('**/api/v1/projects/den-web/documents/successor-brief', (route) => json(route, documentDetail));
  await page.route('**/api/v1/projects/den-web/documents/a-very-long-document-slug-used-to-keep-the-list-row-height-stable', (route) => json(route, longDocumentDetail));
  await page.route('**/api/v1/projects/den-web/documents/successor-brief/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/den-web/documents/a-very-long-document-slug-used-to-keep-the-list-row-height-stable/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/asha/documents', (route) => json(route, ashaDocuments));
  await page.route('**/api/v1/projects/asha/documents/asha-brief', (route) => json(route, ashaDocumentDetail));
  await page.route('**/api/v1/projects/asha/documents/asha-brief/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/_global/documents/global-brief', (route) => json(route, globalDocumentDetail));
  await page.route('**/api/v1/projects/_global/documents/global-brief/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/knowledge/entries', (route) => json(route, { items: knowledgeEntries, count: knowledgeEntries.length }));
  await page.route('**/api/v1/knowledge/entries/*', (route) => {
    const slug = new URL(route.request().url()).pathname.split('/').pop();
    const detail = knowledgeDetails.find((entry) => entry.slug === slug);
    if (detail) return json(route, detail);
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'knowledge entry not found' }),
    });
  });
  await page.route('**/api/v1/projects/den-web/agent-guidance', (route) => json(route, guidancePacket('den-web', [projectGuidanceEntry, globalGuidanceEntry])));
  await page.route('**/api/v1/projects/den-web/agent-guidance?**', (route) => json(route, guidancePacket('den-web', [projectGuidanceEntry, globalGuidanceEntry])));
  await page.route('**/api/v1/projects/_global/agent-guidance', (route) => json(route, guidancePacket('_global', [globalGuidanceEntry])));
  await page.route('**/api/v1/projects/_global/agent-guidance?**', (route) => json(route, guidancePacket('_global', [globalGuidanceEntry])));
  await page.route('**/api/v1/projects/den-web/agent-guidance/entries/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      await json(route, { deleted: true, message: 'Agent guidance entry deleted.' });
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/v1/projects/den-web/agent-guidance/entries', guidanceEntriesRoute);
  await page.route('**/api/v1/projects/den-web/agent-guidance/entries?**', guidanceEntriesRoute);
  await page.route('**/api/v1/projects/_global/agent-guidance/entries?**', (route) => json(route, { entries: [globalGuidanceEntry], count: 1 }));
  await page.route('**/api/v1/blog/publications/preview', (route) => json(route, publication));
  await page.route('**/api/v1/blog/publications', (route) => json(route, { ...publication, status: 'published', dry_run: false }));
  await page.route('**/api/v1/projects/den-web/librarian/query', (route) => json(route, { answer: 'Librarian fixture loaded', sources: [{ title: 'fixture' }] }));
  await page.route('**/api/v1/observation/lane?**', (route) => json(route, observation));
}

function includeArchivedHidden(route: Route): boolean {
  const url = new URL(route.request().url());
  return url.searchParams.get('include_archived') === 'true' && url.searchParams.get('include_hidden') === 'true';
}

function messagesFor(route: Route): unknown {
  const url = new URL(route.request().url());
  return url.searchParams.get('task_id') === '3993' ? taskMessages : messages;
}

async function guidanceEntriesRoute(route: Route): Promise<void> {
  if (route.request().method() === 'POST') {
    const body = route.request().postDataJSON() as { readonly importance?: string; readonly audience?: readonly string[]; readonly sort_order?: number; readonly notes?: string };
    await json(route, {
      ...projectGuidanceEntry,
      importance: body.importance ?? projectGuidanceEntry.importance,
      audience: body.audience ?? projectGuidanceEntry.audience,
      sort_order: body.sort_order ?? projectGuidanceEntry.sort_order,
      notes: body.notes ?? projectGuidanceEntry.notes,
    });
    return;
  }
  await json(route, { entries: [projectGuidanceEntry, globalGuidanceEntry], count: 2 });
}

function guidancePacket(projectId: string, entries: readonly (typeof projectGuidanceEntry)[]): unknown {
  return {
    project_id: projectId,
    resolved_at: '2026-07-02T00:00:00Z',
    sources: entries.map((entry) => ({
      entry_id: entry.id,
      source_scope: entry.project_id,
      document_project_id: entry.document_project_id,
      document_slug: entry.document_slug,
      document_title: entry.document_slug === 'global-brief' ? 'Global Brief' : 'Successor Brief',
      document_type: 'reference',
      document_updated_at: '2026-07-02T00:00:00Z',
      visibility: 'normal',
      tags: entry.document_slug === 'global-brief' ? ['global'] : ['successor'],
      importance: entry.importance,
      audience: entry.audience,
      sort_order: entry.sort_order,
      notes: entry.notes,
      content_bytes: 64,
    })),
    skipped_sources: [],
    content_sha256: 'fixture',
    content_bytes: 128,
    truncated: false,
    incomplete: false,
  };
}

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
