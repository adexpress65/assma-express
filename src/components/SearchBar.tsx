// apps/mobile/src/components/SearchBar.tsx
import React from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
};

export default function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
}: Props) {
  const router = useRouter();

  const openCamera = () => {
    Keyboard.dismiss(); // ?? évite tout resize parasite
    router.push("/camera"); // caméra interne
  };

  return (
    <View style={styles.container}>
      {/* Icône recherche */}
      <Ionicons
        name="search"
        size={20}
        color="#888"
        style={{ marginRight: 8 }}
      />

      {/* Input */}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder || "Rechercher..."}
        returnKeyType="search"
      />

      {/* Icône caméra (REMPLACEMENT de l'icône image) */}
      <TouchableOpacity onPress={openCamera} style={styles.cameraButton}>
        <Ionicons name="camera-outline" size={22} color="#666" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 10,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  cameraButton: {
    marginLeft: 8,
  },
});
