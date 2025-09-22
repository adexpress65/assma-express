import { Tabs } from "expo-router";

export default function Layout() {
  return (
    <Tabs>
      <Tabs.Screen name="home" options={{ title: "Accueil" }} />
      <Tabs.Screen name="shop" options={{ title: "Boutique" }} />
      <Tabs.Screen name="cart" options={{ title: "Panier" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="account" options={{ title: "Mon Compte" }} />
      <Tabs.Screen name="settings" options={{ title: "Paramètres" }} />
    </Tabs>
  );
}
