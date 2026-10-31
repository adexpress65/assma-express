/**
 * ROUTAGE MESSAGERIE A2Express — source unique.
 *
 * Règle : le destinataire d’un fil boutique est le propriétaire vendeur
 * (sellerUid), jamais un repli silencieux vers le super-admin / support.
 *
 * Interdit :
 *  - créer une conversation hors de createOrGetConversation / bootstrapStoreConversation
 *  - arrayUnion(viewerUid) si le viewer n’est ni client ni vendeur du fil
 *  - coller companyId dans participants (le companyId est un champ, pas un UID)
 *  - réutiliser SUPPORT_INBOX_UID comme fallback boutique
 *
 * Types :
 *  - customer_to_store     → participants = [clientUid, sellerUid]
 *  - customer_to_support   → participants = [clientUid, SUPPORT_INBOX_UID]
 *  - seller_to_customer    → participants = [clientUid, sellerUid]
 */
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

export type ConversationKind =
  | "customer_to_store"
  | "customer_to_support"
  | "seller_to_customer";

/** Uniquement pour customer_to_support. Ne jamais l’utiliser comme fallback boutique. */
export const SUPPORT_INBOX_UID = "biU1QvlrGtZeqTLdbLONLGbyVQ92";

export class MessagingRoutingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MessagingRoutingError";
    this.code = code;
  }
}

export function nonEmptyId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const SHOP_OWNER_ROLES = new Set(["seller", "admin", "super-admin", "super_admin"]);

/** Le document users/{id société} est le propriétaire seulement si son rôle gère une boutique. */
export function isVerifiedShopAccount(role: unknown): boolean {
  return typeof role === "string" && SHOP_OWNER_ROLES.has(role.trim());
}

export function companyOwnerCandidates(
  data: Record<string, unknown> | null | undefined,
  options?: { companyId?: string | null; companyIdIsAccount?: boolean },
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    const id = nonEmptyId(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  if (data) {
    for (const key of ["ownerUid", "ownerId", "sellerUid"] as const) push(data[key]);
  }
  const hasExplicitOwner = out.length > 0;
  if (!hasExplicitOwner && options?.companyIdIsAccount) push(options.companyId);
  if (data) push(data.uid);
  return out;
}

/**
 * Propriétaires société (ownerUid, ownerId, sellerUid, compte de la boutique, uid).
 * Le compte support n’est destinataire boutique que s’il EST le compte de cette boutique.
 * Un sellerId produit, ou le super-admin, n’est jamais un repli pour une autre boutique.
 */
export function pickStoreOwnerUid(input: {
  productSellerUid?: string | null;
  companyCandidates: string[];
  supportInboxUid?: string | null;
  shopAccountUid?: string | null;
}): string {
  const blocked = new Set<string>();
  const support = nonEmptyId(input.supportInboxUid ?? SUPPORT_INBOX_UID);
  const shopAccount = nonEmptyId(input.shopAccountUid);
  if (support && support !== shopAccount) blocked.add(support);

  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const id of input.companyCandidates) {
    const clean = nonEmptyId(id);
    if (!clean || blocked.has(clean) || seen.has(clean)) continue;
    seen.add(clean);
    candidates.push(clean);
  }

  const productSeller = nonEmptyId(input.productSellerUid);
  if (shopAccount && candidates[0] === shopAccount) return shopAccount;
  if (productSeller && seen.has(productSeller)) return productSeller;

  if (candidates.length === 0) {
    throw new MessagingRoutingError(
      "STORE_OWNER_UNRESOLVED",
      "Impossible de déterminer le propriétaire de la boutique. Le message n’a pas été envoyé au support.",
    );
  }
  return candidates[0];
}

export function canonicalStoreConversationId(
  companyId: string,
  clientUid: string,
): string {
  const company = nonEmptyId(companyId);
  const client = nonEmptyId(clientUid);
  if (!company || !client) {
    throw new MessagingRoutingError(
      "INVALID_CONVERSATION_IDS",
      "storeId et clientUid sont obligatoires.",
    );
  }
  return `${company}_${client}`;
}

