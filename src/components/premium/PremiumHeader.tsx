import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Dimensions, ScrollView, ActivityIndicator, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import SearchResults from '@/components/search/SearchResults';
import { searchGlobal } from '@/services/searchService';
import type { SearchResultItem } from '@/services/searchService';
import LanguageSelectorModal from '@/components/language/LanguageSelectorModal';
import { Language } from '@/services/i18n/languages';
import { useCurrency } from '../../contexts/CurrencyContext'; // ✅ Import vérifié

const { width } = Dimensions.get('window');

const DesignParticles = () => (
  <View style={styles.particlesContainer}>
    <View style={[styles.particle, { width: 3, height: 3, top: 4, right: 8, opacity: 0.7 }]} />
    <View style={[styles.particle, { width: 2, height: 2, top: 12, right: 20, opacity: 0.4 }]} />
    <View style={[styles.particle, { width: 4, height: 4, top: 2, right: 32, opacity: 0.6 }]} />
    <Ionicons name="sparkles" size={10} color="rgba(255,255,255,0.4)" style={{ marginLeft: 10 }} />
  </View>
);

export default function PremiumHeader() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const { t, i18n } = useTranslation();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  
  // ✅ UTILISATION DU CONTEXT (Suppression de l'état local index)
  const { currency, setCurrencyByCode } = useCurrency();

  const toggleCurrency = () => {
    const codes = ['USD', 'XOF', 'EUR'];
    const currentIndex = codes.indexOf(currency.code);
    const nextIndex = (currentIndex + 1) % codes.length;
    setCurrencyByCode(codes[nextIndex]);
  };

  useEffect(() => {
    const loadCurrentLanguage = async () => {
      setCurrentLanguage({
        code: i18n.language,
        name: getLanguageName(i18n.language),
        nativeName: getNativeLanguageName(i18n.language),
        flag: getFlag(i18n.language),
        direction: i18n.language === 'ar' ? 'rtl' : 'ltr'
      });
    };
    loadCurrentLanguage();
  }, [i18n.language]);

  const handleLanguageSelect = async (language: Language) => {
    try {
      await i18n.changeLanguage(language.code);
      setCurrentLanguage(language);
      setLanguageModalVisible(false);
    } catch (error) {
      console.error(t('header.languageChangeError'), error);
    }
  };

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setLoading(true);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          const results = await searchGlobal(searchQuery);
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          setSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setLoading(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
    }
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      cleanSearch();
      router.push({ pathname: '/search-results', params: { query: searchQuery, timestamp: Date.now() } });
    }
  };

  const handleSelectSuggestion = (item: SearchResultItem) => {
    cleanSearch();
    switch(item.type) {
      case 'product': router.push({ pathname: '/product/[id]', params: { id: item.id } }); break;
      case 'category': router.push({ pathname: '/category/[id]', params: { id: item.id, name: item.name } }); break;
      case 'company': router.push({ pathname: '/company/[id]', params: { id: item.id, name: item.name } }); break;
      default: router.push({ pathname: '/search-results', params: { query: item.name } });
    }
  };

  const cleanSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const getLanguageName = (code: string): string => {
    const languages: Record<string, string> = {
      'en': t('languages.english'), 'fr': t('languages.french'), 'es': t('languages.spanish'),
      'ar': t('languages.arabic'), 'zh': t('languages.chinese'), 'ru': t('languages.russian'),
      'pt': t('languages.portuguese'), 'tr': t('languages.turkish'), 'de': t('languages.german'),
      'it': t('languages.italian'), 'nl': t('languages.dutch'), 'ja': t('languages.japanese'),
      'ko': t('languages.korean'), 'vi': t('languages.vietnamese'), 'id': t('languages.indonesian'),
    };
    return languages[code] || t('languages.english');
  };

  const getNativeLanguageName = (code: string): string => {
    const languages: Record<string, string> = {
      'en': 'English', 'fr': 'Français', 'es': 'Español', 'ar': 'العربية', 'zh': '简体中文',
      'ru': 'Русский', 'pt': 'Português', 'tr': 'Türkçe', 'de': 'Deutsch', 'it': 'Italiano',
      'nl': 'Nederlands', 'ja': '日本語', 'ko': '한국어', 'vi': 'Tiếng Việt', 'id': 'Bahasa Indonesia',
    };
    return languages[code] || 'English';
  };

  const getFlag = (code: string): string => {
    const flags: Record<string, string> = {
      'en': '🇬🇧', 'fr': '🇫🇷', 'es': '🇪🇸', 'ar': '🇸🇦', 'zh': '🇨🇳', 'ru': '🇷🇺', 'pt': '🇵🇹',
      'tr': '🇹🇷', 'de': '🇩🇪', 'it': '🇮🇹', 'nl': '🇳🇱', 'ja': '🇯🇵', 'ko': '🇰🇷', 'vi': '🇻🇳', 'id': '🇮🇩',
    };
    return flags[code] || '🇬🇧';
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.keyboardAvoidingView, i18n.language === 'ar' && { direction: 'rtl' }]}>
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowSuggestions(false); }}>
        <View style={styles.stickyContainer}>
          <LinearGradient colors={['#ff6a00', '#ff8c00']} style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.logoContainer} onPress={() => router.push('/')}>
                <Text style={styles.logoText}>{t('header.title')}</Text>
                <View style={styles.betaBadge}><Text style={styles.betaText}>{t('header.subtitle')}</Text></View>
              </TouchableOpacity>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsScrollContainer} contentContainerStyle={styles.actionsContentContainer}>
                <TouchableOpacity style={styles.iconButton} onPress={() => setLanguageModalVisible(true)}>
                  {currentLanguage ? <Text style={styles.languageFlag}>{currentLanguage.flag}</Text> : <Ionicons name="language-outline" size={20} color="#fff" />}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.supplierButton} onPress={() => router.push('/suppliers')}>
                  <Ionicons name="business-outline" size={12} color="#fff" />
                  <Text style={styles.supplierButtonText}>{t('common.suppliers')}</Text>
                </TouchableOpacity>

                <DesignParticles />

                {/* ✅ BOUTON DEVISE CORRIGÉ */}
                <TouchableOpacity style={styles.currencyButton} onPress={toggleCurrency}>
                  <Text style={styles.currencyText}>{currency.label}</Text>
                  <Ionicons name="caret-down" size={8} color="#fff" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </ScrollView>
            </View>

            <View style={styles.searchSection}>
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                  <TextInput ref={searchInputRef} style={styles.searchInput} placeholder={t('common.search')} placeholderTextColor="#999" value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearchSubmit} returnKeyType="search" onFocus={() => { if (searchQuery.length >= 2 && suggestions.length > 0) setShowSuggestions(true); }} />
                  {loading && <ActivityIndicator size="small" color="#ff6a00" style={styles.searchLoading} />}
                  {!!(searchQuery.length > 0 && !loading) && (
                    <TouchableOpacity style={styles.clearButton} onPress={cleanSearch}><Ionicons name="close-circle" size={18} color="#999" /></TouchableOpacity>
                  )}
                </View>
                <View style={styles.premiumBadge}><Ionicons name="sparkles" size={16} color="#FFD700" /><Text style={styles.premiumText}>Pro</Text></View>
              </View>

              {!!showSuggestions && (
                <View style={styles.searchResultsContainer}>
                  <SearchResults results={suggestions} onSelect={handleSelectSuggestion} query={searchQuery} />
                  {!!(suggestions.length > 0) && (
                    <TouchableOpacity style={styles.seeAllButton} onPress={handleSearchSubmit}>
                      <Text style={styles.seeAllText}>{t('common.seeAll')} "{searchQuery}"</Text>
                      <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}><Text style={styles.statNumber}>50M+</Text><Text style={styles.statLabel}>{t('common.products')}</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={styles.statNumber}>10K+</Text><Text style={styles.statLabel}>{t('common.suppliers')}</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={styles.statNumber}>150+</Text><Text style={styles.statLabel}>{t('common.countries')}</Text></View>
            </View>
          </LinearGradient>
        </View>
      </TouchableWithoutFeedback>

      <LanguageSelectorModal visible={languageModalVisible} onClose={() => setLanguageModalVisible(false)} onLanguageSelect={handleLanguageSelect} currentLanguageCode={currentLanguage?.code || 'en'} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: { position: 'relative', zIndex: 1001 },
  stickyContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  container: { paddingTop: Platform.OS === 'ios' ? 35 : 25, paddingHorizontal: 12, paddingBottom: 12, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, minHeight: 30 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 6 },
  logoText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  betaBadge: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, marginLeft: 3 },
  betaText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  actionsScrollContainer: { flex: 1, maxHeight: 35 },
  actionsContentContainer: { flexDirection: 'row', alignItems: 'center', paddingRight: 4, gap: 4 },
  supplierButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  supplierButtonText: { color: '#fff', fontSize: 10, fontWeight: '600', marginLeft: 3 },
  iconButton: { padding: 3 },
  languageFlag: { fontSize: 18 },
  currencyButton: { backgroundColor: 'rgba(255, 255, 255, 0.25)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center', marginLeft: 5 },
  currencyText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  particlesContainer: { flexDirection: 'row', alignItems: 'center', width: 40, position: 'relative' },
  particle: { position: 'absolute', backgroundColor: '#fff', borderRadius: 10 },
  searchSection: { position: 'relative', zIndex: 1002 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, marginRight: 6 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 13, color: '#333' },
  searchLoading: { marginLeft: 8 },
  clearButton: { padding: 2 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 215, 0, 0.15)', width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
  premiumText: { fontSize: 10, fontWeight: '800', color: '#FFD700', marginLeft: 2 },
  searchResultsContainer: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1003, backgroundColor: '#fff', borderRadius: 12, elevation: 8 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  seeAllText: { fontSize: 13, fontWeight: '600', color: '#ff6a00', marginRight: 6 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 4 },
  statItem: { alignItems: 'center', padding: 2 },
  statNumber: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statLabel: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 10, fontWeight: '500' },
  statDivider: { width: 1, height: 16, backgroundColor: 'rgba(255, 255, 255, 0.3)' },
});