// apps/mobile/src/screens/debug/RoleDebugScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, ScrollView, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { debugUserState, forceLoadUserRole, verifyAndFixUserRole } from '@/utils/authPatch';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const RoleDebugScreen = () => {
  const { user, userProfile, userRole, debugLogState, refreshUserProfile } = useAuth();
  const [firestoreRole, setFirestoreRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadFirestoreData = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      // Lire directement depuis Firestore
      const role = await forceLoadUserRole(user.uid);
      setFirestoreRole(role);
      
      // Debug complet
      await debugUserState(user.uid);
      
      // Log de l'état AuthContext
      debugLogState();
    } catch (error) {
      console.error('Error loading Firestore data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const compareRoles = () => {
    const authRole = userRole;
    const fsRole = firestoreRole;
    
    console.log('=== COMPARAISON RÔLES ===');
    console.log('AuthContext Role:', authRole);
    console.log('Firestore Role:', fsRole);
    console.log('Match:', authRole === fsRole);
    
    if (authRole !== fsRole) {
      Alert.alert(
        '⚠️ Incohérence de rôle détectée',
        `AuthContext: ${authRole}\nFirestore: ${fsRole}`,
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    if (user?.uid) {
      loadFirestoreData();
    }
  }, [user?.uid]);

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        🔧 Débogage Rôles
      </Text>
      
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: 'bold' }}>Utilisateur:</Text>
        <Text>UID: {user?.uid}</Text>
        <Text>Email: {user?.email || '—'}</Text>
        <Text>Téléphone: {user?.phoneNumber || userProfile?.phoneNumber || '—'}</Text>
      </View>
      
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: 'bold' }}>Rôles:</Text>
        <Text>AuthContext: {userRole}</Text>
        <Text>Firestore: {firestoreRole || 'Chargement...'}</Text>
      </View>
      
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: 'bold' }}>Profil:</Text>
        <Text>{JSON.stringify(userProfile, null, 2)}</Text>
      </View>
      
      <Button 
        title="🔄 Rafraîchir les données" 
        onPress={loadFirestoreData}
        disabled={isLoading}
      />
      
      <View style={{ height: 10 }} />
      
      <Button 
        title="🔍 Comparer les rôles" 
        onPress={compareRoles}
      />
      
      <View style={{ height: 10 }} />
      
      <Button 
        title="🔄 Rafraîchir AuthContext" 
        onPress={refreshUserProfile}
      />
      
      <View style={{ height: 20 }} />
      
      <Text style={{ color: 'gray', fontStyle: 'italic' }}>
        Si les rôles sont différents, le problème vient du AuthContext.
        Le rôle Firestore est la source de vérité.
      </Text>
    </ScrollView>
  );
};

export default RoleDebugScreen;