export function buildKindParticipants(
  kind: ConversationKind,
  input: { clientUid: string; sellerUid?: string | null },
): string[] {
  const clientUid = nonEmptyId(input.clientUid);
  if (!clientUid) {
    throw new MessagingRoutingError("MISSING_CLIENT", "clientUid manquant.");
  }
  if (kind === "customer_to_support") {
    return [clientUid, SUPPORT_INBOX_UID];
  }
  const sellerUid = nonEmptyId(input.sellerUid);
  if (!sellerUid) {
    throw new MessagingRoutingError(
      "MISSING_SELLER",
      "sellerUid manquant pour un fil boutique.",
    );
  }
  return [clientUid, sellerUid];
}

export function viewerMayJoinStoreThread(
  viewerUid: string,
  participants: string[],
): boolean {
  return participants.includes(viewerUid);
}

/** Boîte staff : support, ou un fil où ce compte est vraiment client ou vendeur. */
export function staffInboxVisible(
  conv: {
    conversationKind?: string | null;
    type?: string | null;
    participants?: string[] | null;
    sellerUid?: string | null;
    clientUid?: string | null;
  },
  staffUid: string,
): boolean {
  if (conv.type === "support" || conv.conversationKind === "customer_to_support") {
    return true;
  }
  const uid = nonEmptyId(staffUid);
  if (!uid) return false;
  const participants = Array.isArray(conv.participants) ? conv.participants : [];
  return participants.includes(uid) || conv.sellerUid === uid || conv.clientUid === uid;
}

type StoreBootstrapInput = {
  conversationId: string;
  companyId: string;
  viewerUid: string;
  productSellerUid?: string | null;
  clientUid?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
  clientName?: string | null;
  clientAvatar?: string | null;
  debug?: boolean;
};

export async function resolveStoreOwnerUid(input: {
  companyId: string;
  productSellerUid?: string | null;
  debug?: boolean;
}): Promise<{ sellerUid: string; companyName: string | null; companyLogo: string | null }> {
  const companyId = nonEmptyId(input.companyId);
  if (!companyId) {
    throw new MessagingRoutingError("MISSING_COMPANY", "storeId / companyId manquant.");
  }

  const companySnap = await getDoc(doc(db, "companies", companyId));
  const companyData = companySnap.exists()
    ? (companySnap.data() as Record<string, unknown>)
    : null;
  if (!companyData) {
    throw new MessagingRoutingError(
      "COMPANY_NOT_FOUND",
      "Boutique introuvable. Impossible d’ouvrir la discussion.",
    );
  }

  const accountSnap = await getDoc(doc(db, "users", companyId));
  const companyIdIsAccount =
    accountSnap.exists() && isVerifiedShopAccount(accountSnap.data()?.role);
  const sellerUid = pickStoreOwnerUid({
    productSellerUid: input.productSellerUid,
    companyCandidates: companyOwnerCandidates(companyData, {
      companyId,
      companyIdIsAccount,
    }),
    shopAccountUid: companyIdIsAccount ? companyId : null,
  });

  const companyName =
    nonEmptyId(companyData.name) ||
    nonEmptyId(companyData.companyName) ||
    null;
  const companyLogo =
    nonEmptyId(companyData.logo) ||
    nonEmptyId(companyData.companyLogo) ||
    null;

  if (input.debug || (typeof __DEV__ !== "undefined" && __DEV__)) {
    console.log("[messagerie] destinataire boutique", {
      companyId,
      productSellerUid: input.productSellerUid ?? null,
      candidates: companyOwnerCandidates(companyData, {
        companyId,
        companyIdIsAccount,
      }),
      sellerUid,
    });
  }

  return { sellerUid, companyName, companyLogo };
}

function distinctIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function readExistingThread(data: Record<string, unknown>, conversationId: string) {
  const sellerUid = nonEmptyId(data.sellerUid);
  const clientUid = nonEmptyId(data.clientUid);
  const participants = Array.isArray(data.participants)
    ? data.participants.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (!sellerUid || !clientUid) {
    throw new MessagingRoutingError(
      "INVALID_EXISTING",
      "Conversation existante incomplète. Elle doit être corrigée par la migration, pas réécrite ici.",
    );
  }
  return { id: conversationId, sellerUid, clientUid, participants };
}

function participantsMatch(actual: string[], expected: string[]): boolean {
  if (actual.length !== expected.length) return false;
  return expected.every((id) => actual.includes(id));
}

/**
 * Ancien fil sans conversationKind : ajoute uniquement ce champ
 * si le destinataire déjà enregistré est valide. Ne change ni sellerUid ni participants.
 * Retourne false si le fil ne peut pas être réparé (l’envoi du message continue).
 */
