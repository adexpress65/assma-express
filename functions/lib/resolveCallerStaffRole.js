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
exports.resolveCallerStaffRole = void 0;
const admin = __importStar(require("firebase-admin"));
function normalizeStaffRole(raw) {
    const value = String(raw ?? "")
        .trim()
        .toLowerCase();
    if (value === "super-admin" ||
        value === "super_admin" ||
        value === "superadmin" ||
        value === "super admin") {
        return "super-admin";
    }
    if (value === "admin") {
        return "admin";
    }
    return null;
}
async function resolveCallerStaffRole(authUid, tokenRole) {
    const fromClaim = normalizeStaffRole(tokenRole);
    if (fromClaim) {
        return fromClaim;
    }
    const callerDoc = await admin
        .firestore()
        .collection("users")
        .doc(authUid)
        .get();
    if (!callerDoc.exists) {
        return null;
    }
    return normalizeStaffRole(callerDoc.data()?.role);
}
exports.resolveCallerStaffRole = resolveCallerStaffRole;
//# sourceMappingURL=resolveCallerStaffRole.js.map