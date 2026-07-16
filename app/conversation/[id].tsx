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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useMessages } from "../../src/contexts/MessagesContext";
import ProductMessageCard from "../../src/components/ProductMessageCard";
import {
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
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../../src/config/firebase";
import { PAYMENT_ENDPOINTS } from "../../src/config/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pickCompanyNameFromFirestoreData } from "../../src/utils/companyDisplayName";

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
  const x = d.data();
  const rawProduct = x.product as Record<string, unknown> | undefined;
  const rawPayment = x.payment as Record<string, unknown> | undefined;
  return {
    id: d.id,
    text: String(x.text || ""),
    senderId: String(x.senderId || ""),
    senderName: x.senderName ? String(x.senderName) : undefined,
    timestamp:
      x.timestamp && typeof x.timestamp.toDate === "function"
        ? x.timestamp.toDate()
        : new Date(),
    type: x.type ? String(x.type) : "text",
    product: rawProduct
      ? {
          id: String(rawProduct.id || ""),
          name: String(rawProduct.name || "Produit"),
          price: Number(rawProduct.price || 0),
          currency: String(rawProduct.currency || "XOF"),
          image: String(rawProduct.image || ""),
          specifications:
            rawProduct.specifications &&
            typeof rawProduct.specifications === "object"
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
                          (rawProduct.specifications as Record<string, unknown>)
                            .dimensions,
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
      : undefined,
    payment: rawPayment
      ? {
          url: String(rawPayment.url || ""),
          provider: "ngenius",
          status:
            rawPayment.status === "paid" || rawPayment.status === "failed"
              ? rawPayment.status
              : "pending",
        }
      : undefined,
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
        <Text style={styles.msgTime}>{timeStr}</Text>
      </View>
    </View>
  );
});

