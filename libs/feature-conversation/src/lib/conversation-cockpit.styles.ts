export const conversationCockpitStyles = `
  :host {
    display: block;
    height: calc(100dvh - 57px);
    min-width: 0;
    overflow: hidden;
  }

  .surface {
    box-sizing: border-box;
    display: grid;
    gap: 14px;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding: 16px;
  }

  .top {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
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
    font-size: var(--den-font-size-base);
    line-height: var(--den-line-height-snug);
  }

  .layout {
    display: grid;
    gap: 12px;
    grid-template-columns: 240px minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .side-stack {
    display: grid;
    gap: 12px;
    grid-template-rows: minmax(150px, 0.65fr) minmax(320px, 1.35fr);
    min-height: 0;
    overflow: hidden;
  }

  .panel,
  .chat {
    background: var(--den-panel);
    border: 1px solid var(--den-border);
    border-radius: 8px;
    min-width: 0;
  }

  .panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto auto;
    min-height: 0;
    overflow: hidden;
  }

  .panel header,
  .chat-header {
    border-bottom: 1px solid var(--den-border);
    display: grid;
    gap: 4px;
    padding: 10px 12px;
  }

  .list,
  .participants {
    align-content: start;
    display: grid;
    gap: 6px;
    min-height: 0;
    overflow: auto;
    padding: 8px;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  button {
    appearance: none;
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    color: var(--den-text);
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    background: var(--den-hover);
    border-color: var(--den-border-strong);
    outline: none;
  }

  button[disabled] {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .channel-button {
    display: grid;
    gap: 3px;
    min-height: 42px;
    padding: 7px 9px;
    text-align: left;
  }

  .channel-button[aria-pressed='true'] {
    background: var(--den-selected);
    border-color: var(--den-accent);
  }

  .participant {
    border: 1px solid var(--den-border);
    border-radius: 6px;
    background: transparent;
    color: var(--den-text);
    display: grid;
    gap: 3px;
    padding: 7px 9px;
    text-align: left;
    width: 100%;
  }

  .participant[aria-pressed='true'] {
    background: var(--den-selected);
    border-color: var(--den-accent);
  }

  .participant:disabled {
    cursor: default;
    opacity: 0.72;
  }

  .participant-editor,
  .agent-routing {
    border-top: 1px solid var(--den-border);
    display: grid;
    gap: 8px;
    padding: 10px;
  }

  .participant-editor label {
    display: grid;
    gap: 4px;
  }

  .participant-editor label span {
    color: var(--den-muted);
    font-size: var(--den-font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
  }

  .participant-actions {
    display: flex;
    gap: 8px;
  }

  .agent-routing {
    align-items: center;
    grid-template-columns: 1fr;
  }

  .agent-routing input,
  .agent-routing select,
  .participant-editor select {
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    box-sizing: border-box;
    color: var(--den-text);
    min-height: 34px;
    min-width: 0;
    padding: 0 9px;
    width: 100%;
  }

  .agent-routing input {
    grid-column: 1 / -1;
  }

  .agent-routing button {
    justify-self: end;
  }

  .participant-error {
    border-top: 1px solid var(--den-border);
    margin: 0;
    padding: 8px 10px;
  }

  .participant-line,
  .message-meta {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    min-width: 0;
  }

  .chat {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
    overflow: hidden;
  }

  .scrollback {
    align-content: start;
    display: grid;
    gap: 8px;
    min-height: 0;
    overflow: auto;
    padding: 12px;
  }

  .message {
    border-top: 1px solid var(--den-border);
    display: grid;
    gap: 5px;
    padding-top: 8px;
  }

  .message:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  .sender {
    color: var(--den-text);
    font-weight: 700;
  }

  .time,
  .kind,
  .muted,
  .state {
    color: var(--den-muted);
    font-size: var(--den-font-size-sm);
  }

  .kind {
    border: 1px solid var(--den-border);
    border-radius: 999px;
    padding: 1px 7px;
  }

  .body {
    color: var(--den-text);
    font-size: var(--den-font-size-md);
    line-height: var(--den-line-height-snug);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .composer {
    border-top: 1px solid var(--den-border);
    display: grid;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 10px;
    position: relative;
  }

  textarea {
    background: var(--den-input);
    border: 1px solid var(--den-border);
    border-radius: 6px;
    box-sizing: border-box;
    color: var(--den-text);
    line-height: var(--den-line-height-snug);
    min-height: calc(3lh + 18px);
    overflow-x: hidden;
    overflow-y: auto;
    padding: 8px 10px;
    resize: none;
    width: 100%;
  }

  .send-button {
    align-self: end;
    min-height: 36px;
    padding: 0 14px;
  }

  .mention-menu {
    background: var(--den-panel);
    border: 1px solid var(--den-border-strong);
    border-radius: 8px;
    bottom: calc(100% - 4px);
    box-shadow: 0 10px 22px rgb(0 0 0 / 16%);
    display: grid;
    left: 10px;
    max-height: 180px;
    min-width: 220px;
    overflow: auto;
    padding: 4px;
    position: absolute;
    z-index: 3;
  }

  .mention-option {
    border-radius: 6px;
    color: var(--den-text);
    font-size: var(--den-font-size-md);
    padding: 6px 8px;
  }

  .mention-option:first-child {
    background: var(--den-selected);
  }

  .error {
    color: var(--den-danger);
  }

  @media (max-width: 920px) {
    :host {
      height: calc(100dvh - 250px);
    }

    .surface {
      padding: 12px;
    }

    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr);
    }

    .side-stack {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: minmax(160px, 220px);
      height: 220px;
    }

    .composer {
      grid-template-columns: 1fr;
    }

    .send-button {
      justify-self: end;
    }
  }

  @media (max-width: 620px) {
    .top {
      align-items: start;
      display: grid;
    }

    .side-stack {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(130px, 180px) minmax(120px, 170px);
      height: 350px;
    }
  }
`;
