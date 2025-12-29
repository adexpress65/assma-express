// apps/mobile/app/categories/index.tsx - VERSION TEST
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Stack, useRouter } from "expo-router";

export default function CategoriesPage() {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "CatÃƒÂ©gories", headerShown: true }} />
      
      <Text style={styles.title}>Ã°Å¸Å½â€° SUCCÃƒË†S !</Text>
      <Text style={styles.subtitle}>La navigation fonctionne !</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.back()}
      >
        <Text style={styles.buttonText}>Retour ÃƒÂ  l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "green",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#ff6a00",
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});
