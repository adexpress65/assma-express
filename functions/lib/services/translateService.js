"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateText = exports.apiTargetForLocale = void 0;
const TARGET_TO_API = {
    en: "en",
    ar: "ar",
    zh: "zh-CN",
};
function apiTargetForLocale(locale) {
    const k = locale.trim().toLowerCase().split(/[-_]/)[0] || "en";
    return TARGET_TO_API[k] ?? k;
}
exports.apiTargetForLocale = apiTargetForLocale;
async function translateText(text, source, target, apiKey) {
    const t = text.trim();
    if (!t)
        return "";
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
    const json = (await res.json());
    return (json.data?.translations?.[0]?.translatedText ?? "").trim();
}
exports.translateText = translateText;
//# sourceMappingURL=translateService.js.map