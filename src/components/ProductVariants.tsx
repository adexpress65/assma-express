import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface VariantProps {
  label: string;
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
}

export default function ProductVariants({ label, options, selectedOption, onSelect }: VariantProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}: <Text style={styles.selectedValue}>{selectedOption}</Text>
      </Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.optionsRow}
      >
        {options.map((option) => {
          const isSelected = selectedOption === option;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onSelect(option)}
              activeOpacity={0.7}
              style={[
                styles.optionButton,
                isSelected && styles.selectedOptionButton
              ]}
            >
              <Text style={[
                styles.optionText,
                isSelected && styles.selectedOptionText
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    paddingVertical: 12, 
    paddingHorizontal: 16,
    backgroundColor: '#FFF' 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#2D3748', 
    marginBottom: 10 
  },
  selectedValue: { 
    fontWeight: '500', 
    color: '#FF6A00' 
  },
  optionsRow: { 
    flexDirection: 'row', 
    paddingRight: 20 // Pour ne pas coller au bord à la fin du scroll
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F7FAFC',
    marginRight: 10,
    minWidth: 45,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedOptionButton: {
    borderColor: '#FF6A00',
    backgroundColor: '#FFF0E6',
    borderWidth: 1.5
  },
  optionText: { 
    fontSize: 13, 
    color: '#4A5568' 
  },
  selectedOptionText: { 
    color: '#FF6A00', 
    fontWeight: '700' 
  },
});