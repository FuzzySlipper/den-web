import type { DirectConversationSendRequest, DirectConversationSendResponse } from './types';

export function reinitDirectMessagesRuntime(base: string): void {
  void base;
}

export async function sendDirectMessage(conversationId: number, request: DirectConversationSendRequest): Promise<DirectConversationSendResponse> {
  void request;
  throw new Error(`Legacy direct-conversation transcript ${conversationId} is retired. Use channel direct-agent mode.`);
}
