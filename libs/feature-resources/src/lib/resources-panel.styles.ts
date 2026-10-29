const controls = `
  button,
  input,
  select,
  textarea {
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    box-sizing: border-box;
    color: var(--den-text);
    font: inherit;
  }

  button {
    appearance: none;
    cursor: pointer;
    white-space: nowrap;
    min-height: 32px;
    padding: 4px 10px;
  }

  input,
  select,
  textarea {
    min-height: 32px;
    padding: 4px 8px;
  }

  button:hover,
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    border-color: var(--den-border-strong);
    outline: 2px solid color-mix(in srgb, var(--den-accent) 45%, transparent);
    outline-offset: 1px;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  button.primary {
    background: var(--den-accent);
    border-color: var(--den-accent);
    color: var(--den-accent-contrast, var(--den-bg));
  }

  .muted {
    color: var(--den-muted);
  }
`;

export const resourcesPanelStyles = `
  /* The shell clips its main area, so the panel scrolls itself. */
  :host {
    display: block;
    height: calc(100dvh - 57px);
    min-width: 0;
    overflow-y: auto;
  }

  @media (max-width: 840px) {
    :host {
      height: auto;
      overflow: visible;
    }
  }

  ${controls}

  .surface {
    display: grid;
    gap: 20px;
    max-width: 1400px;
    padding: 20px;
  }

  header,
  .section-heading {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    justify-content: space-between;
  }

  h2,
  h3,
  h4,
  p {
    margin: 0;
  }

  h2 {
    font-size: var(--den-font-size-xl);
  }

  h3 {
    font-size: var(--den-font-size-lg);
  }

  .heading {
    display: grid;
    gap: 4px;
  }

  .toolbar {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .muted,
  .state,
  .footnote {
    color: var(--den-muted);
    font-size: var(--den-font-size-md);
  }

  .small-label {
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .connection.live { color: var(--den-accent); }
  .connection.lost { color: var(--den-danger); }

  .notice {
    align-items: start;
    border: 1px solid var(--den-warning-border);
    border-radius: 8px;
    color: var(--den-warning);
    display: flex;
    gap: 12px;
    justify-content: space-between;
    padding: 10px 12px;
  }

  .notice.danger {
    border-color: var(--den-danger);
    color: var(--den-danger);
  }

  .notice.info {
    border-color: var(--den-border-strong);
    color: var(--den-text);
  }

  .summary-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .summary-card,
  .host-card,
  .resource-row,
  .table-wrap {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
  }

  .summary-card {
    display: grid;
    gap: 2px;
    padding: 12px 14px;
  }

  .summary-card strong {
    font-size: var(--den-font-size-xl);
  }

  section {
    display: grid;
    gap: 12px;
  }

  .host-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  .host-card {
    align-content: start;
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 14px;
  }

  .host-top,
  .host-footer,
  .app-line,
  .disk {
    align-items: center;
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .host-role,
  .host-note {
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
  }

  .pill {
    border: 1px solid currentColor;
    border-radius: 999px;
    display: inline-block;
    font-size: var(--den-font-size-sm);
    font-weight: 600;
    padding: 1px 9px;
    white-space: nowrap;
  }

  .tone-active { color: var(--den-accent); }
  .tone-queued,
  .tone-warning { color: var(--den-warning); }
  .tone-quiet,
  .tone-muted,
  .tone-unknown { color: var(--den-muted); }
  .tone-ok { color: var(--den-accent); }
  .tone-danger { color: var(--den-danger); }

  .metrics {
    display: grid;
    gap: 10px;
    grid-template-columns: 1fr 1fr;
  }

  .metric {
    color: var(--den-muted);
    display: grid;
    font-size: var(--den-font-size-sm);
    gap: 2px;
  }

  .metric strong {
    color: var(--den-text);
    font-size: var(--den-font-size-md);
  }

  .bar {
    background: var(--den-input);
    border-radius: 999px;
    height: 6px;
    overflow: hidden;
  }

  .bar i {
    background: var(--den-accent);
    display: block;
    height: 100%;
  }

  .gpu-line,
  .work-snippet,
  .command {
    font-size: var(--den-font-size-sm);
    overflow-wrap: anywhere;
  }

  .gpu-line span,
  .work-snippet .muted {
    color: var(--den-muted);
  }

  .app-line {
    border-top: 1px solid var(--den-border);
    font-size: var(--den-font-size-sm);
    padding-top: 6px;
  }

  .app-count { color: var(--den-accent); }
  .offline { color: var(--den-danger); }

  .error-note {
    color: var(--den-danger);
    font-size: var(--den-font-size-sm);
    overflow-wrap: anywhere;
  }

  button.link {
    background: none;
    border: 0;
    color: var(--den-accent);
    min-height: 0;
    padding: 0;
    text-decoration: underline;
  }

  details > summary {
    cursor: pointer;
  }

  .detail-block {
    border-top: 1px solid var(--den-border);
    display: grid;
    font-size: var(--den-font-size-sm);
    gap: 6px;
    padding-top: 6px;
  }

  .detail-block[open] > *:not(summary) {
    margin-top: 6px;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filters input {
    flex: 1 1 240px;
  }

  .resource-list {
    display: grid;
    gap: 8px;
  }

  .resource-row > summary {
    align-items: center;
    display: grid;
    gap: 8px 16px;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto minmax(0, 1fr);
    padding: 10px 14px;
  }

  .resource-name,
  .resource-used {
    display: grid;
    min-width: 0;
  }

  .resource-name small,
  .resource-used,
  .resource-host {
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
    overflow-wrap: anywhere;
  }

  .resource-used span {
    color: var(--den-text);
  }

  .resource-body {
    border-top: 1px solid var(--den-border);
    display: grid;
    gap: 8px;
    padding: 12px 14px;
  }

  .resource-body code,
  code {
    display: block;
    font-size: var(--den-font-size-sm);
    overflow-wrap: anywhere;
  }

  dl.dates {
    display: grid;
    font-size: var(--den-font-size-sm);
    gap: 4px 12px;
    grid-template-columns: max-content minmax(0, 1fr);
    margin: 0;
  }

  dl.dates dt {
    color: var(--den-muted);
  }

  dl.dates dd {
    margin: 0;
  }

  .resource-actions,
  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .table-wrap {
    overflow-x: auto;
  }

  .table-wrap > .state {
    padding: 14px;
  }

  table {
    border-collapse: collapse;
    font-size: var(--den-font-size-sm);
    width: 100%;
  }

  th,
  td {
    border-bottom: 1px solid var(--den-border);
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }

  td small {
    color: var(--den-muted);
    display: block;
    overflow-wrap: anywhere;
  }

  @media (max-width: 640px) {
    .resource-row > summary {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .metrics {
      grid-template-columns: 1fr;
    }
  }
`;

export const resourcesDialogStyles = `
  :host {
    display: contents;
  }

  ${controls}

  .dialog-backdrop {
    align-items: center;
    background: color-mix(in srgb, var(--den-bg) 76%, transparent);
    box-sizing: border-box;
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
    box-sizing: border-box;
    color: var(--den-text);
    display: grid;
    gap: 12px;
    max-height: calc(100dvh - 36px);
    overflow-y: auto;
    padding: 16px;
    width: min(100%, 560px);
  }

  .dialog-heading {
    align-items: start;
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: var(--den-font-size-lg);
  }

  .eyebrow {
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  label {
    display: grid;
    font-size: var(--den-font-size-sm);
    gap: 4px;
  }

  label small,
  .form-help {
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
  }

  .form-row {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr 1fr;
  }

  .form-error {
    color: var(--den-danger);
    font-size: var(--den-font-size-sm);
  }

  .dialog-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .close {
    min-width: 32px;
  }

  @media (max-width: 540px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
`;
