// app/live/broadcast.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function LiveBroadcastScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Broadcast</Text>
    </View>
  );
}

export default function BroadcastLive() {
  return <LiveBroadcastScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});



