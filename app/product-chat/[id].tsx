import { Redirect } from "expo-router";

/** Ancien chat produit. Aucune écriture : la discussion passe par /conversation. */
export default function LegacyProductChatRedirect() {
  return <Redirect href="/(tabs)/messages" />;
}
