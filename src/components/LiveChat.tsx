// components/LiveChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useLive } from '../contexts/LiveContext';
import { useAuth } from '../contexts/AuthContext';

interface LiveChatProps {
  liveId: string;
}

const LiveChat: React.FC<LiveChatProps> = ({ liveId }) => {
  const { sendMessage, liveMessages } = useLive();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (liveMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [liveMessages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user) return;

    try {
      await sendMessage(message);
      setMessage('');
    } catch (error) {
      console.error('Erreur envoi message:', error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isSystem = item.type === 'system';
    const isGift = item.type === 'gift';
    const isCurrentUser = item.userId === user?.uid;

    return null; // CORRIG…: (
      <View style={[
        styles.messageContainer,
        isSystem && styles.systemMessage,
        isGift && styles.giftMessage,
        isCurrentUser && styles.currentUserMessage
      ]}>
        {!isSystem && !isGift && (
          <Text style={styles.userName}>{item.userName}:</Text>
        )}
        <Text style={[
          styles.messageText,
          isSystem && styles.systemMessageText,
          isGift && styles.giftMessageText,
          isCurrentUser && styles.currentUserMessageText
        ]}>
          {item.text}
        </Text>
        {isGift && <Text style={styles.giftEmoji}>{/* üéÅ */}</Text>}
      </View>
    )
  };

  return null; // CORRIG…: (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>{/* Chat en direct */}</Text>
        <Text style={styles.messageCount}>{liveMessages.length} messages</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={liveMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Tapez votre message..."
          value={message}
          onChangeText={setMessage}
          multiline={false}
          maxLength={200}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!message.trim()}
        >
          <Text style={styles.sendButtonText}>{/* üì§ */}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
};

const styles = StyleSheet.create({
  container: {
    height: 300,
    backgroundColor: '#fff',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageCount: {
    fontSize: 12,
    color: '#666',
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  messageContainer: {
    padding: 8,
    marginBottom: 5,
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
  },
  systemMessage: {
    backgroundColor: '#FFF3CD',
    alignItems: 'center',
  },
  giftMessage: {
    backgroundColor: '#FFE6E6',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  currentUserMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  userName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
  },
  systemMessageText: {
    color: '#856404',
    fontStyle: 'italic',
  },
  giftMessageText: {
    color: '#D1345B',
    fontWeight: '600',
  },
  currentUserMessageText: {
    color: '#fff',
  },
  giftEmoji: {
    position: 'absolute',
    right: 10,
    top: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
  },
  sendButton: {
    padding: 10,
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default LiveChat;
