const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.updateFullAddress = functions.firestore
  .document("companies/{companyId}")
  .onWrite(async (change, context) => {
    const data = change.after.exists ? change.after.data() : null;
    if (!data) return; // suppression → rien à faire

    const addr = data.address;
    if (
      addr &&
      addr.street &&
      addr.city &&
      addr.country &&
      !addr.fullAddress
    ) {
      const fullAddress = `${addr.street}, ${addr.city}, ${addr.country}`;
      await change.after.ref.update({
        "address.fullAddress": fullAddress
      });
      console.log(`✅ fullAddress généré pour ${context.params.companyId}`);
    }
  });