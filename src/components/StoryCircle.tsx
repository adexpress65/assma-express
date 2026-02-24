// src/components/StoryCircle.tsx
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface Props {
  story: any; // tu peux typer plus tard
}

export const StoryCircle: React.FC<Props> = ({ story }) => {
  return (
    <View style={styles.ring}>
      <Image source={{ uri: story.userAvatar }} style={styles.avatar} />
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
});