import { Linking, Platform } from "react-native";

export function sanitizePhoneForTel(phone: string): string {
  return String(phone || "").replace(/[^\d+]/g, "");
}

export function openPhoneDialer(phone: string): void {
  const n = sanitizePhoneForTel(phone);
  if (!n) return;
  void Linking.openURL(`tel:${n}`);
}

/**
 * Ouvre l’app SMS avec un corps prérempli (comportement iOS / Android).
 */
export function openSmsComposer(phone: string, body: string): void {
  const n = sanitizePhoneForTel(phone);
  if (!n) return;
  const encoded = encodeURIComponent(body);
  const url =
    Platform.OS === "ios"
      ? `sms:${n}&body=${encoded}`
      : `sms:${n}?body=${encoded}`;
  void Linking.openURL(url);
}
