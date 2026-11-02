// Stockage local de l'appareil (pas de base serveur : Dolibarr reste la source des données du magasin).
// - réglages, journal des ventes, session de caisse : AsyncStorage (localStorage sur le web)
// - jeton de connexion : SecureStore sur mobile ; sur le web SecureStore n'existe pas, on garde le jeton
//   dans le stockage de session du navigateur (effacé à la fermeture de l'onglet).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PREFIX = 'caruno:';

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export async function loadList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* stockage indisponible : l'app continue */ }
}

export async function remove(key: string): Promise<void> {
  try { await AsyncStorage.removeItem(PREFIX + key); } catch { /* idem */ }
}

export async function getSecret(key: string): Promise<string> {
  try {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(PREFIX + key) || '';
    return (await SecureStore.getItemAsync(PREFIX.replace(':', '.') + key)) || '';
  } catch {
    return '';
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') { if (value) globalThis.sessionStorage?.setItem(PREFIX + key, value); else globalThis.sessionStorage?.removeItem(PREFIX + key); return; }
    if (value) await SecureStore.setItemAsync(PREFIX.replace(':', '.') + key, value);
    else await SecureStore.deleteItemAsync(PREFIX.replace(':', '.') + key);
  } catch { /* idem */ }
}
