import React from "react";
import { View, Text } from "react-native";

export default function SellerDashboard() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>Seller Dashboard</Text>
      <Text> Gestion de vos produits et commandes</Text>
    </View>
  );
}
