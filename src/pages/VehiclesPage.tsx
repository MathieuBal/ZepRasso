import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import VehicleCard from '../components/VehicleCard';
import { getStoredPseudo } from '../lib/localSession';
import { getVehicles, getVotes } from '../lib/repository';
import { findUserVote } from '../lib/scoring';
import type { Vehicle, Vote } from '../types';

export default function VehiclesPage() {
  const pseudo = getStoredPseudo();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getVehicles(), getVotes()])
      .then(([loadedVehicles, loadedVotes]) => {
        setVehicles(loadedVehicles);
        setVotes(loadedVotes);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const votedCount = vehicles.filter((vehicle) => findUserVote(votes, vehicle.id, pseudo)).length;

  return (
    <section className="grid">
      <div className="card">
        <h1 className="hero-title gradient-text">Véhicules en course</h1>
        {pseudo ? (
          <p className="lead">Connecté en tant que <strong>{pseudo}</strong>. Tu as voté pour {votedCount}/{vehicles.length} véhicules.</p>
        ) : (
          <p className="notice">Entre ton pseudo avant de voter. <Link to="/login"><strong>Définir mon pseudo</strong></Link></p>
        )}
      </div>

      {loading && <p className="notice">Chargement des véhicules...</p>}
      {error && <p className="error">{error}</p>}

      <div className="grid three">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} hasVoted={Boolean(findUserVote(votes, vehicle.id, pseudo))} />
        ))}
      </div>
    </section>
  );
}
