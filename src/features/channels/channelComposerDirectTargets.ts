import type { GatewayMember } from '../../api/types';

function memberIsActiveAgent(member: GatewayMember): boolean {
  return member.memberType === 'agent' && member.membershipStatus === 'active';
}

export function directTargetsForComposerBody(body: string, members: GatewayMember[]): GatewayMember[] {
  const normalizedBody = body.toLowerCase();
  return members
    .filter(memberIsActiveAgent)
    .filter(member => normalizedBody.includes(`@${member.memberIdentity.toLowerCase()}`));
}
