import React from "react";
import { View, Text, Button } from "react-native";

export default function LoginScreen({ navigation }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Connexion</Text>
      <Button title="Aller à l'accueil" onPress={() => navigation.replace("Home")} />
    </View>
  );
}
