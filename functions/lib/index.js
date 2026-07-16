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
exports.visualImageSearch = exports.conversationModeration = exports.onProductTranslate = exports.onProductWrite = exports.onNewChatMessagePush = exports.askAsmaAI = void 0;
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
var onProductTranslate_1 = require("./onProductTranslate");
Object.defineProperty(exports, "onProductTranslate", { enumerable: true, get: function () { return onProductTranslate_1.onProductTranslate; } });
var conversationModeration_1 = require("./conversationModeration");
Object.defineProperty(exports, "conversationModeration", { enumerable: true, get: function () { return conversationModeration_1.conversationModeration; } });
var visualImageSearch_1 = require("./visualImageSearch");
Object.defineProperty(exports, "visualImageSearch", { enumerable: true, get: function () { return visualImageSearch_1.visualImageSearch; } });
//# sourceMappingURL=index.js.map