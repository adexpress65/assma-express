import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';

export interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  viewed: boolean;
  duration?: number;
  timestamp: any;
}

interface StoryCircleProps {
  userId: string;
  userName: string;
  userAvatar: string;
  stories: StoryItem[];
  onOpen: (stories: StoryItem[], initialIndex: number) => void;
}

export const StoryCircle: React.FC<StoryCircleProps> = ({
  userId,
  userName,
  userAvatar,
  stories,
  onOpen,
}) => {
  const firstUnseenIndex = stories.findIndex(s => !s.viewed);
  const hasUnseen = firstUnseenIndex !== -1;

  const handlePress = () => {
    onOpen(stories, hasUnseen ? firstUnseenIndex : 0);
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <View
        style={[
          styles.avatarWrapper,
          hasUnseen && styles.avatarWrapperActive,
        ]}
      >
        <Image
          source={{ uri: userAvatar }}
          style={styles.avatar}
        />
      </View>

      <Text style={styles.userName} numberOfLines={1}>
        {userName}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 80,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  avatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    backgroundColor: '#CCC',
    marginBottom: 4,
  },
  avatarWrapperActive: {
    backgroundColor: '#1DA1F2',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  userName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
});
