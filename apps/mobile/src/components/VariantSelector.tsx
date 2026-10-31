// src/components/VariantSelector.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function VariantSelector({ variants = [], selected, onSelect }: any) {
  return (
    <View>
      <Text style={{ fontWeight: '700', marginBottom: 8 }}>Variantes</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {variants.map((v: any) => {
          const active = selected && selected.id === v.id;
          return (
            <TouchableOpacity
              key={v.id ?? v.name}
              onPress={() => onSelect(v)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                marginRight: 8,
                marginBottom: 8,
                borderWidth: active ? 1 : 1,
                borderColor: active ? '#ff6a00' : '#ddd',
                backgroundColor: active ? '#fff7f0' : '#fff'
              }}
            >
              <Text>{v.name}</Text>
              {v.price ? <Text style={{ fontSize: 12 }}>{v.price} F</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
