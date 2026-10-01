import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
  const router = useRouter();

  // Redirection dès le premier effet : un aller-retour de state en plus retardait
  // la navigation d'un cycle de render complet.
  useEffect(() => {
    router.replace('/intro');
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
  );
}
