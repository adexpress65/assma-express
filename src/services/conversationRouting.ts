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

export function companyOwnerCandidates(
  data: Record<string, unknown> | null | undefined,
): string[] {
  if (!data) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of ["ownerUid", "ownerId", "sellerUid", "uid"] as const) {
    const id = nonEmptyId(data[key]);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Propriétaires société (ownerUid, ownerId, sellerUid, uid), hors support.
 * Le sellerId produit n’est retenu que s’il fait partie de ces propriétaires :
 * un UID arbitraire, y compris le super-admin, n’est jamais destinataire.
 */
export function pickStoreOwnerUid(input: {
  productSellerUid?: string | null;
  companyCandidates: string[];
  supportInboxUid?: string | null;
}): string {
  const blocked = new Set<string>();
  const support = nonEmptyId(input.supportInboxUid ?? SUPPORT_INBOX_UID);
  if (support) blocked.add(support);

  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const id of input.companyCandidates) {
    const clean = nonEmptyId(id);
    if (!clean || blocked.has(clean) || seen.has(clean)) continue;
    seen.add(clean);
    candidates.push(clean);
  }

  const productSeller = nonEmptyId(input.productSellerUid);
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
  if (sellerUid === SUPPORT_INBOX_UID) {
    throw new MessagingRoutingError(
      "STAFF_AS_STORE_OWNER",
      "Le destinataire boutique ne peut pas être le compte support.",
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

  const sellerUid = pickStoreOwnerUid({
    productSellerUid: input.productSellerUid,
    companyCandidates: companyOwnerCandidates(companyData),
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
      candidates: companyOwnerCandidates(companyData),
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
