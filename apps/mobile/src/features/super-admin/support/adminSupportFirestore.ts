import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";

export type SupportTicketRow = {
  id: string;
  status: string;
  subject: string;
  preview: string;
  userEmail?: string;
  createdAt: Date | null;
  raw: Record<string, unknown>;
};

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const ts = v as Timestamp;
  if (typeof ts?.toDate === "function") {
    try {
      return ts.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function pickSubject(data: Record<string, unknown>): string {
  return String(
    data.subject ??
      data.title ??
      data.topic ??
      data.category ??
      data.type ??
      "Ticket support",
  ).trim();
}

function pickPreview(data: Record<string, unknown>): string {
  const m = String(data.message ?? data.body ?? data.description ?? "").trim();
  if (m) return m.length > 120 ? `${m.slice(0, 117)}…` : m;
  return "—";
}

function pickEmail(data: Record<string, unknown>): string | undefined {
  const e = String(data.userEmail ?? data.email ?? data.contactEmail ?? "").trim();
  return e || undefined;
}

/**
 * Tickets `supportTickets` (Firestore). Sans index `createdAt`, retombe sur un scan limité.
 */
export async function fetchSupportTickets(max = 50): Promise<SupportTicketRow[]> {
  const col = collection(db, "supportTickets");
  let snap;
  try {
    snap = await getDocs(query(col, orderBy("createdAt", "desc"), limit(max)));
  } catch {
    snap = await getDocs(query(col, limit(max)));
  }

  const rows: SupportTicketRow[] = [];
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    rows.push({
      id: d.id,
      status: String(data.status ?? "open").toLowerCase(),
      subject: pickSubject(data),
      preview: pickPreview(data),
      userEmail: pickEmail(data),
      createdAt: toDate(data.createdAt ?? data.updatedAt),
      raw: data,
    });
  });

  rows.sort((a, b) => {
    const ta = a.createdAt?.getTime() ?? 0;
    const tb = b.createdAt?.getTime() ?? 0;
    return tb - ta;
  });

  return rows.slice(0, max);
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: string,
): Promise<void> {
  await updateDoc(doc(db, "supportTickets", ticketId), {
    status,
    updatedAt: serverTimestamp(),
  });
}
