import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  SafeAreaView, TextInput, Image, Alert, Dimensions, Animated, Modal, Linking 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Firebase imports
import { collection, query, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../src/config/firebase'; 

const { width, height } = Dimensions.get('window');

export default function InnovationHubScreen() {
  const router = useRouter();
  
  // -- ÉTATS DONNÉES & CALCULS --
  const [products, setProducts] = useState([]);
  const [linkInput, setLinkInput] = useState('');
  const [dims, setDims] = useState({ l: '', w: '', h: '', kg: '' });
  const [res, setRes] = useState(null);

  // -- ÉTATS IA & ANIMATIONS --
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAIPreview, setShowAIPreview] = useState(false);
  const analysisProgress = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation de respiration pour l'icône Askia
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // Animation flottante pour le bouton IA
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Récupération des produits réels depuis Firestore
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      const p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(p);
    });
    return () => unsub();
  }, []);

  // -- LOGIQUE IA DÉTECTIVE --
  const handleAnalyze = () => {
    if (!linkInput.includes('http')) {
      Alert.alert("Askia IA", "Veuillez coller un lien valide d'un site marchand.");
      return;
    }
    setIsAnalyzing(true);
    Animated.timing(analysisProgress, {
      toValue: 1,
      duration: 3500,
      useNativeDriver: false,
    }).start(() => {
      setIsAnalyzing(false);
      analysisProgress.setValue(0);
      router.push({
        pathname: '/ai-assistant',
        params: { initialMessage: `Analyse ce produit pour le marché malien : ${linkInput}` }
      });
    });
  };

  // -- LOGIQUE CALCULATEUR & ENVOI WHATSAPP --
  const calculateFret = () => {
    const { l, w, h, kg } = dims;
    if (!l || !w || !h) return Alert.alert("Erreur", "Veuillez remplir toutes les dimensions.");
    const cbm = (parseFloat(l) * parseFloat(w) * parseFloat(h)) / 1000000;
    const weight = parseFloat(kg) || 0;
    setRes({
      express: weight * 12000,
      maritime: cbm * 295000
    });
  };

  const sendToWhatsApp = (type: string, prix: string) => {
    const user = auth.currentUser;
    const clientName = user?.displayName || "Client A2E";
    const clientID = user?.uid ? user.uid.substring(0, 7).toUpperCase() : "INVITÉ";
    
    const message = 
      `*NOUVELLE ESTIMATION A2E*%0A` +
      `----------------------------%0A` +
      `👤 *CLIENT:* ${clientName}%0A` +
      `🆔 *ID:* ${clientID}%0A` +
      `----------------------------%0A` +
      `📦 *MODE:* ${type}%0A` +
      `📏 *DIM:* ${dims.l}x${dims.w}x${dims.h} cm%0A` +
      `⚖️ *POIDS:* ${dims.kg} kg%0A` +
      `💰 *PRIX:* ${prix} FCFA%0A` +
      `----------------------------%0A` +
      `_Envoyé via le Lab Innovation Askia_`;

    const phone = "22300000000"; // REMPLACE PAR TON NUMÉRO
    Linking.openURL(`https://wa.me/${phone}?text=${message}`);
  };

  // -- GESTION PRÉVISUALISATION IA --
  const openAIAssistant = (initialMessage?: string) => {
    setShowAIPreview(false);
    if (initialMessage) {
      setTimeout(() => {
        router.push({
          pathname: '/ai-assistant',
          params: { initialMessage }
        });
      }, 300);
    } else {
      setTimeout(() => {
        router.push('/ai-assistant');
      }, 300);
    }
  };

  // -- PRÉVISUALISATION IA MODAL --
  const AIPreviewModal = () => {
    const quickQuestions = [
      "Comment importer en Chine ?",
      "Fret maritime vs aérien ?",
      "Dédouanement au Mali ?",
      "Tendances produits ?"
    ];

    return (
      <Modal
        visible={showAIPreview}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAIPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAIPreview(false)}
          />
          
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1A1A1A', '#2D2D2D']} style={styles.aiPreviewGradient}>
              <View style={styles.previewHeader}>
                <View style={styles.aiAvatar}>
                  <MaterialCommunityIcons name="robot" size={24} color="#FF6B00" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle}>Askia IA • Expert A2Express</Text>
                  <Text style={styles.previewSub}>Disponible 24h/24 pour vos questions</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAIPreview(false)} style={styles.closePreviewBtn}>
                  <Ionicons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.chatPreview}>
                <View style={styles.aiMessage}>
                  <Text style={styles.aiMessageText}>Bonjour ! Comment puis-je vous aider aujourd'hui ?</Text>
                </View>
                <View style={styles.userMessage}>
                  <Text style={styles.userMessageText}>Besoin d'info sur l'import</Text>
                </View>
              </View>

              <View style={styles.quickQuestionsRow}>
                {quickQuestions.map((question, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.quickQuestionBtn}
                    onPress={() => openAIAssistant(question)}
                  >
                    <Text style={styles.quickQuestionText} numberOfLines={1}>{question}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.openFullBtn}
                onPress={() => openAIAssistant()}
              >
                <LinearGradient colors={['#8E24AA', '#4A148C']} style={styles.openFullGradient}>
                  <Ionicons name="chatbubbles" size={18} color="#FFF" />
                  <Text style={styles.openFullText}>Ouvrir Askia IA</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER PREMIUM */}
      <LinearGradient colors={['#4A148C', '#8E24AA']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>A2Express LAB INNOVATION</Text>
          <View style={styles.badgeIA}>
            <Text style={styles.badgeText}>ASKIA 2.5 ACTIVE</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => openAIAssistant()}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <MaterialCommunityIcons name="robot" size={28} color="#FF6B00" />
          </Animated.View>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* CARD IA INTÉGRÉE */}
        <TouchableOpacity onPress={() => setShowAIPreview(true)} activeOpacity={0.9}>
          <LinearGradient colors={['#FF6B00', '#FF8E00']} style={styles.aiAccessCard}>
            <View style={styles.aiAccessContent}>
              <View>
                <Text style={styles.aiAccessTitle}>Assistant Askia IA</Text>
                <Text style={styles.aiAccessSub}>Cliquez pour parler à notre expert IA</Text>
              </View>
              <Animated.View style={{ transform: [{ translateY: floatAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5]
              }) }] }}>
                <MaterialCommunityIcons name="robot-excited" size={32} color="#FFF" />
              </Animated.View>
            </View>
            <View style={styles.featuresRow}>
              <View style={styles.featureItem}>
                <Ionicons name="bulb" size={14} color="#FFF" />
                <Text style={styles.featureText}>Conseils</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="calculator" size={14} color="#FFF" />
                <Text style={styles.featureText}>Calculs</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="trending-up" size={14} color="#FFF" />
                <Text style={styles.featureText}>Tendances</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* IA DÉTECTIVE CARD */}
        <View style={styles.iaCard}>
          <LinearGradient colors={['#1A1A1A', '#333']} style={styles.iaGradient}>
            <Text style={styles.iaTitle}>Détective de Prix IA</Text>
            <Text style={styles.iaSub}>Collez un lien, Askia trouve l'usine en Chine.</Text>
            <View style={styles.searchRow}>
              <TextInput 
                style={styles.iaInput} 
                placeholder="Lien Alibaba, 1688..." 
                placeholderTextColor="#666"
                value={linkInput}
                onChangeText={setLinkInput}
              />
              <TouchableOpacity style={styles.iaBtn} onPress={handleAnalyze}>
                <Ionicons name="search" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* CATALOGUE PRODUITS (LISTE COMPACTE) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tendances du Lab</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/categories')}>
              <Text style={styles.seeMore}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {products.map((item) => (
            <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => router.push(`/product/${item.id}`)}>
              <Image source={{ uri: item.imageUrl || item.image }} style={styles.listImg} />
              <View style={styles.listInfo}>
                <Text style={styles.listShop}>{item.storeName || "USINE PARTENAIRE"}</Text>
                <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.listPrice}>{item.price} F</Text>
              </View>
              <View style={styles.liveBadge}>
                <Ionicons name="videocam" size={12} color="#8E24AA" />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* CALCULATEUR DE FRET */}
        <View style={styles.fretSection}>
          <View style={styles.fretHeaderWithAI}>
            <Text style={styles.fretTitle}>Simulateur de Fret IA</Text>
            <TouchableOpacity 
              style={styles.aiHelpBtn}
              onPress={() => openAIAssistant("Explique-moi comment calculer le fret maritime vs aérien")}
            >
              <Ionicons name="help-circle" size={18} color="#8E24AA" />
              <Text style={styles.aiHelpText}>Demander à Askia</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.fretGrid}>
            <View style={styles.fInBox}>
              <Text style={styles.fLabel}>L (cm)</Text>
              <TextInput style={styles.fInput} keyboardType="numeric" onChangeText={(v)=>setDims({...dims, l:v})}/>
            </View>
            <View style={styles.fInBox}>
              <Text style={styles.fLabel}>l (cm)</Text>
              <TextInput style={styles.fInput} keyboardType="numeric" onChangeText={(v)=>setDims({...dims, w:v})}/>
            </View>
            <View style={styles.fInBox}>
              <Text style={styles.fLabel}>H (cm)</Text>
              <TextInput style={styles.fInput} keyboardType="numeric" onChangeText={(v)=>setDims({...dims, h:v})}/>
            </View>
          </View>
          <TextInput 
            style={styles.fWeight} 
            placeholder="Poids total (kg)" 
            keyboardType="numeric" 
            onChangeText={(v)=>setDims({...dims, kg:v})} 
          />
          <TouchableOpacity style={styles.calcBtn} onPress={calculateFret}>
            <Text style={styles.calcBtnText}>CALCULER & ESTIMER</Text>
          </TouchableOpacity>

          {res && (
            <View style={styles.resContainer}>
              <TouchableOpacity style={styles.resItem} onPress={() => sendToWhatsApp("EXPRESS", res.express.toLocaleString())}>
                <Text style={styles.resLabel}>✈️ Express:</Text>
                <Text style={styles.resVal}>
                  {res.express.toLocaleString()} F 
                  <Ionicons name="logo-whatsapp" size={14} color="#25D366" style={{ marginLeft: 5 }} />
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resItem} onPress={() => sendToWhatsApp("MARITIME", res.maritime.toLocaleString())}>
                <Text style={styles.resLabel}>🚢 Maritime:</Text>
                <Text style={styles.resVal}>
                  {res.maritime.toLocaleString()} F 
                  <Ionicons name="logo-whatsapp" size={14} color="#25D366" style={{ marginLeft: 5 }} />
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>

      {/* BOUTON FLOTTANT IA */}
      <Animated.View style={[styles.floatingAIBtn, { transform: [{ translateY: floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -10]
      }) }] }]}>
        <TouchableOpacity onPress={() => setShowAIPreview(true)} style={styles.floatingBtnInner}>
          <LinearGradient colors={['#8E24AA', '#4A148C']} style={styles.floatingGradient}>
            <MaterialCommunityIcons name="robot" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* MODAL PRÉVISUALISATION IA */}
      <AIPreviewModal />

      {/* LOADER ANALYSE MODAL */}
      <Modal visible={isAnalyzing} transparent>
        <View style={styles.overlay}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <MaterialCommunityIcons name="brain" size={80} color="#FF6B00" />
          <Text style={styles.loadT}>ASKIA ANALYSE LE LIEN...</Text>
          <View style={styles.pBarBg}>
            <Animated.View style={[styles.pBarFill, { 
              width: analysisProgress.interpolate({ 
                inputRange: [0, 1], 
                outputRange: ['0%', '100%']
              }) 
            }]} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FB' 
  },
  scrollContent: { 
    padding: 20, 
    paddingBottom: 100 
  },
  
  // HEADER
  header: { 
    padding: 20, 
    paddingTop: 50, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30 
  },
  headerTitle: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  hBtn: { 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    padding: 8, 
    borderRadius: 12 
  },
  badgeIA: { 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 10, 
    marginTop: 5 
  },
  badgeText: { 
    color: '#FF6B00', 
    fontSize: 8, 
    fontWeight: 'bold' 
  },

  // CARD ACCÈS IA
  aiAccessCard: { 
    marginBottom: 25, 
    borderRadius: 25, 
    padding: 20, 
    elevation: 5 
  },
  aiAccessContent: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  aiAccessTitle: { 
    color: '#FFF', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  aiAccessSub: { 
    color: 'rgba(255,255,255,0.8)', 
    fontSize: 12 
  },
  featuresRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around' 
  },
  featureItem: { 
    alignItems: 'center' 
  },
  featureText: { 
    color: '#FFF', 
    fontSize: 10, 
    marginTop: 4 
  },

  // MODAL PRÉVISUALISATION
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  aiPreviewGradient: { 
    padding: 20, 
    paddingBottom: 30 
  },
  previewHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  aiAvatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#333', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  previewTitle: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  previewSub: { 
    color: '#AAA', 
    fontSize: 11 
  },
  closePreviewBtn: { 
    padding: 5 
  },
  chatPreview: { 
    backgroundColor: '#2A2A2A', 
    borderRadius: 15, 
    padding: 12, 
    marginBottom: 15 
  },
  aiMessage: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#333', 
    padding: 10, 
    borderRadius: 15, 
    borderBottomLeftRadius: 5, 
    maxWidth: '80%', 
    marginBottom: 8 
  },
  aiMessageText: { 
    color: '#FFF', 
    fontSize: 12 
  },
  userMessage: { 
    alignSelf: 'flex-end', 
    backgroundColor: '#8E24AA', 
    padding: 10, 
    borderRadius: 15, 
    borderBottomRightRadius: 5, 
    maxWidth: '70%' 
  },
  userMessageText: { 
    color: '#FFF', 
    fontSize: 12 
  },
  quickQuestionsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    marginBottom: 15 
  },
  quickQuestionBtn: { 
    width: '48%', 
    backgroundColor: '#333', 
    padding: 10, 
    borderRadius: 10, 
    marginBottom: 8 
  },
  quickQuestionText: { 
    color: '#FFF', 
    fontSize: 11, 
    textAlign: 'center' 
  },
  openFullBtn: { 
    marginTop: 5 
  },
  openFullGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 15, 
    borderRadius: 15 
  },
  openFullText: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    marginLeft: 8 
  },

  // BOUTON FLOTTANT
  floatingAIBtn: { 
    position: 'absolute', 
    bottom: 30, 
    right: 20, 
    zIndex: 999 
  },
  floatingBtnInner: { 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8 
  },
  floatingGradient: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 5 
  },

  // IA DÉTECTIVE
  iaCard: { 
    marginBottom: 25, 
    borderRadius: 25, 
    overflow: 'hidden', 
    elevation: 5 
  },
  iaGradient: { 
    padding: 20 
  },
  iaTitle: { 
    color: '#FFF', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  iaSub: { 
    color: '#AAA', 
    fontSize: 11, 
    marginBottom: 15 
  },
  searchRow: { 
    flexDirection: 'row', 
    backgroundColor: '#000', 
    borderRadius: 15, 
    padding: 5 
  },
  iaInput: { 
    flex: 1, 
    color: '#FFF', 
    paddingHorizontal: 15 
  },
  iaBtn: { 
    backgroundColor: '#FF6B00', 
    padding: 12, 
    borderRadius: 12 
  },

  // SECTION PRODUITS
  section: { 
    marginBottom: 25 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 15 
  },
  sectionTitle: { 
    fontSize: 17, 
    fontWeight: 'bold' 
  },
  seeMore: { 
    color: '#8E24AA', 
    fontWeight: 'bold', 
    fontSize: 12 
  },
  listItem: { 
    flexDirection: 'row', 
    backgroundColor: '#FFF', 
    padding: 12, 
    borderRadius: 20, 
    marginBottom: 10, 
    alignItems: 'center', 
    elevation: 2 
  },
  listImg: { 
    width: 60, 
    height: 60, 
    borderRadius: 15, 
    backgroundColor: '#F0F0F0' 
  },
  listInfo: { 
    flex: 1, 
    marginLeft: 15 
  },
  listShop: { 
    color: '#8E24AA', 
    fontSize: 9, 
    fontWeight: 'bold' 
  },
  listName: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#444' 
  },
  listPrice: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#FF6B00' 
  },
  liveBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F3E5F5', 
    padding: 5, 
    borderRadius: 8 
  },
  liveText: { 
    fontSize: 8, 
    fontWeight: 'bold', 
    color: '#8E24AA', 
    marginLeft: 3 
  },

  // CALCULATEUR FRET
  fretSection: { 
    backgroundColor: '#FFF', 
    borderRadius: 25, 
    padding: 20, 
    elevation: 3, 
    marginBottom: 30 
  },
  fretHeaderWithAI: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  fretTitle: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  aiHelpBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 6, 
    backgroundColor: '#F3E5F5', 
    borderRadius: 10 
  },
  aiHelpText: { 
    color: '#8E24AA', 
    fontSize: 10, 
    marginLeft: 4 
  },
  fretGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  fInBox: { 
    width: '31%' 
  },
  fLabel: { 
    fontSize: 10, 
    color: '#8E24AA', 
    fontWeight: 'bold', 
    marginBottom: 5 
  },
  fInput: { 
    backgroundColor: '#F4F7FA', 
    padding: 12, 
    borderRadius: 12, 
    textAlign: 'center' 
  },
  fWeight: { 
    backgroundColor: '#F4F7FA', 
    padding: 15, 
    borderRadius: 12, 
    marginTop: 15 
  },
  calcBtn: { 
    backgroundColor: '#1A1A1A', 
    padding: 16, 
    borderRadius: 15, 
    marginTop: 20, 
    alignItems: 'center' 
  },
  calcBtnText: { 
    color: '#FFF', 
    fontWeight: 'bold' 
  },
  resContainer: { 
    marginTop: 15, 
    borderTopWidth: 1, 
    borderColor: '#EEE', 
    paddingTop: 10 
  },
  resItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 8 
  },
  resLabel: { 
    color: '#777' 
  },
  resVal: { 
    fontWeight: 'bold', 
    color: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center'
  },

  // MODAL LOADER
  overlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadT: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    marginTop: 20 
  },
  pBarBg: { 
    width: '70%', 
    height: 6, 
    backgroundColor: '#333', 
    borderRadius: 3, 
    marginTop: 20 
  },
  pBarFill: { 
    height: '100%', 
    backgroundColor: '#FF6B00' 
  }
});
