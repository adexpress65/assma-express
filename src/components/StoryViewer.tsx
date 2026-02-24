// src/components/StoryViewer.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Image,
  StatusBar,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  timestamp: any;
  views: number;
  duration?: number;
}

interface Props {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
  onStoryView: (storyId: string) => void;
}

export const StoryViewer: React.FC<Props> = ({
  stories,
  initialIndex,
  onClose,
  onStoryView,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    onStoryView(currentStory.id);
    // Progression automatique
    const interval = setInterval(() => {
      if (!isPaused) setProgress((p) => (p >= 1 ? 1 : p + 0.01));
    }, 50);
    if (progress >= 1) {
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setProgress(0);
      } else {
        onClose();
      }
    }
    return () => clearInterval(interval);
  }, [currentIndex, isPaused, progress]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  if (showStoryViewer) {
    return (
      <StoryViewer
        stories={stories}
        initialIndex={selectedStoryIndex}
        onClose={() => setShowStoryViewer(false)}
        onStoryView={(id) => console.log('Story vue:', id)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {/* Barre de progression */}
      <View style={styles.progressContainer}>
        {stories.map((_, idx) => (
          <View key={idx} style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress * 100}%`
                      : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Zone de touch gauche / droite */}
      <TouchableOpacity activeOpacity={1} onPress={handlePrevious} style={styles.touchLeft} />
      <TouchableOpacity activeOpacity={1} onPress={handleNext} style={styles.touchRight} />

      {/* Contenu */}
      {currentStory.mediaType === 'image' ? (
        <Image source={{ uri: currentStory.mediaUrl }} style={styles.media} resizeMode="cover" />
      ) : (
        <Video
          source={{ uri: currentStory.mediaUrl }}
          style={styles.media}
          resizeMode="cover"
          shouldPlay={!isPaused}
          isLooping={false}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={{ uri: currentStory.userAvatar }} style={styles.userAvatar} />
          <Text style={styles.userName}>{currentStory.userName}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Statistiques */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>{currentStory.views} vues</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressContainer: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 50, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  progressBar: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2, borderRadius: 1 },
  progressFill: { height: 2, backgroundColor: '#FFF', borderRadius: 1 },
  touchLeft: { position: 'absolute', left: 0, top: 100, bottom: 0, width: width / 2, zIndex: 10 },
  touchRight: { position: 'absolute', right: 0, top: 100, bottom: 0, width: width / 2, zIndex: 10 },
  media: { width, height },
  header: { position: 'absolute', top: 60, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  userName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  closeButton: { padding: 8 },
  stats: { position: 'absolute', left: 16, bottom: 100, zIndex: 100 },
  statsText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
});