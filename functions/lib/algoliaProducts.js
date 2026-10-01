"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProductIdsFromAlgolia = exports.shouldRemoveProductFromAlgolia = exports.createAlgoliaProductsIndex = exports.ALGOLIA_INDEX_NAME = exports.ALGOLIA_ADMIN_KEY = exports.ALGOLIA_APP_ID = void 0;
exports.ALGOLIA_APP_ID = "ZYRHOXK3WR";
exports.ALGOLIA_ADMIN_KEY = "db3194e274569db32e5938952f5a3ffd";
exports.ALGOLIA_INDEX_NAME = "products";
const DELETE_CHUNK = 1000;
function createAlgoliaProductsIndex(algoliasearchFn) {
    const client = algoliasearchFn(exports.ALGOLIA_APP_ID, exports.ALGOLIA_ADMIN_KEY);
    return client.initIndex(exports.ALGOLIA_INDEX_NAME);
}
exports.createAlgoliaProductsIndex = createAlgoliaProductsIndex;
function shouldRemoveProductFromAlgolia(data) {
    return data?.isActive === false;
}
exports.shouldRemoveProductFromAlgolia = shouldRemoveProductFromAlgolia;
async function deleteProductIdsFromAlgolia(index, productIds) {
    const ids = [
        ...new Set(productIds.filter((id) => typeof id === "string" && id.length > 0)),
    ];
    for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
        const chunk = ids.slice(i, i + DELETE_CHUNK);
        if (chunk.length === 1) {
            await index.deleteObject(chunk[0]);
        }
        else {
            await index.deleteObjects(chunk);
        }
    }
}
exports.deleteProductIdsFromAlgolia = deleteProductIdsFromAlgolia;
//# sourceMappingURL=algoliaProducts.js.map