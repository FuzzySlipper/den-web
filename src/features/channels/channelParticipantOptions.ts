export const DEFAULT_WAKE_POLICY = 'mentions_only';

export const WAKE_POLICY_OPTIONS = [
  { value: 'never', label: 'never' },
  { value: 'mentions_only', label: 'mentions only' },
  { value: 'direct_questions_only', label: 'direct questions' },
  { value: 'substantive_digest', label: 'substantive digest' },
  { value: 'all_human_messages', label: 'all human' },
  { value: 'all_messages_except_self', label: 'all except self' },
];

export const MEMBERSHIP_STATUS_OPTIONS = [
  { value: 'active', label: 'active' },
  { value: 'muted', label: 'muted' },
  { value: 'left', label: 'left' },
  { value: 'banned', label: 'banned' },
];
