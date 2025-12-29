// apps/mobile/src/components/account/ProfileHeader.tsx
import React from 'react';
import {
  View,
  Text, // 👈 ASSURE-TOI D'AVOIR CET IMPORT
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function ProfileHeader() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.header}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Chargement...</Text> {/* 👈 Bien dans <Text> */}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {user ? (
          <>
            <Image 
              source={{ 
                uri: user.photoURL || 'https://via.placeholder.com/80',
              }} 
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              {/* 👇 TOUS LES TEXTES DOIVENT ÊTRE DANS <Text> */}
              <Text style={styles.userName}>
                {user.displayName || 'Utilisateur'}
              </Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={logout}
            >
              <Ionicons name="log-out-outline" size={20} color="#666" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person-outline" size={40} color="#666" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Bonjour, connectez-vous</Text>
              <Text style={styles.subtitle}>Pour une expérience personnalisée</Text>
            </View>
          </>
        )}
      </View>

      {user && (
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Coupons</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Favoris</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>Commandes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>128</Text>
            <Text style={styles.statLabel}>Points</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
});