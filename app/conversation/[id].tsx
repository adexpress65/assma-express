import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { getUserDisplayLabel } from "../../src/utils/userIdentity";
import { useRequireAuth } from "../../src/contexts/AuthGuardContext";
import { useMessages } from "../../src/contexts/MessagesContext";
import ProductMessageCard from "../../src/components/ProductMessageCard";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../src/config/firebase";
import { PAYMENT_ENDPOINTS } from "../../src/config/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ConversationProfileModal from "../../src/components/ConversationProfileModal";
import { pickCompanyNameFromFirestoreData } from "../../src/utils/companyDisplayName";
import {
  bootstrapStoreConversation,
  MessagingRoutingError,
} from "../../src/services/conversationRouting";

function isHttpUrl(s: unknown): s is string {
  return (
    typeof s === "string" &&
    (s.startsWith("http://") || s.startsWith("https://"))
  );
}

function normalizeRouteParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let current = trimmed;
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(current).trim();
      if (!decoded || decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current || null;
}

function clientUidFromCanonicalId(
  conversationId: string,
  companyId?: string | null,
): string | null {
  if (companyId && conversationId.startsWith(`${companyId}_`)) {
    const suffix = conversationId.slice(companyId.length + 1);
    return suffix || null;
  }
  const i = conversationId.lastIndexOf("_");
  if (i <= 0 || i === conversationId.length - 1) return null;
  return conversationId.slice(i + 1);
}

/** UID acheteur à afficher : jamais l'UID du boutiquier/super-admin connecté. */
function resolvePeerClientUid(
  conv: Record<string, unknown> | null | undefined,
  viewerUid: string | undefined,
  options?: {
    conversationId?: string | null;
    companyId?: string | null;
    routeClientUid?: string | null;
  },
): string | null {
  if (!viewerUid) return null;
  const companyId =
    options?.companyId ||
    (typeof conv?.companyId === "string" ? conv.companyId : null);
  const routeClientUid = options?.routeClientUid || null;
  if (routeClientUid && routeClientUid !== viewerUid) return routeClientUid;
  const fromCanonical = options?.conversationId
    ? clientUidFromCanonicalId(options.conversationId, companyId)
    : null;
  if (fromCanonical && fromCanonical !== viewerUid) return fromCanonical;
  if (!conv) return null;
  const sellerUid = typeof conv.sellerUid === "string" ? conv.sellerUid : null;
  const raw =
    (typeof conv.clientUid === "string" && conv.clientUid) ||
    (typeof conv.createdBy === "string" && conv.createdBy) ||
    null;
  const viewerIsShop = viewerUid === companyId || viewerUid === sellerUid;
  if (raw && (!viewerIsShop || raw !== viewerUid)) return raw;
  const parts = Array.isArray(conv.participants) ? conv.participants : [];
  const peer = parts.find(
    (p): p is string =>
      typeof p === "string" &&
      p.length > 0 &&
      p !== viewerUid &&
      p !== companyId &&
      p !== sellerUid,
  );
  return peer ?? null;
}

function isGenericAccountLabel(name: string | null | undefined): boolean {
  const n = String(name || "").trim().toLowerCase();
  return !n || n === "superadmin" || n === "super admin" || n === "client";
}

function pickSellerViewClientName(options: {
  routeName?: string | null;
  extraName?: string | null;
  interlocutorName?: string | null;
  conv?: Record<string, unknown> | null;
}): string {
  const conv = options.conv;
  const convClient =
    typeof conv?.clientName === "string" ? conv.clientName.trim() : "";
  const candidates = [
    options.routeName,
    convClient,
    options.extraName,
    options.interlocutorName,
    typeof conv?.userName === "string" ? conv.userName : null,
    typeof conv?.customerName === "string" ? conv.customerName : null,
  ];
  for (const candidate of candidates) {
    const trimmed = String(candidate || "").trim();
    if (trimmed && !isGenericAccountLabel(trimmed)) return trimmed;
  }
  return "Client";
}

function companyOwnerUidFromData(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null;
  for (const key of ["uid", "ownerId", "ownerUid", "sellerUid"] as const) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function sanitizeImageUri(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let clean = normalizeRouteParam(raw);
  if (!clean) return null;
  clean = clean.replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, "");
  if (
    clean.includes("/products/") &&
    !clean.includes("products%2F") &&
    clean.includes("firebasestorage")
  ) {
    clean = clean.replace("/products/", "/products%2F");
  }
  return clean;
}

function pickImageFromProductRecord(data: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    data.mainImage,
    data.imageUrl,
    data.productImage,
    data.thumbnail,
    data.thumbnailUrl,
    data.coverImage,
    data.image,
    Array.isArray(data.images) ? data.images[0] : null,
    Array.isArray(data.images) ? data.images[1] : null,
  ];

  for (const candidate of candidates) {
    const normalized = sanitizeImageUri(candidate);
    if (normalized) return normalized;
  }

  return null;
}

type UiMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  timestamp: Date;
  type?: string;
  imageUrl?: string;
  image?: string;
  metadata?: Record<string, unknown>;
  product?: {
    id: string;
    name: string;
    price: number;
    currency: string;
    image: string;
    specifications?: {
      weight?: string;
      dimensions?: string;
      volume?: string;
    };
  };
  payment?: {
    url: string;
    provider: "ngenius";
    status: "pending" | "paid" | "failed";
  };
};

type HeaderShop = { name: string; logo: string | null };
type HeaderPerson = { name: string; photo: string | null };

const LIVE_MESSAGE_WINDOW = 40;
const OLDER_PAGE_SIZE = 45;
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

function parsePriceAmount(rawPrice: string | null | undefined): number {
  if (!rawPrice) return 0;
  const firstNumericChunk = rawPrice.match(/\d[\d\s.,]*/)?.[0] || "";
  if (!firstNumericChunk) return 0;
  const digitsOnly = firstNumericChunk.replace(/[^\d]/g, "");
  const n = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(n) ? n : 0;
}

