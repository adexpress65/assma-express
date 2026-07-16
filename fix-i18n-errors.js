// fix-i18n-errors.js - VERSION CORRIGÉE
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing i18n syntax errors...\n');

// Liste des fichiers connus avec erreurs
const filesToFix = [
  'apps/mobile/src/components/language/LanguageSelectorModal.tsx',
  'apps/mobile/app/(tabs)/messages.tsx'
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const original = content;
    let changesMade = false;
    
    console.log(`\n📄 Processing: ${filePath}`);
    
    // CORRECTION 1: Déplacer useTranslation() hors des paramètres
    // Recherche: const { t } = useTranslation() dans les paramètres de fonction
    const paramPattern = /function\s+\w+\s*\([\s\S]*?{\s*$/;
    const match = content.match(paramPattern);
    
    if (match) {
      // Vérifier si le hook est dans les paramètres
      const lines = content.split('\n');
      let inParams = false;
      let foundHookInParams = false;
      let hookLineIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('function') && line.includes('({')) {
          inParams = true;
        }
        
        if (inParams && line.includes('const { t } = useTranslation()')) {
          foundHookInParams = true;
          hookLineIndex = i;
          console.log(`  ❌ Found hook in parameters at line ${i + 1}`);
        }
        
        if (inParams && line.includes('}:') && line.includes(')')) {
          inParams = false;
        }
      }
      
      if (foundHookInParams && hookLineIndex !== -1) {
        // Déplacer le hook après l'accolade ouvrante de la fonction
        for (let i = hookLineIndex + 1; i < lines.length; i++) {
          if (lines[i].includes('{')) {
            // Déplacer la ligne du hook ici
            const hookLine = lines[hookLineIndex];
            lines[hookLineIndex] = ''; // Supprimer de l'ancienne position
            
            // Insérer après l'accolade
            lines[i] = lines[i] + '\n' + hookLine;
            console.log(`  ✅ Moved hook to function body`);
            changesMade = true;
            break;
          }
        }
        
        content = lines.join('\n');
      }
    }
    
    // CORRECTION 2: Apostrophes mal échappées dans t()
    // Chercher: t('key', 'texte avec 'apostrophe' dedans')
    const apostrophePattern = /t\(['"]([^'"]*)['"]\s*,\s*'([^']*)'([^']*)'([^']*)'/g;
    const apostropheMatches = [...content.matchAll(apostrophePattern)];
    
    if (apostropheMatches.length > 0) {
      console.log(`  Found ${apostropheMatches.length} apostrophe errors`);
      
      apostropheMatches.forEach((match, index) => {
        const fullMatch = match[0];
        const key = match[1];
        const part1 = match[2];
        const part2 = match[3];
        const part3 = match[4];
        
        // Reconstruire avec backticks
        const fullText = part1 + "'" + part2 + part3;
        const replacement = `t('${key}', \`${fullText}\`)`;
        
        content = content.replace(fullMatch, replacement);
        console.log(`  ✅ Fixed apostrophe error ${index + 1}`);
        changesMade = true;
      });
    }
    
    // Écrire le fichier si des modifications ont été faites
    if (changesMade) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`  💾 File saved`);
    } else {
      console.log(`  ✓ No errors found`);
    }
    
  } catch (error) {
    console.log(`❌ Error fixing ${filePath}:`, error.message);
  }
});

console.log('\n🎉 Fix complete!');
console.log('\n📋 To find other potential issues, run these commands:');
console.log('1. Find hooks in wrong place:');
console.log('   grep -n "const { t } = useTranslation()" apps/mobile/src/components/language/LanguageSelectorModal.tsx');
console.log('');
console.log('2. Find apostrophe errors:');
console.log('   find apps/mobile -name "*.tsx" -exec grep -l "t([^)]*'\''[^)]*)" {} \\;');