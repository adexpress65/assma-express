// src/types/messaging.ts
export interface Conversation {
  id: string;
  title: string;
  type: 'order' | 'inquiry' | 'support' | 'partner' | 'direct';
  participants: string[];
  participantNames: { [userId: string]: string };
  participantAvatars: { [userId: string]: string };
  lastMessage: string;
  lastMessageTime: firestore.Timestamp;
  unreadCount: { [userId: string]: number };
  orderData?: {
    orderId: string;
    orderNumber: string;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    totalAmount: string;
    productName?: string;
    productImage?: string;
  };
  partnerData?: {
    companyId: string;
    companyName: string;
    verified: boolean;
    category: string;
    responseTime: string;
    rating: number;
    online: boolean;
  };
  metadata?: {
    productId?: string;
    categoryId?: string;
    liveStreamId?: string;
    ticketNumber?: string;
  };
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
}

export interface Message {
  id: string;
  conversationId: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: 'text' | 'image' | 'order_update' | 'system' | 'product' | 'offer';
  metadata?: {
    productId?: string;
    productImage?: string;
    productName?: string;
    price?: string;
    orderStatus?: string;
    trackingNumber?: string;
    offerAmount?: string;
    imageUrl?: string;
  };
  readBy: string[];
  createdAt: firestore.Timestamp;
}

export interface Partner {
  id: string;
  name: string;
  avatar: string;
  companyName: string;
  verified: boolean;
  category: string;
  rating: number;
  responseTime: string;
  online: boolean;
  productCount: number;
  lastActive: firestore.Timestamp;
}

export interface LiveStream {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  thumbnail: string;
  viewers: number;
  category: string;
  productId?: string;
  productName?: string;
  isLive: boolean;
  startedAt: firestore.Timestamp;
}