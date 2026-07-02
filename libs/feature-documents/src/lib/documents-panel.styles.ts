export const documentsPanelStyles = `
  :host {
    display: block;
    min-width: 0;
  }

  .documents {
    display: grid;
    grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
    min-height: 100%;
  }

  .list,
  .detail {
    min-width: 0;
  }

  .list {
    border-right: 1px solid var(--den-border);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  header {
    border-bottom: 1px solid var(--den-border);
    display: grid;
    gap: 6px;
    padding: 18px 20px;
  }

  h2,
  h3 {
    margin: 0;
  }

  h2 {
    font-size: var(--den-font-size-xl);
    line-height: var(--den-line-height-tight);
  }

  h3 {
    font-size: var(--den-font-size-lg);
    line-height: var(--den-line-height-snug);
  }

  .muted,
  .state,
  .summary,
  .meta {
    color: var(--den-muted);
    font-size: var(--den-font-size-md);
  }

  .items {
    align-content: start;
    display: grid;
    gap: 8px;
    grid-auto-rows: max-content;
    overflow: auto;
    padding: 10px;
  }

  .doc-button,
  .section,
  .comment {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
  }

  .doc-button {
    appearance: none;
    color: var(--den-text);
    cursor: pointer;
    display: grid;
    grid-template-rows: minmax(1.25em, auto) minmax(1.25em, auto) minmax(22px, auto);
    gap: 6px;
    min-height: 74px;
    min-width: 0;
    padding: 10px 12px;
    text-align: left;
    width: 100%;
  }

  .doc-button:hover,
  .doc-button:focus-visible {
    background: var(--den-hover);
    border-color: var(--den-border-strong);
    outline: none;
  }

  .doc-button[aria-pressed='true'] {
    background: var(--den-selected);
    border-color: var(--den-accent);
  }

  .doc-title {
    font-size: var(--den-font-size-md);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .doc-button .meta {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chips {
    align-items: center;
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    min-height: 22px;
    min-width: 0;
    overflow: hidden;
  }

  .chip {
    border: 1px solid var(--den-border);
    border-radius: 999px;
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
    max-width: 100%;
    overflow: hidden;
    padding: 2px 7px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .detail-body {
    align-content: start;
    display: grid;
    gap: 14px;
    grid-auto-rows: max-content;
    overflow: auto;
    padding: 18px;
  }

  .section {
    align-content: start;
    display: grid;
    gap: 12px;
    padding: 14px;
  }

  .metadata-section {
    gap: 10px;
  }

  .section-head {
    align-items: start;
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }

  .section-actions {
    align-items: center;
    display: flex;
    gap: 8px;
  }

  .edit-button {
    appearance: none;
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    color: var(--den-text);
    cursor: pointer;
    font: inherit;
    min-height: 30px;
    padding: 0 10px;
  }

  .edit-button:hover,
  .edit-button:focus-visible {
    background: var(--den-hover);
    border-color: var(--den-border-strong);
    outline: none;
  }

  .meta-grid {
    align-items: start;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .meta-item {
    border: 1px solid var(--den-border);
    border-radius: 6px;
    box-sizing: border-box;
    display: grid;
    gap: 2px;
    min-width: 118px;
    padding: 7px 9px;
  }

  .label {
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
  }

  .value {
    color: var(--den-text);
    font-size: var(--den-font-size-md);
    overflow-wrap: anywhere;
  }

  .tags-item {
    max-width: 360px;
  }

  .comment {
    display: grid;
    gap: 8px;
    padding: 10px;
  }

  .reply {
    border-left: 2px solid var(--den-border-strong);
    color: var(--den-muted);
    display: grid;
    gap: 4px;
    padding-left: 10px;
  }

  .comment-body {
    white-space: pre-wrap;
  }

  .error {
    color: var(--den-danger);
  }

  @media (max-width: 920px) {
    .documents {
      grid-template-columns: 1fr;
    }

    .list {
      border-bottom: 1px solid var(--den-border);
      border-right: 0;
      min-height: 360px;
    }
  }
`;
