// apps/mobile/src/utils/specialChars.ts

/**
 * Utilitaire pour les caractères spéciaux français
 * Résout les problèmes d'encodage dans React Native
 */

export const specialChars = {
  // Accents aigus
  eAcute: '\u00E9', // é
  eAcuteUpper: '\u00C9', // É
  aAcute: '\u00E1', // á
  iAcute: '\u00ED', // í
  oAcute: '\u00F3', // ó
  uAcute: '\u00FA', // ú
  
  // Accents graves
  eGrave: '\u00E8', // è
  aGrave: '\u00E0', // à
  uGrave: '\u00F9', // ù
  iGrave: '\u00EC', // ì
  oGrave: '\u00F2', // ò
  
  // Accents circonflexes
  eCircumflex: '\u00EA', // ê
  aCircumflex: '\u00E2', // â
  iCircumflex: '\u00EE', // î
  oCircumflex: '\u00F4', // ô
  uCircumflex: '\u00FB', // û
  
  // Trémas
  eDiaeresis: '\u00EB', // ë
  iDiaeresis: '\u00EF', // ï
  uDiaeresis: '\u00FC', // ü
  
  // Cédille
  cCedilla: '\u00E7', // ç
  cCedillaUpper: '\u00C7', // Ç
  
  // Symboles
  euro: '\u20AC', // €
  copyright: '\u00A9', // ©
  trademark: '\u2122', // ™
  bullet: '\u2022', // •
  
  // Ponctuation
  leftQuote: '\u00AB', // «
  rightQuote: '\u00BB', // »
  emDash: '\u2014', // —
  enDash: '\u2013', // –
};

// Helper functions pour les mots courants
export const frenchWords = {
  // Articles et prépositions
  de: 'd' + specialChars.eAcute,
  a: specialChars.aGrave,
  la: 'l' + specialChars.aGrave,
  ou: 'o' + specialChars.uGrave,
  
  // Mots courants
  hotel: 'h' + specialChars.oCircumflex + 'tel',
  deja: 'd' + specialChars.eAcute + 'j' + specialChars.aGrave,
  voila: 'voil' + specialChars.aGrave,
  eleve: specialChars.eAcute + 'l' + specialChars.eAcute + 've',
  ete: specialChars.eAcute + 't' + specialChars.eAcute,
  mere: 'm' + specialChars.eGrave + 're',
  pere: 'p' + specialChars.eGrave + 're',
  frere: 'fr' + specialChars.eGrave + 're',
  
  // E-commerce
  categorie: 'cat' + specialChars.eAcute + 'gorie',
  produit: 'produit',
  produits: 'produits',
  vendeur: 'vendeur', 
  vendeurs: 'vendeurs',
  client: 'client',
  clients: 'clients',
  commande: 'commande',
  commandes: 'commandes',
  livraison: 'livraison',
  paiement: 'paiement',
  parametres: 'param' + specialChars.eAcute + 'tres',
  administrateur: 'administrateur',
  superAdmin: 'super-admin',
  
  // Messages
  connexion: 'connexion',
  deconnexion: 'd' + specialChars.eAcute + 'connexion',
  inscription: 'inscription',
  bienvenue: 'bienvenue',
  accueil: 'accueil',
  
  // Actions
  ajouter: 'ajouter',
  modifier: 'modifier',
  supprimer: 'supprimer',
  rechercher: 'rechercher',
  filtrer: 'filtrer',
};

// Fonction utilitaire pour formater du texte
export const formatText = (text: string): string => {
  const replacements: { [key: string]: string } = {
    // Accents aigus
    'e´': specialChars.eAcute,
    'E´': specialChars.eAcuteUpper,
    'a´': specialChars.aAcute,
    'i´': specialChars.iAcute,
    'o´': specialChars.oAcute,
    'u´': specialChars.uAcute,
    
    // Accents graves  
    'e`': specialChars.eGrave,
    'a`': specialChars.aGrave,
    'u`': specialChars.uGrave,
    'i`': specialChars.iGrave,
    'o`': specialChars.oGrave,
    
    // Accents circonflexes
    'e^': specialChars.eCircumflex,
    'a^': specialChars.aCircumflex, 
    'i^': specialChars.iCircumflex,
    'o^': specialChars.oCircumflex,
    'u^': specialChars.uCircumflex,
    
    // Trémas
    'e"': specialChars.eDiaeresis,
    'i"': specialChars.iDiaeresis,
    'u"': specialChars.uDiaeresis,
    
    // Cédille
    'c,': specialChars.cCedilla,
    'C,': specialChars.cCedillaUpper,
    
    // Raccourcis courants
    'deja': frenchWords.deja,
    'a': frenchWords.a,
    'categorie': frenchWords.categorie,
  };
  
  let formatted = text;
  Object.keys(replacements).forEach(key => {
    formatted = formatted.replace(new RegExp(key, 'g'), replacements[key]);
  });
  
  return formatted;
};

// Export par défaut pour une utilisation facile
export default {
  chars: specialChars,
  words: frenchWords,
  format: formatText,
};