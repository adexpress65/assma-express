import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  ActionSheetIOS,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Portal } from '@gorhom/portal';

import SearchResults from '@/components/search/SearchResults';
import { searchGlobal } from '@/services/searchService';
import type { SearchResultItem } from '@/services/searchService';
import {
  analyzeImageForVisualSearch,
  ImageSearchGeminiError,
  isVisualSearchGeminiConfigured,
} from '@/services/imageSearchGemini';
import LanguageSelectorModal from '@/components/language/LanguageSelectorModal';
import { Language } from '@/services/i18n/languages';
import { changeLanguage } from '@/services/i18n';
import { isRTLLanguage } from '@/utils/layoutDirection';
import { useCurrency } from '../../contexts/CurrencyContext';
import { setVisualSearchPickBase64, setVisualSearchDescriptor } from '@/services/visualSearchImageBuffer';

const { width } = Dimensions.get('window');

export const PREMIUM_HEADER_SEARCH_HEIGHT = 48;
export const PREMIUM_HEADER_TOP_BAR_HEIGHT = 40;

type PremiumHeaderProps = {
  onSearch?: (query: string) => void;
  compact?: boolean;
};

function sanitizeSearchText(value: string): string {
  let sanitized = String(value || '').trim();

  const noisePatterns = [
    /here is the json requested:?/gi,
    /here is the json:?/gi,
    /requested json:?/gi,
    /this is the json:?/gi,
    /the following json:?/gi,
    /json requested:?/gi,
    /json response:?/gi,
  ];

  noisePatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '');
  });

  sanitized = sanitized
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,\-]+|[\s:;,\-]+$/g, '')
    .trim();

  return sanitized;
}

function useLanguageHelpers() {
  const { t, i18n } = useTranslation();

  const getLanguageName = useCallback((code: string): string => {
    const languages: Record<string, string> = {
      en: t('languages.english'),
      fr: t('languages.french'),
      es: t('languages.spanish'),
      ar: t('languages.arabic'),
      zh: t('languages.chinese'),
      ru: t('languages.russian'),
      pt: t('languages.portuguese'),
      tr: t('languages.turkish'),
      de: t('languages.german'),
      it: t('languages.italian'),
      nl: t('languages.dutch'),
      ja: t('languages.japanese'),
      ko: t('languages.korean'),
      vi: t('languages.vietnamese'),
      id: t('languages.indonesian'),
    };
    return languages[code] || t('languages.english');
  }, [t]);

  const getNativeLanguageName = useCallback((code: string): string => {
    const languages: Record<string, string> = {
      en: 'English',
      fr: 'Français',
      es: 'Español',
      ar: 'العربية',
      zh: '简体中文',
      ru: 'Русский',
      pt: 'Português',
      tr: 'Türkçe',
      de: 'Deutsch',
      it: 'Italiano',
      nl: 'Nederlands',
      ja: '日本語',
      ko: '한국어',
      vi: 'Tiếng Việt',
      id: 'Bahasa Indonesia',
    };
    return languages[code] || 'English';
  }, []);

  const getFlag = useCallback((code: string): string => {
    const flags: Record<string, string> = {
      en: '🇬🇧',
      fr: '🇫🇷',
      es: '🇪🇸',
      ar: '🇸🇦',
      zh: '🇨🇳',
      ru: '🇷🇺',
      pt: '🇵🇹',
      tr: '🇹🇷',
      de: '🇩🇪',
      it: '🇮🇹',
      nl: '🇳🇱',
      ja: '🇯🇵',
      ko: '🇰🇷',
      vi: '🇻🇳',
      id: '🇮🇩',
    };
    return flags[code] || '🇬🇧';
  }, []);

  return { t, i18n, getLanguageName, getNativeLanguageName, getFlag };
}