function mapDocToUiMessage(d: QueryDocumentSnapshot): UiMessage {
  const x = d.data() as Record<string, unknown>;
  const rawProduct = x.product as Record<string, unknown> | undefined;
  const rawPayment = x.payment as Record<string, unknown> | undefined;
  const rawTimestamp = x.timestamp as { toDate?: () => Date } | undefined;

  const product = rawProduct
    ? {
        id: String(rawProduct.id || ""),
        name: String(rawProduct.name || "Produit"),
        price: Number(rawProduct.price || 0),
        currency: String(rawProduct.currency || "XOF"),
        image: String(rawProduct.image || ""),
        specifications:
          rawProduct.specifications && typeof rawProduct.specifications === "object"
            ? {
                weight:
                  (rawProduct.specifications as Record<string, unknown>).weight != null
                    ? String(
                        (rawProduct.specifications as Record<string, unknown>).weight,
                      )
                    : undefined,
                dimensions:
                  (rawProduct.specifications as Record<string, unknown>).dimensions != null
                    ? String(
                        (rawProduct.specifications as Record<string, unknown>).dimensions,
                      )
                    : undefined,
                volume:
                  (rawProduct.specifications as Record<string, unknown>).volume != null
                    ? String(
                        (rawProduct.specifications as Record<string, unknown>).volume,
                      )
                    : undefined,
              }
            : undefined,
      }
    : undefined;

  const payment = rawPayment
    ? {
        url: String(rawPayment.url || ""),
        provider: "ngenius" as const,
        status: (() => {
          const rawStatus = rawPayment.status;
          const paymentStatus: "pending" | "paid" | "failed" =
            rawStatus === "paid" || rawStatus === "failed"
              ? (rawStatus as "paid" | "failed")
              : "pending";
          return paymentStatus;
        })(),
      }
    : undefined;

  return {
    id: d.id,
    text: String(x.text || ""),
    senderId: String(x.senderId || ""),
    senderName: x.senderName ? String(x.senderName) : undefined,
    timestamp:
      rawTimestamp?.toDate && typeof rawTimestamp.toDate === "function"
        ? rawTimestamp.toDate()
        : new Date(),
    type: x.type ? String(x.type) : "text",
    image: x.image ? String(x.image) : x.imageUrl ? String(x.imageUrl) : undefined,
    imageUrl: x.imageUrl ? String(x.imageUrl) : x.image ? String(x.image) : undefined,
    metadata:
      x.metadata && typeof x.metadata === "object"
        ? (x.metadata as Record<string, unknown>)
        : undefined,
    product,
    payment,
  };
}

const ChatBubbleRow = memo(function ChatBubbleRow({
  item,
  isMine,
}: {
  item: UiMessage;
  isMine: boolean;
}) {
  const textSegments = useMemo(() => {
    const parts = item.text.split(URL_REGEX);
    return parts.map((part) => ({
      value: part,
      isUrl: /^https?:\/\/[^\s]+$/i.test(part),
    }));
  }, [item.text]);

  const handleOpenUrl = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert("Lien invalide", "Impossible d'ouvrir ce lien de paiement.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Lien invalide", "Impossible d'ouvrir ce lien de paiement.");
    }
  }, []);

  const imageUri =
    item.imageUrl ||
    item.image ||
    item.metadata?.imageUrl ||
    item.metadata?.image ||
    item.metadata?.photoUrl ||
    undefined;
  const resolvedImageUri = imageUri
    ? sanitizeImageUri(imageUri) || (isHttpUrl(imageUri) ? imageUri : null)
    : null;
  const isImageMessage =
    item.type === "image" ||
    item.type === "order_photo" ||
    Boolean(resolvedImageUri && (item.type === "file" || item.type === "media" || item.type === "text"));

  const timeStr = item.timestamp.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View
      style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowTheirs]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        {isImageMessage && resolvedImageUri ? (
          <View style={styles.imageBubbleContainer}>
            {item.text ? (
              <Text style={styles.msgText}>{item.text}</Text>
            ) : null}
            <Image
              source={{ uri: resolvedImageUri }}
              style={styles.messageImage}
              contentFit="cover"
            />
          </View>
        ) : (
          <Text style={styles.msgText}>
            {textSegments.map((segment, idx) =>
              segment.isUrl ? (
                <Text
                  key={`${item.id}-url-${idx}`}
                  style={styles.msgLink}
                  onPress={() => void handleOpenUrl(segment.value)}
                >
                  {segment.value}
                </Text>
              ) : (
                <Text key={`${item.id}-txt-${idx}`}>{segment.value}</Text>
              ),
            )}
          </Text>
        )}
        <Text style={styles.msgTime}>{timeStr}</Text>
      </View>
    </View>
  );
});

export default function ConversationScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    companyId?: string;
    sellerId?: string;
    productId?: string;
    productName?: string;
    productPrice?: string;
    productImage?: string;
    imageUrl?: string;
    mainImage?: string;
    productContext?: string;
    message?: string;
    price?: string;
    sellerName?: string;
    sellerLogo?: string;
    clientUid?: string;
    clientName?: string;
  }>();

  const { user } = useAuth();
  const { requireAuth } = useRequireAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    sendMessage,
    markAsRead,
    onlineUsers,
    conversations,
    clearAllMessagesInConversation,
    deleteConversation,
  } = useMessages();

  const rawRouteConversationId = String(params.id || "").trim();
  const flatListRef = useRef<FlatList>(null);
  const bootstrapInFlight = useRef(false);

  const passthroughParams = useMemo(
    () => ({
      companyId: params.companyId,
      productId: params.productId,
      productName: params.productName,
      productPrice: params.productPrice,
      productImage: params.productImage,
      imageUrl: params.imageUrl,
      mainImage: params.mainImage,
      productContext: params.productContext,
      sellerName: params.sellerName,
      sellerLogo: params.sellerLogo,
    }),
    [
      params.companyId,
      params.productId,
      params.productName,
      params.productPrice,
      params.productImage,
      params.imageUrl,
      params.mainImage,
      params.productContext,
      params.sellerName,
      params.sellerLogo,
    ],
  );

  const [convData, setConvData] = useState<Record<string, unknown> | null>(null);
  const [convMissing, setConvMissing] = useState(false);
  const [liveMessages, setLiveMessages] = useState<UiMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<UiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  const liveAnchorRef = useRef<QueryDocumentSnapshot | null>(null);
  const olderTailRef = useRef<QueryDocumentSnapshot | null>(null);
  const markReadInFlightRef = useRef(false);

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [shop, setShop] = useState<HeaderShop>({ name: "", logo: null });
  const [interlocutor, setInterlocutor] = useState<HeaderPerson>({
    name: "",
    photo: null,
  });
  
  // 🟢 NOUVEAU : infos enrichies de la boutique (logo, téléphone, email, adresse)
const [companyExtra, setCompanyExtra] = useState<{
  logo?: string | null;
  phone?: string;
  email?: string;
  address?: string;
}>({});

const [clientExtra, setClientExtra] = useState<{ name?: string; photoURL?: string }>({});

useEffect(() => {
  const isClient =
    Boolean(user?.uid) &&
    user?.uid !== convData?.companyId &&
    user?.uid !== convData?.sellerUid;

  const clientUid = resolvePeerClientUid(convData, user?.uid, {
    conversationId: String(params.id || "").trim(),
    companyId:
      (typeof convData?.companyId === "string" ? convData.companyId : null) ||
      normalizeRouteParam(params.companyId),
    routeClientUid: normalizeRouteParam(params.clientUid),
  });

  if (isClient || !clientUid) {
    setClientExtra({});
    return;
  }

  let cancelled = false;
  getDoc(doc(db, "users", clientUid))
    .then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data();
      setClientExtra({
        name: data?.displayName,
        photoURL: data?.photoURL,
      });
    })
    .catch(() => {});

  return () => {
    cancelled = true;
  };
}, [convData?.companyId, convData?.sellerUid, convData, user?.uid, params.id, params.companyId, params.clientUid]);

