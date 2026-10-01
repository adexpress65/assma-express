// 📁 apps/mobile/src/services/order.service.ts
import { db } from '@/config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

export class OrderService {
  
  // ============ CRÉATION DE COMMANDE ============
  
  static async createOrder(userId: string, orderData: any): Promise<{success: boolean, orderId?: string, error?: string}> {
    try {
      console.log('📦 Création commande...');
      
      const orderRef = doc(collection(db, 'orders'));
      const orderId = orderRef.id;
      
      // Préparer les données de la commande
      const order = {
        id: orderId,
        userId: userId,
        orderNumber: `CMD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        status: 'pending_payment',
        items: orderData.items || [],
        subtotalFCFA: orderData.subtotal || 0,
        shippingFCFA: orderData.shipping || 0,
        taxFCFA: orderData.tax || 0,
        totalFCFA: orderData.total || 0,
        totalUSD: PaymentService.convertToUSD(orderData.total || 0),
        shippingMethod: orderData.shippingMethod || orderData.shipping?.method || 'vol_express',
        shippingMethodName:
          orderData.shippingMethodName || orderData.shipping?.option?.name || '',
        shippingMethodDelay:
          orderData.shippingMethodDelay ||
          orderData.shippingEstimatedDays ||
          orderData.shipping?.option?.deliveryTime ||
          '',
        shippingEstimatedDays:
          orderData.shippingEstimatedDays ||
          orderData.shippingMethodDelay ||
          orderData.shipping?.option?.deliveryTime ||
          '',
        shippingMethodType: orderData.shippingMethodType || orderData.shipping?.option?.type || '',
        shippingDetails: orderData.shippingDetails || orderData.shipping || {},
        billingAddress: orderData.billingAddress || {},
        shippingAddress: orderData.shippingAddress || {},
        customerNotes: orderData.customerNotes || '',
        wholesale: orderData.wholesale || {
          isWholesale: false,
          savings: 0,
          totalQuantity: 0
        },
        metadata: orderData.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Sauvegarder la commande
      await setDoc(orderRef, order);
      console.log(`✅ Commande créée: ${orderId}`);
      
      return {
        success: true,
        orderId: orderId
      };
      
    } catch (error: any) {
      console.error('❌ Erreur création commande:', error.message);
      return {
        success: false,
        error: error.message || 'Erreur lors de la création de la commande'
      };
    }
  }
  
  // ============ RÉCUPÉRATION DES COMMANDES ============
  
  static async getOrder(orderId: string): Promise<any> {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const snapshot = await getDoc(orderRef);
      
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() };
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération commande:', error);
      return null;
    }
  }
  
  static async getUserOrders(userId: string, limitCount: number = 20): Promise<any[]> {
    try {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
      // Fallback si index manquant
      if (error.code === 'failed-precondition') {
        return this.getUserOrdersSimple(userId, limitCount);
      }
      console.error('❌ Erreur récupération commandes:', error);
      return [];
    }
  }
  
  private static async getUserOrdersSimple(userId: string, limitCount: number): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(db, 'orders'));
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const userOrders = allOrders
        .filter(order => order.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limitCount);
      
      return userOrders;
    } catch (error) {
      console.error('❌ Erreur fallback commandes:', error);
      return [];
    }
  }
  
  // ============ MISE À JOUR DU STATUT ============
  
  static async updateOrderStatus(orderId: string, status: string, notes?: string): Promise<boolean> {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const updateData: any = {
        status: status,
        updatedAt: new Date()
      };
      
      if (notes) {
        updateData.statusNotes = notes;
      }
      
      // Statuts spéciaux
      if (status === 'paid') {
        updateData.paidAt = new Date();
      } else if (status === 'shipped') {
        updateData.shippedAt = new Date();
      } else if (status === 'delivered') {
        updateData.deliveredAt = new Date();
      } else if (status === 'cancelled') {
        updateData.cancelledAt = new Date();
      }
      
      await setDoc(orderRef, updateData, { merge: true });
      console.log(`✅ Statut commande ${orderId} mis à jour: ${status}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      return false;
    }
  }
  
  // ============ PROCESSUS COMPLET COMMANDE + PAIEMENT ============
  
  static async processOrderAndPayment(userId: string, orderData: any, paymentMethod: string): Promise<{success: boolean, orderId?: string, transactionId?: string, error?: string}> {
    try {
      console.log('🔄 Processus commande + paiement...');
      
      // 1. Créer la commande
      const orderResult = await this.createOrder(userId, orderData);
      if (!orderResult.success) {
        return {
          success: false,
          error: orderResult.error
        };
      }
      
      const orderId = orderResult.orderId!;
      
      // 2. Traiter le paiement
      const paymentResult = await PaymentService.processPayment(userId, {
        amount: orderData.total,
        paymentMethodType: paymentMethod,
        description: `Paiement commande ${orderId}`,
        orderId: orderId,
        metadata: {
          orderNumber: orderResult.orderId,
          itemsCount: orderData.items?.length || 0
        }
      });
      
      if (!paymentResult.success) {
        // Annuler la commande si paiement échoue
        await this.updateOrderStatus(orderId, 'cancelled', 'Paiement échoué');
        return {
          success: false,
          error: paymentResult.error
        };
      }
      
      // 3. Mettre à jour le statut de la commande
      await this.updateOrderStatus(orderId, 'paid');
      
      console.log('✅ Commande et paiement traités avec succès');
      return {
        success: true,
        orderId: orderId,
        transactionId: paymentResult.transactionId
      };
      
    } catch (error: any) {
      console.error('❌ Erreur processus complet:', error.message);
      return {
        success: false,
        error: error.message || 'Erreur lors du traitement'
      };
    }
  }
  
  // ============ STATISTIQUES ============
  
  static async getUserOrderStats(userId: string): Promise<any> {
    try {
      const orders = await this.getUserOrders(userId, 100); // Limite à 100 commandes pour les stats
      
      const totalOrders = orders.length;
      const totalSpentFCFA = orders.reduce((sum, order) => sum + (order.totalFCFA || 0), 0);
      const totalSpentUSD = PaymentService.convertToUSD(totalSpentFCFA);
      
      const statusCounts = {
        pending: orders.filter(o => o.status === 'pending').length,
        paid: orders.filter(o => o.status === 'paid').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length
      };
      
      return {
        totalOrders,
        totalSpentFCFA,
        totalSpentUSD,
        averageOrderValueFCFA: totalOrders > 0 ? totalSpentFCFA / totalOrders : 0,
        statusCounts
      };
    } catch (error) {
      console.error('❌ Erreur statistiques:', error);
      return {
        totalOrders: 0,
        totalSpentFCFA: 0,
        totalSpentUSD: 0,
        averageOrderValueFCFA: 0,
        statusCounts: {}
      };
    }
  }
  
  // ============ GÉNÉRATION DE NUMÉRO DE SUIVI ============
  
  static generateTrackingNumber(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let tracking = 'TRK-';
    for (let i = 0; i < 10; i++) {
      tracking += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return tracking;
  }
}