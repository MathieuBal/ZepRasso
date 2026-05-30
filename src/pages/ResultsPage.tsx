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
      <PageHeader title={votesClosed ? 'Classement final' : 'Classement en direct'} badge={votesClosed ? 'Votes fermés' : 'Votes ouverts'} badgeTone={votesClosed ? 'closed' : 'ok'}>
        <p className="lead">
          {votesClosed
            ? 'Voici le classement définitif, moyenne des cinq critères.'
            : 'Moyenne des cinq critères, mise à jour à chaque nouveau vote. Il se fige quand l’organisateur clôt l’événement.'}
        </p>
      </PageHeader>
      {loading && <p className="notice">Calcul des résultats...</p>}
      {error && <p className="error">{error}</p>}
      <ResultsTable scores={scores} />
    </section>
  );
}
