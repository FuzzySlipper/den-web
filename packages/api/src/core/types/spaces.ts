export type SpaceKind = 'project' | 'personal' | 'assistant' | 'knowledge_base' | 'system' | string;
export type SpaceVisibility = 'normal' | 'hidden' | 'archived' | string;

export interface Space {
  id: string;
  name: string;
  kind: SpaceKind;
  visibility: SpaceVisibility;
  owner: string | null;
  root_path: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  kind?: SpaceKind;
  visibility?: SpaceVisibility;
  owner?: string | null;
  root_path: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectWithStats {
  project: Project;
  task_counts_by_status: Record<string, number>;
  unread_message_count: number;
}
