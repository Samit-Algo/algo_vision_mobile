import type {AgentChatMessageResponse, GeneralChatContentBlock} from '../api';

/** Composer mode: Ask vs Agent (UI selector in chat input). */
export type ChatMode = 'ask' | 'agent';

export type AttachmentType = 'image' | 'video' | 'file';

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  uri: string;
  size?: string;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
  isError?: boolean;
  /**
   * Structured assistant body from `message.content[]` (Ask + Agent when backend sends blocks).
   * When set (including `[]`), the bubble uses the same block renderer as `layout/chatbot-attachments.js`.
   */
  contentBlocks?: GeneralChatContentBlock[];
  /** Optional evidence images (general-chat parity). */
  evidence?: unknown[];
  /** Agent mode only: full last response for zone / HITL / flow (Electron `layout` parity). */
  agentEnvelope?: AgentChatMessageResponse;
}

export interface Suggestion {
  id: string;
  label: string;
  icon: string;
}