// 🟢 NOUVEAU : charger le profil à jour du client (nom + photo)
useEffect(() => {
  const isClient =
    Boolean(user?.uid) &&
    user?.uid !== convData?.companyId &&
    user?.uid !== convData?.sellerUid;

  const clientUid = resolvePeerClientUid(convData, user?.uid, {
    conversationId: String(params.id || "").trim(),
    companyId:
      (typeof convData?.companyId === "string" ? convData.companyId : null) ||
      normalizeRouteParam(params.companyId),
    routeClientUid: normalizeRouteParam(params.clientUid),
  });

  if (isClient || !clientUid) {
    setClientExtra({});
    return;
  }

  let cancelled = false;
  getDoc(doc(db, "users", clientUid))
    .then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data();
      setClientExtra({
        name: data?.displayName,
        photoURL: data?.photoURL,
      });
    })
    .catch(() => {});

  return () => {
    cancelled = true;
  };
}, [convData?.companyId, convData?.sellerUid, convData, user?.uid, params.id, params.companyId, params.clientUid]);

  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [composerProductPreview, setComposerProductPreview] = useState<{
    id: string;
    name: string;
    price: number;
    currency: string;
    image: string;
    specifications?: {
      weight?: string;
      dimensions?: string;
      volume?: string;
    };
  } | null>(null);

  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const normalizedCompanyId = useMemo(
    () => normalizeRouteParam(params.companyId),
    [params.companyId],
  );
  const normalizedSellerId = useMemo(
    () => normalizeRouteParam(params.sellerId),
    [params.sellerId],
  );
  const normalizedRouteClientUid = useMemo(
    () => normalizeRouteParam(params.clientUid),
    [params.clientUid],
  );
  const normalizedRouteClientName = useMemo(
    () => normalizeRouteParam(params.clientName),
    [params.clientName],
  );
  const normalizedProductId = useMemo(
    () => normalizeRouteParam(params.productId),
    [params.productId],
  );
  const hasStrictProductContext = useMemo(
    () => normalizeRouteParam(params.productContext) === "1",
    [params.productContext],
  );
  const normalizedProductName = useMemo(
    () => normalizeRouteParam(params.productName),
    [params.productName],
  );
  const normalizedProductPrice = useMemo(
    () => normalizeRouteParam(params.productPrice),
    [params.productPrice],
  );
  const normalizedProductImage = useMemo(
    () =>
      sanitizeImageUri(params.productImage) ||
      sanitizeImageUri(params.imageUrl) ||
      sanitizeImageUri(params.mainImage),
    [params.productImage, params.imageUrl, params.mainImage],
  );
  const normalizedPrefillMessage = useMemo(
    () => normalizeRouteParam(params.message),
    [params.message],
  );

  useEffect(() => {
    if (!normalizedPrefillMessage) return;
    setInputText((previous) =>
      previous && previous.trim().length > 0 ? previous : normalizedPrefillMessage,
    );
  }, [normalizedPrefillMessage]);

  const normalizedPrefillPrice = useMemo(() => {
    const p = normalizeRouteParam(params.price);
    if (!p) return 0;
    const digits = p.replace(/[^0-9.,]/g, "").replace(/\s+/g, "").replace(",", ".");
    const n = Number(digits);
    return Number.isFinite(n) ? n : 0;
  }, [params.price]);

  const hasProductActions = useMemo(
    () => Boolean(normalizedProductId) && hasStrictProductContext,
    [normalizedProductId, hasStrictProductContext],
  );

  // 1. Calcul prioritaire et robuste de l'ID de conversation
  const conversationId = useMemo(() => {
    if (rawRouteConversationId && rawRouteConversationId !== "undefined") {
      return rawRouteConversationId;
    }
    if (user?.uid && normalizedCompanyId) {
      return `${normalizedCompanyId}_${user.uid}`;
    }
    return "";
  }, [rawRouteConversationId, user?.uid, normalizedCompanyId]);

  const otherUid = useMemo(() => {
    if (!user?.uid || !convData?.participants) return null;
    const parts = convData.participants as string[];
    return parts.find((p) => p !== user.uid && p !== convData.companyId) ?? null;
  }, [convData, user?.uid]);

