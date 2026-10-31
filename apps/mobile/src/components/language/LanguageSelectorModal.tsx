// apps/mobile/src/components/language/LanguageSelectorModal.tsx

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Language, SUPPORTED_LANGUAGES } from '@/services/i18n/languages';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLanguageSelect: (language: Language) => void;
  currentLanguageCode: string;
}

const { height } = Dimensions.get('window');

export default function LanguageSelectorModal({
  visible,
  onClose,
  onLanguageSelect,
  currentLanguageCode,
}: Props) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>🌐 Select language</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {SUPPORTED_LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={styles.item}
                onPress={() => onLanguageSelect(lang)}
              >
                <Text style={styles.flag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text>{lang.name}</Text>
                  <Text style={{ color: '#777' }}>{lang.nativeName}</Text>
                </View>
                {currentLanguageCode === lang.code && (
                  <Ionicons name="checkmark-circle" size={20} color="#ff6a00" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: '#f2f2f2',
  },
  flag: { fontSize: 22 },
});
