// src/components/StoryCarousel.tsx - VERSION SANS ANIMATION PROBLEMATIQUE
import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Story } from '../types/messages';

const { width } = Dimensions.get('window');
const STORY_SIZE = 70;
const STORY_PADDING = 8;

// Créer FlatList animée
const AnimatedFlatList = Animated.createAnimatedComponent(Animated.FlatList);

interface StoryCarouselProps {
  stories: Story[];
  onStoryPress?: (storyId: string) => void;
}

const StoryItem = memo(({ 
  story, 
  onPress 
}: { 
  story: Story; 
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={styles.storyItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.storyRing,
        story.hasNewStories ? styles.hasNewStory : styles.seenStory,
        !story.seen && styles.unseenStory
      ]}>
        <View style={styles.storyAvatar}>
          <Text style={styles.avatarText}>{story.avatar}</Text>
        </View>
      </View>
      <Text style={styles.storyName} numberOfLines={1}>
        {story.name}
      </Text>
      {story.hasNewStories && <View style={styles.newBadge} />}
    </TouchableOpacity>
  );
});

export const StoryCarousel: React.FC<StoryCarouselProps> = memo(({
  stories,
  onStoryPress
}) => {
  const handleStoryPress = (storyId: string) => {
    if (onStoryPress) {
      onStoryPress(storyId);
    }
  };

  const renderStory = ({ item }: { item: Story }) => (
    <StoryItem 
      story={item} 
      onPress={() => handleStoryPress(item.id)} 
    />
  );

  const keyExtractor = (item: Story) => item.id;

  if (stories.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stories</Text>
        <TouchableOpacity style={styles.seeAllButton}>
          <Text style={styles.seeAllText}>Voir tout</Text>
          <Ionicons name="chevron-forward" size={14} color="#666" />
        </TouchableOpacity>
      </View>
      
      <AnimatedFlatList
        data={stories}
        renderItem={renderStory}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        // SUPPRIMEZ les animations problématiques pour l'instant
        // onScroll={Animated.event(
        //   [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        //   { useNativeDriver: true }
        // )}
        // scrollEventThrottle={16}
        // Optimisations de performance
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={100}
      />
      
      {/* SUPPRIMEZ temporairement l'indicateur de progression animé */}
      {/* 
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBar} />
        ))}
      </View>
      */}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  listContent: {
    paddingHorizontal: 8,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: STORY_SIZE,
    position: 'relative',
  },
  storyRing: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 6,
  },
  hasNewStory: {
    borderColor: '#FF6B00',
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
  },
  seenStory: {
    borderColor: '#333',
  },
  unseenStory: {
    borderColor: '#4CAF50',
  },
  storyAvatar: {
    width: STORY_SIZE - 12,
    height: STORY_SIZE - 12,
    borderRadius: (STORY_SIZE - 12) / 2,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  storyName: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    maxWidth: STORY_SIZE,
  },
  newBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B00',
    borderWidth: 2,
    borderColor: '#000000',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  progressBar: {
    width: 8,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#666',
    marginHorizontal: 2,
  },
});

export default StoryCarousel;