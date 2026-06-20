import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { GatewayMember } from '@den-web/api/types';
import {
  findActiveMentionQuery,
  getMentionSuggestions,
  insertMentionToken,
  type MentionQuery,
  type MentionSuggestion,
} from '@den-web/models/channels';
import { findSlashCommandSuggestions, getSlashCommandHelpLines, type SlashCommand } from './channelSlashCommands';
import {
  appendHistory,
  persistHistory,
  readHistory,
  subscribeToHistoryChanges,
  type ComposerHistoryEntry,
} from './channelComposerHistory';

export interface ChannelComposerApi {
  draft: string;
  handleDraftChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  mentionQuery: MentionQuery | null;
  mentionSuggestions: MentionSuggestion[];
  mentionActiveIndex: number;
  insertMention: (identity: string) => void;
  slashCommandSuggestions: SlashCommand[];
  slashActiveIndex: number;
  slashHelpLines: string[];
  showSlashHelp: boolean;
  composerHistoryEntries: ComposerHistoryEntry[];
  handleComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSelectSlashCommand: (command: string) => void;
  /** Record a successfully sent message into history and reset the draft. */
  recordSentMessage: (body: string) => void;
}

interface Params {
  members: GatewayMember[];
  normalizedSenderIdentity: string;
}

/**
 * Owns channel composer input state: draft text, slash-command and mention
 * menus, composer history navigation, and the keyboard handling that drives
 * them. The send/network concern stays in the panel, which calls
 * {@link ChannelComposerApi.recordSentMessage} once a message posts.
 */
export function useChannelComposer({ members, normalizedSenderIdentity }: Params): ChannelComposerApi {
  const [draft, setDraft] = useState('');
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [composerHistoryEntries, setComposerHistoryEntries] = useState<ComposerHistoryEntry[]>([]);
  const [historyNavigateIndex, setHistoryNavigateIndex] = useState<number | null>(null);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const historyUnsentDraftRef = useRef('');

  const slashCommandSuggestions = useMemo(() => findSlashCommandSuggestions(draft), [draft]);
  const slashHelpLines = useMemo(() => getSlashCommandHelpLines(), []);
  const showSlashHelp = draft.trim() === '/help';
  const mentionQuery = useMemo(() => findActiveMentionQuery(draft), [draft]);
  const mentionSuggestions = useMemo(
    () => mentionQuery ? getMentionSuggestions(members, mentionQuery.query) : [],
    [members, mentionQuery],
  );

  // Reset the highlighted mention when the suggestion list changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMentionActiveIndex(0);
  }, [mentionQuery?.query, mentionSuggestions.length]);

  // Load composer history from storage when the posting identity changes.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setComposerHistoryEntries(readHistory(normalizedSenderIdentity));
    setHistoryNavigateIndex(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [normalizedSenderIdentity]);

  // Cross-tab composer history synchronization
  useEffect(() => {
    return subscribeToHistoryChanges(normalizedSenderIdentity, (entries) => {
      setComposerHistoryEntries(entries);
    });
  }, [normalizedSenderIdentity]);

  // Reset slash-command active index when suggestions change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlashActiveIndex(0);
  }, [slashCommandSuggestions.length]);

  const handleDraftChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDraft(value);
    setHistoryNavigateIndex(null);
    historyUnsentDraftRef.current = value;
  }, []);

  const insertMention = useCallback((identity: string) => {
    if (!mentionQuery) return;
    setDraft(current => insertMentionToken(current, mentionQuery, identity));
    setMentionActiveIndex(0);
  }, [mentionQuery]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    // If slash-command menu is active, handle slash-command navigation/selection
    if (slashCommandSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashActiveIndex(index => (index + 1) % slashCommandSuggestions.length);
        return;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashActiveIndex(index => (index - 1 + slashCommandSuggestions.length) % slashCommandSuggestions.length);
        return;
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const cmd = slashCommandSuggestions[slashActiveIndex] ?? slashCommandSuggestions[0];
        if (cmd) {
          if (cmd.command === '/clear') {
            setDraft('');
          } else {
            setDraft(cmd.command);
          }
        }
        setHistoryNavigateIndex(null);
        return;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setSlashActiveIndex(0);
        return;
      }
    }

    // If mention menu is active, handle mention navigation/selection
    if (mentionQuery && mentionSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionActiveIndex(index => (index + 1) % mentionSuggestions.length);
        return;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionActiveIndex(index => (index - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(mentionSuggestions[mentionActiveIndex]?.identity ?? mentionSuggestions[0].identity);
        return;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setMentionActiveIndex(0);
        setDraft(current => current);
        return;
      }
    }

    // ArrowUp — navigate history (only when at the start of the draft and not in a menu)
    if (event.key === 'ArrowUp' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      const textarea = event.currentTarget;
      const canStartHistoryRecall = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
      const isNavigatingHistory = historyNavigateIndex !== null;
      if ((isNavigatingHistory || canStartHistoryRecall) && composerHistoryEntries.length > 0) {
        event.preventDefault();
        const currentNavIndex = historyNavigateIndex;
        if (currentNavIndex === null) {
          // Start navigating from the most recent entry
          historyUnsentDraftRef.current = draft;
          setHistoryNavigateIndex(composerHistoryEntries.length - 1);
          setDraft(composerHistoryEntries[composerHistoryEntries.length - 1].body);
        } else if (currentNavIndex > 0) {
          // Go to previous entry
          setHistoryNavigateIndex(currentNavIndex - 1);
          setDraft(composerHistoryEntries[currentNavIndex - 1].body);
        }
        return;
      }
    }

    // ArrowDown — navigate forward through history
    if (event.key === 'ArrowDown' && !event.shiftKey && !event.ctrlKey && !event.metaKey && historyNavigateIndex !== null) {
      event.preventDefault();
      if (historyNavigateIndex < composerHistoryEntries.length - 1) {
        const nextIndex = historyNavigateIndex + 1;
        setHistoryNavigateIndex(nextIndex);
        setDraft(composerHistoryEntries[nextIndex].body);
      } else {
        // At the end of history, restore the current draft
        setHistoryNavigateIndex(null);
        setDraft(historyUnsentDraftRef.current);
      }
      return;
    }

    // Submit on Enter (without Shift). Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const form = (event.currentTarget as HTMLTextAreaElement).form;
      if (form) {
        form.requestSubmit();
      }
    }
  }, [draft, insertMention, mentionActiveIndex, mentionQuery, mentionSuggestions, slashCommandSuggestions, slashActiveIndex, composerHistoryEntries, historyNavigateIndex]);

  const handleSelectSlashCommand = useCallback((command: string) => {
    if (command === '/clear') {
      setDraft('');
    } else {
      setDraft(command);
    }
    setHistoryNavigateIndex(null);
  }, []);

  const recordSentMessage = useCallback((body: string) => {
    setDraft('');
    const updated = appendHistory(composerHistoryEntries, body);
    setComposerHistoryEntries(updated);
    persistHistory(normalizedSenderIdentity, updated);
    setHistoryNavigateIndex(null);
  }, [composerHistoryEntries, normalizedSenderIdentity]);

  return {
    draft,
    handleDraftChange,
    mentionQuery,
    mentionSuggestions,
    mentionActiveIndex,
    insertMention,
    slashCommandSuggestions,
    slashActiveIndex,
    slashHelpLines,
    showSlashHelp,
    composerHistoryEntries,
    handleComposerKeyDown,
    handleSelectSlashCommand,
    recordSentMessage,
  };
}
