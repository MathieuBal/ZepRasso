import { Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getFinance } from '../lib/repository';
import { formatMoney } from '../lib/money';
import type { FinanceSummary } from '../types';

type Props = { reloadKey?: number };

// Récap financier de la soirée, agrégé côté serveur. Read-only.
export default function FinancePanel({ reloadKey = 0 }: Props) {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    getFinance().then(setData).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  if (error) return <div className="panel"><p className="error">{error}</p></div>;
  if (!data) return null;

  const { contest, lotteries, races, totals } = data;
  const hasRaces = races.length > 0;
  const hasLotteries = lotteries.detail.length > 0;

  return (
    <div className="panel grid">
      <div className="between">
        <div>
          <p className="section-eyebrow">Bilan de la soirée</p>
          <h2 style={{ margin: '4px 0 0' }}><Wallet size={18} style={{ verticalAlign: -3 }} /> Récap financier</h2>
        </div>
        <button className="button" onClick={() => { setOpen((o) => !o); load(); }}>
          {open ? 'Masquer le détail' : 'Voir le détail'}
        </button>
      </div>

      {/* Chiffres clés */}
      <div className="finance-grid">
        <div className="finance-card highlight">
          <p className="section-eyebrow">Ta part organisateur</p>
          <span className="money money-big">{formatMoney(totals.orgaTake)}</span>
          <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>ce que tu gardes au total</p>
        </div>
        <div className="finance-card">
          <p className="section-eyebrow">À redistribuer</p>
          <span className="money money-big">{formatMoney(totals.toPayOut)}</span>
          <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>gains podiums + paris à verser</p>
        </div>
        <div className="finance-card">
          <p className="section-eyebrow">Total brassé</p>
          <span className="money money-big">{formatMoney(totals.grossHandled)}</span>
          <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>argent total qui a circulé</p>
        </div>
      </div>

      {open && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Source</th><th>Pot / Revenu</th><th>Ta part</th><th>À redistribuer</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>Concours</strong><br /><span className="muted" style={{ fontSize: '0.8rem' }}>{contest.paidParticipants} inscrit(s) payé(s)</span></td>
                <td style={{ fontFamily: 'monospace' }}>{formatMoney(contest.pool)}</td>
                <td style={{ fontFamily: 'monospace' }}>{formatMoney(contest.orgaCut)}</td>
                <td style={{ fontFamily: 'monospace' }}>{formatMoney(contest.toPayOut)}</td>
              </tr>

              {hasLotteries && lotteries.detail.map((l) => (
                <tr key={l.id}>
                  <td><strong>Loterie</strong> · {l.name}<br /><span className="muted" style={{ fontSize: '0.8rem' }}>{l.paidTickets} ticket(s) payé(s)</span></td>
                  <td style={{ fontFamily: 'monospace' }}>{formatMoney(l.revenue)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{formatMoney(l.revenue)}</td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-3)' }}>—</td>
                </tr>
              ))}

              {hasRaces && races.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>Course</strong> · {r.name}
                    <br /><span className="muted" style={{ fontSize: '0.8rem' }}>
                      inscriptions + paris{r.winnerDeclared ? ' · vainqueur déclaré' : ''}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{formatMoney(r.pilotPool + r.betPool)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{formatMoney(r.orgaCut)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{formatMoney(r.pilotToPayOut + r.betToPayOut)}</td>
                </tr>
              ))}

              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td><strong>TOTAL</strong></td>
                <td style={{ fontFamily: 'monospace' }}>{formatMoney(totals.grossHandled)}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatMoney(totals.orgaTake)}</td>
                <td style={{ fontFamily: 'monospace' }}>{formatMoney(totals.toPayOut)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
        Seuls les paiements validés (payés) sont comptés. Les paris d'une course sans vainqueur déclaré utilisent une estimation à {/* */}la part orga configurée.
      </p>
    </div>
  );
}
