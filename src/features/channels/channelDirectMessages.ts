import type { ChannelMessage } from '../../api/types';
import { parseJsonRecord, stringFromUnknown } from './jsonRecord';

/**
 * Direct-agent-message metadata parsing, shared by the channel chat panel and
 * the focused session view.
 *
 * The two call sites read the same `deliveryMode === 'direct_agent_message'`
 * metadata but with intentionally different shapes, so they stay as two named
 * functions rather than one ambiguous return type:
 *
 *  - {@link parseDirectMessageMetadata} (channel chat panel) only recognises the
 *    metadata on `wake_event` source messages and returns the raw record so
 *    callers can inspect arbitrary delivery fields.
 *  - {@link directMessageEvidence} (focused session view) accepts the metadata
 *    regardless of source kind and returns a compact, typed delivery summary.
 */

export interface DirectMessageEvidence {
  target: string | null;
  status: string;
}

/** Parsed direct-agent-message metadata when present, or null. No source-kind restriction. */
function parseDirectAgentMetadata(metadataJson: string | null): Record<string, unknown> | null {
  const parsed = parseJsonRecord(metadataJson);
  if (!parsed) return null;
  return parsed.deliveryMode === 'direct_agent_message' ? parsed : null;
}

/**
 * Channel-chat-panel semantics: direct-message metadata is only carried on
 * `wake_event` source messages. Returns the raw metadata record for callers
 * that inspect delivery/claim/target fields directly.
 */
export function parseDirectMessageMetadata(message: ChannelMessage): Record<string, unknown> | null {
  if (message.sourceKind !== 'wake_event' || !message.metadataJson) return null;
  return parseDirectAgentMetadata(message.metadataJson);
}

/**
 * Focused-session-view semantics: extract a compact delivery-evidence summary
 * from any direct-agent-message, independent of source kind.
 */
export function directMessageEvidence(message: ChannelMessage): DirectMessageEvidence | null {
  const metadata = parseDirectAgentMetadata(message.metadataJson);
  if (!metadata) return null;
  const target = stringFromUnknown(metadata.targetMemberIdentity);
  const status = [
    stringFromUnknown(metadata.deliveryStatus),
    stringFromUnknown(metadata.claimStatus),
    stringFromUnknown(metadata.completionStatus),
    stringFromUnknown(metadata.suppressionStatus),
  ].filter(Boolean).join(' · ');
  return { target, status: status || 'claimed/delivered/reply-posted pending' };
}
