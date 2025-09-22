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
        tabBarActiveTintColor: "#00AEEF",
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
import { View, Text, ScrollView, StyleSheet } from "react-native";
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
        <Text style={styles.topTab}>Produits</Text>
        <Text style={styles.topTab}>Fabricant</Text>
        <Text style={styles.topTab}>Région</Text>
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
  header: { backgroundColor: "#00AEEF", padding: 15, alignItems: "center" },
  logo: { color: "white", fontWeight: "bold", fontSize: 18 },
  topTabs: { flexDirection: "row", justifyContent: "space-around", marginVertical: 10 },
  topTab: { fontSize: 16, fontWeight: "600", color: "#00AEEF" },
  categories: { flexDirection: "row", justifyContent: "space-around", marginVertical: 15 },
  products: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around" },
});

// src/components/CarouselBanner.tsx
import React, { useState, useRef, useEffect } from "react";
import { Dimensions, Image, ScrollView, StyleSheet, View } from "react-native";

const { width } = Dimensions.get("window");
const images = ["https://picsum.photos/400/200", "https://picsum.photos/401/200", "https://picsum.photos/402/200"];

export default function CarouselBanner() {
  const scrollRef = useRef<any>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const newIndex = (index + 1) % images.length;
      scrollRef.current?.scrollTo({ x: newIndex * width, animated: true });
      setIndex(newIndex);
    }, 3000);
    return () => clearInterval(timer);
  }, [index]);

  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} ref={scrollRef} style={styles.container}>
      {images.map((uri, i) => (
        <Image key={i} source={{ uri }} style={styles.image} />
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({ container: { height: 200 }, image: { width, height: 200 } });

// src/components/CategoryPill.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export default function CategoryPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  pill: { backgroundColor: "#E6F7FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  text: { color: "#00AEEF", fontWeight: "bold" },
});

// src/components/ProductCard.tsx
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function ProductCard({ title, price, image, onPress }: { title: string; price: string; image: string; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: image }} style={styles.image} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.price}>{price}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { width: "45%", backgroundColor: "#fff", marginVertical: 10, borderRadius: 8, padding: 10, elevation: 3 },
  image: { width: "100%", height: 100, borderRadius: 8 },
  title: { fontSize: 14, fontWeight: "bold", marginTop: 5 },
  price: { color: "#00AEEF", marginTop: 3 },
});

// src/components/QuickActions.tsx
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function QuickActions({ onExplore, onQuote }: { onExplore: () => void; onQuote: () => void }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.action} onPress={onExplore}>
        <Ionicons name="grid" size={24} color="#00AEEF" />
        <Text>Explorer</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={onQuote}>
        <Ionicons name="document-text" size={24} color="#00AEEF" />
        <Text>Demander un devis</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flexDirection: "row", justifyContent: "space-around", marginVertical: 10 }, action: { alignItems: "center" } });

// src/components/SearchBar.tsx
import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SearchBar({ value, onChangeText, onSubmit, placeholder }: any) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color="gray" />
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} onSubmitEditing={onSubmit} />
      <Ionicons name="camera" size={20} color="gray" />
    </View>
  );
}
const styles = StyleSheet.create({ container: { flexDirection: "row", alignItems: "center", backgroundColor: "#f2f2f2", margin: 10, paddingHorizontal: 10, borderRadius: 8 }, input: { flex: 1, marginLeft: 8 } });

// src/components/SectionTitle.tsx
import React from "react";
import { Text, View, StyleSheet } from "react-native";

export default function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { margin: 10 }, text: { fontSize: 16, fontWeight: "bold" } });

