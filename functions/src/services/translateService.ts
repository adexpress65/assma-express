/**
 * Google Cloud Translation API v2 (REST).
 * @see https://cloud.google.com/translate/docs/reference/rest/v2/translate
 */

const TARGET_TO_API: Record<string, string> = {
  en: "en",
  ar: "ar",
  zh: "zh-CN",
};

export function apiTargetForLocale(locale: string): string {
  const k = locale.trim().toLowerCase().split(/[-_]/)[0] || "en";
  return TARGET_TO_API[k] ?? k;
}

export async function translateText(
  text: string,
  source: string,
  target: string,
  apiKey: string,
): Promise<string> {
  const t = text.trim();
  if (!t) return "";
  const src = source.trim().toLowerCase().split(/[-_]/)[0] || "fr";
  const tgt = apiTargetForLocale(target);
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: t,
      source: src,
      target: tgt,
      format: "text",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Translation ${src}->${tgt}: HTTP ${res.status} ${err}`);
  }
  const json = (await res.json()) as {
    data?: { translations?: { translatedText: string }[] };
  };
  return (json.data?.translations?.[0]?.translatedText ?? "").trim();
}
