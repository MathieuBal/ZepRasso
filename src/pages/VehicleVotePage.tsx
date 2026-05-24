import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import VoteForm from '../components/VoteForm';
import { getStoredPseudo } from '../lib/localSession';
import { getConfiguredEventId, getVehicles, getVotes, upsertVote } from '../lib/repository';
import { findUserVote } from '../lib/scoring';
import type { Vehicle, Vote } from '../types';

export default function VehicleVotePage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const pseudo = getStoredPseudo();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vote, setVote] = useState<Vote | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getVehicles(), getVotes()])
      .then(([vehicles, votes]) => {
        const currentVehicle = vehicles.find((item) => item.id === vehicleId) || null;
        setVehicle(currentVehicle);
        if (currentVehicle) setVote(findUserVote(votes, currentVehicle.id, pseudo));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [pseudo, vehicleId]);

  if (!pseudo) return <Navigate to="/login" replace />;

  async function handleSubmit(scores: {
    aesthetics: number;
    coherence: number;
    originality: number;
    details: number;
    rpPresentation: number;
  }) {
    if (!vehicle || !pseudo) return;
    setError(null);
    await upsertVote({
      eventId: getConfiguredEventId(),
      vehicleId: vehicle.id,
      voterPseudo: pseudo,
      ...scores,
    });
    setSaved(true);
    setTimeout(() => navigate('/vehicles'), 700);
  }

  if (loading) return <p className="notice">Chargement du véhicule...</p>;
  if (!vehicle) return <p className="error">Véhicule introuvable.</p>;

  return (
    <section className="grid two">
      <div className="card vehicle-card">
        {vehicle.imageUrl ? <img className="vehicle-img" src={vehicle.imageUrl} alt={vehicle.name} /> : <div className="vehicle-img" />}
        <div className="vehicle-body grid">
          <Link className="button ghost" to="/vehicles"><ArrowLeft size={16} /> Retour</Link>
          <div>
            <h1 className="hero-title gradient-text" style={{ fontSize: 'clamp(2rem, 6vw, 3.6rem)' }}>{vehicle.name}</h1>
            <p className="lead">Propriétaire : <strong>{vehicle.ownerName}</strong></p>
            <p className="muted">{vehicle.category}{vehicle.plate ? ` · Plaque ${vehicle.plate}` : ''}</p>
            {vehicle.description && <p className="muted">{vehicle.description}</p>}
          </div>
        </div>
      </div>
      <div className="panel grid">
        <span className={vote ? 'badge ok' : 'badge wait'}>{vote ? 'Vote déjà enregistré' : 'Vote à faire'}</span>
        <h2 style={{ margin: 0 }}>Note ce véhicule</h2>
        {vehicle.isDisqualified && <p className="error">Ce véhicule est disqualifié, le vote est désactivé.</p>}
        {error && <p className="error">{error}</p>}
        {saved && <p className="success">Vote enregistré, retour à la liste...</p>}
        <VoteForm initialVote={vote} disabled={vehicle.isDisqualified} onSubmit={handleSubmit} />
      </div>
    </section>
  );
}
