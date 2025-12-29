// apps/mobile/src/services/companyDetectionService.js
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export class CompanyDetectionService {
  
  static async detectCompanyForAdmin(adminId, specifiedCompanyId = null) {
    try {
      console.log('🔍 Détection compagnie pour admin:', adminId);
      
      if (specifiedCompanyId) {
        const companyDoc = await getDoc(doc(db, 'companies', specifiedCompanyId));
        if (companyDoc.exists()) {
          const company = companyDoc.data();
          return {
            companyId: companyDoc.id,
            companyName: company.name,
            companyLogo: company.logo,
            companyData: company
          };
        }
      }
      
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      const companies = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      return { companies, needsSelection: true };
      
    } catch (error) {
      console.error('❌ Erreur détection compagnie admin:', error);
      throw new Error('Impossible de charger les compagnies');
    }
  }

  static async detectCompanyForSupplier(supplierId) {
    try {
      console.log('🔍 Détection compagnie pour fournisseur:', supplierId);
      
      const companiesQuery = query(
        collection(db, 'companies'), 
        where('uid', '==', supplierId)
      );
      
      const querySnapshot = await getDocs(companiesQuery);
      
      if (!querySnapshot.empty) {
        const companyDoc = querySnapshot.docs[0];
        const company = companyDoc.data();
        
        return {
          companyId: companyDoc.id,
          companyName: company.name,
          companyLogo: company.logo,
          companyData: company
        };
      }
      
      return {
        companyId: supplierId,
        companyName: 'Mon Entreprise',
        companyLogo: 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO',
        companyData: null
      };
      
    } catch (error) {
      console.error('❌ Erreur détection compagnie fournisseur:', error);
      return {
        companyId: supplierId,
        companyName: 'Mon Entreprise',
        companyLogo: 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO',
        companyData: null
      };
    }
  }

  static async getCompanyDetails(companyId) {
    try {
      if (!companyId || companyId === 'default-company') {
        return null;
      }

      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (companyDoc.exists()) {
        return { id: companyDoc.id, ...companyDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération détails compagnie:', error);
      return null;
    }
  }
}
