import React from "react";
import { ScrollView, TouchableOpacity, Text, View } from "react-native";

export default function FlashDealTabs({
  categories,
  selected,
  onSelect,
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-4"
    >
      <View className="flex-row">
        {categories.map((cat) => {
          const active = cat === selected;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => onSelect(cat)}
              className={`px-4 py-2 mr-2 rounded-full ${
                active ? "bg-orange-500" : "bg-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  active ? "text-white" : "text-gray-700"
                }`}
              >
                {cat.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}