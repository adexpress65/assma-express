const fs = require('fs');
const path = require('path');

const ROOT = 'apps/mobile';

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Corrige Alert.alert(`)Texte', 'Texte')
  content = content.replace(
    /Alert\.alert\(\s*`\)\s*([^']+)'\s*,\s*'([^']+)'\s*\)/g,
    "Alert.alert('$1', '$2')"
  );

  // Supprime backticks orphelins dans Alert.alert
  content = content.replace(
    /Alert\.alert\(\s*`([^`]*)'\s*,/g,
    "Alert.alert('$1',"
  );

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`🛠️ Fixed Alert: ${file}`);
  }
}

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f === 'node_modules' || f.startsWith('.')) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) scan(full);
    else if (/\.(ts|tsx|jsx)$/.test(full)) fix(full);
  }
}

scan(ROOT);
console.log('\n✅ Alert.alert cleanup done');
