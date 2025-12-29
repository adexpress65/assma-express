import React from "react";
import { View, Text } from "react-native";

export default function AdminDashboard() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>Admin Dashboard</Text>
      <Text> Gestion des utilisateurs et des produits</Text>
    </View>
  );
}
