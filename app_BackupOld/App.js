import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useFirstLaunch } from '../src/hooks/useFirstLaunch';
import IntroScreen from '../src/screens/intro';

export default function Index() {
  const router = useRouter();
  const { isFirstLaunch, isLoading } = useFirstLaunch();

  useEffect(() => {
    // Si ce n'est pas le premier lancement, rediriger directement
    if (!isLoading && !isFirstLaunch) {
      router.replace('/(tabs)/home');
    }
  }, [isFirstLaunch, isLoading, router]);

  // Afficher rien pendant le chargement
  if (isLoading) {
    return null;
  }

  // Si ce n'est pas le premier lancement, afficher rien (la redirection se fera via useEffect)
  if (!isFirstLaunch) {
    return null;
  }

  // Si premier lancement, afficher l'intro
  return <IntroScreen />;
}