function PremiumHeaderTopBarBase() {
  const router = useRouter();
  const {
    t,
    i18n,
    getLanguageName,
    getNativeLanguageName,
    getFlag,
  } = useLanguageHelpers();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const { currency, setCurrencyByCode } = useCurrency();

  useEffect(() => {
    setCurrentLanguage({
      code: i18n.language,
      name: getLanguageName(i18n.language),
      nativeName: getNativeLanguageName(i18n.language),
      flag: getFlag(i18n.language),
      direction: isRTLLanguage(i18n.language) ? 'rtl' : 'ltr',
    });
  }, [getFlag, getLanguageName, getNativeLanguageName, i18n.language]);

  const handleLanguageSelect = useCallback(async (language: Language) => {
    try {
      await changeLanguage(language.code);
      setCurrentLanguage(language);
      setLanguageModalVisible(false);
    } catch (error) {
      console.error(t('header.languageChangeError'), error);
    }
  }, [t]);

  const toggleCurrency = useCallback(() => {
    const codes = ['USD', 'XOF', 'EUR'];
    const currentIndex = codes.indexOf(currency.code);
    const nextIndex = (currentIndex + 1) % codes.length;
    setCurrencyByCode(codes[nextIndex]);
  }, [currency.code, setCurrencyByCode]);

  return (
    <>
      <View style={styles.topBarRow}>
        <TouchableOpacity style={styles.logoContainer} onPress={() => router.push('/')}>
          <Text style={styles.logoText}>A2Express B2B</Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actionsScrollContainer}
          contentContainerStyle={styles.actionsContentContainer}
        >
          <TouchableOpacity style={styles.iconButton} onPress={() => setLanguageModalVisible(true)}>
            {currentLanguage ? (
              <Text style={styles.languageFlag}>{currentLanguage.flag}</Text>
            ) : (
              <Ionicons name="language-outline" size={18} color="#333" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionChip} onPress={() => router.push('/suppliers')}>
            <Ionicons name="business-outline" size={12} color="#ff6a00" />
            <Text style={styles.actionChipText}>{t('common.suppliers')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.currencyChip} onPress={toggleCurrency}>
            <Text style={styles.currencyText}>{currency.label}</Text>
            <Ionicons name="caret-down" size={10} color="#333" style={styles.currencyArrow} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <LanguageSelectorModal
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        onLanguageSelect={handleLanguageSelect}
        currentLanguageCode={i18n.language}
      />
    </>
  );
}

