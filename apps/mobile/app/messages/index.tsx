import { Redirect } from "expo-router";

/** Ancien écran de démo. La boîte réelle est l’onglet Messages. */
export default function LegacyMessagesRedirect() {
  return <Redirect href="/(tabs)/messages" />;
}
