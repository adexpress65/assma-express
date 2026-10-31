/**
 * Préférer ce wrapper (ou SafeAreaView de react-native-safe-area-context) à celui de react-native,
 * déprécié. Le root `app/_layout.tsx` enveloppe déjà l’app avec `SafeAreaProvider`.
 */
import { SafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';

export function ScreenSafeArea(props: SafeAreaViewProps) {
  return <SafeAreaView {...props} />;
}
