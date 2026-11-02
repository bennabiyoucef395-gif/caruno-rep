// État de l'application : réglages du poste, profil du magasin, utilisateur connecté et client Dolibarr.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Dolibarr, capabilities, type Capabilities, type Me } from '@/lib/dolibarr';
import { loadJSON, saveJSON, getSecret, setSecret } from '@/lib/storage';
import { applyLanguage, deviceLanguage, type Lang } from '@/i18n';

// Réglages de CE poste (Paramètres > Ce poste).
export type DeviceSettings = { dolibarrUrl: string; deviceName: string; lang: Lang; catalogueUrl: string };
// Profil du MAGASIN. Gardé sur le poste pour l'instant ; cible : un profil commun lu depuis Dolibarr par tous les postes.
export type ShopProfile = {
  vat: boolean;
  stockMode: 'bill' | 'shipment';
  warehouseId: number;
  cashAccountId: number;
  bankAccountId: number;
  counterCustomerId: number;
  openingFloat: number;
};

const DEFAULT_DEVICE: DeviceSettings = { dolibarrUrl: '', deviceName: 'Comptoir 1', lang: 'fr', catalogueUrl: '/catalogue/tibao-2025.json' };
const DEFAULT_SHOP: ShopProfile = { vat: false, stockMode: 'bill', warehouseId: 1, cashAccountId: 1, bankAccountId: 2, counterCustomerId: 5, openingFloat: 10000 };

type Auth = { token: string; me: Me | null; cap: Capabilities | null; paymentTypes: Record<string, number> };

type AppState = {
  ready: boolean;
  device: DeviceSettings;
  shop: ShopProfile;
  auth: Auth;
  api: Dolibarr;
  saveDevice: (d: Partial<DeviceSettings>) => Promise<{ needsRestart: boolean }>;
  saveShop: (s: Partial<ShopProfile>) => Promise<void>;
  signIn: (login: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  navFolded: boolean;
  setNavFolded: (v: boolean) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<DeviceSettings>(DEFAULT_DEVICE);
  const [shop, setShop] = useState<ShopProfile>(DEFAULT_SHOP);
  const [auth, setAuth] = useState<Auth>({ token: '', me: null, cap: null, paymentTypes: {} });
  const [navFolded, setFolded] = useState(false);

  const api = useMemo(() => new Dolibarr(device.dolibarrUrl || 'http://localhost', auth.token), [device.dolibarrUrl, auth.token]);

  useEffect(() => {
    (async () => {
      const d = await loadJSON<DeviceSettings>('device', { ...DEFAULT_DEVICE, lang: deviceLanguage() });
      const s = await loadJSON<ShopProfile>('shop', DEFAULT_SHOP);
      const ui = await loadJSON<{ navFolded: boolean }>('ui', { navFolded: false });
      setDevice(d); setShop(s); setFolded(ui.navFolded); applyLanguage(d.lang);
      // Session déjà ouverte sur ce poste : on relit l'utilisateur et ses droits avec le jeton gardé.
      const token = await getSecret('token');
      if (token && d.dolibarrUrl) {
        try {
          const client = new Dolibarr(d.dolibarrUrl, token);
          const me = await client.me();
          const pt = await client.paymentTypes().catch(() => ({}));
          setAuth({ token, me, cap: capabilities(me.rights), paymentTypes: pt });
        } catch { await setSecret('token', ''); }
      }
      setReady(true);
    })();
  }, []);

  const saveDevice = useCallback(async (patch: Partial<DeviceSettings>) => {
    const next = { ...device, ...patch };
    setDevice(next); await saveJSON('device', next);
    return patch.lang && patch.lang !== device.lang ? applyLanguage(patch.lang) : { needsRestart: false };
  }, [device]);

  const saveShop = useCallback(async (patch: Partial<ShopProfile>) => {
    const next = { ...shop, ...patch };
    setShop(next); await saveJSON('shop', next);
  }, [shop]);

  const signIn = useCallback(async (login: string, password: string) => {
    const client = new Dolibarr(device.dolibarrUrl);
    const token = await client.login(login, password);
    const me = await client.me();
    const pt = await client.paymentTypes().catch(() => ({}));
    await setSecret('token', token);
    setAuth({ token, me, cap: capabilities(me.rights), paymentTypes: pt });
  }, [device.dolibarrUrl]);

  // Déconnexion de ce poste : le jeton est oublié ici. (Annuler le jeton sur tous les appareils demande le mot de passe : à venir.)
  const signOut = useCallback(async () => {
    await setSecret('token', '');
    setAuth({ token: '', me: null, cap: null, paymentTypes: {} });
  }, []);

  const setNavFolded = useCallback((v: boolean) => { setFolded(v); saveJSON('ui', { navFolded: v }); }, []);

  const value = useMemo(() => ({ ready, device, shop, auth, api, saveDevice, saveShop, signIn, signOut, navFolded, setNavFolded }),
    [ready, device, shop, auth, api, saveDevice, saveShop, signIn, signOut, navFolded, setNavFolded]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp hors de AppProvider');
  return v;
}

// Montants : un seul prix final si le magasin ne facture pas la TVA (cas du magasin de développement).
export function money(n: number, da = 'DA'): string {
  return Math.round(n || 0).toLocaleString('fr-FR') + ' ' + da;
}