const conversationProfile = useMemo(() => {
  const isClient =
    Boolean(user?.uid) &&
    user?.uid !== convData?.companyId &&
    user?.uid !== convData?.sellerUid;
  let name: string;
  let role: string;
  let avatarUrl: string | null;
  if (isClient) {
    name =
      (shop.name && shop.name !== "Super admin" ? shop.name : null) ||
      (typeof convData?.companyName === "string" && convData.companyName !== "Super admin"
        ? convData.companyName
        : null) ||
      String(params.sellerName || "") ||
      "Boutique";
    role = "Boutique";
    // 🟢 Priorité au logo enrichi via Firestore, sinon shop.logo en repli
    avatarUrl = companyExtra.logo || shop.logo || null;
  } else {
    name = pickSellerViewClientName({
      routeName: normalizedRouteClientName,
      extraName: clientExtra.name,
      interlocutorName: interlocutor.name,
      conv: convData as Record<string, unknown> | null,
    });
    role = "Client acheteur";
    avatarUrl = clientExtra.photoURL || interlocutor.photo || null;  // 👈 MODIFIÉ : photo à jour en priorité
  }

const details: { label: string; value: string }[] = [];
  return {
    id: otherUid || String(convData?.companyId || conversationId || ""),
    name,
    role,
    avatarUrl,
    logo: undefined, // le modal utilise avatarUrl || logo || coverImage ; avatarUrl suffit ici
    phone: isClient ? companyExtra.phone : undefined,
    address: isClient ? companyExtra.address : undefined,
    subtitle: undefined,
    details,
  };
}, [
  convData,
  interlocutor.name,
  interlocutor.photo,
  shop.logo,
  shop.name,
  otherUid,
  conversationId,
  user?.uid,
  params.sellerName,
  companyExtra,
  clientExtra,
  normalizedRouteClientName,
]);
  const openProfileModal = useCallback(() => setProfileModalVisible(true), []);
  const closeProfileModal = useCallback(() => setProfileModalVisible(false), []);
  const isClientViewer = useMemo(
    () =>
      Boolean(user?.uid) &&
      user.uid !== convData?.companyId &&
      user.uid !== convData?.sellerUid,
    [user?.uid, convData?.companyId, convData?.sellerUid],
  );
  const interlocutorOnline = useMemo(() => {
    if (!otherUid) return false;
    const safeOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
    return safeOnlineUsers.some(
      (u) => u?.uid === otherUid && u?.status === "online"
    );
  }, [onlineUsers, otherUid]);
  const unreadForMe = useMemo(() => {
    if (!user?.uid || !convData) return 0;
    const unreadMap = convData.unreadCount as Record<string, unknown> | undefined;
    const raw = unreadMap?.[user.uid];
    const n = Number(raw ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [convData, user?.uid]);
  useEffect(() => {
    if (!conversationId || !user?.uid || !convData) return;
    if (unreadForMe <= 0) return;
    if (markReadInFlightRef.current) return;
    markReadInFlightRef.current = true;
    markAsRead(conversationId)
      .catch(() => {})
      .finally(() => {
        markReadInFlightRef.current = false;
      });
  }, [conversationId, user?.uid, convData, unreadForMe, markAsRead]);
  useEffect(() => {
    bootstrapInFlight.current = false;
  }, [conversationId]);
 // 1. Réinitialiser les états lors du changement de conversation
  useEffect(() => {
    setLiveMessages([]);
    setOlderMessages([]);
    setHasMoreOlder(true);
    olderTailRef.current = null;
    liveAnchorRef.current = null;
  }, [conversationId, user?.uid]);
  
  // 🟢 NOUVEAU : charger les infos enrichies de la boutique (logo, téléphone, email, adresse)
useEffect(() => {
  const isClient =
    Boolean(user?.uid) &&
    user?.uid !== convData?.companyId &&
    user?.uid !== convData?.sellerUid;

  const companyId =
    typeof convData?.companyId === "string" ? convData.companyId : normalizedCompanyId;

  if (!isClient || !companyId) {
    setCompanyExtra({});
    return;
  }

  let cancelled = false;
  getDoc(doc(db, "companies", companyId))
    .then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data() as Record<string, any>;
      const addr = data?.address;
      const address = addr
        ? [addr.street, addr.city, addr.country].filter((p: string) => p && p.trim()).join(", ")
        : data?.location || undefined;

      setCompanyExtra({
        logo: data?.logo || data?.companyLogo || null,
        phone: data?.phone && data.phone.trim() ? data.phone.trim() : undefined,
        email: data?.email && data.email.trim() ? data.email.trim() : undefined,
        address,
      });
    })
    .catch(() => {});

  return () => {
    cancelled = true;
  };
}, [convData?.companyId, convData?.sellerUid, normalizedCompanyId, user?.uid]);

  // 2. 🟢 AJOUT : Écouteur Firestore qui remplit liveMessages et désactive le spinner
  useEffect(() => {
    if (!conversationId || !user) {
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);

    const msgsCol = collection(db, "conversations", conversationId, "messages");
    const q = query(
      msgsCol,
      orderBy("timestamp", "desc"),
      limit(LIVE_MESSAGE_WINDOW)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map(mapDocToUiMessage);
        
        // Stocke le dernier doc pour que loadOlderMessages sache d'où repartir
        if (snapshot.docs.length > 0) {
          liveAnchorRef.current = snapshot.docs[snapshot.docs.length - 1];
        }

        setLiveMessages(msgs);
        setMessagesLoading(false); // 👈 Passe à false : masque le loader orange !
      },
      (error) => {
        console.warn("Erreur snapshot messages:", error);
        setMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId, user]);

  // 3. Fusion des messages (inchangé)
  const displayMessages = useMemo(() => {
    const seen = new Set<string>();
    const out: UiMessage[] = [];
    for (const m of [...liveMessages, ...olderMessages]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [liveMessages, olderMessages]);

  // 4. Chargement de l'historique (inchangé)
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMoreOlder) return;
    const anchor = olderTailRef.current ?? liveAnchorRef.current;
    if (!anchor) {
      setHasMoreOlder(false);
      return;
    }
    setLoadingOlder(true);
    try {
      const msgsCol = collection(
        db,
        "conversations",
        conversationId,
        "messages",
      );
      const q = query(
        msgsCol,
        orderBy("timestamp", "desc"),
        startAfter(anchor),
        limit(OLDER_PAGE_SIZE),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMoreOlder(false);
        return;
      }
      const batch = snap.docs.map(mapDocToUiMessage);
      olderTailRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setOlderMessages((prev) => [...prev, ...batch]);
      if (snap.docs.length < OLDER_PAGE_SIZE) {
        setHasMoreOlder(false);
      }
    } catch (e) {
      console.warn("loadOlderMessages", e);
      setHasMoreOlder(false);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, hasMoreOlder]);

// Bootstrap & Mise à jour instantanée et non-bloquante dans Firestore
useEffect(() => {
  if (!user?.uid || !conversationId) return;
  let cancelled = false;

  const run = async () => {
    if (hasStrictProductContext || normalizedCompanyId) {
      if (!normalizedCompanyId) return;

      if (bootstrapInFlight.current) return;
      bootstrapInFlight.current = true;

      try {
        // Destinataire boutique : conversationRouting (sellerId produit, jamais le support).
        const currentUserName = getUserDisplayLabel(
          {
            displayName: user.displayName || (user as any).name || (user as any).fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
          },
          "Client",
        );

        const currentUserAvatar = user.photoURL || (user as any).avatar || "";
        const parsedClientUid = clientUidFromCanonicalId(
          conversationId,
          normalizedCompanyId,
        );
        const routeClientUid = normalizedRouteClientUid;
        // Suffixe de l'ID canonique = acheteur. Un super-admin / boutiquier
        // n'est le client que si ce suffixe est son propre UID.
        const isOpeningAsClient = parsedClientUid === user.uid;
        const clientUid =
          (routeClientUid &&
          routeClientUid !== user.uid &&
          routeClientUid !== normalizedCompanyId
            ? routeClientUid
            : null) ||
          parsedClientUid ||
          (isOpeningAsClient ? user.uid : null);

        try {
          await bootstrapStoreConversation({
            conversationId,
            companyId: normalizedCompanyId,
            viewerUid: user.uid,
            productSellerUid: normalizedSellerId,
            clientUid,
            companyName: normalizeRouteParam(params.sellerName),
            companyLogo: normalizeRouteParam(params.sellerLogo),
            clientName: isOpeningAsClient ? currentUserName : null,
            clientAvatar: isOpeningAsClient ? currentUserAvatar : null,
            debug: typeof __DEV__ !== "undefined" && __DEV__,
          });
        } catch (e) {
          console.warn("conversation bootstrap error", e);
          if (!cancelled) {
            const message =
              e instanceof MessagingRoutingError
                ? e.message
                : "Impossible d’ouvrir la discussion avec cette boutique.";
            Alert.alert("Contact indisponible", message);
          }
          return;
        }

        if (cancelled) return;
      } catch (e) {
        console.warn("conversation bootstrap error", e);
      } finally {
        bootstrapInFlight.current = false;
      }
    }
  };

  run();

  return () => {
    cancelled = true;
  };
}, [
  user?.uid,
  conversationId,
  hasStrictProductContext,
  normalizedCompanyId,
  normalizedSellerId,
  normalizedRouteClientUid,
]);

// 🟢 Écouteur Firestore unique et sécurisé à conserver
useEffect(() => {
  if (!conversationId || !user) {
    setConvMissing(true);
    return;
  }

  const ref = doc(db, "conversations", conversationId);
  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        setConvData(null);
        if (hasStrictProductContext || normalizedCompanyId) {
          setConvMissing(false);
        } else {
          setConvMissing(true);
        }
        return;
      }

      const data = snap.data();
      const parts = (data.participants as string[] | undefined) || [];
      const companyIdInDoc = typeof data.companyId === "string" ? data.companyId : null;
      const sellerUidInDoc = typeof data.sellerUid === "string" ? data.sellerUid : null;

      const isParticipant =
        Boolean(user?.uid) &&
        (parts.includes(user.uid) ||
          user.uid === companyIdInDoc ||
          user.uid === sellerUidInDoc);

      if (!isParticipant) {
        setConvData(null);
        if (hasStrictProductContext || normalizedCompanyId) {
          setConvMissing(false);
        } else {
          setConvMissing(true);
        }
        return;
      }

      setConvMissing(false);
      setConvData({ id: snap.id, ...data });
    },
    (error) => {
      console.warn("onSnapshot conversation error:", error);
      if (!hasStrictProductContext && !normalizedCompanyId) {
        setConvMissing(true);
      }
    }
  );

  return () => unsub();
}, [conversationId, user, hasStrictProductContext, normalizedCompanyId]);
  // Écouteur Firestore non bloquant pour les nouvelles discussions
  // 🟢 Écouteur Firestore unique et sécurisé à conserver
