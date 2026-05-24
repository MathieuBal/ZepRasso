import { useEffect, useState } from 'react';
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
      <div className="card">
        <span className="badge closed">Classement live</span>
        <h1 className="hero-title gradient-text">Résultats</h1>
        <p className="lead">Classement calculé avec la moyenne des cinq critères. En V1, l’orga garde le dernier mot via l’admin.</p>
      </div>
      {loading && <p className="notice">Calcul des résultats...</p>}
      {error && <p className="error">{error}</p>}
      <ResultsTable scores={scores} />
    </section>
  );
}
