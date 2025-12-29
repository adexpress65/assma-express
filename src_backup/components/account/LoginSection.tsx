import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoginSectionProps {
  onLogin: () => void;
}

export default function LoginSection({ onLogin }: LoginSectionProps) {
  const loginMethods = [
    { icon: 'mail-outline', label: 'Email', color: '#4285F4' },
    { icon: 'logo-google', label: 'Google', color: '#DB4437' },
    { icon: 'logo-facebook', label: 'Facebook', color: '#4267B2' },
    { icon: 'logo-apple', label: 'Apple', color: '#000000' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion / Inscription</Text>
      <Text style={styles.subtitle}>
        Connectez-vous pour accéder à vos favoris, commandes et paramètres
      </Text>
      
      <View style={styles.loginMethods}>
        {loginMethods.map((method, index) => (
          <TouchableOpacity 
            key={index}
            style={styles.loginButton}
            onPress={onLogin}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={method.icon as any} size={20} color={method.color} />
            </View>
            <Text style={styles.loginButtonText}>
              Continuer avec {method.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <Text style={styles.termsText}>
        En continuant, vous acceptez nos{' '}
        <Text style={styles.link}>Conditions d'utilisation</Text> et{' '}
        <Text style={styles.link}>Politique de confidentialité</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  loginMethods: {
    gap: 12,
    marginBottom: 20,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'white',
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
  },
  loginButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  link: {
    color: '#FF6B00',
  },
});