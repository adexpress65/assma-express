import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useMessages } from "../contexts/MessagesContext";
import { db } from "../config/firebase";
import { Company, getCompanyById } from "../services/firebase/companyService";
import {
  Product,
  getProductsByCompanyFirstPage,
  getProductsByCompanyPage,
  type CompanyProductSource,
} from "../services/firebase/productsService";

type DashboardTab = "home" | "products" | "profile";
type SupportedStoreLanguage = "fr" | "en" | "zh";

const PAGE_SIZE = 20;
const PRODUCT_GRID_COLUMNS = 2;

const clamp = (value: number, min = 0, max = 5) => Math.min(max, Math.max(min, value));
const toPercentFromFive = (value: number) => `${Math.round((clamp(value) / 5) * 100)}%`;
const DESCRIPTION_COLLAPSED_LINES = 3;
const SIMILAR_SUPPLIERS_LIMIT = 6;

const normalizeStoreLanguage = (language?: string): SupportedStoreLanguage => {
  const normalized = String(language || "").toLowerCase();
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("fr")) return "fr";
  return "en";
};

const getLangFallbackOrder = (language: SupportedStoreLanguage): SupportedStoreLanguage[] => {
  if (language === "zh") return ["zh", "en", "fr"];
  if (language === "fr") return ["fr", "en", "zh"];
  return ["en", "fr", "zh"];
};

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toLangAliases = (language: SupportedStoreLanguage): string[] => {
  if (language === "zh") return ["zh", "zh_cn", "zh-cn", "cn", "zh_hans"];
  return [language];
};

const pickLocalizedField = (
  source: unknown,
  field: string,
  language: SupportedStoreLanguage,
): string | null => {
  const src = asObject(source);
  if (!src) return null;

  const aliasOrder = getLangFallbackOrder(language).flatMap(toLangAliases);
  const fieldCap = `${field.charAt(0).toUpperCase()}${field.slice(1)}`;

  for (const langKey of aliasOrder) {
    const langCap = langKey
      .replace(/[-_](\w)/g, (_m, c: string) => c.toUpperCase())
      .replace(/^./, (c) => c.toUpperCase());

    const directCandidates = [
      `${field}_${langKey}`,
      `${field}_${langKey.toUpperCase()}`,
      `${field}${langCap}`,
      `${field}${langCap.toUpperCase()}`,
    ];

    for (const key of directCandidates) {
      const value = asNonEmptyString(src[key]);
      if (value) return value;
    }

    const rootBuckets = [src.translations, src.i18n, src.localized, src.locale];
    for (const bucketValue of rootBuckets) {
      const bucket = asObject(bucketValue);
      if (!bucket) continue;

      const byLang = asObject(bucket[langKey]) || asObject(bucket[langKey.toLowerCase()]) || asObject(bucket[langKey.toUpperCase()]);
      const byField = asObject(bucket[field]) || asObject(bucket[fieldCap]);

      const valueFromByLang = byLang ? asNonEmptyString(byLang[field]) || asNonEmptyString(byLang[fieldCap]) : null;
      if (valueFromByLang) return valueFromByLang;

      const valueFromByField = byField
        ? asNonEmptyString(byField[langKey]) ||
          asNonEmptyString(byField[langKey.toLowerCase()]) ||
          asNonEmptyString(byField[langKey.toUpperCase()])
        : null;
      if (valueFromByField) return valueFromByField;
    }
  }

  return asNonEmptyString(src[field]) || null;
};

type SimilarSupplier = {
  id: string;
  name: string;
  logo?: string;
  location?: string;
  businessType?: string;
  rating?: number;
};

