import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/HomeScreen";
import ShopScreen from "../screens/ShopScreen";
import MessagesScreen from "../screens/MessagesScreen";
import CartScreen from "../screens/CartScreen";
import AccountScreen from "../screens/AccountScreen";

export type RootTabParamList = {
  Accueil: undefined;
  Boutique: undefined;
  Messagerie: undefined;
  Panier: undefined;
  Compte: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#E60023",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#eee" },
        tabBarIcon: ({ color, size }) => {
          const map = {
            Accueil: "home-outline",
            Boutique: "bag-handle-outline",
            Messagerie: "chatbubble-ellipses-outline",
            Panier: "cart-outline",
            Compte: "person-outline",
          } as const;
          return <Ionicons name={map[route.name as keyof typeof map]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} />
      <Tab.Screen name="Boutique" component={ShopScreen} />
      <Tab.Screen name="Messagerie" component={MessagesScreen} />
      <Tab.Screen name="Panier" component={CartScreen} />
      <Tab.Screen name="Compte" component={AccountScreen} />
    </Tab.Navigator>
  );
}
