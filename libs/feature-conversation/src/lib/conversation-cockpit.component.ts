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
import { ARTIFACTS_STORE, CONVERSATION_STORE, PREFERENCES_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';
import { conversationCockpitStyles } from './conversation-cockpit.styles';

interface WakePolicyOption {
  readonly value: string;
  readonly label: string;
}

interface MembershipStatusOption {
  readonly value: string;
  readonly label: string;
}

const wakePolicyOptions: readonly WakePolicyOption[] = [
  { value: 'never', label: 'Never' },
  { value: 'mentions_only', label: 'Mentions only' },
  { value: 'direct_questions_only', label: 'Direct questions' },
  { value: 'substantive_digest', label: 'Substantive digest' },
  { value: 'all_human_messages', label: 'All human messages' },
  { value: 'all_messages_except_self', label: 'All except self' },
];

const membershipStatusOptions: readonly MembershipStatusOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'muted', label: 'Muted' },
  { value: 'left', label: 'Left' },
  { value: 'banned', label: 'Banned' },
];

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
                      <button
                        type="button"
                        class="participant"
                        [attr.aria-pressed]="isEditingMember(member)"
                        [disabled]="memberType(member) !== 'agent' || memberSaving()"
                        (click)="editMember(member)"
                      >
                        <div class="participant-line">
                          <strong>{{ memberIdentity(member) }}</strong>
                          <span class="kind">{{ memberType(member) }}</span>
                        </div>
                        <span class="muted">{{ memberStatus(member) }} · {{ memberWakePolicy(member) }}</span>
                      </button>
                    }
                  }
                }
                @default { <p class="state">Select a channel</p> }
              }
            </div>

            @let editedMember = editingMember();
            @if (editedMember) {
              <form class="participant-editor" aria-label="Edit participant activation" (submit)="saveMember($event)">
                <strong>{{ memberIdentity(editedMember) }}</strong>
                <label>
                  <span>Wake</span>
                  <select aria-label="Participant wake policy" [value]="editingWakePolicy()" [disabled]="memberSaving()" (change)="setEditingWakePolicy($event)">
                    @for (option of wakePolicyOptions; track option.value) {
                      <option [value]="option.value" [selected]="option.value === editingWakePolicy()">{{ option.label }}</option>
                    }
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select aria-label="Participant membership status" [value]="editingMembershipStatus()" [disabled]="memberSaving()" (change)="setEditingMembershipStatus($event)">
                    @for (option of membershipStatusOptions; track option.value) {
                      <option [value]="option.value" [selected]="option.value === editingMembershipStatus()">{{ option.label }}</option>
                    }
                  </select>
                </label>
                <div class="participant-actions">
                  <button type="submit" [disabled]="memberSaving()">{{ memberSaving() ? 'Saving' : 'Done' }}</button>
                  <button type="button" [disabled]="memberSaving()" (click)="cancelMemberEdit()">Cancel</button>
                </div>
              </form>
            }

            <form class="agent-routing" aria-label="Agent participant routing controls" (submit)="joinAgent($event)">
              <input
                aria-label="Agent identity to join"
                placeholder="agent identity"
                [value]="inviteIdentity()"
                [disabled]="!selectedChannelId() || inviteSaving()"
                (input)="setInviteIdentity($event)"
              />
              <select aria-label="New agent wake policy" [value]="inviteWakePolicy()" [disabled]="!selectedChannelId() || inviteSaving()" (change)="setInviteWakePolicy($event)">
                @for (option of wakePolicyOptions; track option.value) {
                  <option [value]="option.value" [selected]="option.value === inviteWakePolicy()">{{ option.label }}</option>
                }
              </select>
              <button type="submit" [disabled]="!selectedChannelId() || inviteSaving() || inviteIdentity().trim().length === 0">
                {{ inviteSaving() ? 'Joining' : 'Add agent' }}
              </button>
            </form>

            @if (participantError()) {
              <p class="state error participant-error">{{ participantError() }}</p>
            }
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
              (keydown)="handleComposerKeydown($event)"
            ></textarea>
            @if (mentionSuggestions().length > 0) {
              <div class="mention-menu" role="listbox" aria-label="Mention suggestions">
                @for (identity of mentionSuggestions(); track identity) {
                  <div class="mention-option" role="option">{{ identity }}</div>
                }
              </div>
            }
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
  private readonly preferencesStore = inject(PREFERENCES_STORE);
  private loadedProjectId: string | null = null;
  private latestScrollKey = '';
  private scrollAnchor: ElementRef<HTMLElement> | null = null;

  @ViewChild('scrollAnchor') set latestAnchor(anchor: ElementRef<HTMLElement> | undefined) {
    this.scrollAnchor = anchor ?? null;
  }

  protected readonly draft = signal('');
  protected readonly mentionQuery = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly editingMember = signal<DenConversationMembership | null>(null);
  protected readonly editingWakePolicy = signal('mentions_only');
  protected readonly editingMembershipStatus = signal('active');
  protected readonly memberSaving = signal(false);
  protected readonly inviteIdentity = signal('');
  protected readonly inviteWakePolicy = signal('mentions_only');
  protected readonly inviteSaving = signal(false);
  protected readonly participantError = signal<string | null>(null);
  protected readonly wakePolicyOptions = wakePolicyOptions;
  protected readonly membershipStatusOptions = membershipStatusOptions;
  protected readonly preferences = this.preferencesStore.preferences;
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
  protected readonly participantIdentities = computed(() => uniqueParticipantIdentities(this.membershipItems()));
  protected readonly mentionSuggestions = computed(() => {
    const query = this.mentionQuery();
    if (query === null) return [];
    const normalized = query.toLowerCase();
    return this.participantIdentities()
      .filter((identity) => identity.toLowerCase().startsWith(normalized))
      .slice(0, 6);
  });
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

  private readonly streamEffect = effect((onCleanup) => {
    const channelId = this.selectedChannelId();
    if (!channelId) return;
    const stop = this.conversation.streamChannel(channelId);
    onCleanup(() => stop());
  });

  protected selectChannel(channelId: number): void {
    this.cancelMemberEdit();
    this.participantError.set(null);
    void this.conversation.selectChannel(channelId);
  }

  protected setDraft(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) {
      this.draft.set(event.target.value);
      this.mentionQuery.set(mentionAtCursor(event.target)?.query ?? null);
    }
  }

  protected send(event: Event): void {
    event.preventDefault();
    this.sendDraft();
  }

  protected handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab' && event.target instanceof HTMLTextAreaElement && this.mentionSuggestions().length > 0) {
      event.preventDefault();
      this.applyMentionCompletion(event.target, this.mentionSuggestions()[0] ?? '');
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.sendDraft();
  }

  private sendDraft(): void {
    const body = this.draft().trim();
    if (!body || !this.selectedChannelId() || this.sending()) return;
    this.sending.set(true);
    this.draft.set('');
    this.mentionQuery.set(null);
    const sender = this.preferences().conversationSenderIdentity;
    void this.conversation.sendMessage(sender, body, `${sender}:${Date.now()}`).finally(() => {
      this.sending.set(false);
      this.scheduleScroll('sent');
    });
  }

  private applyMentionCompletion(textarea: HTMLTextAreaElement, identity: string): void {
    if (!identity) return;
    const mention = mentionAtCursor(textarea);
    if (!mention) return;
    const value = textarea.value;
    const next = `${value.slice(0, mention.start)}@${identity} ${value.slice(mention.end)}`;
    const caret = mention.start + identity.length + 2;
    this.draft.set(next);
    this.mentionQuery.set(null);
    queueMicrotask(() => {
      textarea.value = next;
      textarea.setSelectionRange(caret, caret);
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

  protected editMember(member: DenConversationMembership | null): void {
    if (!member || membershipType(member) !== 'agent') return;
    this.participantError.set(null);
    this.editingMember.set(member);
    this.editingWakePolicy.set(membershipWakePolicy(member));
    this.editingMembershipStatus.set(membershipStatus(member));
  }

  protected isEditingMember(member: DenConversationMembership): boolean {
    const editing = this.editingMember();
    return editing !== null && this.participantKey(editing) === this.participantKey(member);
  }

  protected setEditingWakePolicy(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) this.editingWakePolicy.set(target.value);
  }

  protected setEditingMembershipStatus(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) this.editingMembershipStatus.set(target.value);
  }

  protected cancelMemberEdit(): void {
    this.editingMember.set(null);
  }

  protected saveMember(event: Event): void {
    event.preventDefault();
    const member = this.editingMember();
    if (!member || this.memberSaving()) return;
    this.memberSaving.set(true);
    this.participantError.set(null);
    void this.conversation.saveMembership(member, {
      wakePolicy: this.editingWakePolicy(),
      membershipStatus: this.editingMembershipStatus(),
    }).then((result) => {
      if (result.ok) this.editingMember.set(null);
      else this.participantError.set(this.errorText(result.error));
    }).finally(() => this.memberSaving.set(false));
  }

  protected setInviteIdentity(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.inviteIdentity.set(target.value);
  }

  protected setInviteWakePolicy(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) this.inviteWakePolicy.set(target.value);
  }

  protected joinAgent(event: Event): void {
    event.preventDefault();
    const identity = this.inviteIdentity().trim();
    if (!identity || this.inviteSaving()) return;
    this.inviteSaving.set(true);
    this.participantError.set(null);
    void this.conversation.joinAgent(identity, this.inviteWakePolicy()).then((result) => {
      if (result.ok) this.inviteIdentity.set('');
      else this.participantError.set(this.errorText(result.error));
    }).finally(() => this.inviteSaving.set(false));
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

function uniqueParticipantIdentities(members: readonly DenConversationMembership[]): readonly string[] {
  return [...new Set(members.map(membershipIdentity).filter((identity) => identity !== 'unknown'))].sort((left, right) => left.localeCompare(right));
}

function mentionAtCursor(textarea: HTMLTextAreaElement): { readonly start: number; readonly end: number; readonly query: string } | null {
  const caret = textarea.selectionStart;
  const before = textarea.value.slice(0, caret);
  const match = /(^|\s)@([A-Za-z0-9_.-]*)$/.exec(before);
  if (!match) return null;
  return {
    start: caret - (match[2]?.length ?? 0) - 1,
    end: textarea.selectionEnd,
    query: match[2] ?? '',
  };
}
