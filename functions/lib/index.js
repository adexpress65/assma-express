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
exports.updateExchangeRates = exports.lookupUserRoleSnapshot = exports.setUserRole = exports.visualImageSearch = exports.conversationModeration = exports.onProductTranslate = exports.onCompanyUpdated = exports.onCompanyDeleted = exports.onProductWrite = exports.onNewChatMessagePush = exports.askAsmaAI = void 0;
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
var aiSearch_1 = require("./aiSearch");
Object.defineProperty(exports, "askAsmaAI", { enumerable: true, get: function () { return aiSearch_1.aiSearch; } });
var onNewChatMessagePush_1 = require("./onNewChatMessagePush");
Object.defineProperty(exports, "onNewChatMessagePush", { enumerable: true, get: function () { return onNewChatMessagePush_1.onNewChatMessagePush; } });
var onProductWrite_1 = require("./onProductWrite");
Object.defineProperty(exports, "onProductWrite", { enumerable: true, get: function () { return onProductWrite_1.onProductWrite; } });
var onCompanyChange_1 = require("./onCompanyChange");
Object.defineProperty(exports, "onCompanyDeleted", { enumerable: true, get: function () { return onCompanyChange_1.onCompanyDeleted; } });
Object.defineProperty(exports, "onCompanyUpdated", { enumerable: true, get: function () { return onCompanyChange_1.onCompanyUpdated; } });
var onProductTranslate_1 = require("./onProductTranslate");
Object.defineProperty(exports, "onProductTranslate", { enumerable: true, get: function () { return onProductTranslate_1.onProductTranslate; } });
var conversationModeration_1 = require("./conversationModeration");
Object.defineProperty(exports, "conversationModeration", { enumerable: true, get: function () { return conversationModeration_1.conversationModeration; } });
var visualImageSearch_1 = require("./visualImageSearch");
Object.defineProperty(exports, "visualImageSearch", { enumerable: true, get: function () { return visualImageSearch_1.visualImageSearch; } });
var setUserRole_1 = require("./setUserRole");
Object.defineProperty(exports, "setUserRole", { enumerable: true, get: function () { return setUserRole_1.setUserRole; } });
var lookupUserRoleSnapshot_1 = require("./lookupUserRoleSnapshot");
Object.defineProperty(exports, "lookupUserRoleSnapshot", { enumerable: true, get: function () { return lookupUserRoleSnapshot_1.lookupUserRoleSnapshot; } });
var updateExchangeRates_1 = require("./updateExchangeRates");
Object.defineProperty(exports, "updateExchangeRates", { enumerable: true, get: function () { return updateExchangeRates_1.updateExchangeRates; } });
//# sourceMappingURL=index.js.map