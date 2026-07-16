// fix-categories-error.js
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing CategoriesScreen syntax error...\n');

const filePath = path.join(__dirname, 'apps/mobile/src/screens/CategoriesScreen.tsx');

if (!fs.existsSync(filePath)) {
  console.log('❌ File not found:', filePath);
  process.exit(1);
}

try {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log('🔍 Looking for the error at line 441...');
  
  // Corriger la ligne 441 (index 440 en 0-based)
  if (lines[440]) {
    console.log('BEFORE:', lines[440]);
    
    // Correction: t(recuperation_de_tous_les_produits`), 'text') → t('recuperation_de_tous_les_produits', 'text')
    lines[440] = lines[440].replace(
      /t\(recuperation_de_tous_les_produits`\),\s*'([^']+)'\)/,
      `t('recuperation_de_tous_les_produits', '$1')`
    );
    
    // Alternative: avec backticks
    lines[440] = lines[440].replace(
      /t\(recuperation_de_tous_les_produits`\),\s*`([^`]+)`\)/,
      `t('recuperation_de_tous_les_produits', \`$1\`)`
    );
    
    console.log('AFTER:', lines[440]);
  }
  
  // Vérifier aussi d'autres erreurs similaires
  lines.forEach((line, index) => {
    if (line.includes('t(') && !line.includes("t('") && !line.includes('t("')) {
      // Erreur: t(sans_guillemets, ...)
      const fixed = line.replace(
        /t\(([a-z_]+),\s*(['"`][^'"`]+['"`])\)/g,
        "t('$1', $2)"
      );
      
      if (fixed !== line) {
        console.log(`🔧 Fixed line ${index + 1}:`);
        console.log('  BEFORE:', line);
        console.log('  AFTER:', fixed);
        lines[index] = fixed;
      }
    }
  });
  
  const newContent = lines.join('\n');
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('\n✅ CategoriesScreen.tsx fixed successfully!');
  } else {
    console.log('\n✓ No errors found in CategoriesScreen.tsx');
  }
  
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\n🚀 Now restart your app: cd apps/mobile && npm start -- --reset-cache');