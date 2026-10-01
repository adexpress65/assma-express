"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupUserRoleSnapshot = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const resolveCallerStaffRole_1 = require("./resolveCallerStaffRole");
function normalizeRole(raw) {
    const value = String(raw ?? "")
        .trim()
        .toLowerCase();
    if (value === "super-admin" ||
        value === "super_admin" ||
        value === "superadmin" ||
        value === "super admin") {
        return "super-admin";
    }
    if (value === "admin" || value === "seller" || value === "customer") {
        return value;
    }
    return null;
}
exports.lookupUserRoleSnapshot = (0, https_1.onCall)({
    region: "europe-west1",
    cors: true,
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise");
    }
    const callerStaffRole = await (0, resolveCallerStaffRole_1.resolveCallerStaffRole)(request.auth.uid, request.auth.token.role);
    if (!callerStaffRole) {
        throw new https_1.HttpsError("permission-denied", "Action réservée aux comptes admin / super-admin");
    }
    const targetUid = String(request.data?.uid || "").trim();
    if (!targetUid) {
        throw new https_1.HttpsError("invalid-argument", "uid cible requis");
    }
    let authUser;
    try {
        authUser = await admin.auth().getUser(targetUid);
    }
    catch {
        throw new https_1.HttpsError("not-found", "Utilisateur Auth introuvable");
    }
    const claimRole = normalizeRole(authUser.customClaims?.role);
    const userDoc = await admin.firestore().collection("users").doc(targetUid).get();
    const firestoreRole = userDoc.exists
        ? normalizeRole(userDoc.data()?.role)
        : null;
    return {
        ok: true,
        uid: targetUid,
        email: authUser.email || "",
        claimRole,
        firestoreRole,
        isDesynced: claimRole !== null &&
            firestoreRole !== null &&
            claimRole !== firestoreRole,
    };
});
//# sourceMappingURL=lookupUserRoleSnapshot.js.map