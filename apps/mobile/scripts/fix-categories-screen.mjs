import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "src", "screens", "CategoriesScreen.tsx");

let s = fs.readFileSync(filePath, "utf8");

const re = /const normalizeCategoryName = \(name: string\): string => \{[\s\S]*?^\};/m;

const replacement = `/**
 * Clé de dédoublonnage (minuscules, sans accents).
 * On ne regroupe plus par mots-clés (électronique / maison / jardin).
 */
const categoryDedupKey = (name: string): string => {
  const clean = fixEncoding(name).trim();
  if (!clean) return "";
  return clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};`;

if (!re.test(s)) {
  console.error("Pattern normalizeCategoryName not found");
  process.exit(1);
}

s = s.replace(re, replacement);

s = s.replace(
  /if \(typeof c\.productCount === "number" && c\.productCount === 0\) return false;\s*\n/g,
  ""
);

fs.writeFileSync(filePath, s);
console.log("Updated", filePath);
