
import type { ChannelMessage } from '@den-web/api/types';
import { channelMessageDeliveryRequestId, messageHasCheckpointMetadata } from './deliveryRequests';

export interface AssignmentBadgeInfo {
  /** The delivery/assignment ID found on this message */
  assignmentId: string;
  /** Whether this message has checkpoint-related metadata */
  hasCheckpointMetadata: boolean;
  /** Whether the message source suggests it is a final/terminal delivery message */
  isFinalDelivery: boolean;
  /** Short label for the badge */
  label: string;
}

export function deriveAssignmentBadge(
  message: Pick<ChannelMessage, 'deliveryRequestId' | 'sourceKind' | 'sourceId' | 'dedupeKey' | 'metadataJson'>,
): AssignmentBadgeInfo | null {
  const assignmentId = channelMessageDeliveryRequestId(message);
  if (!assignmentId) return null;

  const hasCheckpoint = messageHasCheckpointMetadata(message);

  const isFinalDelivery =
    message.sourceKind === 'gateway_delivery' &&
    (message.dedupeKey?.includes(':final') ?? false);

  const label = isFinalDelivery
    ? 'final'
    : hasCheckpoint
      ? 'checkpoint'
      : 'delivery';

  return { assignmentId, hasCheckpointMetadata: hasCheckpoint, isFinalDelivery, label };
}
