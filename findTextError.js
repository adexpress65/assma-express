#!/usr/bin/env node
/**
 * findTextError.js
 * Analyse ton code React Native pour trouver les retours de texte non encapsulés.
 * Commande : node findTextError.js
 */

import fs from "fs";
import path from "path";

const rootDir = path.resolve("./app"); // Dossier à scanner
const fileExtensions = [".tsx", ".jsx"];

function walk(dir, callback) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, callback);
    else if (fileExtensions.some((ext) => entry.name.endsWith(ext))) callback(fullPath);
  });
}

function analyzeFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Ignore commentaires et chaînes valides
    if (/^\s*\/\//.test(trimmed) || trimmed.startsWith("*") || trimmed.startsWith("import")) return;

    // Cas suspects : return "texte" ou > texte <
    if (
      /return\s+['"`].+['"`];?/.test(trimmed) ||
      />\s*[A-Za-zÀ-ÿ0-9!?,;:. ]+\s*</.test(trimmed)
    ) {
      console.log(`\n⚠️  ${filePath}:${index + 1}`);
      console.log(`   ${trimmed}`);
    }
  });
}

console.log("🔍 Analyse en cours...");
walk(rootDir, analyzeFile);
console.log("\n✅ Scan terminé !");