// 🟢 Écouteur Firestore unique et sécurisé (sans dépendance à setLoading)
useEffect(() => {
  if (!conversationId || !user) {
    setConvMissing(true);
    return;
  }

  const ref = doc(db, "conversations", conversationId);
  const unsub = onSnapshot(
    ref,
    (snap) => {
      // 1. Si le document n'existe pas encore dans Firestore
      if (!snap.exists()) {
        setConvData(null);
        if (hasStrictProductContext || normalizedCompanyId) {
          setConvMissing(false);
        } else {
          setConvMissing(true);
        }
        return;
      }

      // 2. Le document existe : validation de l'accès utilisateur
      const data = snap.data();
      const parts = (data.participants as string[] | undefined) || [];
      const companyIdInDoc = typeof data.companyId === "string" ? data.companyId : null;
      const sellerUidInDoc = typeof data.sellerUid === "string" ? data.sellerUid : null;

      const isParticipant =
        Boolean(user?.uid) &&
        (parts.includes(user.uid) ||
          user.uid === companyIdInDoc ||
          user.uid === sellerUidInDoc);

      if (!isParticipant) {
        setConvData(null);
        if (hasStrictProductContext || normalizedCompanyId) {
          setConvMissing(false);
        } else {
          setConvMissing(true);
        }
        return;
      }

      // 3. Tout est valide : affichage de la conversation
      setConvMissing(false);
      setConvData({ id: snap.id, ...data });
    },
    (error) => {
      console.warn("onSnapshot conversation error:", error);
      if (!hasStrictProductContext && !normalizedCompanyId) {
        setConvMissing(true);
      }
    }
  );

  return () => unsub();
}, [conversationId, user, hasStrictProductContext, normalizedCompanyId]);



  const resolveStructuredProductContext = useCallback(async () => {
    if (!normalizedProductId || !hasStrictProductContext) return null;
    let productData: Record<string, unknown> | null = null;
    try {
      const byDocId = await getDoc(doc(db, "products", normalizedProductId));
      if (byDocId.exists()) {
        productData = byDocId.data() as Record<string, unknown>;
      } else {
        const byIdField = await getDocs(
          query(
            collection(db, "products"),
            where("id", "==", normalizedProductId),
            limit(1),
          ),
        );
        if (!byIdField.empty) {
          productData = byIdField.docs[0].data() as Record<string, unknown>;
        }
      }
    } catch {
      productData = null;
    }

    const nameFromDb =
      productData && typeof productData.name === "string" ? productData.name.trim() : "";
    const currencyFromDb =
      productData && typeof productData.currency === "string"
        ? productData.currency.trim()
        : "";
    const priceFromDb =
      productData && typeof productData.price === "number"
        ? productData.price
        : productData && typeof productData.basePrice === "number"
          ? productData.basePrice
          : 0;

    const priceFromRoute = parsePriceAmount(normalizedProductPrice);
    const imageFromDb = productData ? pickImageFromProductRecord(productData) : null;
    const rawImage = normalizedProductImage || imageFromDb || "";
    const specsFromDb =
      productData && typeof productData.specifications === "object"
        ? (productData.specifications as Record<string, unknown>)
        : null;
    const weightRaw =
      (specsFromDb && specsFromDb.weight) || (productData && productData.weight);
    const dimensionsRaw =
      (specsFromDb && specsFromDb.dimensions) || (productData && productData.dimensions);
    const volumeRaw =
      (specsFromDb && specsFromDb.volume) || (productData && productData.volume);

    let finalImage = rawImage;
    if (rawImage.startsWith("gs://")) {
      try {
        const downloaded = await getDownloadURL(ref(storage, rawImage));
        finalImage = sanitizeImageUri(downloaded) || "";
      } catch {
        finalImage = "";
      }
    }

    return {
      id: normalizedProductId,
      name: normalizedProductName || nameFromDb || "Produit",
      price: priceFromRoute > 0 ? priceFromRoute : priceFromDb,
      currency: currencyFromDb || "XOF",
      image: finalImage,
      specifications: {
        weight: weightRaw != null ? String(weightRaw) : "",
        dimensions: dimensionsRaw != null ? String(dimensionsRaw) : "",
        volume: volumeRaw != null ? String(volumeRaw) : "",
      },
    };
  }, [
    normalizedProductId,
    hasStrictProductContext,
    normalizedProductPrice,
    normalizedProductImage,
    normalizedProductName,
  ]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!hasProductActions) {
        setComposerProductPreview(null);
        return;
      }
      const product = await resolveStructuredProductContext();
      if (!cancelled) {
        setComposerProductPreview(product);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hasProductActions, resolveStructuredProductContext, conversationId]);

  useEffect(() => {
    setPreviewDismissed(false);
  }, [conversationId, normalizedProductId]);

const handleSend = useCallback(
  async (customText?: string) => {
    const textToSend = (customText ?? inputText).trim();

    // 🐞 Log de débogage pour voir exactement ce qui bloque
    console.log("🔍 DEBUG SEND:", { textToSend, user, conversationId });

    if (!textToSend) return;
    if (!user?.uid) {
      Alert.alert("Erreur", "Votre session utilisateur n'est pas chargée.");
      return;
    }
    if (!conversationId) return;

    try {
      setSending(true);
      await sendMessage(conversationId, textToSend, { type: "text" });
      setInputText("");
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible d’envoyer le message.");
    } finally {
      setSending(false);
    }
  },
  [inputText, user, conversationId, sendMessage],
);

