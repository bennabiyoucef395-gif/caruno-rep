// Chargement asynchrone d'un écran : données, erreur lisible (droits Dolibarr compris) et rechargement.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DolibarrError } from '@/lib/dolibarr';

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true); setError('');
    try { const d = await load(); if (n === seq.current) setData(d); }
    catch (e) { if (n === seq.current) setError(explain(e)); }
    finally { if (n === seq.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, error, loading, reload: run, setData };
}

export function explain(e: unknown): string {
  const err = e as DolibarrError;
  if (err && err.status === 403) return 'Votre compte Dolibarr n’a pas le droit de voir ces données.';
  if (err && err.status === 401) return 'Session expirée : reconnectez-vous.';
  return (err && err.message) || 'Erreur';
}

// Date Dolibarr (secondes) → jj/mm/aaaa.
export function dateFr(sec: number, withTime = false): string {
  if (!sec) return '—';
  const d = new Date(sec * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + (withTime ? ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) : '');
}

// Jour local au format AAAA-MM-JJ (filtres Dolibarr sur une date).
export function isoDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
