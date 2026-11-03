import { useTranslation } from 'react-i18next';
import type { Customer, Product } from '@/lib/dolibarr';
import { Badge } from '@/components/ui';

// État du stock d'une pièce : rupture, sous le seuil d'alerte, ou en stock.
export function StockBadge({ p }: { p: Product }) {
  const { t } = useTranslation();
  if (p.stock <= 0) return <Badge label={t('pieces.out')} tone="bad" />;
  if (p.alert && p.stock < p.alert) return <Badge label={t('pieces.low')} tone="warn" />;
  return <Badge label={t('pieces.inStock')} tone="ok" />;
}

// Catégorie d'un client, déduite de son niveau de prix Dolibarr (1 Public, 2 Garage, 3 Gros).
export function LevelBadge({ c }: { c: Customer }) {
  const { t } = useTranslation();
  return <Badge label={t('clients.cat' + c.priceLevel) + ' · ' + t('pos.levelLabel', { name: t('pos.level' + c.priceLevel) })} tone={c.priceLevel === 1 ? 'grey' : 'accent'} />;
}

// Statut d'un document de vente ou d'achat.
export function DocBadge({ kind, status, paid, remain, total }: { kind: string; status: number; paid?: boolean; remain?: number; total?: number }) {
  const { t } = useTranslation();
  if (kind === 'invoice' || kind === 'credit') {
    if (status === 0) return <Badge label={t('doc.draft')} />;
    if (status === 3) return <Badge label={t('doc.abandoned')} />;
    if (paid || status === 2) return <Badge label={kind === 'credit' ? t('doc.used') : t('doc.paid')} tone="ok" />;
    if (remain !== undefined && total !== undefined && remain < total) return <Badge label={t('doc.partial')} tone="warn" />;
    return <Badge label={t('doc.unpaid')} tone="bad" />;
  }
  const map: Record<string, [string, 'grey' | 'ok' | 'warn' | 'bad' | 'info' | 'accent'][]> = {
    proposal: [[t('doc.draft'), 'grey'], [t('doc.sent'), 'info'], [t('doc.signed'), 'ok'], [t('doc.refused'), 'bad'], [t('doc.billed'), 'ok']],
    order: [[t('doc.draft'), 'grey'], [t('doc.validated'), 'info'], [t('doc.shipping'), 'warn'], [t('doc.delivered'), 'ok']],
    shipment: [[t('doc.draft'), 'grey'], [t('doc.validated'), 'info'], [t('doc.closed'), 'ok']],
    supplierOrder: [[t('doc.draft'), 'grey'], [t('doc.validated'), 'info'], [t('doc.approved'), 'info'], [t('doc.ordered'), 'warn'], [t('doc.partReceived'), 'warn'], [t('doc.received'), 'ok']],
  };
  if (status < 0) return <Badge label={t('doc.canceled')} />;
  const s = (map[kind] || [])[status];
  return s ? <Badge label={s[0]} tone={s[1]} /> : <Badge label={String(status)} />;
}
