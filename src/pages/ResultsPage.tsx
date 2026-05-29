import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ResultsTable from '../components/ResultsTable';
import { getEvent, getVehicles, getVotes } from '../lib/repository';
import { calculateVehicleScores } from '../lib/scoring';
import type { VehicleScore } from '../types';

export default function ResultsPage() {
  const [scores, setScores] = useState<VehicleScore[]>([]);
  const [votesClosed, setVotesClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getEvent(), getVehicles(), getVotes()])
      .then(([event, vehicles, votes]) => {
        setVotesClosed(event.status === 'closed');
        setScores(calculateVehicleScores(vehicles, votes));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="grid">
      <PageHeader title="Résultats" badge={votesClosed ? 'Classement final' : 'Classement provisoire'} badgeTone={votesClosed ? 'ok' : 'closed'}>
        <p className="lead">
          {votesClosed
            ? 'Les votes sont clos : voici le classement définitif, calculé sur la moyenne des cinq critères.'
            : 'Classement provisoire, calculé en direct sur la moyenne des cinq critères. Il se fige quand l’organisateur ferme les votes.'}
        </p>
      </PageHeader>
      {loading && <p className="notice">Calcul des résultats...</p>}
      {error && <p className="error">{error}</p>}
      <ResultsTable scores={scores} />
    </section>
  );
}
