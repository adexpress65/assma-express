import { useNavigation } from 'expo-router';

// Solution officielle pour Expo Router v6
export function useAppNavigation() {
  const navigation = useNavigation();

  const push = (path: string) => {
    // @ts-ignore
    navigation.navigate(path);
  };

  const navigate = (path: string) => {
    // @ts-ignore
    navigation.navigate(path);
  };

  const replace = (path: string) => {
    // @ts-ignore
    navigation.replace(path);
  };

  return {
    push,
    navigate,
    replace,
    back: () => navigation.goBack(),
    canGoBack: () => navigation.canGoBack(),
  };
}



