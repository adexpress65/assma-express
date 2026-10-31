export type TabType = 'social' | 'business' | 'shopping';

export interface Story {
  id: string;
  name: string;
  avatar: string;
  hasNewStories: boolean;
  seen: boolean;
}

export interface ConversationBase {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  avatar: string;
  type: string;
}

export interface SocialConversation extends ConversationBase {
  story: boolean;
  online: boolean;
  members: string[];
  isTyping: boolean;
  pinned: boolean;
  mute: boolean;
  lastSeen: string;
}

export interface BusinessConversation extends ConversationBase {
  status: string;
  verified: boolean;
  category: string;
  responseTime: string;
}

export interface ShoppingConversation extends ConversationBase {
  status: string;
  amount?: string;
  progress?: number;
  items?: string[];
  estimatedDelivery?: string;
  expiry?: string;
  discount?: string;
}

export interface ConversationsData {
  social: SocialConversation[];
  business: BusinessConversation[];
  shopping: ShoppingConversation[];
}

export type NavigationProps = {
  navigateToConversation: (id: string) => void;
};