export default function ConversationScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    /** Document Firestore `companies/{id}` (fiche produit / boutique). */
    companyId?: string;
    sellerId?: string;
    productId?: string;
    productName?: string;
    productPrice?: string;
    productImage?: string;
    imageUrl?: string;
    mainImage?: string;
    productContext?: string;
    sellerName?: string;
    sellerLogo?: string;
  }>();
  const { user } = useAuth();
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

  const [convData, setConvData] = useState<Record<string, unknown> | null>(
    null,
  );
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

  const normalizedCompanyId = useMemo(
    () => normalizeRouteParam(params.companyId),
    [params.companyId],
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
  const hasProductActions = useMemo(
    () => Boolean(normalizedProductId) && hasStrictProductContext,
    [normalizedProductId, hasStrictProductContext],
  );
  const deterministicConversationId = useMemo(() => {
    if (!user?.uid || !normalizedCompanyId || !hasStrictProductContext) return null;
    return `${normalizedCompanyId}_${user.uid}`;
  }, [user?.uid, normalizedCompanyId, hasStrictProductContext]);

  const conversationId = deterministicConversationId || rawRouteConversationId;

  const otherUid = useMemo(() => {
    if (!user?.uid || !convData?.participants) return null;
    const parts = convData.participants as string[];
    return parts.find((p) => p !== user.uid) ?? null;
  }, [convData, user?.uid]);

  const interlocutorOnline = useMemo(() => {
    if (!otherUid) return false;
    return onlineUsers.some(
      (u) => u.uid === otherUid && u.status === "online",
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

  useEffect(() => {
    setOlderMessages([]);
    setHasMoreOlder(true);
    olderTailRef.current = null;
    liveAnchorRef.current = null;
  }, [conversationId]);

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

  /**
   * L’ID dans l’URL peut être : doc Firestore `conversations`, UID vendeur (fiche produit),
   * ou ID document `companies` (fiche boutique). On résout / crée la bonne conversation.
   */
  useEffect(() => {
    if (!user?.uid || !conversationId) return;
    let cancelled = false;

    const run = async () => {
      // Flux marketplace strict: 1 conversation = 1 user + 1 boutique.
      if (hasStrictProductContext) {
        if (!normalizedCompanyId) {
          throw new Error("companyId is required for marketplace conversations");
        }
        const convRef = doc(db, "conversations", conversationId);
        const convSnap = await getDoc(convRef);
        if (cancelled || convSnap.exists()) return;

        if (bootstrapInFlight.current) return;
        bootstrapInFlight.current = true;
        try {
          const companySnap = await getDoc(doc(db, "companies", normalizedCompanyId));
          if (cancelled) return;

          const companyData = companySnap.exists()
            ? (companySnap.data() as Record<string, unknown>)
            : null;
          const sellerUidFromParam = normalizeRouteParam(params.sellerId);
          const sellerUidFromCompany =
            companyData && typeof companyData.uid === "string" ? companyData.uid : null;
          const sellerUid = sellerUidFromParam || sellerUidFromCompany;
          const participants = [user.uid, sellerUid]
            .filter((p): p is string => Boolean(p && p.trim()))
            .filter((p, idx, arr) => arr.indexOf(p) === idx);

          await setDoc(
            convRef,
            {
              id: conversationId,
              companyId: normalizedCompanyId,
              companyName:
                (companyData && typeof companyData.name === "string"
                  ? companyData.name
                  : normalizeRouteParam(params.sellerName)) || "Boutique",
              companyLogo:
                companyData && typeof companyData.logo === "string"
                  ? companyData.logo
                  : null,
              title:
                (companyData && typeof companyData.name === "string"
                  ? companyData.name
                  : normalizeRouteParam(params.sellerName)) || "Boutique",
              type: "seller",
              participants,
              participantNames: {
                [user.uid]: user.displayName || "Vous",
              },
              participantAvatars: {
                [user.uid]: user.photoURL || "",
              },
              unreadCount: {
                [user.uid]: 0,
              },
              mute: { [user.uid]: false },
              pinned: { [user.uid]: false },
              archived: { [user.uid]: false },
              lastMessage: "",
              createdBy: user.uid,
              admins: [user.uid],
              messageCount: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch (e) {
          console.warn("conversation bootstrap strict", e);
        } finally {
          bootstrapInFlight.current = false;
        }
        return;
      }

      // Flux legacy (hors contexte produit strict).
      const convSnap = await getDoc(doc(db, "conversations", conversationId));
      if (cancelled || convSnap.exists()) return;

      const targetCompanyId = normalizeRouteParam(params.companyId);
      if (targetCompanyId) {
        const existing = conversations.find(
          (c) =>
            c.companyId === targetCompanyId &&
            Array.isArray(c.participants) &&
            c.participants.includes(user.uid),
        );
        if (existing) {
          return;
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    user?.uid,
    user?.displayName,
    user?.photoURL,
    conversations,
    hasStrictProductContext,
    normalizedCompanyId,
    params.sellerName,
    params.sellerId,
    params.companyId,
  ]);

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
          setConvMissing(true);
          return;
        }
        const data = snap.data();
        const parts = (data.participants as string[] | undefined) || [];
        if (user?.uid && !parts.includes(user.uid)) {
          setConvData(null);
          setConvMissing(true);
          return;
        }
        setConvMissing(false);
        setConvData({ id: snap.id, ...data });
      },
      () => setConvMissing(true),
    );
    return () => unsub();
  }, [conversationId, user]);

  useEffect(() => {
    if (!convData || !user?.uid) return;
    let cancelled = false;

    const run = async () => {
      const participants = (convData.participants as string[]) || [];
      const other = participants.find((p) => p !== user.uid) ?? null;

      let shopName = String(convData.companyName || "").trim();
      let shopLogo: string | null = isHttpUrl(convData.companyLogo)
        ? convData.companyLogo
        : null;
      const companyId =
        typeof convData.companyId === "string" ? convData.companyId : "";

      if ((!shopName || !shopLogo) && companyId) {
        try {
          const cs = await getDoc(doc(db, "companies", companyId));
          if (cs.exists() && !cancelled) {
            const c = cs.data() as Record<string, unknown>;
            if (!shopName) {
              shopName = pickCompanyNameFromFirestoreData(c);
            }
            if (!shopLogo && isHttpUrl(c.logo)) {
              shopLogo = c.logo;
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (!shopName) {
        shopName = String(convData.title || "Conversation").trim();
      }

      if (!cancelled) {
        setShop({ name: shopName || "Conversation", logo: shopLogo });
      }

      if (other) {
        let personName = "";
        let personPhoto: string | null = null;
        const pNames = convData.participantNames as
          | Record<string, string>
          | undefined;
        const pAvatars = convData.participantAvatars as
          | Record<string, string>
          | undefined;

        try {
          const us = await getDoc(doc(db, "users", other));
          if (us.exists() && !cancelled) {
            const ud = us.data();
            personName =
              String(ud.displayName || ud.name || "").trim() ||
              String(pNames?.[other] || "").trim() ||
              "Interlocuteur";
            const ph = ud.photoURL;
            personPhoto = isHttpUrl(ph) ? ph : null;
          }
        } catch {
          personName = String(pNames?.[other] || "").trim() || "Interlocuteur";
        }

        if (!personPhoto && isHttpUrl(pAvatars?.[other])) {
          personPhoto = pAvatars![other];
        }

        if (!personName) {
          personName = String(pNames?.[other] || "").trim() || "Interlocuteur";
        }

        if (!cancelled) {
          setInterlocutor({ name: personName, photo: personPhoto });
        }
      } else if (!cancelled) {
        setInterlocutor({ name: "", photo: null });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [convData, user?.uid]);

  useEffect(() => {
    if (!conversationId) {
      setMessagesLoading(false);
      return;
    }

    const msgsCol = collection(
      db,
      "conversations",
      conversationId,
      "messages",
    );
    const q = query(
      msgsCol,
      orderBy("timestamp", "desc"),
      limit(LIVE_MESSAGE_WINDOW),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          liveAnchorRef.current = null;
          setLiveMessages([]);
          setOlderMessages([]);
          olderTailRef.current = null;
          setHasMoreOlder(false);
        } else {
          const list = snap.docs.map(mapDocToUiMessage);
          liveAnchorRef.current = snap.docs[snap.docs.length - 1] ?? null;
          setLiveMessages(list);
          setHasMoreOlder(snap.docs.length >= LIVE_MESSAGE_WINDOW);
        }
        setMessagesLoading(false);
      },
      () => setMessagesLoading(false),
    );

    return () => unsub();
  }, [conversationId]);

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
      if (!textToSend || !user || !conversationId) return;

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
          onPress={() => router.replace("/(tabs)/account")}
        >
          <Text style={styles.primaryBtnText}>Mon compte</Text>
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
            {shop.logo ? (
              <Image
                source={{ uri: shop.logo }}
                style={styles.shopLogo}
                contentFit="cover"
                transition={100}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.shopLogoPlaceholder}>
                <Ionicons name="storefront" size={20} color="#EA580C" />
              </View>
            )}
            <View style={styles.shopTextCol}>
              <Text style={styles.shopName} numberOfLines={1}>
                {shop.name}
              </Text>
              <Text style={styles.shopHint} numberOfLines={1}>
                Compagnie
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
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
          <Pressable
            style={styles.headerIcon}
            onPress={openActionsMenu}
            hitSlop={10}
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#111827" />
          </Pressable>
        </View>
      </View>

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
    marginBottom: 10,
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
