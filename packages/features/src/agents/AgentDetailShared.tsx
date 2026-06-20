import { detailText, type FullDetailItem } from './AgentDetailSharedUtils';

export function DetailLine({ label, value, onOpen }: { label: string; value: unknown; onOpen: (item: FullDetailItem) => void }) {
  return (
    <button
      type="button"
      className="agents-detail-line"
      onClick={() => onOpen({ title: label, value })}
      title="Open full detail"
    >
      <span className="agents-detail-line-label">{label}</span>
      <span className="agents-detail-line-value">{detailText(value)}</span>
    </button>
  );
}

export function FullDetailPanel({ item, onClose }: { item: FullDetailItem; onClose: () => void }) {
  return (
    <div className="detail-overlay agents-full-detail-panel" role="dialog" aria-label={`Full detail: ${item.title}`} aria-modal="true">
      <div className="detail-header">
        <div className="detail-title-block">
          <h2>{item.title}</h2>
          {item.subtitle && <span className="detail-subtle">{item.subtitle}</span>}
        </div>
        <button className="detail-close" onClick={onClose}>Close</button>
      </div>
      <div className="detail-body">
        <pre className="detail-pre agents-full-detail-pre">{detailText(item.value)}</pre>
      </div>
    </div>
  );
}
