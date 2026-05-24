import { CheckCircle2, Circle, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Vehicle } from '../types';

type VehicleCardProps = {
  vehicle: Vehicle;
  hasVoted?: boolean;
};

export default function VehicleCard({ vehicle, hasVoted = false }: VehicleCardProps) {
  return (
    <article className="card vehicle-card">
      {vehicle.imageUrl ? (
        <img
          className="vehicle-img"
          src={vehicle.imageUrl}
          alt={vehicle.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="vehicle-img" />
      )}
      <div className="vehicle-body grid">
        <div className="between">
          <span className={hasVoted ? 'badge ok' : 'badge wait'}>
            {hasVoted ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            {hasVoted ? 'Déjà voté' : 'À noter'}
          </span>
          {vehicle.isDisqualified && <span className="badge closed">Disqualifié</span>}
        </div>
        <div>
          <h2 className="vehicle-title">{vehicle.name}</h2>
          <p className="muted">Propriétaire : {vehicle.ownerName}</p>
          <p className="muted">{vehicle.category}{vehicle.plate ? ` · Plaque ${vehicle.plate}` : ''}</p>
        </div>
        {vehicle.description && <p className="muted">{vehicle.description}</p>}
        <Link className="button primary" to={`/vehicles/${vehicle.id}`}>
          <Trophy size={16} /> {hasVoted ? 'Voir / modifier le vote' : 'Voter'}
        </Link>
      </div>
    </article>
  );
}
