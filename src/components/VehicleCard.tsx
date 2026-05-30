import { CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Vehicle } from '../types';

type VehicleCardProps = {
  vehicle: Vehicle;
  hasVoted?: boolean;
  /** Note moyenne déjà calculée pour ce véhicule (optionnel). */
  averageScore?: number;
  /** Nombre de votes (optionnel). */
  voteCount?: number;
};

/**
 * Layout dense en "row" : photo gauche, méta centre, note + statut droite.
 * Cliquable en entier — emmène vers /vehicles/:id pour voter / éditer le vote.
 */
export default function VehicleCard({ vehicle, hasVoted = false, averageScore, voteCount }: VehicleCardProps) {
  const thumb = vehicle.imageUrl
    ? { backgroundImage: `url(${vehicle.imageUrl})` }
    : undefined;

  return (
    <Link className="vehicle-row" to={`/vehicles/${vehicle.id}`}>
      <div className="v-thumb" style={thumb} />
      <div className="v-meta">
        <div className="v-tags">
          <span className="eyebrow">{vehicle.category}</span>
          {vehicle.plate && <span className="plate">{vehicle.plate}</span>}
          {vehicle.isDisqualified && <span className="badge closed">Disqualifié</span>}
        </div>
        <h2 className="v-name">{vehicle.name}</h2>
        <div className="v-owner">par <strong style={{ color: 'var(--text-2)' }}>{vehicle.ownerName}</strong></div>
      </div>
      <div className="v-right">
        {hasVoted ? (
          <span className="badge ok"><CheckCircle2 size={12} /> Voté</span>
        ) : (
          <span className="badge wait"><Circle size={12} /> À noter</span>
        )}
        <div className="v-score" style={{ color: typeof averageScore === 'number' && averageScore > 0 ? 'var(--text)' : 'var(--text-3)' }}>
          {typeof averageScore === 'number' && averageScore > 0 ? averageScore.toFixed(1) : '—'}
          <small>{typeof averageScore === 'number' && averageScore > 0 ? '/10' : ''}</small>
        </div>
        {typeof voteCount === 'number' && voteCount > 0 && (
          <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{voteCount} votes</div>
        )}
      </div>
    </Link>
  );
}
