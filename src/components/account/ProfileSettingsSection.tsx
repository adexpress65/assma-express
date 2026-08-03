import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { storage, auth, db } from '@/config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

// 🔗 URLs légales (modifiables facilement)
const CGU_URL = "https://docs.google.com/document/d/e/2PACX-1vRFJn4M-1DAObgWzCFKXznYxnfUeDWaJCRZO8VZTw90iG7u-07rwZKhC1e7urah0LQuOlYGJLalgqh8/pub";
const PRIVACY_URL = "https://docs.google.com/document/d/e/2PACX-1vR38PIQDkytlXJ5qVr94FhghxRnGlV6wF98PziddOEFpc7bIWV8VWsygik27kU0tGfdnRzOCxriwdQX/pub";

function formatAddressFromGeocode(places: Location.LocationGeocodedAddress[], lat: number, lng: number): string {
  const coords = `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const p = places[0];
  if (!p) return coords;
  const lineStreet = [p.streetNumber, p.street].filter(Boolean).join(' ').trim();
  const lineCity = [p.postalCode, p.city].filter(Boolean).join(' ').trim();
  const lineRegion = [p.subregion, p.region, p.country].filter(Boolean).join(', ');
  const parts = [lineStreet || p.name, lineCity, lineRegion].filter(Boolean);
  return parts.join(', ').trim() ? `${parts.join(', ').trim()}\n${coords}` : coords;
}

type GeoTarget = 'address' | 'shop';

export function ProfileSettingsSection({ variant = 'card' }: { variant?: 'card' | 'screen' }) {
  const router = useRouter();
  const { user, userProfile, updateUserProfile, refreshUserProfile, isSeller, isCustomer, userRole, isLoading } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState<null | GeoTarget>(null);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  // Form States
  const [form, setForm] = useState({
    displayName: '', phoneNumber: '', address: '',
    shopName: '', shopDescription: '', shopPhone: '', shopAddress: ''
  });

  const syncForm = useCallback(() => {
    if (!userProfile) return;
    setForm({
      displayName: userProfile.displayName || '',
      phoneNumber: userProfile.phoneNumber || '',
      address: userProfile.address || '',
      shopName: userProfile.sellerInfo?.shopName || '',
      shopDescription: userProfile.sellerInfo?.description || '',
      shopPhone: userProfile.sellerInfo?.phone || '',
      shopAddress: userProfile.sellerInfo?.address || '',
    });
    setPendingImageUri(null);
  }, [userProfile]);

  useEffect(() => { 
    if (!editing) syncForm(); 
  }, [userProfile, editing, syncForm]);

  useEffect(() => {
    if (variant === 'screen' && !isLoading && !user) {
      router.replace('/(tabs)/account');
      Alert.alert('Connexion requise', 'Connectez-vous pour accéder à votre profil.');
    }
  }, [variant, isLoading, user]);

  // 1. GESTION DU CHARGEMENT SÉCURISÉE (Évite le blocage infini)
  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6B00" /></View>;
  }

  // Sécurité si le profil Firestore n'est pas encore synchronisé (Réseau lent)
  if (!user || !userProfile) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF6B00" />
        <Text style={{ marginTop: 10, color: '#666', textAlign: 'center', paddingHorizontal: 20 }}>
          Impossible de charger les détails de votre profil.
        </Text>
        <TouchableOpacity 
          style={[styles.primaryBtn, { marginTop: 15, paddingHorizontal: 20 }]} 
          onPress={() => refreshUserProfile().catch(() => {})}
        >
          <Text style={styles.primaryBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const email = user.email || userProfile.email || '';

  const pickImage = async () => {
    if (!editing) setEditing(true);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission requise', 'Accès à la photothèque refusé.');
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) setPendingImageUri(result.assets[0].uri);
  };

  const fillAddressFromGps = async (target: GeoTarget, key: 'address' | 'shopAddress') => {
    if (!editing) setEditing(true);
    setGeoLoading(target);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Localisation', 'Permission refusée.');

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setForm(prev => ({ ...prev, [key]: formatAddressFromGeocode(places, pos.coords.latitude, pos.coords.longitude) }));
    } catch (e: any) {
      Alert.alert('Localisation', e.message || 'Impossible de récupérer la position.');
    } finally {
      setGeoLoading(null);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) return Alert.alert('Erreur', 'Aucun e-mail associé.');
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('E-mail envoyé', `Lien de réinitialisation envoyé à : ${email}`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  };

const handleSave = async () => {
  setSaving(true);
  try {
    // 🟢 1. Récupération sûre de l'ancienne photo
    let photoURL = userProfile?.photoURL || user?.photoURL || "";

    // 🟢 2. Upload si une nouvelle image a été sélectionnée
    if (pendingImageUri) {
      const res = await fetch(pendingImageUri);
      const blob = await res.blob();
      const storageRef = ref(storage, `profilePictures/${user.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      photoURL = await getDownloadURL(storageRef);

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL });
      }
    }

    // 🟢 3. Construction propre des mises à jour utilisateur
    const phoneInput = form.phoneNumber ? form.phoneNumber.trim() : "";
    const addressInput = form.address ? form.address.trim() : "";

    const updates: Record<string, any> = {
      displayName: form.displayName.trim() || userProfile?.displayName || "",
      // Si le champ est rempli on le met à jour, sinon on conserve l'ancien numéro ou ""
      phoneNumber: phoneInput !== "" ? phoneInput : (userProfile?.phoneNumber || ""),
      address: addressInput !== "" ? addressInput : (userProfile?.address || ""),
      role: userRole,
      updatedAt: serverTimestamp(),
    };

    if (photoURL) {
      updates.photoURL = photoURL;
    }

    if (isSeller) {
      updates.sellerInfo = {
        ...userProfile?.sellerInfo,
        shopName: form.shopName.trim(),
        description: form.shopDescription.trim(),
        phone: form.shopPhone?.trim() || phoneInput,
        address: form.shopAddress?.trim() || addressInput,
      };
    }

    // 🟢 4. Sauvegarde dans Firestore & mise à jour du contexte
    await updateUserProfile(updates);

    if (isSeller && form.shopName.trim()) {
      const companyId = userProfile?.companyId || user.uid;
      await updateDoc(doc(db, 'companies', companyId), {
        name: form.shopName.trim(),
        nameLower: form.shopName.trim().toLowerCase(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    await refreshUserProfile();

    setPendingImageUri(null);
    setEditing(false);
    Alert.alert('Profil mis à jour', 'Vos modifications ont été enregistrées.');
  } catch (e: any) {
    Alert.alert('Erreur', e.message);
  } finally {
    setSaving(false);
  }
};

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Suppression définitive',
      'Voulez-vous vraiment supprimer votre compte ? Cette action effacera vos données et est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              if (auth.currentUser) {
                await updateDoc(doc(db, 'users', auth.currentUser.uid), { accountDeleted: true, deletedAt: serverTimestamp() });
                await auth.currentUser.delete();
                Alert.alert('Compte supprimé', 'À bientôt.');
                router.replace('/(tabs)/account');
              }
            } catch (e: any) {
              Alert.alert('Erreur', e.code === 'auth/requires-recent-login' ? 'Reconnectez-vous avant de supprimer le compte.' : e.message);
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // 📜 Boutons légaux
  const openCGU = async () => {
    try {
      await WebBrowser.openBrowserAsync(CGU_URL);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir les Conditions Générales d\'Utilisation.');
    }
  };

  const openConfidentialite = async () => {
    try {
      await WebBrowser.openBrowserAsync(PRIVACY_URL);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la Politique de Confidentialité.');
    }
  };

  const renderField = (label: string, value: string, key: string, options?: { multiline?: boolean; keyboard?: 'default' | 'phone-pad' }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={[styles.input, options?.multiline && styles.inputMultiline]}
          value={value}
          onChangeText={txt => setForm(p => ({ ...p, [key]: txt }))}
          placeholderTextColor="#AAA"
          editable={!saving}
          multiline={options?.multiline}
          keyboardType={options?.keyboard || 'default'}
        />
      ) : (
        <Text style={styles.valueText}>{value || '—'}</Text>
      )}
    </View>
  );

  const renderAddressField = (label: string, value: string, key: 'address' | 'shopAddress', geoTarget: GeoTarget) => (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {editing && <Text style={styles.geoHint}>Bouton : position GPS</Text>}
      </View>
      {editing ? (
        <View style={styles.addressRow}>
          <TextInput
            style={[styles.input, styles.inputMultiline, { flex: 1 }]}
            value={value}
            onChangeText={txt => setForm(p => ({ ...p, [key]: txt }))}
            placeholder="Adresse complète..."
            placeholderTextColor="#AAA"
            editable={!saving}
            multiline
          />
          <TouchableOpacity style={styles.geoButton} onPress={() => fillAddressFromGps(geoTarget, key)} disabled={saving || geoLoading !== null}>
            {geoLoading === geoTarget ? <ActivityIndicator size="small" color="#FF6B00" /> : <Ionicons name="navigate" size={22} color="#FF6B00" />}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.valueText}>{value || '—'}</Text>
      )}
    </View>
  );

  const body = (
    <>
      {variant === 'card' && <Text style={styles.sectionTitle}>Mon profil</Text>}
      <View style={styles.avatarRow}>
        <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} disabled={saving}>
          {pendingImageUri || user.photoURL ? (
            <Image 
              source={{ uri: (pendingImageUri || user.photoURL) as string }} 
              style={styles.avatarImg} 
            />
          ) : (
            <View style={styles.avatarPlaceholder}><Ionicons name="person" size={40} color="#FF6B00" /></View>
          )}
          <View style={styles.editBadge}><Ionicons name="camera" size={16} color="#FFF" /></View>
        </TouchableOpacity>
        <View style={styles.avatarMeta}>
          <Text style={styles.metaName}>{form.displayName || email.split('@')[0]}</Text>
          <View style={styles.rolePill}><Text style={styles.rolePillText}>{userRole}</Text></View>
        </View>
      </View>

      {renderField('Nom affiché', form.displayName, 'displayName')}

      <View style={styles.field}>
        <Text style={styles.label}>E-mail</Text>
        <Text style={styles.readonlyValue}>{email}</Text>
        {email ? (
          <TouchableOpacity style={styles.resetPasswordRow} onPress={handlePasswordReset}>
            <Ionicons name="key-outline" size={18} color="#FF6B00" />
            <Text style={styles.resetPasswordText}>Réinitialiser le mot de passe par e-mail</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isSeller && (
        <>
          <Text style={styles.subsection}>Boutique</Text>
          {renderField('Nom de la boutique', form.shopName, 'shopName')}
          {renderField('Description', form.shopDescription, 'shopDescription', { multiline: true })}
          {renderField('Téléphone', form.shopPhone, 'shopPhone', { keyboard: 'phone-pad' })}
          {renderAddressField('Adresse boutique', form.shopAddress, 'shopAddress', 'shop')}
        </>
      )}

      {isCustomer && (
        <>
          <Text style={styles.subsection}>Livraison</Text>
          {renderField('Téléphone livraison', form.phoneNumber, 'phoneNumber', { keyboard: 'phone-pad' })}
          {renderAddressField('Adresse livraison', form.address, 'address', 'address')}
        </>
      )}

      <View style={styles.actions}>
        {!editing ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setEditing(true)}>
            <Text style={styles.primaryBtnText}>Modifier le profil</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Enregistrer</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditing(false)} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Annuler</Text>
            </TouchableOpacity>
          </>
        )}

        {/* 🔄 BOUTON SE DÉCONNECTER (Placé de manière élégante) */}
        {!editing && (
          <TouchableOpacity 
            style={[styles.secondaryBtn, { marginTop: 12, flexDirection: 'row', borderColor: '#FF6B00' }]} 
            onPress={async () => {
              try {
                await auth.signOut();
                router.replace('/(tabs)/account');
              } catch (e: any) {
                Alert.alert('Erreur', 'Impossible de se déconnecter.');
              }
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#FF6B00" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FF6B00', fontSize: 16, fontWeight: 'bold' }}>Se déconnecter</Text>
          </TouchableOpacity>
        )}

        {/* 🛑 BOUTON SUPPRIMER LE COMPTE */}
        {!editing && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} disabled={saving}>
            <Ionicons name="trash-outline" size={18} color="#FF3B30" style={{ marginRight: 8 }} />
            <Text style={styles.deleteBtnText}>Supprimer mon compte définitivement</Text>
          </TouchableOpacity>
        )}

        {/* 📜 BOUTONS LÉGAUX (CGU et Confidentialité) */}
        <View style={styles.legalSection}>
          <TouchableOpacity style={styles.legalBtn} onPress={openCGU}>
            <Ionicons name="document-text-outline" size={18} color="#666" style={{ marginRight: 8 }} />
            <Text style={styles.legalBtnText}>Conditions Générales d'Utilisation</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
          
          <View style={styles.legalDivider} />
          
          <TouchableOpacity style={styles.legalBtn} onPress={openConfidentialite}>
            <Ionicons name="shield-outline" size={18} color="#666" style={{ marginRight: 8 }} />
            <Text style={styles.legalBtnText}>Politique de Confidentialité</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return variant === 'screen' ? (
    <ScrollView style={styles.screenScroll} contentContainerStyle={styles.screenScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.screenCard}>{body}</View>
    </ScrollView>
  ) : (
    <View style={styles.card}>{body}</View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12 },
  screenScroll: { flex: 1, backgroundColor: '#F8F9FA' },
  screenScrollContent: { padding: 16 },
  screenCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  subsection: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 10, color: '#FF6B00' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 70, height: 70, borderRadius: 35 },
  avatarPlaceholder: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF0E5', justifyContent: 'center', alignItems: 'center' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FF6B00', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarMeta: { marginLeft: 16 },
  metaName: { fontSize: 18, fontWeight: 'bold' },
  rolePill: { backgroundColor: '#EAEAEA', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4, alignSelf: 'flex-start' },
  rolePillText: { fontSize: 12, color: '#555' },
  field: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: '#666', marginBottom: 4 },
  geoHint: { fontSize: 11, color: '#FF6B00' },
  valueText: { fontSize: 16, color: '#222', paddingVertical: 4 },
  readonlyValue: { fontSize: 16, color: '#777' },
  input: { borderBottomWidth: 1, borderColor: '#CCC', paddingVertical: 6, fontSize: 16, color: '#000' },
  inputMultiline: { minHeight: 40 },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  geoButton: { padding: 10, marginLeft: 8 },
  resetPasswordRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  resetPasswordText: { color: '#FF6B00', marginLeft: 6, fontSize: 14 },
  actions: { marginTop: 24 },
  primaryBtn: { backgroundColor: '#FF6B00', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: { padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#CCC' },
  secondaryBtnText: { color: '#555', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#FF3B30', borderRadius: 8, backgroundColor: '#FFF5F5' },
  deleteBtnText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
  legalSection: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  legalBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  legalBtnText: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },
  legalDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
});