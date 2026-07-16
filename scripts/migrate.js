const admin = require('firebase-admin');

const serviceAccount = require('../assma-expresse-firebase-adminsdk-fbsvc-b87148844b.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


// ----------------------
// CONFIG VARIANTS PAR DEFAUT
// ----------------------

const DEFAULT_SIZES = ["39","40","41","42","43"];
const DEFAULT_COLORS = ["Noir","Gris","Bleu"];


// ----------------------
// GENERATE VARIANTS (size x color)
// ----------------------

function generateVariants(product, sizes, colors) {
  const variants = [];

  for (const color of colors) {
    for (const size of sizes) {
      variants.push({
        id: `${color}-${size}`.toLowerCase(),
        color,
        size,
        price: product.price || 0,
        stock: Math.floor((product.stockQuantity || 100) / (sizes.length * colors.length)),
        sku: `${product.slug || product.id}-${color}-${size}`.toUpperCase(),
        image: product.mainImage || product.imageUrl || "",
        createdAt: new Date()
      });
    }
  }

  return variants;
}


// ----------------------
// MIGRATE PRODUCTS
// ----------------------

async function migrateProducts() {

  console.log("=== MIGRATION VARIANTS PRODUCTS ===");

  const snapshot = await db.collection('products').get();
  console.log("Produits trouvés:", snapshot.size);

  let batch = db.batch();
  let count = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip si deja migré
    if (data.hasVariants === true && Array.isArray(data.variants)) {
      continue;
    }

    const sizes = data.sizes && data.sizes.length ? data.sizes : DEFAULT_SIZES;
    const colors = data.colors && data.colors.length ? data.colors : DEFAULT_COLORS;

    const variants = generateVariants(data, sizes, colors);

    const updates = {
      hasVariants: true,

      variantAttributes: [
        { name: "Color", values: colors },
        { name: "Size", values: sizes }
      ],

      variants,
      updatedAt: new Date()
    };

    batch.update(doc.ref, updates);

    count++;
    updated++;

    if (count === 500) {
      await batch.commit();
      console.log("Batch 500 commit...");
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log("=== MIGRATION TERMINEE ===");
  console.log("Produits migrés:", updated);
}



// ----------------------
// RUN
// ----------------------

async function run() {
  try {
    await migrateProducts();
    console.log("SUCCESS MIGRATION");
    process.exit(0);
  } catch (error) {
    console.error("ERREUR MIGRATION:", error);
    process.exit(1);
  }
}

run();
