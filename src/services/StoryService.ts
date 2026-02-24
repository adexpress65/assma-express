export type Story = {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  mediaUrl: string;
  createdAt: number;
  expiresAt: number;
};

class StoryService {
  async getStories(): Promise<Story[]> {
    // MOCK — à remplacer par API ou Firestore
    return [
      {
        id: '1',
        userId: 'u1',
        username: 'Askia',
        avatarUrl: 'https://i.pravatar.cc/150?img=12',
        mediaUrl: 'https://picsum.photos/400/700',
        createdAt: Date.now() - 1000 * 60 * 10,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      },
    ];
  }

  async getUserStories(userId: string): Promise<Story[]> {
    const stories = await this.getStories();
    return stories.filter(story => story.userId === userId);
  }

  async hasUnseenStory(userId: string): Promise<boolean> {
    // logique basique (à améliorer plus tard)
    const stories = await this.getUserStories(userId);
    return stories.length > 0;
  }
}

export const storyService = new StoryService();
