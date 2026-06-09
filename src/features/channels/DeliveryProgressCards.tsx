import type { ChannelActivityEvent } from '../../api/types';
import { sortActivityEvents, toActivityDisplayModel } from './channelChatRenderModel';
import { ActivityTimeline } from './ActivityTimeline';

/** Collapsible cards summarizing in-flight/finished agent delivery work, grouped by display block. */
export function DeliveryProgressCards({ blocks }: { blocks: Array<{ displayBlockId: string; events: ChannelActivityEvent[] }> }) {
  if (blocks.length === 0) return null;
  return (
    <div className="channel-chat-delivery-progress-list" aria-label="Agent delivery progress">
      {blocks.map(block => {
        const group = sortActivityEvents(block.events);
        const terminal = group.some(event => event.terminal);
        const latest = group[group.length - 1];
        const model = latest ? toActivityDisplayModel(latest) : null;
        return (
          <details key={block.displayBlockId} className={`channel-chat-delivery-progress ${terminal ? 'channel-chat-delivery-progress-terminal' : ''}`} open={!terminal}>
            <summary>
              <span>{terminal ? 'Delivery finished' : 'Agent working'}</span>
              {latest && <strong>{latest.agentIdentity}</strong>}
              <span>{block.displayBlockId}</span>
              <span>{group.length} event{group.length === 1 ? '' : 's'}</span>
              {model?.finalChannelMessageId && <span>final message #{model.finalChannelMessageId}</span>}
            </summary>
            <ActivityTimeline events={group} compact />
          </details>
        );
      })}
    </div>
  );
}
