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

// src/data/mockData.ts
export const categories = [
  { id: "1", name: "Vêtements", image: "https://picsum.photos/200/300" },
  { id: "2", name: "Machines", image: "https://picsum.photos/200/301" },
  { id: "3", name: "Mini Usines", image: "https://picsum.photos/200/302" },
  { id: "4", name: "Véhicules", image: "https://picsum.photos/200/303" },
];

export const products = [
  { id: "p1", title: "T-shirt", price: "12 $", image: "https://picsum.photos/200/310", category: "Vêtements" },
  { id: "p2", title: "Chaussures", price: "45 $", image: "https://picsum.photos/200/311", category: "Vêtements" },
  { id: "p3", title: "Machine", price: "500 $", image: "https://picsum.photos/200/312", category: "Machines" },
  { id: "p4", title: "Camion", price: "1 200 $", image: "https://picsum.photos/200/313", category: "Véhicules" },
  { id: "p5", title: "Mini usine riz", price: "50 000 $", image: "https://picsum.photos/200/314", category: "Mini Usines" },
];

// src/navigation/AppNavigator.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BottomTabs from "./BottomTabs";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import CategoryScreen from "../screens/CategoryScreen";

export type RootStackParamList = {
  Main: undefined;
  ProductDetail: { product: any };
  Category: { category: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={BottomTabs} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Category" component={CategoryScreen} />
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
import ProductCard from "../components/ProductCard";
import SectionTitle from "../components/SectionTitle";
import SearchBar from "../components/SearchBar";
import { categories, products } from "../data/mockData";

export default function HomeScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>ASSMA Market</Text>
      </View>
      <SearchBar placeholder="Rechercher un produit" value="" onChangeText={() => {}} onSubmit={() => {}} />
      <CarouselBanner />
      <SectionTitle title="Explorer par catégories" />
      <View style={styles.categories}>
        {categories.map((cat) => (
          <CategoryPill key={cat.id} label={cat.name} onPress={() => navigation.navigate("Category", { category: cat.name })} />
        ))}
      </View>
      <SectionTitle title="Produits populaires" />
      <View style={styles.products}>
        {products.map((p) => (
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
  categories: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", marginVertical: 15 },
  products: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around" },
});

// src/screens/CategoryScreen.tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import { products } from "../data/mockData";
import ProductCard from "../components/ProductCard";

export default function CategoryScreen() {
  const route = useRoute<any>();
  const { category } = route.params;
  const filtered = products.filter((p) => p.category === category);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{category}</Text>
      <View style={styles.products}>
        {filtered.map((p) => (
          <ProductCard key={p.id} title={p.title} price={p.price} image={p.image} onPress={() => {}} />
        ))}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  products: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around" },
});

// src/screens/ProductDetailScreen.tsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";

export default function ProductDetailScreen() {
  const route = useRoute<any>();
  const { product } = route.params;

  return (
    <View style={styles.container}>
      <Image source={{ uri: product.image }} style={styles.image} />
      <Text style={styles.title}>{product.title}</Text>
      <Text style={styles.price}>{product.price}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: "center" },
  image: { width: "100%", height: 200, borderRadius: 8 },
  title: { fontSize: 22, fontWeight: "bold", marginVertical: 10 },
  price: { fontSize: 18, color: "#00AEEF" },
});

// src/components/CategoryPill.tsx
import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

export default function CategoryPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  pill: { backgroundColor: "#E6F7FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, margin: 5 },
  text: { color: "#00AEEF", fontWeight: "bold" },
});

// src/components/ProductCard.tsx
import React from "react";
import { Image, Pressable, StyleSheet, Text } from "react-native";

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

// src/components/CarouselBanner.tsx
import React, { useState, useRef, useEffect } from "react";
import { Dimensions, Image, ScrollView, StyleSheet } from "react-native";

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

// src/screens/CategoriesScreen.tsx
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { categories } from "../data/mockData";
import CategoryPill from "../components/CategoryPill";
import { useNavigation } from "@react-navigation/native";

export default function CategoriesScreen() {
  const navigation = useNavigation<any>();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {categories.map((cat) => (
        <CategoryPill key={cat.id} label={cat.name} onPress={() => navigation.navigate("Category", { category: cat.name })} />
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({ container: { flexDirection: "row", flexWrap: "wrap", padding: 10 } });

// src/screens/MessagesScreen.tsx
import React from "react";
import { View, Text } from "react-native";
export default function MessagesScreen(){return <View><Text>Messagerie en cours</Text></View>}

// src/screens/CartScreen.tsx
import React from "react";
import { View, Text } from "react-native";
export default function CartScreen(){return <View><Text>Votre panier est vide</Text></View>}

// src/screens/ProfileScreen.tsx
import React from "react";
import { View, Text } from "react-native";
export default function ProfileScreen(){return <View><Text>Profil utilisateur</Text></View>}