export async function repairMissingConversationKind(input: {
  conversationId: string;
  viewerUid: string;
}): Promise<boolean> {
  const conversationId = nonEmptyId(input.conversationId);
  const viewerUid = nonEmptyId(input.viewerUid);
  if (!conversationId || !viewerUid) return false;

  const ref = doc(db, "conversations", conversationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const data = snap.data() as Record<string, unknown>;
  if (nonEmptyId(data.conversationKind)) return false;

  const sellerUid = nonEmptyId(data.sellerUid);
  const clientUid = nonEmptyId(data.clientUid);
  const companyId = nonEmptyId(data.companyId);
  const participants = Array.isArray(data.participants)
    ? data.participants.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (!sellerUid || !clientUid || !participants.includes(viewerUid)) return false;
  if (viewerUid !== clientUid && viewerUid !== sellerUid) return false;

  let kind: ConversationKind | null = null;
  if (sellerUid === SUPPORT_INBOX_UID && clientUid !== SUPPORT_INBOX_UID && !companyId) {
    const expected = buildKindParticipants("customer_to_support", { clientUid });
    if (!participantsMatch(participants, expected)) return false;
    kind = "customer_to_support";
  } else if (companyId) {
    const companySnap = await getDoc(doc(db, "companies", companyId));
    if (!companySnap.exists()) return false;
    const accountSnap = await getDoc(doc(db, "users", companyId));
    const companyIdIsAccount =
      accountSnap.exists() && isVerifiedShopAccount(accountSnap.data()?.role);
    let owner: string;
    try {
      owner = pickStoreOwnerUid({
        companyCandidates: companyOwnerCandidates(
          companySnap.data() as Record<string, unknown>,
          { companyId, companyIdIsAccount },
        ),
        shopAccountUid: companyIdIsAccount ? companyId : null,
      });
    } catch {
      return false;
    }
    if (owner !== sellerUid) return false;
    const expected = buildKindParticipants("customer_to_store", { clientUid, sellerUid });
    if (!participantsMatch(participants, expected)) return false;
    kind = "customer_to_store";
  } else {
    return false;
  }

  await updateDoc(ref, { conversationKind: kind });
  return true;
}

/** Crée le document seulement s’il n’existe pas. Jamais de merge qui réécrit le routage. */
async function createConversationIfMissing(
  conversationId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const ref = doc(db, "conversations", conversationId);
  const snap = await getDoc(ref);
  if (snap.exists()) return false;
  await setDoc(ref, payload);
  return true;
}

/**
 * Crée le document conversation boutique s’il n’existe pas.
 * Un fil déjà présent n’est pas réécrit (pas de changement de sellerUid / participants).
 */
export async function bootstrapStoreConversation(
  input: StoreBootstrapInput,
): Promise<{ id: string; sellerUid: string; clientUid: string; participants: string[] }> {
  const companyId = nonEmptyId(input.companyId);
  const viewerUid = nonEmptyId(input.viewerUid);
  if (!companyId || !viewerUid) {
    throw new MessagingRoutingError(
      "INVALID_BOOTSTRAP",
      "companyId et utilisateur connecté sont obligatoires.",
    );
  }

  const existingSnap = await getDoc(doc(db, "conversations", input.conversationId));
  if (existingSnap.exists()) {
    return readExistingThread(
      existingSnap.data() as Record<string, unknown>,
      input.conversationId,
    );
  }

  const { sellerUid, companyName, companyLogo } = await resolveStoreOwnerUid({
    companyId,
    productSellerUid: input.productSellerUid,
    debug: input.debug,
  });

  const suffix = input.conversationId.startsWith(`${companyId}_`)
    ? input.conversationId.slice(companyId.length + 1)
    : null;
  const clientUid =
    nonEmptyId(input.clientUid) ||
    (suffix && suffix !== sellerUid && suffix !== companyId ? suffix : null) ||
    (viewerUid !== sellerUid ? viewerUid : null);

  if (!clientUid) {
    throw new MessagingRoutingError(
      "MISSING_CLIENT",
      "Impossible d’identifier le client de cette discussion.",
    );
  }

  const participants = distinctIds(
    buildKindParticipants("customer_to_store", { clientUid, sellerUid }),
  );
  if (!participants.includes(viewerUid)) {
    throw new MessagingRoutingError(
      "VIEWER_NOT_PARTICIPANT",
      "Seul le client ou le propriétaire de la boutique peut ouvrir ce fil.",
    );
  }

  const title = nonEmptyId(input.companyName) || companyName || "Boutique";
  const logo = nonEmptyId(input.companyLogo) || companyLogo || "";
  const clientName = nonEmptyId(input.clientName) || "Client";
  const clientAvatar = nonEmptyId(input.clientAvatar) || "";

  await createConversationIfMissing(input.conversationId, {
    id: input.conversationId,
    conversationKind: "customer_to_store" as ConversationKind,
    type: "seller",
    companyId,
    companyName: title,
    companyLogo: logo,
    title,
    sellerUid,
    clientUid,
    clientName,
    clientAvatar,
    participants,
    participantNames: {
      [sellerUid]: title,
      [clientUid]: clientName,
    },
    participantAvatars: {
      [sellerUid]: logo,
      [clientUid]: clientAvatar,
    },
    createdBy: viewerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: input.conversationId, sellerUid, clientUid, participants };
}

export async function bootstrapSupportConversation(input: {
  clientUid: string;
  clientName?: string | null;
}): Promise<string> {
  const clientUid = nonEmptyId(input.clientUid);
  if (!clientUid) {
    throw new MessagingRoutingError("MISSING_CLIENT", "clientUid manquant.");
  }
  const conversationId = `support_${clientUid}`;
  const existingSnap = await getDoc(doc(db, "conversations", conversationId));
  if (existingSnap.exists()) return conversationId;

  const participants = distinctIds(
    buildKindParticipants("customer_to_support", { clientUid }),
  );
  const clientName = nonEmptyId(input.clientName) || "Client";
  await createConversationIfMissing(conversationId, {
    id: conversationId,
    conversationKind: "customer_to_support" as ConversationKind,
    type: "support",
    title: "Support A2Express",
    sellerUid: SUPPORT_INBOX_UID,
    clientUid,
    participants,
    participantNames: {
      [SUPPORT_INBOX_UID]: "Support A2Express",
      [clientUid]: clientName,
    },
    createdBy: clientUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return conversationId;
}

/**
 * Fil vendeur → client (photo de colis, suivi). Même propriétaire boutique
 * que customer_to_store. Ne réécrit pas un fil déjà ouvert.
 */
export async function bootstrapSellerToCustomerConversation(input: {
  conversationId: string;
  companyId: string;
  viewerUid: string;
  clientUid: string;
  clientName?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
}): Promise<{ id: string; sellerUid: string; clientUid: string; participants: string[] }> {
  const companyId = nonEmptyId(input.companyId);
  const viewerUid = nonEmptyId(input.viewerUid);
  const clientUid = nonEmptyId(input.clientUid);
  if (!companyId || !viewerUid || !clientUid) {
    throw new MessagingRoutingError(
      "INVALID_BOOTSTRAP",
      "companyId, client et utilisateur connecté sont obligatoires.",
    );
  }

  const existingSnap = await getDoc(doc(db, "conversations", input.conversationId));
  if (existingSnap.exists()) {
    return readExistingThread(
      existingSnap.data() as Record<string, unknown>,
      input.conversationId,
    );
  }

  const resolved = await resolveStoreOwnerUid({ companyId });
  const sellerUid = resolved.sellerUid;
  const participants = distinctIds(
    buildKindParticipants("seller_to_customer", { clientUid, sellerUid }),
  );
  if (!participants.includes(viewerUid)) {
    throw new MessagingRoutingError(
      "VIEWER_NOT_PARTICIPANT",
      "Seul le client ou le propriétaire de la boutique peut ouvrir ce fil.",
    );
  }

  const title = nonEmptyId(input.companyName) || resolved.companyName || "Boutique";
  const logo = nonEmptyId(input.companyLogo) || resolved.companyLogo || "";
  const clientName = nonEmptyId(input.clientName) || "Client";

  await createConversationIfMissing(input.conversationId, {
    id: input.conversationId,
    conversationKind: "seller_to_customer" as ConversationKind,
    type: "seller",
    companyId,
    companyName: title,
    companyLogo: logo,
    title,
    sellerUid,
    clientUid,
    clientName,
    participants,
    participantNames: {
      [sellerUid]: title,
      [clientUid]: clientName,
    },
    participantAvatars: {
      [sellerUid]: logo,
    },
    createdBy: viewerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: input.conversationId, sellerUid, clientUid, participants };
}
