// apps/mobile/fix-encoding.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Mapping des caractères mal encodés
const CHAR_MAPPINGS = {
  // Accents français courants
  'Ã©': 'é',
  'Ã¨': 'è',
  'Ãª': 'ê',
  'Ã§': 'ç',
  'Ã ': 'à',  // Note: espace après Ã
  'Ã ': 'à',  // avec accent grave
  'Ã¢': 'â',
  'Ã®': 'î',
  'Ã´': 'ô',
  'Ã¹': 'ù',
  'Ã»': 'û',
  'Ã«': 'ë',
  'Ã¯': 'ï',
  'Ã¼': 'ü',
  'Ã¿': 'ÿ',
  
  // Caractères spéciaux
  'Â°': '°',
  'Â«': '«',
  'Â»': '»',
  'Â£': '£',
  'Â€': '€',
  'Â¢': '¢',
  
  // Guillemets et apostrophes
  'â€œ': '"',
  'â€�': '"',
  'â€™': "'",
  'â€˜': "'",
  'â€”': '—',
  'â€“': '–',
  'â€¦': '…',
  
  // Caractères UTF-8 mal décodés
  'Ã‰': 'É',
  'Ã€': 'À',
  'Ã‡': 'Ç',
  'ÃŽ': 'Î',
  'Ã•': 'Ô',
  'Ã›': 'Û',
  
  // Supprimer les caractères invalides
  '\ufffd': '', // �
  '\u0000': '', // Null character
};

// Extensions de fichiers à traiter
const TARGET_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.json', '.md', '.txt'];

function fixEncoding(content) {
  let fixedContent = content;
  
  // Appliquer les remplacements
  Object.entries(CHAR_MAPPINGS).forEach(([bad, good]) => {
    const regex = new RegExp(bad, 'g');
    fixedContent = fixedContent.replace(regex, good);
  });
  
  // Nettoyer les séquences UTF-8 mal formées
  fixedContent = fixedContent
    .replace(/[^\x00-\x7F]+/g, match => {
      // Essayer de corriger les séquences UTF-8 multi-octets
      try {
        return Buffer.from(match, 'latin1').toString('utf8');
      } catch {
        return match;
      }
    })
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Contrôles ASCII
  
  return fixedContent;
}

function processFile(filePath) {
  try {
    // Lire le fichier en latin1 (ISO-8859-1) d'abord
    let content = fs.readFileSync(filePath, { encoding: 'latin1' });
    const originalContent = content;
    
    // Appliquer les corrections
    content = fixEncoding(content);
    
    // Si des corrections ont été faites
    if (content !== originalContent) {
      // Sauvegarder une copie de backup
      const backupPath = `${filePath}.backup-${Date.now()}`;
      fs.writeFileSync(backupPath, originalContent, { encoding: 'latin1' });
      console.log(`  ↳ Backup créé: ${backupPath}`);
      
      // Écrire le fichier corrigé en UTF-8
      fs.writeFileSync(filePath, content, { encoding: 'utf8' });
      
      // Compter les différences
      const diffCount = [...content].reduce((count, char, i) => 
        count + (char !== originalContent[i] ? 1 : 0), 0);
      
      return {
        success: true,
        file: filePath,
        changes: diffCount,
        backup: backupPath
      };
    }
    
    return { success: true, file: filePath, changes: 0 };
    
  } catch (error) {
    return {
      success: false,
      file: filePath,
      error: error.message
    };
  }
}

