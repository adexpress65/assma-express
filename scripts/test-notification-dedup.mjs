/**
 * Aligné avec functions/src/notifications.ts
 * (newProductIdempotencyKey + uniqueExpoPushTokens).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";

function newProductIdempotencyKey(productId) {
  return `new_product:${String(productId || "").trim()}`;
}

function uniqueExpoPushTokens(rawTokens) {
  const out = new Set();
  for (const candidate of rawTokens) {
    if (typeof candidate !== "string") continue;
    const token = candidate.trim();
    if (!token) continue;
    if (!token.startsWith("ExponentPushToken[")) continue;
    out.add(token);
  }
  return [...out];
}

test("clé d’idempotence unique par produit", () => {
  assert.equal(newProductIdempotencyKey("abc"), "new_product:abc");
  assert.equal(newProductIdempotencyKey(" abc "), "new_product:abc");
});

test("un même jeton présent 4 fois n’est envoyé qu’une fois", () => {
  const token = "ExponentPushToken[aaaa]";
  const unique = uniqueExpoPushTokens([token, token, ` ${token} `, token]);
  assert.deepEqual(unique, [token]);
});

test("jetons distincts : un envoi par device, pas par compte dupliqué", () => {
  const a = "ExponentPushToken[aaa]";
  const b = "ExponentPushToken[bbb]";
  assert.deepEqual(uniqueExpoPushTokens([a, b, a]), [a, b]);
});
