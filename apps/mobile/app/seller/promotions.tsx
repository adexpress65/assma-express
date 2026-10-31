import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PromotionsScreen() {
  const [promotions, setPromotions] = useState([
    {
      id: '1',
      title: 'Soldes Ãƒâ€°tÃƒÂ© 2024',
      code: 'ETE2024',
      discount: '20%',
      startDate: '2024-06-01',
      endDate: '2024-08-31',
      status: 'active',
      usage: 45,
      limit: 100
    },
    {
      id: '2',
      title: 'PremiÃƒÂ¨re Commande',
      code: 'BIENVENUE',
      discount: '15%',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: 'active',
      usage: 89,
      limit: 200
    },
    {
      id: '3',
      title: 'Black Friday',
      code: 'BLACKFRIDAY',
      discount: '30%',
      startDate: '2024-11-25',
      endDate: '2024-11-30',
      status: 'scheduled',
      usage: 0,
      limit: 500
    }
  ]);

  const [newPromotion, setNewPromotion] = useState({
    title: '',
    code: '',
    discount: '',
    startDate: '',
    endDate: '',
    limit: ''
  });

  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);

  // SÃƒÂ©lecteur de date simple
  const SimpleDateInput = ({ 
    value, 
    placeholder, 
    onPress 
  }: { 
    value: string; 
    placeholder: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={dateStyles.input} onPress={onPress}>
      <Text style={value ? dateStyles.inputText : dateStyles.placeholder}>
        {value || placeholder}
      </Text>
      <Ionicons name="calendar-outline" size={20} color="#666" />
    </TouchableOpacity>
  );

  const handleCreatePromotion = () => {
    if (!newPromotion.title || !newPromotion.code || !newPromotion.discount) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    const promotion = {
      id: Date.now().toString(),
      title: newPromotion.title,
      code: newPromotion.code.toUpperCase(),
      discount: newPromotion.discount,
      startDate: newPromotion.startDate || '2024-01-01',
      endDate: newPromotion.endDate || '2024-12-31',
      status: 'active' as const,
      usage: 0,
      limit: parseInt(newPromotion.limit) || 100
    };

    setPromotions(prev => [promotion, ...prev]);
    setNewPromotion({
      title: '',
      code: '',
      discount: '',
      startDate: '',
      endDate: '',
      limit: ''
    });
    
    Alert.alert('SuccÃƒÂ¨s', 'Promotion crÃƒÂ©ÃƒÂ©e avec succÃƒÂ¨s !');
  };

  const togglePromotionStatus = (id: string) => {
    setPromotions(prev => 
      prev.map(promo => 
        promo.id === id 
          ? { ...promo, status: promo.status === 'active' ? 'paused' : 'active' }
          : promo
      )
    );
  };

  const deletePromotion = (id: string) => {
    Alert.alert(
      'Supprimer la promotion',
      'ÃƒÅ tes-vous sÃƒÂ»r de vouloir supprimer cette promotion ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: () => {
            setPromotions(prev => prev.filter(promo => promo.id !== id));
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'paused': return '#FF9800';
      case 'scheduled': return '#2196F3';
      case 'expired': return '#FF4444';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'paused': return 'En pause';
      case 'scheduled': return 'PlanifiÃƒÂ©e';
      case 'expired': return 'ExpirÃƒÂ©e';
      default: return status;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ã°Å¸Å½Â¯ Promotions</Text>
        <Text style={styles.subtitle}>GÃƒÂ©rez vos codes promotionnels</Text>
      </View>

      {/* Formulaire de crÃƒÂ©ation */}
      <View style={styles.createSection}>
        <Text style={styles.sectionTitle}>CrÃƒÂ©er une nouvelle promotion</Text>
        
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Titre de la promotion *"
            value={newPromotion.title}
            onChangeText={(text) => setNewPromotion(prev => ({ ...prev, title: text }))}
          />
          
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Code promo *"
              value={newPromotion.code}
              onChangeText={(text) => setNewPromotion(prev => ({ ...prev, code: text }))}
              maxLength={20}
            />
            
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="RÃƒÂ©duction *"
              value={newPromotion.discount}
              onChangeText={(text) => setNewPromotion(prev => ({ ...prev, discount: text }))}
            />
          </View>

          <View style={styles.row}>
            <SimpleDateInput
              value={newPromotion.startDate}
              placeholder="Date de dÃƒÂ©but"
              onPress={() => {
                // Simuler la sÃƒÂ©lection de date
                const today = new Date().toISOString().split('T')[0];
                setNewPromotion(prev => ({ ...prev, startDate: today }));
              }}
            />
            
            <SimpleDateInput
              value={newPromotion.endDate}
              placeholder="Date de fin"
              onPress={() => {
                // Simuler la sÃƒÂ©lection de date
                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                setNewPromotion(prev => ({ 
                  ...prev, 
                  endDate: nextMonth.toISOString().split('T')[0] 
                }));
              }}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Limite d'utilisation (optionnel)"
            value={newPromotion.limit}
            onChangeText={(text) => setNewPromotion(prev => ({ ...prev, limit: text }))}
            keyboardType="numeric"
          />

          <TouchableOpacity 
            style={styles.createButton}
            onPress={handleCreatePromotion}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.createButtonText}>CrÃƒÂ©er la promotion</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste des promotions */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Promotions actives</Text>
        
        {promotions.map((promotion) => (
          <View key={promotion.id} style={styles.promotionCard}>
            <View style={styles.promotionHeader}>
              <View style={styles.promotionInfo}>
                <Text style={styles.promotionTitle}>{promotion.title}</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.promotionCode}>{promotion.code}</Text>
                  <Text style={styles.promotionDiscount}>{promotion.discount}</Text>
                </View>
              </View>
              
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(promotion.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(promotion.status) }]}>
                  {getStatusText(promotion.status)}
                </Text>
              </View>
            </View>

            <View style={styles.promotionDetails}>
              <Text style={styles.detailText}>
                Ã°Å¸â€œâ€¦ {promotion.startDate} Ã¢â€ â€™ {promotion.endDate}
              </Text>
              <Text style={styles.detailText}>
                Ã°Å¸â€˜Â¥ Utilisation: {promotion.usage}/{promotion.limit}
              </Text>
            </View>

            <View style={styles.usageBar}>
              <View 
                style={[
                  styles.usageProgress,
                  { width: `${(promotion.usage / promotion.limit) * 100}%` }
                ]} 
              />
            </View>

            <View style={styles.promotionActions}>
              <TouchableOpacity 
                style={[
                  styles.actionButton,
                  promotion.status === 'active' ? styles.pauseButton : styles.activateButton
                ]}
                onPress={() => togglePromotionStatus(promotion.id)}
              >
                <Ionicons 
                  name={promotion.status === 'active' ? 'pause' : 'play'} 
                  size={16} 
                  color="#FFF" 
                />
                <Text style={styles.actionButtonText}>
                  {promotion.status === 'active' ? 'Pause' : 'Activer'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.copyButton]}
                onPress={() => {
                  // Copier le code promo
                  Alert.alert('CopiÃƒÂ© !', `Code ${promotion.code} copiÃƒÂ© dans le presse-papier`);
                }}
              >
                <Ionicons name="copy-outline" size={16} color="#666" />
                <Text style={styles.copyButtonText}>Copier</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => deletePromotion(promotion.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#FF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const dateStyles = StyleSheet.create({
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  inputText: {
    fontSize: 14,
    color: '#333',
  },
  placeholder: {
    fontSize: 14,
    color: '#999',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  createSection: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listSection: {
    marginBottom: 20,
  },
  promotionCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  promotionInfo: {
    flex: 1,
  },
  promotionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promotionCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B00',
    backgroundColor: '#FFF3E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  promotionDiscount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  promotionDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  usageBar: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  usageProgress: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 2,
  },
  promotionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
    flex: 1,
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  copyButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flex: 0.8,
  },
  copyButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FFE0E0',
    flex: 0.4,
  },
});
