export const wikiPanelStyles = `
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

  button,
  input {
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    box-sizing: border-box;
    color: var(--den-text);
    font: inherit;
    min-height: 32px;
  }

  button {
    cursor: pointer;
    padding: 4px 10px;
    white-space: nowrap;
  }

  input {
    min-width: 0;
    padding: 4px 8px;
    width: 260px;
  }

  button:hover,
  button:focus-visible,
  input:focus-visible {
    border-color: var(--den-border-strong);
    outline: 2px solid color-mix(in srgb, var(--den-accent) 45%, transparent);
    outline-offset: 1px;
  }

  a {
    color: var(--den-accent);
  }

  .surface {
    display: grid;
    gap: 16px;
    max-width: 1500px;
    padding: 20px;
  }

  header {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    justify-content: space-between;
  }

  h1,
  h2,
  h3,
  p,
  ul,
  ol,
  dl,
  dd {
    margin: 0;
  }

  h2 {
    font-size: var(--den-font-size-xl);
  }

  h3 {
    font-size: var(--den-font-size-base);
  }

  .heading {
    display: grid;
    gap: 4px;
  }

  .toolbar {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .muted {
    color: var(--den-muted);
    font-size: var(--den-font-size-md);
  }

  .small-label {
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .notice {
    border: 1px solid var(--den-warning-border);
    border-radius: 8px;
    color: var(--den-warning);
    font-size: var(--den-font-size-md);
    padding: 8px 12px;
  }

  .notice.danger {
    border-color: var(--den-danger);
    color: var(--den-danger);
  }

  .layout {
    align-items: start;
    display: grid;
    gap: 20px;
    grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .browse {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
    display: grid;
    gap: 10px;
    padding: 12px;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tabs a {
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
    padding: 4px 8px;
    text-decoration: none;
  }

  .tabs a:hover {
    background: var(--den-hover);
  }

  .tabs a.active {
    background: var(--den-selected);
    border-color: var(--den-border);
    color: var(--den-text);
  }

  .zone-note {
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
    line-height: var(--den-line-height-normal);
  }

  .crumb {
    font-size: var(--den-font-size-sm);
  }

  .entries {
    display: grid;
    gap: 2px;
    list-style: none;
    padding: 0;
  }

  .entries li {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    font-size: var(--den-font-size-md);
    gap: 4px 8px;
    padding: 3px 4px;
  }

  .entries a {
    text-decoration: none;
  }

  .entries a:hover {
    text-decoration: underline;
  }

  .entries a.current {
    color: var(--den-text);
    font-weight: 700;
  }

  .entries a.folder {
    color: var(--den-text);
  }

  .results li {
    border-bottom: 1px solid var(--den-border);
    display: grid;
    gap: 2px;
    padding: 6px 4px;
  }

  .path,
  .count,
  .snippet {
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
  }

  .snippet {
    font-size: var(--den-font-size-sm);
    line-height: var(--den-line-height-normal);
  }

  .badge {
    border: 1px solid var(--den-border);
    border-radius: 999px;
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
    padding: 0 7px;
    text-decoration: none;
    white-space: nowrap;
  }

  a.badge {
    color: var(--den-accent);
  }

  .badge.warn,
  dd.warn {
    border-color: var(--den-warning-border);
    color: var(--den-warning);
  }

  .reader {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .page-head {
    display: grid;
    gap: 6px;
  }

  .page-head h1 {
    font-size: var(--den-font-size-xl);
    line-height: var(--den-line-height-tight);
  }

  .question {
    color: var(--den-muted);
    font-style: italic;
  }

  .page-grid {
    align-items: start;
    display: grid;
    gap: 20px;
    grid-template-columns: minmax(0, 1fr) minmax(200px, 270px);
  }

  @media (max-width: 1200px) {
    .page-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .facts {
      grid-row: 1;
    }
  }

  .body {
    max-width: 860px;
    min-width: 0;
  }

  .facts {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
    display: grid;
    font-size: var(--den-font-size-sm);
    gap: 8px;
    min-width: 0;
    overflow-wrap: anywhere;
    padding: 12px;
  }

  .facts dl {
    display: grid;
    gap: 4px;
  }

  .facts dl div {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .facts dt {
    color: var(--den-muted);
  }

  .facts dd.badge {
    font-size: var(--den-font-size-xs);
  }

  .facts h3 {
    margin-top: 4px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    border: 1px solid var(--den-border);
    border-radius: 999px;
    font-size: var(--den-font-size-xs);
    padding: 1px 8px;
    text-decoration: none;
  }

  .aliases {
    color: var(--den-muted);
  }

  .links {
    display: grid;
    gap: 3px;
    padding-left: 16px;
  }

  .history {
    border-top: 1px solid var(--den-border);
    display: grid;
    gap: 8px;
    max-width: 1140px;
    padding-top: 12px;
  }

  .history ol {
    display: grid;
    gap: 6px;
    list-style: none;
    padding: 0;
  }

  .history li {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    font-size: var(--den-font-size-sm);
    gap: 4px 10px;
  }

  .history .when,
  .history .hash {
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
  }

  .history .author {
    font-weight: 600;
  }

  .intro {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
    display: grid;
    gap: 8px;
    max-width: 720px;
    padding: 16px;
  }
`;
