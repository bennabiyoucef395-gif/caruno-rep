// Caisse : session (ouverture / clôture), journal des ventes non terminées, enchaînement d'une vente dans Dolibarr.
// Tout est gardé sur l'appareil ; les données du magasin (factures, paiements, stock) sont dans Dolibarr.
import type { Dolibarr } from '@/lib/dolibarr';
import { loadJSON, loadList, saveJSON, remove } from '@/lib/storage';

export type PayMode = 'LIQ' | 'CHQ' | 'VIR' | 'CREDIT';
export type SaleLine = { productId: number; ref: string; label: string; qty: number; price: number };
export type Payment = { mode: PayMode; amount: number };

// Une vente reçoit un identifiant unique (ref_ext de la facture) et passe par le journal avant tout appel :
// après une coupure, la reprise relit Dolibarr à chaque étape et ne refait rien deux fois.
export type JournalEntry = {
  sale: string;
  time: string;
  device: string;
  customerId: number;
  lines: SaleLine[];
  pays: Payment[]; // règlements à enregistrer (espèces nettes du rendu) ; « CREDIT » n'est pas un paiement
  total: number;
  step: 'create' | 'validate' | 'pay';
  invoiceId?: number;
  notePrivate?: string;
};

export type Step = { key: string; vars?: Record<string, string>; skip?: boolean };

export type Session = {
  id: string;
  openedAt: string;
  openedBy: string;
  opening: number;
  count: number;
  total: number;
  byMode: Record<string, number>;
  moves: { at: string; type: 'in' | 'out'; amount: number; reason: string }[];
};

export const newId = (prefix: string) => prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
export const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

export const loadJournal = () => loadList<JournalEntry>('journal');
const saveJournal = (j: JournalEntry[]) => saveJSON('journal', j);

export async function putJournal(e: JournalEntry) {
  const all = (await loadJournal()).filter((x) => x.sale !== e.sale);
  all.push(e); await saveJournal(all);
}
export async function dropJournal(sale: string) {
  await saveJournal((await loadJournal()).filter((x) => x.sale !== sale));
}

export async function loadSession(): Promise<Session | null> {
  const s = await loadJSON<Session | { id: '' }>('session', { id: '' } as any);
  return s && (s as Session).id ? (s as Session) : null;
}
export const saveSession = (s: Session | null) => (s ? saveJSON('session', s) : remove('session'));
export const loadLastClose = () => loadJSON<{ at: string; counted: number; diff: number } | { at: '' }>('lastClose', { at: '' } as any);

export function openSession(by: string, opening: number): Session {
  return { id: newId('CS'), openedAt: nowText(), openedBy: by, opening, count: 0, total: 0, byMode: { LIQ: 0, CHQ: 0, VIR: 0, CREDIT: 0 }, moves: [] };
}

export function expectedCash(s: Session): number {
  return s.opening + (s.byMode.LIQ || 0) + s.moves.reduce((t, m) => t + (m.type === 'in' ? m.amount : -m.amount), 0);
}

// Enchaîne la vente : facture (retrouvée par ref_ext si elle existe déjà) → validation sur l'entrepôt → règlements.
export async function runSale(api: Dolibarr, opts: { warehouseId: number; cashAccountId: number; paymentTypes: Record<string, number> }, j: JournalEntry): Promise<{ invoiceRef: string; steps: Step[] }> {
  const steps: Step[] = [];
  await putJournal(j);

  let inv = await api.invoiceByRefExt(j.sale);
  if (inv) steps.push({ key: 'resume.found', vars: { ref: inv.ref }, skip: true });
  else {
    const id = await api.createInvoice(j.customerId, j.lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price, label: l.label })), j.sale, j.notePrivate);
    inv = await api.invoice(id);
    steps.push({ key: 'resume.created', vars: { sale: j.sale } });
  }
  const id = Number(inv.id);
  j.invoiceId = id; j.step = 'validate'; await putJournal(j);

  if (Number(inv.statut) === 0) { await api.validateInvoice(id, opts.warehouseId); steps.push({ key: 'resume.validated' }); }
  else steps.push({ key: 'resume.alreadyValidated', skip: true });
  j.step = 'pay'; await putJournal(j);

  inv = await api.invoice(id);
  let rest = Math.round(Number(inv.remaintopay ?? 0));
  const money = j.pays.filter((p) => p.mode !== 'CREDIT' && p.amount > 0);
  if (!money.length) { /* vente à crédit : rien à encaisser */ }
  else if (rest <= 0) steps.push({ key: 'resume.alreadyPaid', skip: true });
  else {
    for (const p of money) {
      const amount = Math.min(p.amount, rest);
      if (amount <= 0) continue;
      await api.payInvoice(id, amount, opts.paymentTypes[p.mode] || ({ LIQ: 4, CHQ: 7, VIR: 2 } as Record<string, number>)[p.mode], opts.cashAccountId, j.sale);
      rest -= amount;
      steps.push({ key: 'resume.paid', vars: { v: String(amount) } });
    }
  }
  await dropJournal(j.sale);
  inv = await api.invoice(id);
  return { invoiceRef: inv.ref, steps };
}

// Clôture : rapport dans l'agenda Dolibarr ; mouvements et écart sur le compte Caisse si l'utilisateur a le droit « banque ».
export async function closeSession(api: Dolibarr, s: Session, counted: number, opts: { userId: number; canBank: boolean; cashAccountId: number; device: string }): Promise<{ bankWritten: boolean }> {
  const expected = expectedCash(s);
  const diff = counted - expected;
  let bankWritten = false;
  if (opts.canBank) {
    for (const m of s.moves) await api.addBankLine(opts.cashAccountId, (m.type === 'in' ? 'Entrée caisse : ' : 'Sortie caisse : ') + m.reason + ' (' + s.id + ')', m.type === 'in' ? m.amount : -m.amount);
    if (diff) await api.addBankLine(opts.cashAccountId, 'Écart de caisse ' + s.id + ' (' + opts.device + ')', diff);
    bankWritten = true;
  }
  const lines = [
    'Session ' + s.id + ' — poste ' + opts.device,
    'Ouverte ' + s.openedAt + ' par ' + s.openedBy + ', fermée ' + nowText(),
    'Ventes : ' + s.count + ', total ' + s.total + ' DA',
    'Espèces ' + (s.byMode.LIQ || 0) + ' · Chèques ' + (s.byMode.CHQ || 0) + ' · Virements ' + (s.byMode.VIR || 0) + ' · À crédit ' + (s.byMode.CREDIT || 0),
    'Fond ' + s.opening + ' · entrées ' + s.moves.filter((m) => m.type === 'in').reduce((t, m) => t + m.amount, 0) + ' · sorties ' + s.moves.filter((m) => m.type === 'out').reduce((t, m) => t + m.amount, 0),
    'Attendu ' + expected + ' · compté ' + counted + ' · écart ' + diff,
    ...s.moves.map((m) => '  ' + m.at + ' ' + (m.type === 'in' ? '+' : '-') + m.amount + ' ' + m.reason),
    bankWritten ? 'Écritures passées sur le compte Caisse.' : 'Écritures du compte Caisse à passer par un responsable.',
  ];
  await api.addAgendaEvent(opts.userId, 'Clôture de caisse ' + s.id + ' (' + opts.device + ')', lines.join('\n'));
  await saveJSON('lastClose', { at: nowText(), counted, diff });
  await saveSession(null);
  return { bankWritten };
}
