// src/services/MessageService.ts
import { db } from '@/config/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

export const listenMessages = (
  conversationId: string,
  callback: (messages: any[]) => void
) => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(messages);
  });
};

export const sendMessage = async (
  conversationId: string,
  text: string,
  userId: string
) => {
  await addDoc(collection(db, 'messages'), {
    conversationId,
    text,
    userId,
    createdAt: serverTimestamp(),
  });
};
