export const opsPanelStyles = `
  :host {
    display: block;
    min-width: 0;
  }

  .surface {
    display: grid;
    gap: 16px;
    padding: 20px;
    max-width: 1280px;
  }

  header {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    justify-content: space-between;
  }

  h2,
  h3,
  h4 {
    margin: 0;
  }

  h2 {
    font-size: var(--den-font-size-xl);
  }

  h3 {
    font-size: var(--den-font-size-lg);
  }

  h4 {
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .heading {
    display: grid;
    gap: 4px;
  }

  .toolbar {
    align-items: center;
    display: flex;
    gap: 10px;
  }

  .muted,
  .state {
    color: var(--den-muted);
    font-size: var(--den-font-size-md);
  }

  p.state {
    margin: 0;
  }

  .notice {
    border: 1px solid var(--den-warning-border);
    border-radius: 8px;
    color: var(--den-warning);
    margin: 0;
    padding: 10px 12px;
  }

  .notice.danger {
    border-color: var(--den-danger);
    color: var(--den-danger);
  }

  .summary {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pill {
    border: 1px solid currentColor;
    border-radius: 999px;
    display: inline-block;
    font-size: var(--den-font-size-sm);
    font-weight: 600;
    padding: 2px 10px;
    white-space: nowrap;
  }

  .tone-ok { color: var(--den-accent); }
  .tone-info { color: var(--den-text); }
  .tone-warning { color: var(--den-warning); }
  .tone-danger { color: var(--den-danger); }
  .tone-muted { color: var(--den-muted); }

  .hosts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .host {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
    display: grid;
    gap: 2px;
    min-width: 180px;
    padding: 8px 12px;
  }

  .jobs {
    display: grid;
    gap: 12px;
  }

  .job {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
    display: grid;
    gap: 12px;
    padding: 14px;
  }

  .job-head {
    align-items: start;
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }

  .job-title {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .facts {
    display: grid;
    gap: 12px 20px;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .fact {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .value {
    overflow-wrap: anywhere;
  }

  code {
    font-size: var(--den-font-size-sm);
    overflow-wrap: anywhere;
  }

  .problem {
    color: var(--den-danger);
    font-size: var(--den-font-size-sm);
    margin: 0;
    max-height: 7.5em;
    overflow: auto;
    white-space: pre-wrap;
  }

  .warn-text {
    color: var(--den-warning);
  }

  details summary {
    cursor: pointer;
  }

  button {
    appearance: none;
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    color: var(--den-text);
    cursor: pointer;
    font: inherit;
    min-height: 32px;
    padding: 4px 10px;
  }

  button:hover,
  button:focus-visible {
    border-color: var(--den-border-strong);
    outline: 2px solid color-mix(in srgb, var(--den-accent) 45%, transparent);
    outline-offset: 1px;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.58;
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

  .history {
    border-top: 1px solid var(--den-border);
    display: grid;
    gap: 10px;
    overflow-x: auto;
    padding-top: 12px;
  }
`;
