import { Redirect } from "expo-router";

/** Ancien fil /chat. Aucune écriture : la discussion passe par /conversation. */
export default function LegacyChatRedirect() {
  return <Redirect href="/(tabs)/messages" />;
}
