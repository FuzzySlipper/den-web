export const knowledgePanelStyles = `
  :host {
    display: block;
    height: calc(100dvh - 57px);
    min-width: 0;
    overflow: hidden;
  }

  .knowledge {
    display: grid;
    grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
    height: 100%;
    max-height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .list,
  .detail {
    min-height: 0;
    min-width: 0;
    overflow: hidden;
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

  .items,
  .detail-body {
    min-height: 0;
    overflow: auto;
  }

  .items {
    align-content: start;
    display: grid;
    gap: 8px;
    grid-auto-rows: max-content;
    padding: 10px;
  }

  .entry-button,
  .section,
  .source-ref {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
  }

  .entry-button {
    appearance: none;
    color: var(--den-text);
    cursor: pointer;
    display: grid;
    gap: 6px;
    min-height: 74px;
    min-width: 0;
    padding: 10px 12px;
    text-align: left;
    width: 100%;
  }

  .entry-button:hover,
  .entry-button:focus-visible {
    background: var(--den-hover);
    border-color: var(--den-border-strong);
    outline: none;
  }

  .entry-button[aria-pressed='true'] {
    background: var(--den-selected);
    border-color: var(--den-accent);
  }

  .entry-title,
  .entry-button .meta {
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
    height: 100%;
    max-height: 100%;
  }

  .detail-body {
    align-content: start;
    display: grid;
    gap: 14px;
    grid-auto-rows: max-content;
    padding: 18px;
  }

  .section {
    align-content: start;
    display: grid;
    gap: 12px;
    padding: 14px;
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

  .section-head {
    align-items: start;
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }

  .source-list {
    display: grid;
    gap: 8px;
  }

  .source-ref {
    display: grid;
    gap: 4px;
    padding: 10px;
  }

  a {
    color: var(--den-accent);
    overflow-wrap: anywhere;
  }

  .error {
    color: var(--den-danger);
  }

  .mobile-back {
    display: none;
  }

  @media (max-width: 840px) {
    .knowledge {
      display: block;
      position: relative;
    }

    .list,
    .detail {
      height: 100%;
      width: 100%;
    }

    .detail {
      display: none;
    }

    .knowledge.show-detail .list {
      display: none;
    }

    .knowledge.show-detail .detail {
      display: grid;
    }

    .mobile-back {
      appearance: none;
      background: var(--den-input);
      border: 1px solid var(--den-border);
      border-radius: 6px;
      color: var(--den-text);
      cursor: pointer;
      display: inline-block;
      font: inherit;
      justify-self: start;
      min-height: 30px;
      padding: 0 10px;
    }
  }
`;
