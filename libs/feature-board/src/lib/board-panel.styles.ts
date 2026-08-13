export const boardPanelStyles = `
  :host {
    display: block;
    height: calc(100dvh - 57px);
    min-width: 0;
    overflow: hidden;
  }

  .board {
    display: grid;
    grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
    height: 100%;
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

  .list-header,
  .detail-header {
    border-bottom: 1px solid var(--den-border);
    display: grid;
    gap: 8px;
    padding: 16px 18px;
  }

  h2,
  h3,
  h4,
  p {
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

  h4 {
    font-size: var(--den-font-size-md);
  }

  .muted,
  .state,
  .meta,
  .hint,
  .form-note {
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
  }

  .toolbar,
  .form-actions,
  .detail-actions,
  .section-head {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .toolbar {
    align-items: stretch;
  }

  .toolbar input {
    flex: 1 1 150px;
    min-width: 0;
  }

  input,
  textarea {
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    box-sizing: border-box;
    color: var(--den-text);
    font: inherit;
    min-width: 0;
    padding: 8px 9px;
    width: 100%;
  }

  input {
    min-height: 34px;
  }

  textarea {
    line-height: var(--den-line-height-normal);
    min-height: 110px;
    resize: vertical;
  }

  button {
    appearance: none;
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    color: var(--den-text);
    cursor: pointer;
    font: inherit;
    min-height: 34px;
    padding: 5px 10px;
  }

  button:hover,
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    border-color: var(--den-border-strong);
    outline: 2px solid color-mix(in srgb, var(--den-accent) 45%, transparent);
    outline-offset: 1px;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  .primary {
    background: var(--den-accent);
    border-color: var(--den-accent);
    color: var(--den-accent-contrast);
  }

  .danger {
    color: var(--den-danger);
  }

  .items,
  .detail-body {
    align-content: start;
    display: grid;
    gap: 10px;
    grid-auto-rows: max-content;
    min-height: 0;
    overflow: auto;
  }

  .items {
    padding: 10px;
  }

  .detail {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .detail-body {
    gap: 14px;
    padding: 18px;
  }

  .post-button,
  .search-result,
  .section,
  .composer,
  .post-form {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
  }

  .post-button,
  .search-result {
    display: grid;
    gap: 5px;
    min-width: 0;
    padding: 10px 11px;
    text-align: left;
    width: 100%;
  }

  button.post-button,
  button.search-result {
    cursor: pointer;
  }

  .post-button:hover,
  .post-button:focus-visible,
  .search-result:hover,
  .search-result:focus-visible,
  .post-button[aria-pressed='true'],
  .search-result[aria-pressed='true'] {
    background: var(--den-hover);
    border-color: var(--den-accent);
    outline: none;
  }

  .post-title,
  .result-title {
    overflow-wrap: anywhere;
  }

  .result-snippet {
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .section,
  .composer,
  .post-form {
    display: grid;
    gap: 10px;
    padding: 14px;
  }

  .section-head {
    justify-content: space-between;
  }

  .section-head h4 {
    margin-right: auto;
  }

  .post-body {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .comment-path {
    border-color: var(--den-accent);
  }

  .path-list {
    display: grid;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .path-item {
    border-left: 2px solid var(--den-border);
    display: grid;
    gap: 6px;
    min-width: 0;
    padding: 8px 0 8px 10px;
  }

  .path-item.path-target {
    background: color-mix(in srgb, var(--den-accent) 10%, transparent);
    border-left-color: var(--den-accent);
  }

  .path-body {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .reply-list {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .state.error,
  .error {
    color: var(--den-danger);
  }

  .success,
  .notice {
    color: var(--den-success, #378a55);
    font-size: var(--den-font-size-sm);
  }

  .mobile-back {
    display: none;
  }

  .dialog-backdrop {
    align-items: center;
    background: color-mix(in srgb, var(--den-bg) 76%, transparent);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 18px;
    position: fixed;
    z-index: 5;
  }

  .dialog {
    background: var(--den-panel);
    border: 1px solid var(--den-border-strong);
    border-radius: 8px;
    box-shadow: 0 12px 40px color-mix(in srgb, var(--den-bg) 55%, transparent);
    display: grid;
    gap: 12px;
    max-width: 520px;
    padding: 16px;
    width: min(100%, 520px);
  }

  @media (max-width: 840px) {
    :host {
      height: auto;
      min-height: calc(100vh - 250px);
      overflow: visible;
    }

    .board {
      display: block;
      height: auto;
      min-height: calc(100vh - 250px);
      overflow: visible;
      position: relative;
    }

    .list,
    .detail {
      height: auto;
      min-height: calc(100vh - 250px);
      width: 100%;
    }

    .detail {
      display: none;
    }

    .board.show-detail .list {
      display: none;
    }

    .board.show-detail .detail {
      display: grid;
    }

    .items,
    .detail-body {
      max-height: none;
      overflow: visible;
    }

    .mobile-back {
      display: inline-block;
      justify-self: start;
    }
  }
`;
