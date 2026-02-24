// src/services/TrackingService.ts
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface TrackingUpdate {
  timestamp: Date;
  status: string;
  location: string;
  description: string;
}

export interface PackageTracking {
  trackingNumber: string;
  carrier: string;
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed';
  estimatedDelivery: Date;
  currentLocation: string;
  updates: TrackingUpdate[];
}

class TrackingService {
  async trackPackage(trackingNumber: string): Promise<PackageTracking> {
    // Intégration avec des API de transporteurs
    // Exemple avec des API fictives
    
    const mockTracking: PackageTracking = {
      trackingNumber,
      carrier: 'DHL',
      status: 'in_transit',
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      currentLocation: 'Paris, France',
      updates: [
        {
          timestamp: new Date(),
          status: 'in_transit',
          location: 'Paris',
          description: 'Votre colis est en transit vers le centre de distribution'
        }
      ]
    };

    return mockTracking;
  }

  subscribeToTracking(trackingNumber: string, callback: (tracking: PackageTracking) => void) {
    const unsubscribe = onSnapshot(
      doc(db, 'tracking', trackingNumber),
      (doc) => {
        if (doc.exists()) {
          callback(doc.data() as PackageTracking);
        }
      }
    );

    return unsubscribe;
  }

  async sendTrackingUpdate(conversationId: string, trackingNumber: string) {
    const tracking = await this.trackPackage(trackingNumber);
    
    // Envoyer un message dans la conversation avec les infos de suivi
    const trackingMessage = {
      type: 'tracking',
      trackingNumber: tracking.trackingNumber,
      status: tracking.status,
      estimatedDelivery: tracking.estimatedDelivery,
      currentLocation: tracking.currentLocation
    };

    return trackingMessage;
  }
}

export const trackingService = new TrackingService();