export default function CompanyProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { createConversation, sendMessage } = useMessages();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const companyId = useMemo(
    () => (Array.isArray(params.id) ? params.id[0] : params.id) || "",
    [params.id],
  );
  const language = useMemo(
    () => normalizeStoreLanguage(i18n.resolvedLanguage || i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );
  const numberLocale = useMemo(() => {
    if (language === "zh") return "zh-CN";
    if (language === "fr") return "fr-FR";
    return "en-US";
  }, [language]);
  const compactFmt = useMemo(() => new Intl.NumberFormat(numberLocale, { notation: "compact" }), [numberLocale]);
  const moneyFmt = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("profile");
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLastDoc, setProductsLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [productsSource, setProductsSource] = useState<CompanyProductSource | null>(null);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [similarSuppliers, setSimilarSuppliers] = useState<SimilarSupplier[]>([]);
  const [homeDescriptionExpanded, setHomeDescriptionExpanded] = useState(false);
  const [profileDescriptionExpanded, setProfileDescriptionExpanded] = useState(false);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        const [companyData, firstProducts] = await Promise.all([
          getCompanyById(companyId),
          getProductsByCompanyFirstPage(companyId, PAGE_SIZE),
        ]);
        const similarSuppliersQuery = query(
          collection(db, "companies"),
          where("isActive", "==", true),
          limit(12),
        );
        const similarSnapshot = await getDocs(similarSuppliersQuery);
        const similarList = similarSnapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name:
                pickLocalizedField(data, "name", language) ||
                String(data.name || t("app.supplier.store.storeFallbackTitle")),
              logo: typeof data.logo === "string" ? data.logo : undefined,
              location:
                pickLocalizedField(data, "location", language) ||
                (typeof data.location === "string" ? data.location : undefined),
              businessType:
                pickLocalizedField(data, "businessType", language) ||
                (typeof data.businessType === "string" ? data.businessType : undefined),
              rating:
                typeof data.rating === "number"
                  ? data.rating
                  : typeof data.stats?.rating === "number"
                    ? data.stats.rating
                    : 0,
            } as SimilarSupplier;
          })
          .filter((item) => item.id !== companyId)
          .slice(0, SIMILAR_SUPPLIERS_LIMIT);

        setCompany(companyData);
        setProducts(firstProducts.products);
        setProductsLastDoc(firstProducts.lastDoc);
        setProductsHasMore(firstProducts.hasMore);
        setProductsSource(firstProducts.source);
        setSimilarSuppliers(similarList);
        setHomeDescriptionExpanded(false);
        setProfileDescriptionExpanded(false);
      } catch (error) {
        console.error("Erreur dashboard Alibaba-like:", error);
        Alert.alert(t("app.account.errorTitle"), t("app.supplier.store.loadStoreError"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, language, t],
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const loadMoreProducts = useCallback(async () => {
    if (!companyId || !productsHasMore || !productsSource || !productsLastDoc || loadingMoreProducts) {
      return;
    }
    try {
      setLoadingMoreProducts(true);
      const next = await getProductsByCompanyPage(
        companyId,
        PAGE_SIZE,
        productsSource,
        productsLastDoc,
      );
      if (next.products.length === 0) {
        setProductsHasMore(false);
        return;
      }
      setProducts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...next.products.filter((p) => !ids.has(p.id))];
      });
      setProductsLastDoc(next.lastDoc);
      setProductsHasMore(next.hasMore);
    } catch (error) {
      console.error("Erreur pagination produits:", error);
      setProductsHasMore(false);
    } finally {
      setLoadingMoreProducts(false);
    }
  }, [companyId, loadingMoreProducts, productsHasMore, productsLastDoc, productsSource]);

  const startConversationWithSupplier = useCallback(
    async (initialMessage?: string) => {
      if (!company) return;
      if (!user?.uid) {
        Alert.alert(t("app.account.accessLimitedTitle"), t("app.supplier.store.loginRequiredToContact"));
        return;
      }
      try {
        const conversationId = await createConversation({
          companyId: company.id,
          participants: [company.uid],
          type: "entrepreneur",
          title:
            pickLocalizedField(company as unknown, "name", language) ||
            company.name ||
            t("app.supplier.store.storeFallbackTitle"),
        });
        if (initialMessage?.trim()) {
          await sendMessage(conversationId, initialMessage.trim(), { type: "text" });
        }
        router.push(`/conversation/${conversationId}`);
      } catch (error) {
        console.error("Erreur ouverture conversation:", error);
        Alert.alert(t("app.account.errorTitle"), t("app.supplier.store.openConversationError"));
      }
    },
    [company, createConversation, language, router, sendMessage, t, user?.uid],
  );

  const handleInquiryRequest = useCallback(() => {
    void startConversationWithSupplier(
      t("app.supplier.store.inquiryTemplate", {
        name:
          pickLocalizedField(company as unknown, "name", language) ||
          company?.name ||
          "",
        defaultValue:
          `Bonjour ${company?.name || ""}, je souhaite envoyer une demande de devis concernant vos produits.`,
      }),
    );
  }, [company, language, startConversationWithSupplier, t]);
  const getLocalizedProductName = useCallback(
    (product: Product) =>
      pickLocalizedField(product as unknown, "name", language) ||
      product.name ||
      t("productCard.uncategorized"),
    [language, t],
  );
  const getLocalizedProductDescription = useCallback(
    (product: Product) =>
      pickLocalizedField(product as unknown, "description", language) ||
      product.description ||
      "",
    [language],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>{t("app.supplier.store.loadingStore")}</Text>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t("app.supplier.store.storeNotFoundTitle")}</Text>
        <Text style={styles.errorSubtitle}>{t("app.supplier.store.storeNotFoundSubtitle")}</Text>
      </View>
    );
  }

  const companyName =
    pickLocalizedField(company as unknown, "name", language) ||
    company.name ||
    t("app.supplier.store.thisStore");
  const rating = clamp(company.rating || company.stats?.rating || 0);
  const reviewCount = company.stats?.reviewCount || 0;
  const years = company.yearsOnPlatform || 0;
  const responseRate = Math.max(0, company.responseRate || 0);
  const productCount = company.stats?.productCount ?? company.productCount ?? products.length;
  const responseTimeLabel =
    pickLocalizedField(company as unknown, "responseTime", language) ||
    company.responseTime ||
    t("app.supplier.store.notProvided");
  const categoryText =
    pickLocalizedField(company as unknown, "mainProducts", language) ||
    company.mainProducts ||
    t("app.supplier.store.noMainRange");
  const descriptionText =
    pickLocalizedField(company as unknown, "description", language) ||
    company.description ||
    t("app.supplier.store.noCompanyDescription");
  const countryText =
    pickLocalizedField(company as unknown, "location", language) ||
    company.location ||
    t("app.supplier.store.locationNotSpecified");
  const isVerified = Boolean(company.verified || company.verification?.verified);
  const verificationStatus = company.verification?.status || (isVerified ? "verified" : "pending");
  const verificationLabel =
    verificationStatus === "verified"
      ? t("app.supplier.store.verifiedSupplier")
      : t("app.supplier.store.supplier");
  const coverMedia =
    company.coverImage || products[0]?.imageUrl || company.logo || "https://via.placeholder.com/1200x600";
  const profileLogo = company.logo || company.coverImage || products[0]?.imageUrl || "https://via.placeholder.com/200x200";
  const hasProfileLogoSource = Boolean(company.logo || company.coverImage || products[0]?.imageUrl);
  const logoInitial = (companyName || "B").trim().charAt(0).toUpperCase();
  const hasVideo = Boolean((company as any)?.coverVideo || (company as any)?.videoUrl);

  const serviceScore = rating;
  const shippingScore = clamp((responseRate / 100) * 5);
  const qualityScore = rating;
  const shouldShowExpandButton = descriptionText.length > 180;

  const renderHeaderAndTabs = () => (
    <>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>

        <View style={styles.searchStub}>
          <Text style={styles.searchShopName} numberOfLines={1}>{companyName}</Text>
          <Ionicons name="chevron-down" size={14} color="#6B7280" />
        </View>

        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="cart-outline" size={21} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="share-social-outline" size={21} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroMedia}>
          <Image
            source={{ uri: coverMedia }}
            style={styles.heroMediaImage}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
          />
          <View style={styles.heroMediaOverlay}>
            <View style={styles.mediaBadge}>
              <Ionicons name={hasVideo ? "videocam-outline" : "image-outline"} size={14} color="#FFFFFF" />
              <Text style={styles.mediaBadgeText}>
                {hasVideo ? t("app.supplier.store.storeVideo") : t("app.supplier.store.storePhoto")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.heroInfoBlock}>
          <View style={styles.identityRow}>
            <View style={styles.logoWrap}>
              <Image
                source={{ uri: profileLogo }}
                style={styles.companyLogo}
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
              />
              {!hasProfileLogoSource && (
                <View style={styles.logoFallback}>
                  <Text style={styles.logoFallbackText}>{logoInitial}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifiedText}>{verificationLabel}</Text>
              <Text style={styles.companyTitle}>{companyName}</Text>
              <Text style={styles.metaLine}>
                {rating > 0 ? `${rating.toFixed(1)}/5` : t("app.supplier.store.ratingNotProvided")} •{" "}
                {years > 0 ? t("app.supplier.store.yearsCount", { count: years }) : t("app.supplier.store.newSupplier")} • {countryText}
              </Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heartBtn}>
              <Ionicons name="heart-outline" size={19} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatBtn} onPress={() => void startConversationWithSupplier()}>
              <Text style={styles.chatBtnText}>{t("app.supplier.store.chatNow")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "home" && styles.tabActive]}
          onPress={() => setActiveTab("home")}
        >
          <Text style={[styles.tabText, activeTab === "home" && styles.tabTextActive]}>{t("app.tabs.home")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "products" && styles.tabActive]}
          onPress={() => setActiveTab("products")}
        >
          <Text style={[styles.tabText, activeTab === "products" && styles.tabTextActive]}>{t("common.products")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "profile" && styles.tabActive]}
          onPress={() => setActiveTab("profile")}
        >
          <Text style={[styles.tabText, activeTab === "profile" && styles.tabTextActive]}>{t("app.supplier.store.companyProfileTab")}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSimilarSuppliers = (title: string) => (
    <View style={styles.section}>
      <View style={styles.sectionHeadRow}>
        <Text style={styles.similarSectionTitle}>{title}</Text>
        <Text style={styles.linkText}>{similarSuppliers.length}</Text>
      </View>
      {similarSuppliers.length === 0 ? (
        <Text style={styles.emptyText}>{t("app.supplier.store.noSimilarSuppliers")}</Text>
      ) : (
        <View style={styles.similarList}>
          {similarSuppliers.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.similarListItem}
              onPress={() =>
                router.push({ pathname: "/company/[id]", params: { id: item.id, view: "dashboard" } })
              }
            >
              <Image
                source={{ uri: item.logo || "https://via.placeholder.com/120x120" }}
                style={styles.similarListImage}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
              />
              <View style={styles.similarListBody}>
                <Text style={styles.similarName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.similarMeta} numberOfLines={1}>
                  {item.businessType || item.location || t("app.supplier.store.supplier")}
                </Text>
                <Text style={styles.similarRating}>
                  {item.rating && item.rating > 0 ? `${item.rating.toFixed(1)}/5` : t("app.supplier.store.na")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {activeTab === "products" ? (
        <FlatList
          style={styles.container}
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={PRODUCT_GRID_COLUMNS}
          contentContainerStyle={[styles.content, { paddingBottom: 150 + Math.max(insets.bottom, 12) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} tintColor="#FF6A00" />}
          ListHeaderComponent={
            <>
              {renderHeaderAndTabs()}
              <View style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <Text style={styles.sectionTitle}>{t("app.supplier.store.allProducts")}</Text>
                  <Text style={styles.linkText}>
                    {t("app.supplier.store.productsDisplayed", { count: compactFmt.format(products.length) })}
                  </Text>
                </View>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.productCard} onPress={() => router.push(`/product/${item.id}`)}>
              <Image
                source={{ uri: item.imageUrl || "https://via.placeholder.com/200x200" }}
                style={styles.productImage}
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
              />
              <Text numberOfLines={2} style={styles.productName}>
                {getLocalizedProductName(item)}
              </Text>
              {getLocalizedProductDescription(item) ? (
                <Text numberOfLines={1} style={styles.productDescription}>
                  {getLocalizedProductDescription(item)}
                </Text>
              ) : null}
              <Text style={styles.productPrice}>{moneyFmt.format(item.price || 0)} F CFA</Text>
            </TouchableOpacity>
          )}
          columnWrapperStyle={styles.gridRow}
          onEndReachedThreshold={0.35}
          onEndReached={() => {
            void loadMoreProducts();
          }}
          ListFooterComponent={
            <View style={styles.footerLoad}>
              {loadingMoreProducts ? (
                <ActivityIndicator color="#FF6A00" />
              ) : productsHasMore ? (
                <Text style={styles.footerLoadText}>{t("app.supplier.store.loadingNextProducts")}</Text>
              ) : (
                <Text style={styles.footerLoadText}>{t("app.supplier.store.catalogEnd")}</Text>
              )}
            </View>
          }
        />
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: 150 + Math.max(insets.bottom, 12) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} tintColor="#FF6A00" />}
        >
          {renderHeaderAndTabs()}

          {activeTab === "home" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("app.supplier.store.storeOverview")}</Text>
              <Text
                style={styles.sectionDesc}
                numberOfLines={homeDescriptionExpanded ? undefined : DESCRIPTION_COLLAPSED_LINES}
              >
                {descriptionText}
              </Text>
              {shouldShowExpandButton && (
                <TouchableOpacity onPress={() => setHomeDescriptionExpanded((prev) => !prev)}>
                  <Text style={styles.expandText}>
                    {homeDescriptionExpanded ? t("app.supplier.store.showLess") : t("app.supplier.store.readMore")}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.sectionSub}>{t("app.supplier.store.mainProducts", { value: categoryText })}</Text>
              <Text style={styles.sectionSub}>{t("app.supplier.store.responseTime", { value: responseTimeLabel })}</Text>

              <View style={styles.homeStats}>
                <View style={styles.homeStatCard}>
                  <Text style={styles.homeStatBig}>{rating > 0 ? rating.toFixed(1) : t("app.supplier.store.na")}</Text>
                  <Text style={styles.homeStatSmall}>{t("app.supplier.store.satisfaction")}</Text>
                </View>
                <View style={styles.homeStatCard}>
                  <Text style={styles.homeStatBig}>{compactFmt.format(productCount)}</Text>
                  <Text style={styles.homeStatSmall}>{t("common.products")}</Text>
                </View>
                <View style={styles.homeStatCard}>
                  <Text style={styles.homeStatBig}>{responseRate > 0 ? `${responseRate}%` : t("app.supplier.store.na")}</Text>
                  <Text style={styles.homeStatSmall}>{t("app.supplier.store.onTimeDelivery")}</Text>
                </View>
              </View>

              <Text style={styles.previewTitle}>{t("app.supplier.store.someProducts")}</Text>
              {products.length === 0 ? (
                <Text style={styles.emptyText}>{t("app.supplier.store.noPublishedProducts")}</Text>
              ) : (
                <View style={styles.previewGrid}>
                  {products.slice(0, 4).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.previewCard}
                      onPress={() => router.push(`/product/${item.id}`)}
                    >
                      <Image
                        source={{ uri: item.imageUrl || "https://via.placeholder.com/200x200" }}
                        style={styles.previewImage}
                        contentFit="cover"
                        transition={160}
                        cachePolicy="memory-disk"
                      />
                      <Text numberOfLines={1} style={styles.previewName}>{getLocalizedProductName(item)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          {activeTab === "home" && renderSimilarSuppliers(t("app.supplier.store.similarSuppliers"))}

          {activeTab === "profile" && (
            <View style={styles.section}>
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionTitle}>{t("app.supplier.store.companyProfileTab")}</Text>
                <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
              </View>

              <Text
                style={styles.profileDescription}
                numberOfLines={profileDescriptionExpanded ? undefined : DESCRIPTION_COLLAPSED_LINES}
              >
                {descriptionText}
              </Text>
              {shouldShowExpandButton && (
                <TouchableOpacity onPress={() => setProfileDescriptionExpanded((prev) => !prev)}>
                  <Text style={styles.expandText}>
                    {profileDescriptionExpanded ? t("app.supplier.store.showLess") : t("app.supplier.store.readMore")}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.ratingRow}>
                <Text style={styles.ratingBig}>{rating > 0 ? rating.toFixed(1) : t("app.supplier.store.na")}</Text>
                <Text style={styles.ratingOver}>/5</Text>
                <Text style={styles.reviewsCount}>
                  {reviewCount > 0 ? t("app.supplier.store.reviewsCount", { count: compactFmt.format(reviewCount) }) : t("app.supplier.store.noReviews")}
                </Text>
              </View>

              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>{t("app.supplier.store.supplierService")}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: toPercentFromFive(serviceScore) }]} />
                </View>
                <Text style={styles.progressValue}>{serviceScore > 0 ? serviceScore.toFixed(1) : "-"}</Text>
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>{t("app.supplier.store.onTimeShipping")}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: toPercentFromFive(shippingScore) }]} />
                </View>
                <Text style={styles.progressValue}>{shippingScore > 0 ? shippingScore.toFixed(1) : "-"}</Text>
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>{t("app.supplier.store.productQuality")}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: toPercentFromFive(qualityScore) }]} />
                </View>
                <Text style={styles.progressValue}>{qualityScore > 0 ? qualityScore.toFixed(1) : "-"}</Text>
              </View>
            </View>
          )}
          {activeTab === "profile" && renderSimilarSuppliers(t("app.supplier.store.similarCompanies"))}
        </ScrollView>
      )}

      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 12), bottom: 6 }]}>
        <TouchableOpacity style={styles.bottomGhost} onPress={handleInquiryRequest}>
          <Text style={styles.bottomGhostText}>{t("app.supplier.store.sendInquiry")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomPrimary} onPress={() => void startConversationWithSupplier()}>
          <Text style={styles.bottomPrimaryText}>{t("app.supplier.store.chatNow")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingBottom: 150 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#6B7280" },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  errorSubtitle: { marginTop: 6, color: "#6B7280" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  searchStub: {
    flex: 1,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
  },
  searchShopName: { flex: 1, fontWeight: "500", color: "#111827" },

  hero: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  heroMedia: {
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  heroMediaImage: {
    borderRadius: 14,
    width: "100%",
    height: "100%",
  },
  heroMediaOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  mediaBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mediaBadgeText: {
    marginLeft: 5,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  heroInfoBlock: {
    marginTop: 12,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoWrap: {
    width: 62,
    height: 62,
    borderRadius: 14,
    marginRight: 10,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    position: "relative",
  },
  companyLogo: {
    width: "100%",
    height: "100%",
  },
  logoFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.45)",
  },
  logoFallbackText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 18,
  },
  verifiedText: { fontSize: 13, color: "#1677FF", fontWeight: "700" },
  companyTitle: { marginTop: 4, fontSize: 28, fontWeight: "800", color: "#111827", lineHeight: 32 },
  metaLine: { marginTop: 5, color: "#374151", fontSize: 13 },
  heroActions: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  heartBtn: {
    width: 42,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  chatBtn: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  chatBtnText: { color: "#111827", fontWeight: "700" },

  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingHorizontal: 8,
  },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 10, marginRight: 4, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#111827" },
  tabText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
  tabTextActive: { color: "#111827", fontWeight: "800" },

  section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 24, fontWeight: "800", color: "#111827", lineHeight: 30 },
  sectionDesc: { marginTop: 8, color: "#374151", fontSize: 14, lineHeight: 20 },
  sectionSub: { marginTop: 6, color: "#4B5563", fontSize: 13 },
  expandText: { marginTop: 6, color: "#0F62FE", fontWeight: "600", fontSize: 13 },
  linkText: { color: "#6B7280", fontWeight: "600" },

  homeStats: { flexDirection: "row", marginTop: 14 },
  homeStatCard: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, marginRight: 8 },
  homeStatBig: { fontSize: 18, fontWeight: "800", color: "#111827" },
  homeStatSmall: { marginTop: 3, color: "#6B7280", fontSize: 12 },
  previewTitle: { marginTop: 14, fontSize: 16, fontWeight: "700", color: "#111827" },
  previewGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, justifyContent: "space-between" },
  previewCard: { width: "48%", marginBottom: 10 },
  previewImage: { width: "100%", height: 110, borderRadius: 8, backgroundColor: "#E5E7EB" },
  previewName: { marginTop: 6, fontSize: 12, color: "#111827" },

  gridRow: { justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 16 },
  productCard: { width: "48%", backgroundColor: "#FFFFFF" },
  productImage: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: "#F3F4F6" },
  productName: { marginTop: 8, fontSize: 13, color: "#111827", minHeight: 34 },
  productDescription: { marginTop: 3, fontSize: 12, color: "#6B7280", minHeight: 18 },
  productPrice: { marginTop: 4, fontSize: 14, fontWeight: "700", color: "#B45309" },
  emptyText: { marginTop: 8, color: "#6B7280" },
  footerLoad: { paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  footerLoadText: { color: "#6B7280", fontSize: 12 },

  profileDescription: { marginTop: 8, color: "#374151", fontSize: 14, lineHeight: 22 },
  similarSectionTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  similarList: { marginTop: 10 },
  similarListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  similarListImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#E5E7EB" },
  similarListBody: { flex: 1, marginHorizontal: 10 },
  similarName: { fontSize: 13, fontWeight: "700", color: "#111827" },
  similarMeta: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  similarRating: { marginTop: 4, fontSize: 12, color: "#B45309", fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 8, marginBottom: 14 },
  ratingBig: { fontSize: 48, fontWeight: "800", color: "#111827", lineHeight: 50 },
  ratingOver: { fontSize: 26, color: "#111827", marginBottom: 5, marginLeft: 4 },
  reviewsCount: { marginLeft: 12, marginBottom: 8, color: "#6B7280", textDecorationLine: "underline" },
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  progressLabel: { width: 135, fontSize: 13, color: "#374151" },
  progressTrack: { flex: 1, height: 4, backgroundColor: "#E5E7EB", borderRadius: 3, marginHorizontal: 10 },
  progressFill: { height: 4, backgroundColor: "#F97316", borderRadius: 3 },
  progressValue: { width: 28, textAlign: "right", color: "#374151" },

  bottomActions: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 6,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingTop: 10,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  bottomGhost: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  bottomGhostText: { color: "#111827", fontWeight: "700" },
  bottomPrimary: {
    flex: 1,
    height: 42,
    backgroundColor: "#F97316",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomPrimaryText: { color: "#FFFFFF", fontWeight: "800" },
});
