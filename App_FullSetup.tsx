// App.tsx
import React from "react";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <Provider store={store}>
      <AppNavigator />
    </Provider>
  );
}

// src/navigation/AppNavigator.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BottomTabs from "./BottomTabs";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import CategoryScreen from "../screens/CategoryScreen";
import RegionScreen from "../screens/RegionScreen";
import ManufacturerScreen from "../screens/ManufacturerScreen";
import ChatScreen from "../screens/ChatScreen";
import CartScreen from "../screens/CartScreen";

export type RootStackParamList = {
  Main: undefined;
  ProductDetail: { product: any };
  Category: { category: string };
  Region: undefined;
  Manufacturer: undefined;
  Chat: undefined;
  Cart: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={BottomTabs} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Category" component={CategoryScreen} />
        <Stack.Screen name="Region" component={RegionScreen} />
        <Stack.Screen name="Manufacturer" component={ManufacturerScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// src/navigation/BottomTabs.tsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import CategoriesScreen from "../screens/CategoriesScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CartScreen from "../screens/CartScreen";

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#007BFF",
        tabBarInactiveTintColor: "gray",
        tabBarIcon: ({ color, size }) => {
          let iconName: any;
          if (route.name === "Accueil") iconName = "home";
          else if (route.name === "Catégories") iconName = "grid";
          else if (route.name === "Messagerie") iconName = "chatbubble";
          else if (route.name === "Panier") iconName = "cart";
          else if (route.name === "Profil") iconName = "person";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} />
      <Tab.Screen name="Catégories" component={CategoriesScreen} />
      <Tab.Screen name="Messagerie" component={MessagesScreen} />
      <Tab.Screen name="Panier" component={CartScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// src/screens/HomeScreen.tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import CarouselBanner from "../components/CarouselBanner";
import CategoryPill from "../components/CategoryPill";
import QuickActions from "../components/QuickActions";
import ProductCard from "../components/ProductCard";
import SectionTitle from "../components/SectionTitle";
import SearchBar from "../components/SearchBar";

const mockProducts = [
  { id: 1, title: "Ordinateur Portable", price: "250000 FCFA", image: "https://picsum.photos/200/300" },
  { id: 2, title: "Chaise de Bureau", price: "30000 FCFA", image: "https://picsum.photos/200/301" },
  { id: 3, title: "Téléphone Android", price: "150000 FCFA", image: "https://picsum.photos/200/302" },
  { id: 4, title: "Casque Audio", price: "45000 FCFA", image: "https://picsum.photos/200/303" },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>ASSMA Market</Text>
      </View>
      <SearchBar placeholder="Rechercher un produit" value="" onChangeText={() => {}} onSubmit={() => {}} />
      <View style={styles.topTabs}>
        <TouchableOpacity><Text style={styles.topTab}>Produits</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.topTab}>Fabricant</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.topTab}>Région</Text></TouchableOpacity>
      </View>
      <CarouselBanner />
      <View style={styles.categories}>
        <CategoryPill label="Vêtements" onPress={() => navigation.navigate("Category", { category: "Vêtements" })} />
        <CategoryPill label="Machines" onPress={() => navigation.navigate("Category", { category: "Machines" })} />
        <CategoryPill label="Mini Usines" onPress={() => navigation.navigate("Category", { category: "Mini Usines" })} />
        <CategoryPill label="Véhicules" onPress={() => navigation.navigate("Category", { category: "Véhicules" })} />
      </View>
      <QuickActions onExplore={() => navigation.navigate("Catégories")} onQuote={() => navigation.navigate("Chat")} />
      <SectionTitle title="Produits populaires" />
      <View style={styles.products}>
        {mockProducts.map((p) => (
          <ProductCard key={p.id} title={p.title} price={p.price} image={p.image} onPress={() => navigation.navigate("ProductDetail", { product: p })} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#007BFF", padding: 15, alignItems: "center" },
  logo: { color: "white", fontWeight: "bold", fontSize: 18 },
  topTabs: { flexDirection: "row", justifyContent: "space-around", marginVertical: 10 },
  topTab: { fontSize: 16, fontWeight: "600", color: "#007BFF" },
  categories: { flexDirection: "row", justifyContent: "space-around", marginVertical: 15 },
  products: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around" },
});

