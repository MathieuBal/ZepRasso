import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ResultsTable from '../components/ResultsTable';
import { getEvent, getPrize, getVehicles, getVotes } from '../lib/repository';
import type { PrizeSummary } from '../lib/repository';
import { calculateVehicleScores } from '../lib/scoring';
import { formatMoney } from '../lib/money';
import { usePolling } from '../lib/usePolling';
import type { VehicleScore } from '../types';

const POLL_MS = 8000;

export default function ResultsPage() {
  const [scores, setScores] = useState<VehicleScore[]>([]);
  const [votesClosed, setVotesClosed] = useState(false);
  const [prize, setPrize] = useState<PrizeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    Promise.all([getEvent(), getVehicles(), getVotes(), getPrize()])
      .then(([event, vehicles, votes, prizeInfo]) => {
        if (!mountedRef.current) return;
        setVotesClosed(event.status === 'closed');
        setScores(calculateVehicleScores(vehicles, votes));
        setPrize(prizeInfo);
        setError(null);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setLoading(false);
      });
  }, []);

  usePolling(load, POLL_MS);

  const hasAnyVote = scores.some((score) => score.voteCount > 0);

  return (
    <section className="grid">
      <PageHeader
        title={votesClosed ? 'Classement final' : 'Classement en direct'}
        badge={votesClosed ? 'Votes fermés' : 'Votes ouverts'}
        badgeTone={votesClosed ? 'closed' : 'ok'}
      >
        <p className="lead">
          {votesClosed
            ? 'Classement définitif, calculé sur les cinq critères.'
            : 'Mis à jour à chaque nouveau vote. Il se fige quand l’organisateur clôt l’événement.'}
        </p>
        <p className="muted" style={{ marginTop: 6, fontSize: '0.85rem' }}>
          Pour éviter qu'un véhicule peu noté ne gagne par chance, deux règles s'appliquent : (1) <strong>quorum</strong> — un véhicule doit avoir été noté par au moins la moitié des votants pour entrer dans le classement ; (2) la note finale est <strong>pondérée</strong> (rapprochée de la moyenne globale) pour les véhicules à faible nombre de votes. La moyenne brute reste affichée à titre indicatif.
        </p>
      </PageHeader>
      {prize && prize.pool > 0 && (
        <div className="panel" style={{ display: 'grid', gap: 6 }}>
          <p className="section-eyebrow">Cagnotte en jeu</p>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {formatMoney(prize.pool)} en jeu · 🥇 {formatMoney(prize.podium.first)} · 🥈 {formatMoney(prize.podium.second)} · 🥉 {formatMoney(prize.podium.third)}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            {prize.paidCount} inscription{prize.paidCount > 1 ? 's' : ''} payée{prize.paidCount > 1 ? 's' : ''} × {formatMoney(prize.entryFee)} (part organisation : {formatMoney(prize.orgaCut)}).
          </p>
        </div>
      )}
      {loading && <p className="notice">Calcul des résultats…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && !hasAnyVote && (
        <p className="notice">Aucun vote pour l'instant. Les premiers votes feront apparaître le classement ici.</p>
      )}
      {!loading && !error && hasAnyVote && <ResultsTable scores={scores} prize={prize ?? undefined} />}
    </section>
  );
}
