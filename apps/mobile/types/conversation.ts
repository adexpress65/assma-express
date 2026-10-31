// src/types/conversation.ts
import { ConversationType } from '../contexts/MessagesContext';

export interface ExtendedConversation {
  id: string;
  title: string;
  type: ConversationType;
  participants?: string[];
  participantAvatars?: { [key: string]: string };
  participantNames?: { [key: string]: string };
  lastMessage?: string;
  updatedAt: any;
  createdAt?: any;
  unreadCount?: { [key: string]: number };
  mute?: boolean;
}