import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ResultsTable from '../components/ResultsTable';
import { getEvent, getVehicles, getVotes } from '../lib/repository';
import { calculateVehicleScores } from '../lib/scoring';
import { usePolling } from '../lib/usePolling';
import type { VehicleScore } from '../types';

const POLL_MS = 8000;

export default function ResultsPage() {
  const [scores, setScores] = useState<VehicleScore[]>([]);
  const [votesClosed, setVotesClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    Promise.all([getEvent(), getVehicles(), getVotes()])
      .then(([event, vehicles, votes]) => {
        if (!mountedRef.current) return;
        setVotesClosed(event.status === 'closed');
        setScores(calculateVehicleScores(vehicles, votes));
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
            ? 'Voici le classement définitif, moyenne des cinq critères.'
            : 'Moyenne des cinq critères, mise à jour à chaque nouveau vote. Il se fige quand l’organisateur clôt l’événement.'}
        </p>
      </PageHeader>
      {loading && <p className="notice">Calcul des résultats…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && !hasAnyVote && (
        <p className="notice">Aucun vote pour l'instant. Les premiers votes feront apparaître le classement ici.</p>
      )}
      {!loading && !error && hasAnyVote && <ResultsTable scores={scores} />}
    </section>
  );
}
