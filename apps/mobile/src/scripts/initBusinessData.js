// scripts/initBusinessData.js
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../src/config/firebase';

const initCompanies = async () => {
  const companies = [
    {
      name: 'Assma Express',
      logo: '🛒',
      category: 'Marketplace',
      status: 'online',
      verified: true,
      chatEnabled: true,
      responseTime: '2 min',
      rating: 4.8,
      businessHours: {
        open: '08:00',
        close: '22:00',
        timezone: 'GMT+1'
      }
    },
    {
      name: 'TechStore Maroc',
      logo: '💻',
      category: 'Électronique',
      status: 'online',
      verified: true,
      chatEnabled: true,
      responseTime: '5 min',
      rating: 4.5,
      businessHours: {
        open: '09:00',
        close: '20:00',
        timezone: 'GMT+1'
      }
    },
    {
      name: 'Livraison Express',
      logo: '🚚',
      category: 'Logistique',
      status: 'away',
      verified: true,
      chatEnabled: true,
      responseTime: '15 min',
      rating: 4.2,
      businessHours: {
        open: '06:00',
        close: '00:00',
        timezone: 'GMT+1'
      }
    }
  ];

  for (const company of companies) {
    const docRef = await addDoc(collection(db, 'companies'), company);
    console.log(`✅ Company added: ${company.name} (${docRef.id})`);
  }
};

const initSupportAgents = async () => {
  const agents = [
    {
      name: 'Support Assma',
      email: 'support@assma.com',
      role: 'support_agent',
      status: 'online',
      assignedTickets: 0,
      maxTickets: 10,
      skills: ['technical', 'billing', 'delivery'],
      languages: ['fr', 'ar', 'en']
    }
  ];

  for (const agent of agents) {
    const docRef = await addDoc(collection(db, 'supportAgents'), agent);
    console.log(`✅ Agent added: ${agent.name} (${docRef.id})`);
  }
};

export const initializeBusinessData = async () => {
  try {
    await initCompanies();
    await initSupportAgents();
    console.log('✅ Business data initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing business data:', error);
  }
};