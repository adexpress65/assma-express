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
exports.setUserRole = void 0;
const admin = __importStar(require("firebase-admin"));
const core_1 = require("firebase-functions/v2/core");
const https_1 = require("firebase-functions/v2/https");
const resolveCallerStaffRole_1 = require("./resolveCallerStaffRole");
(0, core_1.onInit)(() => {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
});
const ASSIGNABLE_ROLES = ["super-admin", "admin", "seller", "customer"];
function normalizeCallerRole(raw) {
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
function isAssignableRole(value) {
    return ASSIGNABLE_ROLES.includes(value);
}
exports.setUserRole = (0, https_1.onCall)({
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
    const requestedRole = String(request.data?.role || "")
        .trim()
        .toLowerCase();
    const role = normalizeCallerRole(requestedRole);
    if (!targetUid) {
        throw new https_1.HttpsError("invalid-argument", "uid cible requis");
    }
    if (!role || !isAssignableRole(role)) {
        throw new https_1.HttpsError("invalid-argument", "role invalide (super-admin | admin | seller | customer)");
    }
    if (role === "super-admin" && callerStaffRole !== "super-admin") {
        throw new https_1.HttpsError("permission-denied", "Seul un super-admin peut attribuer le rôle super-admin");
    }
    let target;
    try {
        target = await admin.auth().getUser(targetUid);
    }
    catch {
        throw new https_1.HttpsError("not-found", "Utilisateur Auth introuvable");
    }
    const nextClaims = { ...(target.customClaims || {}), role };
    await admin.auth().setCustomUserClaims(targetUid, nextClaims);
    await admin.firestore().collection("users").doc(targetUid).set({
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
        ok: true,
        uid: targetUid,
        role,
        note: "Le client cible doit appeler getIdToken(true) (ou se reconnecter) pour voir le nouveau claim.",
    };
});
//# sourceMappingURL=setUserRole.js.map