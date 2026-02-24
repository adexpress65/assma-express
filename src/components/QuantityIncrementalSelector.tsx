import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Step {
  min: number;
  price: number;
}

interface Props {
  quantity: number;
  minQuantity?: number;
  stock?: number;
  priceSteps?: Step[];
  onChange: (val: number) => void;
}

export default function QuantityIncrementalSelector({
  quantity,
  minQuantity = 1,
  stock = 999999,
  priceSteps = [],
  onChange,
}: Props) {

  const handleIncrement = () => {
    if (quantity < stock) {
      onChange(quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > minQuantity) {
      onChange(quantity - 1);
    }
  };

  const handleInput = (txt: string) => {
    const val = parseInt(txt);
    if (isNaN(val)) return;
    if (val < minQuantity) return onChange(minQuantity);
    if (val > stock) return onChange(stock);
    onChange(val);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quantité</Text>
        <Text style={styles.stockStatus}>
          {stock > 0 ? `${stock} pièces disponibles` : "Rupture de stock"}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.counter}>
          <TouchableOpacity onPress={handleDecrement} style={styles.btn}>
            <Ionicons name="remove" size={20} color={quantity <= minQuantity ? "#CCC" : "#333"} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={String(quantity)}
            keyboardType="numeric"
            onChangeText={handleInput}
          />

          <TouchableOpacity onPress={handleIncrement} style={styles.btn}>
            <Ionicons name="add" size={20} color={quantity >= stock ? "#CCC" : "#333"} />
          </TouchableOpacity>
        </View>

        {priceSteps.length > 0 && (
          <View style={styles.steps}>
            {priceSteps.map((s, i) => {
              const active = quantity >= s.min;
              return (
                <View key={i} style={[styles.step, active && styles.active]}>
                  <Text style={[styles.stepTxt, active && styles.activeTxt]}>
                    {s.min}+ pcs
                  </Text>
                  <Text style={[styles.stepPrice, active && styles.activeTxt]}>
                    {s.price} F
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '700' },
  stockStatus: { fontSize: 12, color: '#777' },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 8,
    backgroundColor: '#F8F8F8'
  },

  btn: { padding: 10, width: 44, alignItems: 'center' },
  input: { width: 50, textAlign: 'center', fontWeight: 'bold', fontSize: 16 },

  steps: { flexDirection: 'row', gap: 6 },

  step: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    minWidth: 55
  },

  active: {
    backgroundColor: '#FFF0E6',
    borderWidth: 1,
    borderColor: '#FF6A00'
  },

  stepTxt: { fontSize: 10, color: '#777' },
  stepPrice: { fontSize: 11, fontWeight: 'bold' },
  activeTxt: { color: '#FF6A00' }
});
