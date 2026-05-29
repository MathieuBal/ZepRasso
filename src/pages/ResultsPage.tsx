import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ResultsTable from '../components/ResultsTable';
import { getVehicles, getVotes } from '../lib/repository';
import { calculateVehicleScores } from '../lib/scoring';
import type { VehicleScore } from '../types';

export default function ResultsPage() {
  const [scores, setScores] = useState<VehicleScore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getVehicles(), getVotes()])
      .then(([vehicles, votes]) => setScores(calculateVehicleScores(vehicles, votes)))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="grid">
      <PageHeader title="Résultats" badge="Classement live" badgeTone="closed">
        <p className="lead">Classement calculé sur la moyenne des cinq critères. L’organisateur valide le résultat final depuis l’espace admin.</p>
      </PageHeader>
      {loading && <p className="notice">Calcul des résultats...</p>}
      {error && <p className="error">{error}</p>}
      <ResultsTable scores={scores} />
    </section>
  );
}
