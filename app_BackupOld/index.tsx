import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useFirstLaunch } from '../src/hooks/useFirstLaunch';
import IntroScreen from '../src/screens/intro';

export default function Index() {
  const router = useRouter();
  const { isFirstLaunch, isLoading } = useFirstLaunch();

  // âš™ï¸ Si ce n'est pas le premier lancement, redirige directement vers les tabs
  useEffect(() => {
    if (!isLoading && !isFirstLaunch) {
      router.replace('/(tabs)/home');
    }
  }, [isFirstLaunch, isLoading, router]);

  // ðŸ•“ Rien pendant le chargement
  if (isLoading) return null;

  // ðŸš€ Si premier lancement, montre lâ€™intro
  if (isFirstLaunch) {
    return <IntroScreen />;
  }

  // ðŸ” Sinon, ne rien rendre (redirigÃ© via useEffect)
  return null;
}

