/**
 * Identité affichable / provider Auth — comptes e-mail, sociaux ou téléphone.
 */

export function hasUsableEmail(email?: string | null): boolean {
  return typeof email === 'string' && email.trim().includes('@');
}

export function mapFirebaseAuthProvider(
  providerId?: string | null,
  explicit?: string | null,
): string | undefined {
  const raw = String(explicit || providerId || '')
    .trim()
    .toLowerCase();
  if (!raw) return undefined;
  if (raw === 'google.com' || raw === 'google') return 'google';
  if (raw === 'facebook.com' || raw === 'facebook') return 'facebook';
  if (raw === 'apple.com' || raw === 'apple') return 'apple';
  if (raw === 'phone') return 'phone';
  if (raw === 'password') return 'password';
  return raw;
}

export function isSocialAuthProvider(
  provider?: string | null,
): provider is 'google' | 'facebook' | 'apple' {
  return provider === 'google' || provider === 'facebook' || provider === 'apple';
}

type ProviderUser = {
  email?: string | null;
  phoneNumber?: string | null;
  providerData?: Array<{ providerId?: string }> | null;
};

type ProviderProfile = {
  email?: string | null;
  providerId?: string | null;
};

/** Compte dont le provider principal est le téléphone (pas de mot de passe e-mail). */
export function isPhoneAuthUser(
  user?: ProviderUser | null,
  profile?: ProviderProfile | null,
): boolean {
  const providers = user?.providerData?.map((p) => p.providerId) ?? [];
  const hasPhone =
    providers.includes('phone') ||
    mapFirebaseAuthProvider(profile?.providerId) === 'phone';
  if (!hasPhone) return false;
  const hasPassword = providers.includes('password');
  if (hasPassword) return false;
  if (hasUsableEmail(user?.email) || hasUsableEmail(profile?.email)) return false;
  return true;
}

/** Nom vide, « Utilisateur », ou le numéro lui-même (placeholder). */
export function isPlaceholderDisplayName(
  value?: string | null,
  phone?: string | null,
): boolean {
  const n = String(value || '').trim();
  if (!n) return true;
  if (/^utilisateur$/i.test(n)) return true;
  const phoneRaw = String(phone || '').trim();
  if (phoneRaw && (n === phoneRaw || n === phoneRaw.replace(/^\+/, ''))) return true;
  const nDigits = n.replace(/\D/g, '');
  const pDigits = phoneRaw.replace(/\D/g, '');
  if (pDigits.length >= 8 && nDigits === pDigits) return true;
  if (/^\+\d{8,15}$/.test(n)) return true;
  return false;
}

export function profileNeedsDisplayName(
  profile: { displayName?: string | null; name?: string | null },
  phone?: string | null,
): boolean {
  const name = String(profile.name || '').trim();
  const display = String(profile.displayName || '').trim();
  const usable = name || display;
  if (!usable) return true;
  return isPlaceholderDisplayName(usable, phone);
}

export function getUserDisplayLabel(
  input: {
    displayName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
  },
  fallback = 'Utilisateur',
): string {
  const name = input.displayName?.trim();
  if (name) return name;
  if (hasUsableEmail(input.email)) {
    return String(input.email).trim().split('@')[0];
  }
  const phone = input.phoneNumber?.trim();
  if (phone) return phone;
  return fallback;
}

export function getUserContactLabel(input: {
  email?: string | null;
  phoneNumber?: string | null;
}): string {
  if (hasUsableEmail(input.email)) return String(input.email).trim();
  const phone = input.phoneNumber?.trim();
  if (phone) return phone;
  return 'Utilisateur';
}
