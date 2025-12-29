import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function FlashDealCard({ product }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="bg-white mb-4 rounded-xl p-4 shadow-sm"
      onPress={() => router.push(`/flash-deals/${product.id}`)}
    >
      <Image
        source={{ uri: product.image }}
        className="w-full h-40 rounded-lg"
        resizeMode="cover"
      />

      <Text className="text-base font-semibold mt-3" numberOfLines={1}>
        {product.title}
      </Text>

      <View className="flex-row items-center mt-2">
        <Text className="text-lg font-bold text-red-600">
          {product.promoPrice} FCFA
        </Text>
        <Text className="text-sm text-gray-400 line-through ml-2">
          {product.price} FCFA
        </Text>
      </View>

      <Text className="text-xs text-gray-500 mt-1">
        {product.stock} piÃƒÂ¨ces restantes
      </Text>
    </TouchableOpacity>
  );
}