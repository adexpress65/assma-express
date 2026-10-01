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
  arrayUnion,
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
 * Ordre : sellerId produit/route d’abord, puis ownerUid/ownerId/sellerUid/uid
 * de la société. Tout UID égal au support est ignoré. Aucun fallback admin.
 */
export function pickStoreOwnerUid(input: {
  productSellerUid?: string | null;
  companyCandidates: string[];
  supportInboxUid?: string | null;
}): string {
  const blocked = new Set<string>();
  const support = nonEmptyId(input.supportInboxUid ?? SUPPORT_INBOX_UID);
  if (support) blocked.add(support);

  const ordered: string[] = [];
  const productSeller = nonEmptyId(input.productSellerUid);
  if (productSeller) ordered.push(productSeller);
  for (const id of input.companyCandidates) {
    const clean = nonEmptyId(id);
    if (clean) ordered.push(clean);
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ordered) {
    if (blocked.has(id) || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  if (unique.length === 0) {
    throw new MessagingRoutingError(
      "STORE_OWNER_UNRESOLVED",
      "Impossible de déterminer le propriétaire de la boutique. Le message n’a pas été envoyé au support.",
    );
  }
  return unique[0];
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

/**
 * Crée ou fusionne le document conversation boutique.
 * N’ajoute le viewer aux participants que s’il est client ou vendeur.
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

  const participants = buildKindParticipants("customer_to_store", {
    clientUid,
    sellerUid,
  });

  const title =
    nonEmptyId(input.companyName) || companyName || "Boutique";
  const logo = nonEmptyId(input.companyLogo) || companyLogo || "";
  const viewerIsClient = viewerUid === clientUid;
  const viewerIsSeller = viewerUid === sellerUid;

  const payload: Record<string, unknown> = {
    id: input.conversationId,
    conversationKind: "customer_to_store" as ConversationKind,
    type: "seller",
    companyId,
    companyName: title,
    companyLogo: logo,
    title,
    sellerUid,
    clientUid,
    participants: arrayUnion(...participants),
    [`participantNames.${sellerUid}`]: title,
    [`participantNames.${companyId}`]: title,
    [`participantAvatars.${sellerUid}`]: logo,
    [`participantAvatars.${companyId}`]: logo,
    updatedAt: serverTimestamp(),
  };

  if (viewerIsClient) {
    const clientName = nonEmptyId(input.clientName) || "Client";
    const clientAvatar = nonEmptyId(input.clientAvatar) || "";
    payload.createdBy = viewerUid;
    payload.clientName = clientName;
    payload.clientAvatar = clientAvatar;
    payload[`participantNames.${clientUid}`] = clientName;
    payload[`participantAvatars.${clientUid}`] = clientAvatar;
  } else if (!viewerIsSeller) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[messagerie] viewer ignoré (ni client ni vendeur)",
        { viewerUid, clientUid, sellerUid },
      );
    }
  }

  await setDoc(doc(db, "conversations", input.conversationId), payload, {
    merge: true,
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
  const participants = buildKindParticipants("customer_to_support", { clientUid });
  await setDoc(
    doc(db, "conversations", conversationId),
    {
      id: conversationId,
      conversationKind: "customer_to_support" as ConversationKind,
      type: "support",
      title: "Support A2Express",
      sellerUid: SUPPORT_INBOX_UID,
      clientUid,
      participants: arrayUnion(...participants),
      [`participantNames.${SUPPORT_INBOX_UID}`]: "Support A2Express",
      [`participantNames.${clientUid}`]: nonEmptyId(input.clientName) || "Client",
      createdBy: clientUid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return conversationId;
}
