# Messagerie A2Express

## Règle de routage

Toute création / récupération de conversation passe par
`apps/mobile/src/services/conversationRouting.ts`.

| Type | Destinataire | Participants |
|---|---|---|
| `customer_to_store` | owner boutique (`product.sellerUid` puis `ownerUid` / `ownerId` / `sellerUid` / `uid`, en ignorant l’UID support) | `[clientUid, sellerUid]` |
| `customer_to_support` | `SUPPORT_INBOX_UID` uniquement | `[clientUid, SUPPORT_INBOX_UID]` |
| `seller_to_customer` | client | `[clientUid, sellerUid]` |

Interdit : fallback silencieux vers le super-admin, `arrayUnion` du viewer s’il n’est ni client ni vendeur, coller `companyId` dans `participants`.

Si le propriétaire boutique est introuvable → erreur UI, pas d’écriture.

## Vues

- Client : `participants` / `clientUid`
- Vendeur : `participants` / `sellerUid`
- Super-admin : fils `customer_to_support` uniquement

## Tests

```
cd apps/mobile
npm run test:critical
```

Cas couverts : client→boutique pas chez le super-admin ; client→support chez le super-admin ; owner manquant = erreur.

## Migration (dry-run d’abord)

```
cd scripts
npx tsx migrate-conversation-routing.ts
npx tsx migrate-conversation-routing.ts --execute
```

Sauvegarde : branches `backup/messagerie-avant-audit` (app) et `backup/monorepo-messagerie-avant-audit`.
