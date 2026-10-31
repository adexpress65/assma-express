/** Indicatifs pays pour la connexion SMS (défaut Mali). */

export type PhoneCountry = {
  iso: string;
  name: string;
  dial: string;
  minLocal: number;
  maxLocal: number;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'ML', name: 'Mali', dial: '223', minLocal: 8, maxLocal: 8 },
  { iso: 'SN', name: 'Sénégal', dial: '221', minLocal: 9, maxLocal: 9 },
  { iso: 'CI', name: "Côte d'Ivoire", dial: '225', minLocal: 8, maxLocal: 10 },
  { iso: 'BF', name: 'Burkina Faso', dial: '226', minLocal: 8, maxLocal: 8 },
  { iso: 'GN', name: 'Guinée', dial: '224', minLocal: 8, maxLocal: 9 },
  { iso: 'NE', name: 'Niger', dial: '227', minLocal: 8, maxLocal: 8 },
  { iso: 'TG', name: 'Togo', dial: '228', minLocal: 8, maxLocal: 8 },
  { iso: 'BJ', name: 'Bénin', dial: '229', minLocal: 8, maxLocal: 8 },
  { iso: 'GH', name: 'Ghana', dial: '233', minLocal: 9, maxLocal: 9 },
  { iso: 'FR', name: 'France', dial: '33', minLocal: 9, maxLocal: 9 },
];

export const DEFAULT_PHONE_COUNTRY =
  PHONE_COUNTRIES.find((c) => c.iso === 'ML') ?? PHONE_COUNTRIES[0];

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Normalise un numéro local + indicatif vers E.164 (`+223xxxxxxxx`). */
export function toE164(dial: string, localInput: string): string {
  const dialDigits = digitsOnly(dial);
  let local = digitsOnly(localInput);

  if (local.startsWith('00')) {
    local = local.slice(2);
  }
  if (local.startsWith(dialDigits)) {
    return `+${local}`;
  }
  local = local.replace(/^0+/, '');
  return `+${dialDigits}${local}`;
}

export function isValidE164(e164: string, country?: PhoneCountry): boolean {
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return false;
  if (!country) return true;
  const local = e164.slice(1 + country.dial.length);
  return local.length >= country.minLocal && local.length <= country.maxLocal;
}

export function formatE164ForDisplay(e164: string): string {
  if (!e164.startsWith('+')) return e164;
  return e164.replace(/(\+\d{2,3})(\d+)/, '$1 $2');
}
