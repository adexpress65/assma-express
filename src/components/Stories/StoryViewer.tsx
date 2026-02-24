// src/components/Stories/StoryViewer.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated,
  PanResponder,
  Dimensions,
  Image,
  StatusBar
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

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

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
  onStoryView: (storyId: string) => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  stories,
  initialIndex,
  onClose,
  onStoryView
}) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { user } = useAuth();
  
  const progressAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // Marquer la story comme vue
    onStoryView(stories[currentStoryIndex].id);
    
    // Animation de progression
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: stories[currentStoryIndex].duration || 5000,
      useNativeDriver: false
    }).start(() => {
      // Story suivante
      if (currentStoryIndex < stories.length - 1) {
        setCurrentStoryIndex(currentStoryIndex + 1);
        setProgress(0);
      } else {
        onClose();
      }
    });

    return () => progressAnim.stopAnimation();
  }, [currentStoryIndex]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setIsPaused(true),
    onPanResponderRelease: () => setIsPaused(false),
    onPanResponderTerminate: () => setIsPaused(false),
  });

  const handleNext = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setProgress(0);
    }
  };

  const currentStory = stories[currentStoryIndex];

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Barre de progression */}
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { 
                  width: index < currentStoryIndex ? '100%' : 
                         index === currentStoryIndex ? progressAnim.interpolate({
                           inputRange: [0, 1],
                           outputRange: ['0%', '100%']
                         }) : '0%'
                }
              ]} 
            />
          </View>
        ))}
      </View>

      {/* Contenu de la story */}
      <TouchableOpacity 
        activeOpacity={1}
        onPress={handlePrevious}
        style={styles.touchAreaLeft}
      />
      <TouchableOpacity 
        activeOpacity={1}
        onPress={handleNext}
        style={styles.touchAreaRight}
      />

      {currentStory.mediaType === 'image' ? (
        <Image 
          source={{ uri: currentStory.mediaUrl }} 
          style={styles.media}
          resizeMode="cover"
        />
      ) : (
        <Video
          source={{ uri: currentStory.mediaUrl }}
          style={styles.media}
          resizeMode="cover"
          shouldPlay={!isPaused}
          isLooping={false}
        />
      )}

      {/* Header avec info utilisateur */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image 
            source={{ uri: currentStory.userAvatar }} 
            style={styles.userAvatar}
          />
          <View>
            <Text style={styles.userName}>{currentStory.userName}</Text>
            <Text style={styles.timestamp}>
              {new Date(currentStory.timestamp?.toDate()).toLocaleTimeString()}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="heart-outline" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="paper-plane-outline" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Statistiques */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          {currentStory.views} vues
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 50,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 2,
    borderRadius: 1,
  },
  progressFill: {
    height: 2,
    backgroundColor: '#FFF',
    borderRadius: 1,
  },
  media: {
    width,
    height,
  },
  touchAreaLeft: {
    position: 'absolute',
    left: 0,
    top: 100,
    bottom: 0,
    width: width / 2,
    zIndex: 10,
  },
  touchAreaRight: {
    position: 'absolute',
    right: 0,
    top: 100,
    bottom: 0,
    width: width / 2,
    zIndex: 10,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  userName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  closeButton: {
    padding: 8,
  },
  actions: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    zIndex: 100,
  },
  actionButton: {
    padding: 12,
    marginBottom: 16,
  },
  stats: {
    position: 'absolute',
    left: 16,
    bottom: 100,
    zIndex: 100,
  },
  statsText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
});
