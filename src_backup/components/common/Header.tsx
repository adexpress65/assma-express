import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

export default function Header() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    router.push({
      pathname: "/search",
      params: { q: query.trim() },
    });
  };

  return (
    <View
      style={[
        styles.wrapper,
        { paddingTop: insets.top + 8 },
      ]}
    >
      <BlurView intensity={80} tint="light" style={styles.container}>
        <Text style={styles.appTitle}>Assma-Express</Text>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#555" />
          <TextInput
            placeholder="Rechercher un produit"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            style={styles.input}
            placeholderTextColor="#777"
            returnKeyType="search"
          />
          <TouchableOpacity onPress={handleSearch}>
            <Ionicons name="camera-outline" size={22} color="#555" />
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "rgba(255,106,0,0.25)",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  container: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  appTitle: {
    color: "#ff6a00",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
  },
  input: {
    flex: 1,
    paddingVertical: 4,
    fontSize: 15,
    color: "#333",
  },
});
