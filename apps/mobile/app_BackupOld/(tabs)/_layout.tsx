import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useAuth } from "../../src/contexts/AuthContext";

export default function TabsLayout() {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  // Redirection automatique vers le dashboard si admin/seller
  useEffect(() => {
    if (!loading && user && (userRole === 'admin' || userRole === 'seller' || userRole === 'super-admin')) {
      // Optionnel: Rediriger vers le dashboard appropriÃ©
      // router.replace(`/${userRole}/dashboard`);
    }
  }, [user, userRole, loading]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ff6a00",
        tabBarInactiveTintColor: "#999",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="categories"
        options={{
          title: "CatÃ©gories",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="apps-outline" color={color} size={size} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="cart"
        options={{
          title: "Panier",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" color={color} size={size} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="account"
        options={{
          title: "Compte",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
