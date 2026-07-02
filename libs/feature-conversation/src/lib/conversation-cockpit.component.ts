import { Component, computed, effect, inject, signal } from '@angular/core';
import { channelMessagePrimaryBody, conversationChannelLabel, messageSender } from '@den-web/domain';
import { CONVERSATION_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';

@Component({
  selector: 'den-conversation-cockpit',
  standalone: true,
  styles: [`
    :host { display: block; min-width: 0; }
    .surface { display: grid; gap: 14px; padding: 20px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h2 { font-size: var(--den-font-size-xl); margin: 0; }
    .grid { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 14px; }
    .panel { border: 1px solid var(--den-border); border-radius: 8px; background: var(--den-panel); min-width: 0; }
    .panel-inner { display: grid; gap: 10px; padding: 12px; }
    button, textarea { font: inherit; }
    button { border: 1px solid var(--den-border); border-radius: 6px; background: var(--den-input); color: var(--den-text); min-height: 36px; padding: 0 10px; text-align: left; }
    button[aria-pressed='true'] { background: var(--den-selected); border-color: var(--den-accent); }
    textarea { min-height: 76px; resize: vertical; border: 1px solid var(--den-border); border-radius: 6px; padding: 10px; }
    .muted, .state { color: var(--den-muted); font-size: var(--den-font-size-md); }
    .error { color: var(--den-danger); }
    .message, .timeline { border-top: 1px solid var(--den-border); padding-top: 10px; }
    strong { display: block; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `],
  template: `
    <section class="surface" aria-label="Conversation">
      <header>
        <h2>Conversation</h2>
        <span class="muted">{{ selectedProjectId() || 'Select a project' }}</span>
      </header>
      <div class="grid">
        <aside class="panel">
          <div class="panel-inner">
            <strong>Channels</strong>
            @switch (channels().kind) {
              @case ('loading') { <p class="state">Loading channels</p> }
              @case ('error') { <p class="state error">{{ errorText(channelsError()) }}</p> }
              @case ('data') {
                @if (channelItems().length === 0) { <p class="state">No channels</p> }
                @for (channel of channelItems(); track channel.id) {
                  <button type="button" [attr.aria-pressed]="channel.id === selectedChannelId()" (click)="selectChannel(channel.id)">
                    {{ channelLabel(channel) }}
                  </button>
                }
              }
              @default { <p class="state">Ready</p> }
            }
          </div>
        </aside>
        <div class="panel">
          <div class="panel-inner">
            <strong>{{ selectedChannelLabel() }}</strong>
            @switch (messages().kind) {
              @case ('loading') { <p class="state">Loading messages</p> }
              @case ('error') { <p class="state error">{{ errorText(messagesError()) }}</p> }
              @case ('data') {
                @if (messageItems().length === 0) { <p class="state">No messages</p> }
                @for (message of messageItems(); track message.id) {
                  <article class="message">
                    <strong>{{ sender(message) }}</strong>
                    <div class="muted">{{ body(message) }}</div>
                  </article>
                }
              }
              @default { <p class="state">Select a channel</p> }
            }
            <textarea aria-label="Conversation message" [value]="draft()" (input)="setDraft($event)"></textarea>
            <button type="button" (click)="send()">Send</button>
            <strong>Timeline</strong>
            @switch (timeline().kind) {
              @case ('loading') { <p class="state">Loading timeline</p> }
              @case ('error') { <p class="state error">{{ errorText(timelineError()) }}</p> }
              @case ('data') {
                @if (timelineItems().length === 0) { <p class="state">No timeline items</p> }
                @for (item of timelineItems(); track item.id) {
                  <div class="timeline"><strong>{{ item.title }}</strong><span class="muted">{{ item.kind }}</span></div>
                }
              }
              @default { <p class="state">Timeline fallback ready</p> }
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class ConversationCockpitComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly conversation = inject(CONVERSATION_STORE);
  private loadedProjectId: string | null = null;
  protected readonly draft = signal('');
  protected readonly selectedProjectId = this.workspace.selectedProjectId;
  protected readonly channels = this.conversation.channels;
  protected readonly messages = this.conversation.messages;
  protected readonly timeline = this.conversation.timeline;
  protected readonly selectedChannelId = this.conversation.selectedChannelId;
  protected readonly channelItems = computed(() => stateValue(this.channels()) ?? []);
  protected readonly messageItems = computed(() => stateValue(this.messages()) ?? []);
  protected readonly timelineItems = computed(() => stateValue(this.timeline()) ?? []);
  protected readonly selectedChannelLabel = computed(() => conversationChannelLabel(this.conversation.selectedChannel(), '#select-channel'));
  protected readonly channelsError = computed(() => errorOf(this.channels()));
  protected readonly messagesError = computed(() => errorOf(this.messages()));
  protected readonly timelineError = computed(() => errorOf(this.timeline()));

  private readonly refreshEffect = effect(() => {
    const projectId = this.selectedProjectId();
    if (!projectId || projectId === this.loadedProjectId) return;
    this.loadedProjectId = projectId;
    queueMicrotask(() => void this.conversation.refreshChannels(projectId));
  });

  private readonly autoSelectEffect = effect(() => {
    const firstChannelId = this.channelItems()[0]?.id;
    if (firstChannelId === undefined || this.selectedChannelId() !== null) return;
    queueMicrotask(() => void this.conversation.selectChannel(firstChannelId));
  });

  protected selectChannel(channelId: number): void { void this.conversation.selectChannel(channelId); }
  protected setDraft(event: Event): void { if (event.target instanceof HTMLTextAreaElement) this.draft.set(event.target.value); }
  protected send(): void {
    const body = this.draft().trim();
    if (!body) return;
    this.draft.set('');
    void this.conversation.sendMessage('web-ui', body, `web-ui:${Date.now()}`);
  }
  protected channelLabel = conversationChannelLabel;
  protected sender = messageSender;
  protected body = channelMessagePrimaryBody;
  protected errorText(error: { readonly kind: string; readonly message: string } | null): string { return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load'; }
}

function errorOf<T>(state: { readonly kind: string; readonly error?: T }): T | null {
  return state.kind === 'error' && state.error ? state.error : null;
}
