// simple-fix.js
const fs = require('fs');
const path = require('path');

console.log('🔧 Simple fix for known errors\n');

// 1. Fix LanguageSelectorModal.tsx
const modalPath = path.join(__dirname, 'apps/mobile/src/components/language/LanguageSelectorModal.tsx');
if (fs.existsSync(modalPath)) {
  let content = fs.readFileSync(modalPath, 'utf8');
  
  // Correction: déplacer useTranslation hors des paramètres
  const wrongPattern = /export default function LanguageSelectorModal\(\{\s*\n\s*const \{ t \} = useTranslation\(\);/;
  
  if (wrongPattern.test(content)) {
    content = content.replace(
      wrongPattern,
      `export default function LanguageSelectorModal({\n  visible,`
    );
    
    // Ajouter le hook après l'accolade ouvrante
    content = content.replace(
      /(: LanguageSelectorModalProps\) \{\s*)/,
      `$1\n  const { t } = useTranslation();\n`
    );
    
    fs.writeFileSync(modalPath, content, 'utf8');
    console.log('✅ Fixed LanguageSelectorModal.tsx');
  } else {
    console.log('✓ LanguageSelectorModal.tsx looks ok');
  }
} else {
  console.log('⚠️ LanguageSelectorModal.tsx not found');
}

// 2. Fix messages.tsx
const messagesPath = path.join(__dirname, 'apps/mobile/app/(tabs)/messages.tsx');
if (fs.existsSync(messagesPath)) {
  let content = fs.readFileSync(messagesPath, 'utf8');
  
  // Correction: apostrophes dans t()
  const apostropheError = /t\('en_train_d_ecrire', 'en train d'écrire\.\.\.'\)/;
  
  if (apostropheError.test(content)) {
    content = content.replace(
      apostropheError,
      `t('en_train_d_ecrire', \`en train d'écrire...\`)`
    );
    
    fs.writeFileSync(messagesPath, content, 'utf8');
    console.log('✅ Fixed messages.tsx');
  } else {
    console.log('✓ messages.tsx looks ok');
  }
} else {
  console.log('⚠️ messages.tsx not found');
}

console.log('\n🎉 Fixes applied!');