const handleAttachImage = useCallback(
    async (source: "camera" | "gallery") => {
      if (!conversationId || !user?.uid || sending) return;

      try {
        const permissionResult =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
          Alert.alert(
            "Permission requise",
            source === "camera"
              ? "Veuillez autoriser l’accès à la caméra pour prendre une photo."
              : "Veuillez autoriser l’accès à la galerie pour choisir une photo.",
          );
          return;
        }

        // 🟢 1. Compression maximale dès la prise de vue
        // On évite ainsi de charger l'image pleine résolution en RAM
        const pickerOptions: ImagePicker.ImagePickerOptions = {
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.2, // ⚡ Compression très forte à la source pour préserver la RAM
          allowsEditing: false,
          base64: false,
        };

        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (result.canceled || !result.assets?.[0]?.uri) {
          return;
        }

        setSending(true);

        const asset = result.assets[0];
        
        // 🛑 ON A SUPPRIMÉ ImageManipulator ICI !
        // Réutiliser ImageManipulator recharge une seconde image lourde en RAM
        // et fait sauter le processus Android. On utilise directement 'asset.uri'.
        const uploadUri = asset.uri;

        // 🟢 2. Lecture directe sous forme de Blob
        const response = await fetch(uploadUri);
        const blob = await response.blob();

        // 🟢 3. Envoi vers Firebase Storage
        const imageName = `chat_images/${conversationId}/${Date.now()}.jpg`;
        const imageRef = ref(storage, imageName);
        await uploadBytes(imageRef, blob);

        // Libération explicite de la mémoire
        if (typeof blob.close === "function") {
          blob.close();
        }

        const imageUrl = await getDownloadURL(imageRef);

        const caption =
          inputText.trim() ||
          (composerProductPreview?.name
            ? `Photo - ${composerProductPreview.name}`
            : "Photo de l'article");

        const parsedPriceFromInput = parseFloat(inputText.replace(/[^0-9.]/g, ""));
        const dynamicPrice =
          normalizedPrefillPrice ??
          composerProductPreview?.price ??
          (!isNaN(parsedPriceFromInput) && parsedPriceFromInput > 0
            ? parsedPriceFromInput
            : null);

        await sendMessage(conversationId, caption, {
          type: "product_payment",
          product: {
            id: `article_photo_${Date.now()}`,
            name: caption,
            price: dynamicPrice,
            currency: composerProductPreview?.currency || "XOF",
            image: imageUrl,
            specifications: {
              weight: composerProductPreview?.specifications?.weight || "",
              dimensions: composerProductPreview?.specifications?.dimensions || "",
              volume: composerProductPreview?.specifications?.volume || "",
            },
          },
          payment: {
            url: "",
            provider: "ngenius",
            status: "pending",
          },
          imageUrl,
          image: imageUrl,
          metadata: { imageUrl },
        });

        setInputText("");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[conversation] image send failed", {
          source,
          conversationId,
          message,
          error,
        });
        Alert.alert(
          "Erreur",
          "Impossible d’envoyer la photo dans le chat pour le moment."
        );
      } finally {
        setSending(false);
      }
    },
    [
      conversationId,
      inputText,
      sendMessage,
      sending,
      user?.uid,
      normalizedPrefillPrice,
      composerProductPreview,
    ]
  );

  const openImagePickerActionSheet = useCallback(() => {
    Alert.alert("Ajouter une photo", "Choisissez une source", [
      {
        text: "Caméra",
        onPress: () => void handleAttachImage("camera"),
      },
      {
        text: "Galerie",
        onPress: () => void handleAttachImage("gallery"),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }, [handleAttachImage]);

  const sendProductInquiry = useCallback(() => {
    void (async () => {
      const product = await resolveStructuredProductContext();
      const name = product?.name || normalizedProductName || "ce produit";
      if (product && conversationId) {
        await sendMessage(conversationId, `Demande sur le produit: ${name}`, {
          type: "product_payment",
          product: {
            id: product.id,
            name: product.name,
            price: Number(product.price || 0),
            currency: product.currency || "XOF",
            image: product.image || "",
            specifications: product.specifications,
          },
          payment: {
            url: "",
            provider: "ngenius",
            status: "pending",
          },
        });
        return;
      }
      await handleSend(`Bonjour, je suis intéressé par : ${name}. Est-ce disponible ?`);
    })();
  }, [
    handleSend,
    resolveStructuredProductContext,
    normalizedProductName,
    sendMessage,
    conversationId,
  ]);

  const sendPaymentLinkInChat = useCallback(async () => {
    if (!user || !conversationId || !hasProductActions) {
      Alert.alert("Paiement", "Contexte produit manquant. Ouvrez la discussion depuis la fiche produit.");
      return;
    }

    const product = await resolveStructuredProductContext();
    if (!product) {
      Alert.alert("Paiement", "Produit introuvable pour cette conversation.");
      return;
    }

    const amount = Number(product.price || 0);
    if (amount <= 0) {
      Alert.alert(
        "Paiement",
        "Prix introuvable pour ce produit. Ouvrez la fiche produit et confirmez le prix avant partage.",
      );
      return;
    }

    setCreatingPaymentLink(true);
    try {
      const payload = {
        orderId: `CHAT-${conversationId}-${product.id}-${Date.now()}`,
        userId: user.uid,
        amount,
        currencyCode: product.currency || "XOF",
        email: user.email ?? `${user.uid}@a2express.com`,
        firstname: user.displayName?.split(" ")[0] ?? "Client",
        lastname: user.displayName?.split(" ")[1] ?? "A2Express",
        method: "ngenius_card" as const,
        items: [
          {
            id: product.id,
            productId: product.id,
            name: product.name || "Produit",
            price: amount,
            quantity: 1,
            imageUrl: product.image || undefined,
            specifications: {
              weight: Number.parseFloat(product.specifications?.weight || "0") || 0,
              volume: Number.parseFloat(product.specifications?.volume || "0") || 0,
              dimensions: product.specifications?.dimensions || "",
            },
          },
        ],
        summary: {
          subtotal: amount,
          shipping: 0,
          discount: 0,
          total: amount,
        },
      };

      const response = await fetch(PAYMENT_ENDPOINTS.ngenius, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { url?: string };
      const paymentUrl =
        response.ok && typeof result.url === "string" && result.url.length > 0
          ? result.url
          : null;
      if (!paymentUrl) {
        throw new Error("NGenius n'a pas renvoyé de lien.");
      }
      if (/paydunya/i.test(paymentUrl)) {
        throw new Error("Lien non NGenius retourné.");
      }

      await sendMessage(conversationId, "", {
        type: "product_payment",
        product: {
          id: product.id,
          name: product.name,
          price: amount,
          currency: product.currency || "XOF",
          image: product.image || "",
          specifications: product.specifications,
        },
        payment: {
          url: paymentUrl,
          provider: "ngenius",
          status: "pending",
        },
      });
      Alert.alert("Paiement", "Lien de paiement envoyé dans la discussion.");
    } catch (error) {
      Alert.alert(
        "Paiement indisponible",
        "Impossible de générer le lien de paiement pour le moment.",
      );
    } finally {
      setCreatingPaymentLink(false);
    }
  }, [
    user,
    conversationId,
    hasProductActions,
    resolveStructuredProductContext,
    sendMessage,
  ]);

  const openPreviewProduct = useCallback(() => {
    if (!composerProductPreview?.id) return;
    router.push(`/product/${composerProductPreview.id}`);
  }, [router, composerProductPreview?.id]);

  const openActionsMenu = useCallback(() => {
    if (!user?.uid || !conversationId) return;
    const parts = (convData?.participants as string[]) || [];
    const isParticipant = parts.includes(user.uid);
    const isPair = parts.length === 2;
    const createdBy = convData?.createdBy as string | undefined;
    const admins = (convData?.admins as string[] | undefined) || [];
    const canDeleteThread =
      isParticipant &&
      (isPair || createdBy === user.uid || admins.includes(user.uid));

    Alert.alert("Conversation", undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Vider les messages",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Vider les messages ?",
            "Tous les messages seront supprimés pour tout le monde.",
            [
              { text: "Annuler", style: "cancel" },
              {
                text: "Vider",
                style: "destructive",
                onPress: () => {
                  void (async () => {
                    try {
                      await clearAllMessagesInConversation(conversationId);
                      setOlderMessages([]);
                      olderTailRef.current = null;
                    } catch {
                      Alert.alert("Erreur", "Impossible de vider les messages.");
                    }
                  })();
                },
              },
            ],
          );
        },
      },
      ...(canDeleteThread
        ? ([
            {
              text: "Supprimer la conversation",
              style: "destructive" as const,
              onPress: () => {
                Alert.alert(
                  "Supprimer la conversation ?",
                  "La conversation disparaîtra de votre liste.",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Supprimer",
                      style: "destructive",
                      onPress: () => {
                        void (async () => {
                          try {
                            await deleteConversation(conversationId);
                            router.back();
                          } catch {
                            /* deleteConversation affiche déjà une alerte */
                          }
                        })();
                      },
                    },
                  ],
                );
              },
            },
          ] as const)
        : []),
    ]);
  }, [
    user?.uid,
    conversationId,
    convData,
    clearAllMessagesInConversation,
    deleteConversation,
    router,
  ]);

  const renderChatItem = useCallback(
    ({ item }: { item: UiMessage }) => {
      const isMine = item.senderId === user?.uid;
      if (item.type === "product_payment") {
        return <ProductMessageCard message={item} isMine={isMine} />;
      }
      return <ChatBubbleRow item={item} isMine={isMine} />;
    },
    [user?.uid],
  );

  const handleListEndReached = useCallback(() => {
    if (!hasMoreOlder || loadingOlder || displayMessages.length < 12) return;
    void loadOlderMessages();
  }, [hasMoreOlder, loadingOlder, displayMessages.length, loadOlderMessages]);

  const listFooter = useMemo(() => {
    if (!loadingOlder) return null;
    return (
      <View style={styles.listFooter}>
        <ActivityIndicator size="small" color="#EA580C" />
        <Text style={styles.listFooterText}>Chargement…</Text>
      </View>
    );
  }, [loadingOlder]);

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.muted}>Connectez-vous pour voir la conversation.</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() =>
            requireAuth({
              reason: "contact_seller",
              href: conversationId ? `/conversation/${conversationId}` : undefined,
            })
          }
        >
          <Text style={styles.primaryBtnText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (!conversationId || convMissing) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="chatbubble-ellipses-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Conversation introuvable</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
<View style={styles.container}>
  <StatusBar barStyle="dark-content" />
  <Stack.Screen options={{ headerShown: false }} />
  <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
    <Pressable
      onPress={() => router.back()}
      style={styles.headerIcon}
      hitSlop={12}
    >
      <Ionicons name="chevron-back" size={26} color="#111827" />
    </Pressable>

    <View style={styles.headerMain}>
      <View style={styles.shopRow}>
        {(() => {
          const isClient =
            Boolean(user?.uid) &&
            user?.uid !== convData?.companyId &&
            user?.uid !== convData?.sellerUid;

          // 🟢 Photo cohérente avec le rôle : boutique si je suis client, interlocuteur sinon
          const displayPhoto = isClient ? shop.logo : interlocutor.photo;

          return displayPhoto ? (
            <Pressable onPress={openProfileModal} hitSlop={10}>
              <Image
                source={{ uri: displayPhoto }}
                style={styles.shopLogo}
                contentFit="cover"
                transition={100}
                cachePolicy="memory-disk"
              />
            </Pressable>
          ) : (
            <Pressable
              onPress={openProfileModal}
              style={styles.shopLogoPlaceholder}
              hitSlop={10}
            >
              <Ionicons
                name={isClient ? "storefront" : "person"}
                size={20}
                color="#EA580C"
              />
            </Pressable>
          );
        })()}

        <View style={styles.shopTextCol}>
          {/* Nom principal (client ou boutique) */}
          <Pressable onPress={openProfileModal} hitSlop={6}>
            <Text style={styles.shopName} numberOfLines={1}>
              {(() => {
                const isClient =
                  user?.uid &&
                  user.uid !== convData?.companyId &&
                  user.uid !== convData?.sellerUid;

                if (isClient) {
                  return (
                    (shop.name && shop.name !== "Super admin" ? shop.name : null) ||
                    (convData?.companyName && convData.companyName !== "Super admin"
                      ? convData.companyName
                      : null) ||
                    params.sellerName ||
                    params.companyName ||
                    "Boutique"
                  );
                } else {
                  return pickSellerViewClientName({
                    routeName: normalizedRouteClientName,
                    extraName: clientExtra?.name,
                    interlocutorName: interlocutor?.name,
                    conv: convData as Record<string, unknown> | null,
                  });
                }
              })()}
            </Text>
          </Pressable>

          {/* Sous-titre sous le nom */}
          <Pressable onPress={openProfileModal} hitSlop={6}>
            <Text style={styles.shopHint} numberOfLines={1}>
              {interlocutorOnline
                ? "En ligne"
                : user?.uid &&
                  user.uid !== convData?.companyId &&
                  user.uid !== convData?.sellerUid
                ? "Boutique / Vendeur"
                : "Client"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>

  <View style={styles.headerRight}>
    {!isClientViewer ? (
      <Pressable
        style={styles.headerIcon}
        onPress={() => {
          const cid =
            typeof convData?.companyId === "string"
              ? convData.companyId
              : "";
          if (cid) router.push(`/company/${cid}`);
          else Alert.alert("Conversation", shop.name, [{ text: "OK" }]);
        }}
      >
        <Ionicons name="storefront-outline" size={24} color="#111827" />
      </Pressable>
    ) : null}
    <Pressable
      style={styles.headerIcon}
      onPress={openActionsMenu}
      hitSlop={10}
    >
      <Ionicons name="ellipsis-vertical" size={22} color="#111827" />
    </Pressable>
  </View>
</View>

<ConversationProfileModal
  visible={profileModalVisible}
  profile={conversationProfile}
  onClose={closeProfileModal}
/>

<KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  style={styles.flex}
  keyboardVerticalOffset={0}
>
  {messagesLoading && displayMessages.length === 0 ? (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#EA580C" />
    </View>
  ) : (
<FlatList
  ref={flatListRef}
  data={displayMessages}
  keyExtractor={(item) => item.id}
  renderItem={renderChatItem}
  contentContainerStyle={styles.listPad}
  initialNumToRender={18}
  maxToRenderPerBatch={14}
  windowSize={9}
  removeClippedSubviews={Platform.OS === "android"}
  onEndReached={handleListEndReached}
  onEndReachedThreshold={0.35}
  ListFooterComponent={listFooter}
  inverted // <-- AJOUTE CETTE LIGNE ICI
  ListEmptyComponent={
    <Text style={styles.emptyThread}>
      Aucun message. Écrivez pour commencer.
    </Text>
  }
/>
        )}

        {hasProductActions && composerProductPreview && !previewDismissed ? (
          <View style={styles.composerPreviewCard}>
            <View style={styles.composerPreviewTop}>
              <Text style={styles.composerPreviewLabel}>Produit recommande</Text>
              <Pressable onPress={() => setPreviewDismissed(true)} hitSlop={8}>
                <Ionicons name="close" size={18} color="#9CA3AF" />
              </Pressable>
            </View>
            <View style={styles.composerPreviewBody}>
              {composerProductPreview.image ? (
                <Image
                  source={{ uri: composerProductPreview.image }}
                  style={styles.composerPreviewImage}
                  contentFit="cover"
                  transition={120}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={[styles.composerPreviewImage, styles.composerPreviewImagePh]}
                />
              )}
              <View style={styles.composerPreviewMid}>
                <Text style={styles.composerPreviewTitle} numberOfLines={2}>
                  {composerProductPreview.name}
                </Text>
                <Text style={styles.composerPreviewPrice}>
                  {Number(composerProductPreview.price || 0).toLocaleString("fr-FR")}{" "}
                  {composerProductPreview.currency || "XOF"}
                </Text>
                <Text style={styles.composerPreviewSpec} numberOfLines={1}>
                  {composerProductPreview.specifications?.weight
                    ? `Poids: ${composerProductPreview.specifications.weight}`
                    : "Poids: -"}
                  {"  "}
                  {composerProductPreview.specifications?.volume
                    ? `Volume: ${composerProductPreview.specifications.volume}`
                    : "Volume: -"}
                </Text>
                {composerProductPreview.specifications?.dimensions ? (
                  <Text style={styles.composerPreviewSpec} numberOfLines={1}>
                    Dimensions: {composerProductPreview.specifications.dimensions}
                  </Text>
                ) : null}
                <View style={styles.composerPreviewActions}>
                  <Pressable style={styles.composerPreviewViewBtn} onPress={openPreviewProduct}>
                    <Text style={styles.composerPreviewViewBtnText}>Voir</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.composerPreviewPayBtn,
                      creatingPaymentLink && styles.productActionChipDisabled,
                    ]}
                    onPress={() => void sendPaymentLinkInChat()}
                    disabled={creatingPaymentLink || sending}
                  >
                    <Text style={styles.composerPreviewPayBtnText}>
                      {creatingPaymentLink ? "Lien..." : "Lien paiement"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.composerPreviewSendBtn}
                    onPress={sendProductInquiry}
                    disabled={sending}
                  >
                    <Text style={styles.composerPreviewSendBtnText}>Envoyer</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        <View
          style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}
        >
          <View style={styles.quickChips}>
            {hasProductActions ? (
              <>
                <Pressable
                  style={styles.productActionChip}
                  onPress={sendProductInquiry}
                  disabled={sending}
                >
                  <Text style={styles.productActionChipText}>Question produit</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.productActionChip,
                    styles.productActionChipPrimary,
                    creatingPaymentLink && styles.productActionChipDisabled,
                  ]}
                  onPress={() => void sendPaymentLinkInChat()}
                  disabled={creatingPaymentLink || sending}
                >
                  <Text style={styles.productActionChipPrimaryText}>
                    {creatingPaymentLink ? "Lien..." : "Payer ce produit"}
                  </Text>
                </Pressable>
              </>
            ) : null}
            {["C’est disponible ?", "Dernier prix ?", "Livraison ?"].map((t) => (
              <Pressable
                key={t}
                style={styles.chip}
                onPress={() => void handleSend(t)}
                disabled={sending}
              >
                <Text style={styles.chipText}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Écrire un message…"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={4000}
            />
            <Pressable
              style={styles.attachBtn}
              hitSlop={8}
              onPress={openImagePickerActionSheet}
              disabled={sending}
            >
              <Ionicons name="camera-outline" size={22} color="#EA580C" />
            </Pressable>
            <Pressable style={styles.emojiBtn} hitSlop={8}>
              <MaterialCommunityIcons name="emoticon-happy-outline" size={24} color="#6B7280" />
            </Pressable>
            {inputText.trim().length > 0 ? (
              <Pressable
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={() => void handleSend()}
                disabled={sending}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
  },
  muted: { fontSize: 15, color: "#6B7280", textAlign: "center" },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: "#EA580C",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  secondaryBtnText: { color: "#111827", fontWeight: "600" },
  headerRight: { flexDirection: "row", alignItems: "flex-start" },
  listFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  listFooterText: { fontSize: 13, color: "#6B7280" },
  emptyThread: {
    textAlign: "center",
    color: "#9CA3AF",
    paddingVertical: 32,
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  headerIcon: { padding: 8, marginTop: 2 },
  headerMain: { flex: 1, minWidth: 0 },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shopLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  shopLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  shopTextCol: { flex: 1, minWidth: 0 },
  shopName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  shopHint: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
    marginTop: 2,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F3F4F6",
  },
  personAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },
  personAvatarPh: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E0E7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  personInitials: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4338CA",
  },
  personTextCol: { flex: 1, minWidth: 0 },
  personName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  personStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotOn: { backgroundColor: "#22C55E" },
  statusDotOff: { backgroundColor: "#D1D5DB" },
  personStatus: { fontSize: 12, color: "#9CA3AF" },
  loader: { flex: 1, justifyContent: "center" },
  listPad: { padding: 16, paddingBottom: 8 },
  msgRow: { marginBottom: 10, width: "100%" },
  msgRowMine: { alignItems: "flex-end" },
  msgRowTheirs: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: "#FFEDD5",
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  msgText: { fontSize: 15, color: "#1F2937", lineHeight: 21 },
  imageBubbleContainer: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    marginTop: 10,
  },
  msgLink: {
    color: "#2563EB",
    textDecorationLine: "underline",
    fontWeight: "700",
  },
  msgTime: {
    fontSize: 11,
    color: "#9CA3AF",
    alignSelf: "flex-end",
    marginTop: 6,
  },
  inputBar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  quickChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  chipText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  productActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  productActionChipPrimary: {
    backgroundColor: "#EA580C",
  },
  productActionChipDisabled: {
    opacity: 0.65,
  },
  productActionChipText: { fontSize: 12, color: "#111827", fontWeight: "700" },
  productActionChipPrimaryText: { fontSize: 12, color: "#FFFFFF", fontWeight: "700" },
  composerPreviewCard: {
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  composerPreviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  composerPreviewLabel: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  composerPreviewBody: { flexDirection: "row", alignItems: "center", gap: 10 },
  composerPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  composerPreviewImagePh: {
    backgroundColor: "#E5E7EB",
  },
  composerPreviewMid: { flex: 1, minWidth: 0 },
  composerPreviewTitle: { fontSize: 14, color: "#111827", fontWeight: "700" },
  composerPreviewPrice: {
    marginTop: 4,
    fontSize: 13,
    color: "#EA580C",
    fontWeight: "700",
  },
  composerPreviewSpec: { marginTop: 2, fontSize: 11, color: "#6B7280" },
  composerPreviewActions: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  composerPreviewViewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
  },
  composerPreviewViewBtnText: { color: "#C2410C", fontSize: 12, fontWeight: "700" },
  composerPreviewPayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#2563EB",
  },
  composerPreviewPayBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  composerPreviewSendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#EA580C",
  },
  composerPreviewSendBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: "#F3F4F6",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emojiBtn: { padding: 8, marginBottom: 2 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.6 },
});
