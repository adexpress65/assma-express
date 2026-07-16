const fs = require('fs');
const path = require('path');

const targetDirs = [
  'apps/mobile/src',
  'apps/mobile/app',
];

function rollbackFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // <Text>{t('key', 'texte')}</Text> => <Text>texte</Text>
  content = content.replace(
    /<Text>\s*\{\s*t\(\s*'[^']+'\s*,\s*'([^']+)'\s*\)\s*\}\s*<\/Text>/g,
    '<Text>$1</Text>'
  );

  // placeholder={t('key', 'texte')} => placeholder="texte"
  content = content.replace(
    /placeholder=\{\s*t\(\s*'[^']+'\s*,\s*'([^']+)'\s*\)\s*\}/g,
    'placeholder="$1"'
  );

  // title={t('key', 'texte')} => title="texte"
  content = content.replace(
    /title=\{\s*t\(\s*'[^']+'\s*,\s*'([^']+)'\s*\)\s*\}/g,
    'title="$1"'
  );

  // Supprimer useTranslation import
  content = content.replace(
    /import\s+\{\s*useTranslation\s*\}\s+from\s+['"]react-i18next['"];\n?/g,
    ''
  );

  // Supprimer const { t } = useTranslation();
  content = content.replace(
    /\s*const\s+\{\s*t\s*\}\s*=\s*useTranslation\(\);\s*/g,
    '\n'
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`↩️ Reverted: ${filePath}`);
  }
}

function scan(dir) {
  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach(item => {
    const full = path.join(dir, item);
    if (item.includes('node_modules') || item.startsWith('.')) return;

    const stat = fs.statSync(full);
    if (stat.isDirectory()) scan(full);
    else if (/\.(tsx|jsx|ts)$/.test(full)) rollbackFile(full);
  });
}

targetDirs.forEach(scan);
console.log('\n✅ ROLLBACK TERMINÉ');
