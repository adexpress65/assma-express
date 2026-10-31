import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#FF6B00',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F8F9FA' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="edit"
        options={{
          title: 'Mon profil',
          headerBackTitle: 'Retour',
        }}
      />
    </Stack>
  );
}