function scanDirectory(dirPath, options = {}) {
  const {
    dryRun = false,
    verbose = false,
    recursive = true
  } = options;
  
  const results = {
    totalFiles: 0,
    processed: 0,
    changed: 0,
    errors: 0,
    details: []
  };
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Ignorer node_modules et autres dossiers système
          if (recursive && !['node_modules', '.git', '.next', '.expo', 'build', 'dist'].includes(item)) {
            if (verbose) console.log(`📁 Scanning: ${fullPath}`);
            const subResults = scanDirectory(fullPath, options);
            
            results.totalFiles += subResults.totalFiles;
            results.processed += subResults.processed;
            results.changed += subResults.changed;
            results.errors += subResults.errors;
            results.details.push(...subResults.details);
          }
        } else {
          // Vérifier l'extension
          const ext = path.extname(item).toLowerCase();
          
          if (TARGET_EXTENSIONS.includes(ext)) {
            results.totalFiles++;
            
            if (dryRun) {
              // Mode simulation - juste détecter
              try {
                const content = fs.readFileSync(fullPath, { encoding: 'latin1' });
                const fixed = fixEncoding(content);
                
                if (content !== fixed) {
                  results.changed++;
                  results.details.push({
                    file: fullPath,
                    action: 'would fix',
                    changes: 'detected'
                  });
                  
                  if (verbose) {
                    console.log(`⚠️  ${fullPath}`);
                    console.log('   Problèmes détectés');
                  }
                }
              } catch (error) {
                results.errors++;
              }
              
            } else {
              // Mode réel - corriger
              const result = processFile(fullPath);
              results.processed++;
              
              if (result.success) {
                if (result.changes > 0) {
                  results.changed++;
                  console.log(`✅ ${fullPath} (${result.changes} corrections)`);
                } else if (verbose) {
                  console.log(`✓ ${fullPath} (OK)`);
                }
                results.details.push({
                  file: fullPath,
                  action: result.changes > 0 ? 'fixed' : 'ok',
                  changes: result.changes
                });
              } else {
                results.errors++;
                console.error(`❌ ${fullPath}: ${result.error}`);
                results.details.push({
                  file: fullPath,
                  action: 'error',
                  error: result.error
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error accessing ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dirPath}:`, error.message);
  }
  
  return results;
}

function printSummary(results, dryRun = false) {
  console.log('\n' + '='.repeat(50));
  console.log('RÉSULTATS DE LA CORRECTION D\'ENCODAGE');
  console.log('='.repeat(50));
  console.log(`Fichiers trouvés: ${results.totalFiles}`);
  console.log(`Fichiers traités: ${results.processed}`);
  console.log(`Fichiers ${dryRun ? 'à corriger' : 'corrigés'}: ${results.changed}`);
  console.log(`Erreurs: ${results.errors}`);
  
  if (results.changed > 0 && !dryRun) {
    console.log('\n⚠️  IMPORTANT: Des sauvegardes ont été créées avec l\'extension .backup-*');
    console.log('   Vous pouvez les supprimer une fois que tout fonctionne:');
    console.log('   find . -name "*.backup-*" -delete');
  }
  
  if (results.changed === 0 && results.errors === 0) {
    console.log('\n🎉 Tous les fichiers sont déjà en UTF-8 correct !');
  }
}

async function main() {
  console.log('🛠️  Correcteur d\'encodage UTF-8');
  console.log('='.repeat(50));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Demander le mode
  const question = (query) => new Promise(resolve => rl.question(query, resolve));
  
  console.log('\nOptions disponibles:');
  console.log('1. Simulation (détecter seulement)');
  console.log('2. Correction (avec backup)');
  console.log('3. Vérifier un fichier spécifique');
  
  const choice = await question('\nChoisissez une option (1-3): ');
  
  if (choice === '3') {
    const filePath = await question('Chemin du fichier: ');
    if (fs.existsSync(filePath)) {
      console.log(`\nAnalyse de ${filePath}:`);
      const result = processFile(filePath);
      if (result.success) {
        console.log(result.changes > 0 
          ? `✅ ${result.changes} corrections appliquées`
          : '✓ Fichier déjà correct');
      } else {
        console.error(`❌ Erreur: ${result.error}`);
      }
    } else {
      console.error('❌ Fichier non trouvé');
    }
    rl.close();
    return;
  }
  
  const dryRun = choice === '1';
  
  if (dryRun) {
    console.log('\n🔍 Mode simulation - aucun fichier ne sera modifié');
  } else {
    console.log('\n⚡ Mode correction - les fichiers seront modifiés');
    console.log('   Des backups seront créés avant modification');
  }
  
  const startDir = process.cwd();
  console.log(`\nScanning: ${startDir}`);
  
  const results = scanDirectory(startDir, {
    dryRun,
    verbose: false,
    recursive: true
  });
  
  printSummary(results, dryRun);
  
  if (dryRun && results.changed > 0) {
    console.log('\nPour appliquer les corrections, relancez avec l\'option 2');
  }
  
  rl.close();
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixEncoding, processFile, scanDirectory };