function PremiumHeader({ onSearch }: PremiumHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 12, width: width - 24 });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchSectionRef = useRef<View>(null);
  const router = useRouter();
  const pathname = usePathname();
  /** Ref pour éviter qu’une requête Algolia/Firestore en cours rouvre le Portal au-dessus de `/search-results`. */
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { t, i18n } = useTranslation();
  /** Sans clé Gemini embarquée au build, ne pas afficher l’icône (évite le message technique aux clients). */
  const imageSearchEnabled = useMemo(() => isVisualSearchGeminiConfigured(), []);

  useEffect(() => {
    if (pathname?.includes('search-results')) {
      setShowSuggestions(false);
    }
  }, [pathname]);

  const measureSearchSection = useCallback(() => {
    searchSectionRef.current?.measure((x, y, w, h, pageX, pageY) => {
      setDropdownPos({
        top: pageY + h - 4,
        left: pageX,
        width: w,
      });
    });
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchGlobal(searchQuery, { includeCompanies: false });
        if (pathnameRef.current?.includes('search-results')) {
          return;
        }
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        measureSearchSection();
      } catch {
        if (!pathnameRef.current?.includes('search-results')) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [measureSearchSection, searchQuery]);

  const cleanSearch = useCallback(() => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const query = sanitizeSearchText(searchQuery);
    if (!query) {
      return;
    }

    onSearch?.(query);
    cleanSearch();
    router.push({
      pathname: '/search-results',
      params: { query, timestamp: Date.now() },
    });
  }, [cleanSearch, onSearch, router, searchQuery]);

  const handleSelectSuggestion = useCallback((item: SearchResultItem) => {
    cleanSearch();
    switch (item.type) {
      case 'product':
        router.push({ pathname: '/product/[id]', params: { id: item.id } });
        break;
      case 'category':
        router.push({ pathname: '/category/[id]', params: { id: item.id, name: item.name } });
        break;
      case 'company':
        router.push({ pathname: '/company/[id]', params: { id: item.id, name: item.name } });
        break;
      default:
        router.push({ pathname: '/search-results', params: { query: item.name } });
    }
  }, [cleanSearch, router]);

  const openPhotoSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const pickAndAnalyzeImage = useCallback(async (source: 'library' | 'camera') => {
    try {
      if (source === 'camera') {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraPermission.status !== 'granted') {
          Alert.alert(
            t('header.imageSearchTitle'),
            t('header.imageSearchPermissionCamera'),
            [
              { text: t('header.imageSearchCancel'), style: 'cancel' },
              { text: t('header.imageSearchOpenSettings'), onPress: openPhotoSettings },
            ],
          );
          return;
        }
      } else {
        const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libraryPermission.status !== 'granted') {
          Alert.alert(
            t('header.imageSearchTitle'),
            t('header.imageSearchPermissionPhotos'),
            [
              { text: t('header.imageSearchCancel'), style: 'cancel' },
              { text: t('header.imageSearchOpenSettings'), onPress: openPhotoSettings },
            ],
          );
          return;
        }
      }

      const picker =
        source === 'camera'
          ? ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.5,
              base64: true,
            })
          : ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.5,
              base64: true,
            });

      const result = await picker;
      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert(t('header.imageSearchTitle'), t('header.imageSearchError'));
        return;
      }

      setImageSearchLoading(true);
      Keyboard.dismiss();
      setShowSuggestions(false);

      const visualSearchPayload = await analyzeImageForVisualSearch(
        asset.base64,
        asset.mimeType || 'image/jpeg'
      );
      let keywords = sanitizeSearchText(visualSearchPayload.searchQuery);
      if (!keywords.trim() || /^json$/i.test(keywords.trim())) {
        keywords = sanitizeSearchText(
          [...visualSearchPayload.labels, ...visualSearchPayload.keywords].join(' '),
        );
      }
      if (!keywords.trim()) {
        keywords = 'produit';
      }
      const imageFileName =
        asset.fileName ||
        asset.uri.split('/').pop() ||
        `image-${Date.now()}.jpg`;
      setVisualSearchPickBase64(asset.base64, asset.mimeType || 'image/jpeg');
      setVisualSearchDescriptor(visualSearchPayload);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchQuery(keywords);
      onSearch?.(keywords);
      router.push({
        pathname: '/search-results',
        params: {
          query: keywords,
          source: 'image',
          imageUri: asset.uri,
          imageFileName,
          /** MIME réel du picker (le base64 n’est pas passé dans l’URL : relu depuis imageUri côté résultats). */
          imageMimeType: asset.mimeType || 'image/jpeg',
          visualSearchPayload: JSON.stringify(visualSearchPayload),
          timestamp: String(Date.now()),
        },
      });
    } catch (error) {
      if (error instanceof ImageSearchGeminiError && error.code === 'NO_API_KEY') {
        Alert.alert(t('header.imageSearchTitle'), t('header.imageSearchNoApiKey'));
      } else {
        console.warn('Image search:', error);
        Alert.alert(t('header.imageSearchTitle'), t('header.imageSearchError'));
      }
    } finally {
      setImageSearchLoading(false);
    }
  }, [onSearch, openPhotoSettings, router, t]);

  const showImageSearchOptions = useCallback(() => {
    if (imageSearchLoading) {
      return;
    }

    const gallery = t('header.imageSearchGallery');
    const camera = t('header.imageSearchCamera');
    const cancel = t('header.imageSearchCancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [cancel, gallery, camera],
          cancelButtonIndex: 0,
          title: t('header.imageSearchTitle'),
          message: t('header.imageSearchMessage'),
        },
        (index) => {
          if (index === 1) {
            void pickAndAnalyzeImage('library');
          }
          if (index === 2) {
            void pickAndAnalyzeImage('camera');
          }
        },
      );
      return;
    }

    Alert.alert(t('header.imageSearchTitle'), t('header.imageSearchMessage'), [
      { text: cancel, style: 'cancel' },
      { text: gallery, onPress: () => void pickAndAnalyzeImage('library') },
      { text: camera, onPress: () => void pickAndAnalyzeImage('camera') },
    ]);
  }, [imageSearchLoading, pickAndAnalyzeImage, t]);

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.keyboardAvoidingView, isRTLLanguage(i18n.language) && { direction: 'rtl' }]}
      >
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowSuggestions(false); }}>
          <View style={styles.searchShell}>
            <View
              ref={searchSectionRef}
              style={styles.searchSection}
              onLayout={measureSearchSection}
            >
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder={t('common.search')}
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                  onFocus={() => {
                    measureSearchSection();
                    if (searchQuery.length >= 2 && suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />
                {loading && (
                  <ActivityIndicator size="small" color="#ff6a00" style={styles.searchLoading} />
                )}
                {!!(searchQuery.length > 0 && !loading) && (
                  <TouchableOpacity style={styles.clearButton} onPress={cleanSearch}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>

              {imageSearchEnabled ? (
                <TouchableOpacity
                  style={[styles.imageSearchButton, imageSearchLoading && styles.imageSearchButtonDisabled]}
                  onPress={showImageSearchOptions}
                  disabled={imageSearchLoading}
                  accessibilityLabel={t('header.imageSearchAccessibility')}
                >
                  {imageSearchLoading ? (
                    <ActivityIndicator size="small" color="#ff6a00" />
                  ) : (
                    <Ionicons name="camera-outline" size={22} color="#ff6a00" />
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {showSuggestions && suggestions.length > 0 && (
        <Portal>
          <TouchableWithoutFeedback onPress={() => setShowSuggestions(false)}>
            <View style={StyleSheet.absoluteFill}>
              <View
                style={[
                  styles.portalContainer,
                  { top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width },
                ]}
              >
                <SearchResults
                  results={suggestions}
                  onSelect={handleSelectSuggestion}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Portal>
      )}
    </>
  );
}

function PremiumHeaderStatsBase() {
  const { t } = useTranslation();

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>50M+</Text>
        <Text style={styles.statLabel}>{t('common.products')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>10K+</Text>
        <Text style={styles.statLabel}>{t('common.suppliers')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>150+</Text>
        <Text style={styles.statLabel}>{t('common.countries')}</Text>
      </View>
    </View>
  );
}

export const PremiumHeaderTopBar = React.memo(PremiumHeaderTopBarBase);
export const PremiumHeaderStats = React.memo(PremiumHeaderStatsBase);
export default React.memo(PremiumHeader);

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    zIndex: 1001,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: PREMIUM_HEADER_TOP_BAR_HEIGHT,
    paddingHorizontal: 14,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 8,
  },
  logoText: {
    color: '#5b3115',
    fontSize: 17,
    fontWeight: '800',
  },
  betaBadge: {
    backgroundColor: '#ffd8b8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  betaText: {
    color: '#d86a11',
    fontSize: 9,
    fontWeight: '700',
  },
  actionsScrollContainer: {
    flex: 1,
    maxHeight: 36,
  },
  actionsContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    gap: 6,
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#fff7f1',
    borderWidth: 1,
    borderColor: '#e8c9b1',
  },
  languageFlag: {
    fontSize: 18,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8f2',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8c9b1',
  },
  actionChipText: {
    color: '#d86a11',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8f2',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8c9b1',
  },
  currencyText: {
    color: '#7a451d',
    fontSize: 11,
    fontWeight: '800',
  },
  currencyArrow: {
    marginLeft: 4,
  },
  searchShell: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffaf7',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginRight: 8,
    height: PREMIUM_HEADER_SEARCH_HEIGHT,
    borderWidth: 1,
    borderColor: '#e6cdbc',
    ...Platform.select({
      ios: {
        shadowColor: '#9b6a46',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#4a321f',
  },
  searchLoading: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 2,
  },
  imageSearchButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: PREMIUM_HEADER_SEARCH_HEIGHT,
    height: PREMIUM_HEADER_SEARCH_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#fff8f2',
    borderWidth: 1,
    borderColor: '#e6cdbc',
    ...Platform.select({
      ios: {
        shadowColor: '#9b6a46',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  imageSearchButtonDisabled: {
    opacity: 0.75,
  },
  portalContainer: {
    position: 'absolute',
    zIndex: 99999,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    maxHeight: 400,
    overflow: 'hidden',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fffaf7',
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 6,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ecd8ca',
    ...Platform.select({
      ios: {
        shadowColor: '#9b6a46',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  statNumber: {
    color: '#5b3115',
    fontSize: 13,
    fontWeight: '800',
  },
  statLabel: {
    color: '#7b6757',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 0,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#ead9cc',
  },
});
