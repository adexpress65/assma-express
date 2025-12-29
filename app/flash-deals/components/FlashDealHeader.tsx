import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function FlashDealHeader() {
  return (
    <View className="flex-row items-center justify-between mt-2 mb-4">
      <Text className="text-2xl font-bold">Flash Deals</Text>
      <Ionicons name="flash-outline" size={28} color="#f97316" />
    </View>
  );
}