import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import VehicleCard from '../components/VehicleCard';
import { getStoredPseudo } from '../lib/localSession';
import { getEvent, getVehicles, getVotes } from '../lib/repository';
import { findUserVote } from '../lib/scoring';
import type { Vehicle, Vote } from '../types';

export default function VehiclesPage() {
  const pseudo = getStoredPseudo();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [votesClosed, setVotesClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getEvent(), getVehicles(), getVotes()])
      .then(([event, loadedVehicles, loadedVotes]) => {
        setVotesClosed(event.status === 'closed');
        setVehicles(loadedVehicles);
        setVotes(loadedVotes);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const votedCount = vehicles.filter((vehicle) => findUserVote(votes, vehicle.id, pseudo)).length;

  return (
    <section className="grid">
      <PageHeader title="Véhicules en course" badge={pseudo ? `Pseudo : ${pseudo}` : 'Pseudo requis'} badgeTone={pseudo ? 'ok' : 'wait'}>
        {votesClosed ? (
          <p className="notice">Les votes sont fermés. Découvre le <Link to="/results"><strong>classement final</strong></Link>.</p>
        ) : pseudo ? (
          <p className="lead">Tu as voté pour {votedCount}/{vehicles.length} véhicules.</p>
        ) : (
          <p className="notice">Entre ton pseudo avant de voter. <Link to="/login"><strong>Définir mon pseudo</strong></Link></p>
        )}
      </PageHeader>

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
