import { formatTimeAgo } from '@den-web/shared';
import type { Message, TaskDetail as TaskDetailType } from '@den-web/api/types';
import { messageIntentLabel } from '../messages/messageIntents';
import { dependencyStatusSatisfied } from './taskAvailability';

interface Props {
  detail: TaskDetailType;
  dependencyWaiting: boolean;
  onSelectMessage: (message: Message) => void;
  onSelectTask: (taskId: number) => void;
}

export function TaskRelationsSections({
  detail,
  dependencyWaiting,
  onSelectMessage,
  onSelectTask,
}: Props) {
  const { task } = detail;
  const handleTaskNavigation = (nextTaskId: number) => {
    if (nextTaskId !== task.id) onSelectTask(nextTaskId);
  };

  return (
    <>
      {detail.dependencies.length > 0 && (
        <div className="detail-section">
          <h3>Dependencies</h3>
          {dependencyWaiting && (
            <p className="detail-hint">Automatic wait: unfinished dependencies defer this task without creating a manual blocker.</p>
          )}
          {detail.dependencies.map(dep => {
            const satisfied = dependencyStatusSatisfied(dep.status);
            return (
              <button
                key={dep.task_id}
                type="button"
                className={`list-item detail-nav-button dependency-item ${satisfied ? 'dependency-item-satisfied' : 'dependency-item-waiting'}`}
                onClick={() => handleTaskNavigation(dep.task_id)}
                title={`${satisfied ? 'Satisfied' : 'Unfinished dependency'}: open task #${dep.task_id}`}
              >
                <span className={`badge badge-${dep.status}`}>{dep.status}</span>
                <span className={`dependency-state ${satisfied ? 'dependency-state-satisfied' : 'dependency-state-waiting'}`}>
                  {satisfied ? 'satisfied' : 'waiting'}
                </span>
                {' '}#{dep.task_id} {dep.title}
              </button>
            );
          })}
        </div>
      )}

      {detail.subtasks.length > 0 && (
        <div className="detail-section">
          <h3>Subtasks</h3>
          {detail.subtasks.map(sub => (
            <button
              key={sub.id}
              type="button"
              className="list-item detail-nav-button"
              onClick={() => handleTaskNavigation(sub.id)}
              title={`Open task #${sub.id}`}
            >
              <span className={`badge badge-${sub.status}`}>{sub.status}</span>
              {' '}#{sub.id} {sub.title}
            </button>
          ))}
        </div>
      )}

      {task.description && (
        <div className="detail-section">
          <h3>Description</h3>
          <div className="detail-description">{task.description}</div>
        </div>
      )}

      {detail.recent_messages.length > 0 && (
        <div className="detail-section">
          <h3>Recent Messages</h3>
          {detail.recent_messages.map(msg => (
            <button
              key={msg.id}
              type="button"
              className="message-item detail-nav-button detail-message-button"
              onClick={() => onSelectMessage(msg)}
              title={msg.thread_id != null ? `Open thread #${msg.thread_id}` : `Open message #${msg.id}`}
            >
              <span className="message-time">{formatTimeAgo(msg.created_at)}</span>
              <span className={`intent-chip intent-${msg.intent}`}>{messageIntentLabel(msg.intent)}</span>
              <span className="message-sender">{msg.sender}:</span>
              <span className="message-content">{msg.content.replace(/\n/g, ' ')}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
