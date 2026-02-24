// src/config/env.ts
import { Platform } from 'react-native';

type EnvConfig = {
  apiBaseUrl: string;
  realtimeUrl: string;
};

function getBaseUrl(): string {
  const fromProcess = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromProcess) return fromProcess;

  if (__DEV__) {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  return 'https://api.assmaexpress.com';
}

const baseUrl = getBaseUrl();

export const ENV: EnvConfig = {
  apiBaseUrl: baseUrl,
  realtimeUrl: baseUrl, // 🔥 même backend pour HTTP + WS
};

console.log('🌍 ENV =', ENV);
