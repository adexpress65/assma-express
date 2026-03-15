// mobile/src/components/CheckoutFooter.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CheckoutFooterProps {
  onContinue: () => void;
  buttonText?: string;
  totalAmount?: number;
  disabled?: boolean;
}

export default function CheckoutFooter({ 
  onContinue, 
  buttonText = "Continuer vers la livraison", 
  totalAmount,
  disabled = false 
}: CheckoutFooterProps) {
  const insets = useSafeAreaInsets();
  
  const footerHeight = 80 + insets.bottom;

  return (
    <View style={[styles.container, { height: footerHeight }]}>
      <View style={[styles.content, { marginBottom: insets.bottom }]}>
        {totalAmount && (
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>{totalAmount} FCFA</Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={[styles.continueButton, disabled && styles.continueButtonDisabled]}
          onPress={onContinue}
          disabled={disabled}
        >
          <Text style={styles.continueButtonText}>
            {buttonText}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6A00',
  },
  continueButton: {
    backgroundColor: '#FF6A00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
