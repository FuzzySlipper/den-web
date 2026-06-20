
import type { ChannelActivityEvent, ChannelMessage } from '@den-web/api/types';
import { firstIdentifier, firstPositiveInteger, firstString, legacyDeliveryRequestIdFromDedupeKey, parseJsonObject } from './activityUtils';

export function channelMessageDeliveryRequestId(
  message: Pick<ChannelMessage, 'metadataJson' | 'sourceKind' | 'sourceId' | 'dedupeKey'> & Partial<Pick<ChannelMessage, 'deliveryRequestId'>>,
): string | null {
  const firstClass = firstString(message.deliveryRequestId);
  if (firstClass) return firstClass;

  const metadata = parseJsonObject(message.metadataJson);
  const metadataDeliveryRequestId = firstIdentifier(
    metadata.deliveryRequestId,
    metadata.delivery_request_id,
    metadata.channelMessageDeliveryRequestId,
    metadata.channel_message_delivery_request_id,
    metadata.deliveryId,
    metadata.delivery_id,
    metadata.requestId,
    metadata.request_id,
  );
  if (metadataDeliveryRequestId) return metadataDeliveryRequestId;

  const dedupeKey = firstString(message.dedupeKey);
  const dedupeDeliveryRequestId = dedupeKey ? legacyDeliveryRequestIdFromDedupeKey(dedupeKey) : null;
  if (dedupeDeliveryRequestId) return dedupeDeliveryRequestId;

  if (message.sourceKind === 'gateway_delivery' || message.sourceKind === 'external_adapter_message') {
    const sourceId = firstString(message.sourceId);
    if (sourceId) return sourceId;
  }

  return null;
}

export function activityFinalChannelMessageId(event: ChannelActivityEvent): number | null {
  const metadata = parseJsonObject(event.metadataJson);
  return firstPositiveInteger(event.finalChannelMessageId, metadata.finalChannelMessageId, metadata.final_channel_message_id);
}

export function messageHasCheckpointMetadata(
  message: Pick<ChannelMessage, 'metadataJson'>,
): boolean {
  const metadata = parseJsonObject(message.metadataJson);
  return (
    metadata.checkpoint !== undefined ||
    metadata.checkpoint_id !== undefined ||
    metadata.checkpoint_request !== undefined ||
    metadata.checkpoint_response !== undefined ||
    metadata.checkpoint_sequence !== undefined ||
    metadata.checkpoint_status !== undefined ||
    metadata.assignment_checkpoint !== undefined
  );
}
