import { Component, computed, effect, inject, signal, ViewChild, type ElementRef } from '@angular/core';
import type { DenConversationMembership } from '@den-web/protocol';
import {
  artifactDimensions,
  artifactDisplayName,
  artifactRetentionLabel,
  conversationChannelLabel,
  conversationFeedItems,
  formatArtifactByteCount,
  type ArtifactReference,
  membershipIdentity,
  membershipStatus,
  membershipType,
  membershipWakePolicy,
  type ConversationFeedItem,
} from '@den-web/domain';
import { ArtifactEvidenceComponent, type ArtifactEvidenceItem } from '@den-web/feature-artifacts';
import { ARTIFACTS_STORE, CONVERSATION_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';
import { conversationCockpitStyles } from './conversation-cockpit.styles';

@Component({
  selector: 'den-conversation-cockpit',
  standalone: true,
  imports: [ArtifactEvidenceComponent],
  styles: [conversationCockpitStyles],
  template: `
    <section class="surface" aria-label="Conversation">
      <header class="top">
        <h2>Conversation</h2>
        <span class="muted">{{ selectedProjectId() || 'Select a project' }}</span>
      </header>

      <div class="layout">
        <aside class="side-stack">
          <section class="panel" aria-label="Channels">
            <header>
              <h3>Channels</h3>
              <span class="muted">{{ channelItems().length }} loaded</span>
            </header>

            <div class="list">
              @switch (channels().kind) {
                @case ('loading') { <p class="state">Loading channels</p> }
                @case ('error') { <p class="state error">{{ errorText(channelsError()) }}</p> }
                @case ('data') {
                  @if (channelItems().length === 0) {
                    <p class="state">No channels</p>
                  } @else {
                    @for (channel of channelItems(); track channel.id) {
                      <button
                        type="button"
                        class="channel-button"
                        [attr.aria-pressed]="channel.id === selectedChannelId()"
                        (click)="selectChannel(channel.id)"
                      >
                        <strong>{{ channelLabel(channel) }}</strong>
                        <span class="muted">{{ channel.kind || 'channel' }}</span>
                      </button>
                    }
                  }
                }
                @default { <p class="state">Select a project</p> }
              }
            </div>
          </section>

          <section class="panel" aria-label="Channel participants">
            <header>
              <h3>Participants</h3>
              <span class="muted">{{ membershipItems().length }} current</span>
            </header>

            <div class="participants">
              @switch (memberships().kind) {
                @case ('loading') { <p class="state">Loading participants</p> }
                @case ('error') { <p class="state error">{{ errorText(membershipsError()) }}</p> }
                @case ('data') {
                  @if (membershipItems().length === 0) {
                    <p class="state">No participants</p>
                  } @else {
                    @for (member of membershipItems(); track participantKey(member)) {
                      <div class="participant">
                        <div class="participant-line">
                          <strong>{{ memberIdentity(member) }}</strong>
                          <span class="kind">{{ memberType(member) }}</span>
                        </div>
                        <span class="muted">{{ memberStatus(member) }} · {{ memberWakePolicy(member) }}</span>
                      </div>
                    }
                  }
                }
                @default { <p class="state">Select a channel</p> }
              }
            </div>
          </section>
        </aside>

        <section class="chat" aria-label="Channel chat">
          <header class="chat-header">
            <h3>{{ selectedChannelLabel() }}</h3>
            <span class="muted">{{ feedItems().length }} feed items</span>
          </header>

          <div class="scrollback" aria-live="polite">
            @if (messages().kind === 'loading' && feedItems().length === 0) {
              <p class="state">Loading messages</p>
            } @else if (messagesError() || timelineError()) {
              <p class="state error">{{ errorText(messagesError() || timelineError()) }}</p>
            } @else if (feedItems().length === 0) {
              <p class="state">No messages yet</p>
            } @else {
              @for (item of feedItems(); track item.id) {
                <article class="message" [attr.data-source]="item.source">
                  <div class="message-meta">
                    <span class="time">{{ timestamp(item) }}</span>
                    <span class="sender">{{ item.sender }}</span>
                    <span class="kind">{{ item.kind }}</span>
                  </div>
                  <div class="body">{{ item.body }}</div>
                  <den-artifact-evidence [items]="artifactEvidenceItems(item.artifactRefs)" />
                </article>
              }
            }
            <div #scrollAnchor aria-hidden="true"></div>
          </div>

          <form class="composer" (submit)="send($event)">
            <textarea
              aria-label="Conversation message"
              rows="3"
              wrap="soft"
              [disabled]="!selectedChannelId() || sending()"
              [value]="draft()"
              (input)="setDraft($event)"
            ></textarea>
            <button type="submit" class="send-button" [disabled]="!selectedChannelId() || sending() || draft().trim().length === 0">
              {{ sending() ? 'Sending' : 'Send' }}
            </button>
          </form>
        </section>
      </div>
    </section>
  `,
})
export class ConversationCockpitComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly conversation = inject(CONVERSATION_STORE);
  private readonly artifacts = inject(ARTIFACTS_STORE);
  private loadedProjectId: string | null = null;
  private latestScrollKey = '';
  private scrollAnchor: ElementRef<HTMLElement> | null = null;

  @ViewChild('scrollAnchor') set latestAnchor(anchor: ElementRef<HTMLElement> | undefined) {
    this.scrollAnchor = anchor ?? null;
  }

  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly selectedProjectId = this.workspace.selectedProjectId;
  protected readonly channels = this.conversation.channels;
  protected readonly messages = this.conversation.messages;
  protected readonly memberships = this.conversation.memberships;
  protected readonly timeline = this.conversation.timeline;
  protected readonly selectedChannelId = this.conversation.selectedChannelId;
  protected readonly channelItems = computed(() => stateValue(this.channels()) ?? []);
  protected readonly messageItems = computed(() => stateValue(this.messages()) ?? []);
  protected readonly membershipItems = computed(() => stateValue(this.memberships()) ?? []);
  protected readonly timelineItems = computed(() => stateValue(this.timeline()) ?? []);
  protected readonly feedItems = computed(() => conversationFeedItems(this.messageItems(), this.timelineItems()));
  protected readonly selectedChannelLabel = computed(() => conversationChannelLabel(this.conversation.selectedChannel(), '#select-channel'));
  protected readonly channelsError = computed(() => errorOf(this.channels()));
  protected readonly messagesError = computed(() => errorOf(this.messages()));
  protected readonly membershipsError = computed(() => errorOf(this.memberships()));
  protected readonly timelineError = computed(() => errorOf(this.timeline()));

  private readonly refreshEffect = effect(() => {
    const projectId = this.selectedProjectId();
    if (!projectId || projectId === this.loadedProjectId) return;
    this.loadedProjectId = projectId;
    queueMicrotask(() => void this.conversation.refreshChannels(projectId));
  });

  private readonly scrollEffect = effect(() => {
    const scrollKey = `${this.selectedProjectId() ?? ''}:${this.selectedChannelId() ?? ''}:${this.feedItems().length}`;
    this.scheduleScroll(scrollKey);
  });

  private readonly artifactLoadEffect = effect(() => {
    for (const item of this.feedItems()) {
      for (const ref of item.artifactRefs) void this.artifacts.load(ref.ref);
    }
  });

  protected selectChannel(channelId: number): void {
    void this.conversation.selectChannel(channelId);
  }

  protected setDraft(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) this.draft.set(event.target.value);
  }

  protected send(event: Event): void {
    event.preventDefault();
    const body = this.draft().trim();
    if (!body || !this.selectedChannelId() || this.sending()) return;
    this.sending.set(true);
    this.draft.set('');
    void this.conversation.sendMessage('web-ui', body, `web-ui:${Date.now()}`).finally(() => {
      this.sending.set(false);
      this.scheduleScroll('sent');
    });
  }

  protected timestamp(item: ConversationFeedItem): string {
    if (!item.createdAt) return 'unknown time';
    const date = new Date(item.createdAt);
    if (Number.isNaN(date.getTime())) return item.createdAt;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected participantKey(member: DenConversationMembership): string {
    return String(member.id ?? `${member.channel_id ?? member.channelId ?? 'channel'}:${membershipIdentity(member)}`);
  }

  protected channelLabel = conversationChannelLabel;
  protected memberIdentity = membershipIdentity;
  protected memberType = membershipType;
  protected memberStatus = membershipStatus;
  protected memberWakePolicy = membershipWakePolicy;

  protected artifactEvidenceItems(refs: readonly ArtifactReference[]): readonly ArtifactEvidenceItem[] {
    return refs.map((ref) => {
      const state = this.artifacts.stateFor(ref.ref);
      const metadata = stateValue(state) ?? null;
      return {
        ref: ref.ref,
        label: artifactDisplayName(ref, metadata),
        status: state.kind === 'error' ? 'error' : metadata ? 'ready' : 'loading',
        contentUrl: metadata ? this.artifacts.contentUrl(metadata) : null,
        error: state.kind === 'error' ? state.error.message : null,
        mimeType: metadata?.mime_type ?? ref.mimeType,
        byteCount: metadata ? formatArtifactByteCount(metadata.byte_count) : null,
        dimensions: metadata ? artifactDimensions(metadata) : null,
        sha256: metadata?.sha256 ?? null,
        sensitive: metadata?.sensitive ?? ref.sensitive ?? false,
        retention: metadata ? artifactRetentionLabel(metadata) : null,
      };
    });
  }

  protected errorText(error: { readonly kind: string; readonly message: string } | null): string {
    return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load';
  }

  private scheduleScroll(scrollKey: string): void {
    this.latestScrollKey = scrollKey;
    queueMicrotask(() => this.scrollToLatest());
  }

  private scrollToLatest(): void {
    if (!this.latestScrollKey) return;
    this.scrollAnchor?.nativeElement.scrollIntoView({ block: 'end' });
  }
}

function errorOf<T>(state: { readonly kind: string; readonly error?: T }): T | null {
  return state.kind === 'error' && state.error ? state.error : null;
}
