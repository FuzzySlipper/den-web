
import type { GatewayMember } from '@den-web/api/types';

export interface MentionSuggestion {
  identity: string;
  label: string;
  memberType: string;
  membershipStatus: string;
  wakePolicy: string;
}

export interface MentionQuery {
  start: number;
  end: number;
  query: string;
}

export function findActiveMentionQuery(draft: string, cursorPosition = draft.length): MentionQuery | null {
  const prefix = draft.slice(0, cursorPosition);
  const match = /(^|\s)@([A-Za-z0-9_.-]*)$/.exec(prefix);
  if (!match || match.index == null) return null;
  const start = match.index + match[1].length;
  return { start, end: cursorPosition, query: match[2] ?? '' };
}

export function getMentionSuggestions(members: GatewayMember[], query: string, limit = 8): MentionSuggestion[] {
  const normalized = query.trim().toLowerCase();
  return members
    .filter(member => member.membershipStatus === 'active')
    .filter(member => normalized.length === 0 || member.memberIdentity.toLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftAgent = left.memberType === 'agent' ? 0 : 1;
      const rightAgent = right.memberType === 'agent' ? 0 : 1;
      return leftAgent - rightAgent || left.memberIdentity.localeCompare(right.memberIdentity);
    })
    .slice(0, limit)
    .map(member => ({
      identity: member.memberIdentity,
      label: `@${member.memberIdentity} · ${member.memberType} · ${member.membershipStatus} · ${member.wakePolicy}`,
      memberType: member.memberType,
      membershipStatus: member.membershipStatus,
      wakePolicy: member.wakePolicy,
    }));
}

export function insertMentionToken(draft: string, mention: MentionQuery, identity: string): string {
  const before = draft.slice(0, mention.start);
  const after = draft.slice(mention.end);
  const spacer = after.startsWith(' ') || after.length === 0 ? '' : ' ';
  return `${before}@${identity} ${spacer}${after}`;
}
