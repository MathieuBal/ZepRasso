import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import VoteForm from '../components/VoteForm';
import { getStoredPseudo } from '../lib/localSession';
import { getConfiguredEventId, getEvent, getVehicles, getVotes, upsertVote } from '../lib/repository';
import { findUserVote } from '../lib/scoring';
import type { Vehicle, Vote } from '../types';

export default function VehicleVotePage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const pseudo = getStoredPseudo();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vote, setVote] = useState<Vote | undefined>();
  const [votesClosed, setVotesClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getEvent(), getVehicles(), getVotes()])
      .then(([event, vehicles, votes]) => {
        if (cancelled) return;
        setVotesClosed(event.status === 'closed');
        const currentVehicle = vehicles.find((item) => item.id === vehicleId) || null;
        setVehicle(currentVehicle);
        if (currentVehicle) setVote(findUserVote(votes, currentVehicle.id, pseudo));
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
    try {
      await upsertVote({
        eventId: getConfiguredEventId(),
        vehicleId: vehicle.id,
        voterPseudo: pseudo,
        ...scores,
      });
      setSaved(true);
      setTimeout(() => navigate('/vehicles'), 700);
    } catch (err) {
      setError((err as Error).message || "Impossible d'enregistrer le vote.");
    }
  }

  if (loading) return <p className="notice">Chargement du véhicule...</p>;
  if (!vehicle) return <p className="error">Véhicule introuvable.</p>;

  return (
    <section className="grid" style={{ gap: 18 }}>
      {/* Hero photo plein cadre avec infos en bas */}
      <div
        className="card vehicle-card"
        style={{
          position: 'relative',
          minHeight: 320,
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {vehicle.imageUrl ? (
          <div
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${vehicle.imageUrl})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #2a1547, #11052a)' }} />
        )}
        <div
          style={{
            position: 'absolute', inset: 0,
            background:
              'linear-gradient(180deg, rgba(10,2,20,0.4) 0%, transparent 30%, rgba(10,2,20,0.92) 100%)',
          }}
        />
        <div style={{ position: 'absolute', top: 16, left: 16 }}>
          <Link className="button ghost" to="/vehicles" style={{ background: 'rgba(10,2,20,0.55)', backdropFilter: 'blur(10px)' }}>
            <ArrowLeft size={16} /> Retour
          </Link>
        </div>
        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ background: 'rgba(10,2,20,0.55)', backdropFilter: 'blur(8px)', padding: '4px 8px', borderRadius: 4 }}>
              {vehicle.category}
            </span>
            {vehicle.plate && <span className="plate">{vehicle.plate}</span>}
            {vehicle.isDisqualified && <span className="badge closed">Disqualifié</span>}
          </div>
          <h1 className="page-title">{vehicle.name}</h1>
          <p className="lead" style={{ margin: '8px 0 0' }}>
            par <strong>{vehicle.ownerName}</strong>
          </p>
          {vehicle.description && (
            <p className="muted" style={{ marginTop: 6, maxWidth: 640 }}>{vehicle.description}</p>
          )}
        </div>
      </div>

      <div className="panel grid">
        <span className={vote ? 'badge ok' : 'badge wait'}>
          {vote ? '✓ Vote déjà enregistré · tu peux le modifier' : 'Note ce véhicule sur 5 critères'}
        </span>
        <h2>{vote ? 'Modifier mon vote' : 'Mon vote'}</h2>
        {votesClosed && <p className="notice">Les votes sont fermés. Tu peux consulter le <Link to="/results">classement final</Link>.</p>}
        {vehicle.isDisqualified && <p className="error">Ce véhicule est disqualifié, le vote est désactivé.</p>}
        {error && <p className="error">{error}</p>}
        {saved && <p className="success">Vote enregistré, retour à la liste…</p>}
        <VoteForm initialVote={vote} disabled={vehicle.isDisqualified || votesClosed} onSubmit={handleSubmit} />
      </div>
    </section>
  );
}
