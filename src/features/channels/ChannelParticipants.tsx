import type { Channel, GatewayMember } from '../../api/types';
import { memberIsActiveAgent, memberStatus } from './channelParticipantActivity';
import { MEMBERSHIP_STATUS_OPTIONS, WAKE_POLICY_OPTIONS } from './channelParticipantOptions';

interface Props {
  activeChannel: Channel | null;
  members: GatewayMember[];
  membershipsLoading: boolean;
  membershipsError: Error | null;
  memberActivityByIdentity: Map<string, 'active' | 'working'>;
  targetMemberIdentity: string;
  memberSaving: boolean;
  editingMember: GatewayMember | null;
  editingWakePolicy: string;
  editingMembershipStatus: string;
  inviteIdentity: string;
  inviteWakePolicy: string;
  inviteExistingMember: GatewayMember | null;
  inviteSending: boolean;
  onSelectTarget: (identity: string) => void;
  onOpenDmTranscript?: (agentIdentity: string) => void;
  onEditMember: (member: GatewayMember) => void;
  onSaveMemberSettings: () => void;
  onCancelEdit: () => void;
  onEditingWakePolicyChange: (value: string) => void;
  onEditingMembershipStatusChange: (value: string) => void;
  onInviteIdentityChange: (value: string) => void;
  onInviteWakePolicyChange: (value: string) => void;
  onInviteAgent: () => void;
}

/** Channel participant roster, per-member wake/status editor, and agent invite/routing controls. */
export function ChannelParticipants({
  activeChannel,
  members,
  membershipsLoading,
  membershipsError,
  memberActivityByIdentity,
  targetMemberIdentity,
  memberSaving,
  editingMember,
  editingWakePolicy,
  editingMembershipStatus,
  inviteIdentity,
  inviteWakePolicy,
  inviteExistingMember,
  inviteSending,
  onSelectTarget,
  onOpenDmTranscript,
  onEditMember,
  onSaveMemberSettings,
  onCancelEdit,
  onEditingWakePolicyChange,
  onEditingMembershipStatusChange,
  onInviteIdentityChange,
  onInviteWakePolicyChange,
  onInviteAgent,
}: Props) {
  return (
    <>
      <section className="channel-chat-members-panel" aria-label="Channel participants">
        <div className="channel-chat-members-header">
          <strong>Participants</strong>
          <span>{membershipsLoading ? 'loading…' : `${members.length} total`}</span>
        </div>
        <div className="channel-chat-members-list">
          {membershipsError ? (
            <div className="channel-chat-state channel-chat-state-error">{membershipsError.message}</div>
          ) : members.length === 0 ? (
            <div className="channel-chat-state channel-chat-state-muted">No joined agents yet.</div>
          ) : members.map(member => {
            const activity = memberActivityByIdentity.get(member.memberIdentity) ?? 'active';
            const activityClass = activity === 'working' ? 'channel-chat-member-working' : 'channel-chat-member-active';
            const status = memberStatus(member);
            const visibleStatus = activity === 'working' ? status.replace(/^active/, 'working') : status;
            return (
              <div
                key={member.id}
                className={`channel-chat-member-row ${member.memberIdentity === targetMemberIdentity ? 'selected' : ''}`}
              >
                <button
                  type="button"
                  className={`channel-chat-member ${activityClass}`}
                  onClick={() => memberIsActiveAgent(member) && onSelectTarget(member.memberIdentity)}
                  onDoubleClick={() => memberIsActiveAgent(member) && onOpenDmTranscript?.(member.memberIdentity)}
                  disabled={!memberIsActiveAgent(member)}
                  title={memberIsActiveAgent(member) && onOpenDmTranscript ? `${visibleStatus} · double-click to open DM transcript` : visibleStatus}
                >
                  <span className={`channel-chat-member-type member-type-${member.memberType}`}>{member.memberType}</span>
                  <span className="channel-chat-member-identity">{member.memberIdentity}</span>
                  <span className={`member-activity member-activity-${activity}`}>{activity}</span>
                  <span className="channel-chat-member-status">{visibleStatus}</span>
                </button>
                {member.memberType === 'agent' && (
                  <button
                    type="button"
                    className="channel-chat-member-edit"
                    onClick={() => onEditMember(member)}
                    disabled={!activeChannel || memberSaving}
                    aria-label={`Edit wake policy for ${member.memberIdentity}`}
                  >
                    Edit
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {editingMember && (
          <div className="channel-chat-member-editor" aria-label={`Edit ${editingMember.memberIdentity} membership settings`}>
            <div className="channel-chat-member-editor-title">
              <strong>Editing {editingMember.memberIdentity}</strong>
              <span>Changes affect future wake routing only.</span>
            </div>
            <label>
              <span>Wake policy</span>
              <select
                value={editingWakePolicy}
                onChange={event => onEditingWakePolicyChange(event.target.value)}
                disabled={memberSaving}
              >
                {WAKE_POLICY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={editingMembershipStatus}
                onChange={event => onEditingMembershipStatusChange(event.target.value)}
                disabled={memberSaving}
              >
                {MEMBERSHIP_STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="channel-chat-member-editor-actions">
              <button type="button" onClick={onSaveMemberSettings} disabled={memberSaving}>
                {memberSaving ? 'Saving…' : 'Save settings'}
              </button>
              <button type="button" onClick={onCancelEdit} disabled={memberSaving}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="channel-chat-debug-panel" aria-label="Agent participant routing controls">
        <div className="channel-chat-debug-header">
          <strong>Agent routing</strong>
          <span>Participant controls</span>
        </div>
        <div className="channel-chat-invite">
          <input
            value={inviteIdentity}
            onChange={event => onInviteIdentityChange(event.target.value)}
            placeholder="agent identity"
            disabled={!activeChannel || inviteSending}
            aria-label="Agent identity to join"
          />
          <select
            value={inviteWakePolicy}
            onChange={event => onInviteWakePolicyChange(event.target.value)}
            disabled={!activeChannel || inviteSending}
            aria-label="Wake policy"
          >
            {WAKE_POLICY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" onClick={onInviteAgent} disabled={!activeChannel || inviteSending || inviteIdentity.trim().length === 0}>
            {inviteSending ? (inviteExistingMember ? 'Updating…' : 'Joining…') : (inviteExistingMember ? 'Update agent' : 'Join agent')}
          </button>
          <span className="channel-chat-routing-note">Wake policy changes apply to future deliveries only.</span>
        </div>
      </section>
    </>
  );
}
