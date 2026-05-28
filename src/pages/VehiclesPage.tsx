import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import VehicleCard from '../components/VehicleCard';
import { getStoredPseudo } from '../lib/localSession';
import { getVehicles, getVotes } from '../lib/repository';
import { calculateVehicleScores, findUserVote } from '../lib/scoring';
import type { Vehicle, VehicleScore, Vote } from '../types';

export default function VehiclesPage() {
  const pseudo = getStoredPseudo();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');

  useEffect(() => {
    Promise.all([getVehicles(), getVotes()])
      .then(([loadedVehicles, loadedVotes]) => {
        setVehicles(loadedVehicles);
        setVotes(loadedVotes);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const scoresById = useMemo(() => {
    const map = new Map<string, VehicleScore>();
    calculateVehicleScores(vehicles, votes).forEach((s) => map.set(s.vehicle.id, s));
    return map;
  }, [vehicles, votes]);

  const votedCount = vehicles.filter((v) => findUserVote(votes, v.id, pseudo)).length;
  const progressPct = vehicles.length > 0
    ? Math.round((votedCount / vehicles.length) * 100)
    : 0;

  const visible = vehicles.filter((v) => {
    if (filter === 'all') return true;
    const voted = Boolean(findUserVote(votes, v.id, pseudo));
    return filter === 'done' ? voted : !voted;
  });

  return (
    <section className="grid" style={{ gap: 22 }}>
      <PageHeader
        title="Véhicules en course"
        badge={pseudo ? `Pseudo : ${pseudo}` : 'Pseudo requis'}
        badgeTone={pseudo ? 'ok' : 'wait'}
      >
        {pseudo ? (
          <>
            <p className="lead" style={{ marginBottom: 12 }}>
              {votedCount === vehicles.length && vehicles.length > 0
                ? 'Tu as voté pour tous les véhicules. Tu peux encore modifier tes notes.'
                : `Tu as voté pour ${votedCount}/${vehicles.length} véhicules.`}
            </p>
            <div className="between" style={{ gap: 14 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="progress"><span style={{ width: `${progressPct}%` }} /></div>
              </div>
              <div className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-2)', fontWeight: 600 }}>
                {votedCount}/{vehicles.length} · {progressPct}%
              </div>
            </div>
          </>
        ) : (
          <p className="notice">
            Entre ton pseudo avant de voter.{' '}
            <Link to="/login"><strong>Définir mon pseudo</strong></Link>
          </p>
        )}
      </PageHeader>

      {/* Filtres */}
      <div className="actions" role="tablist" aria-label="Filtre véhicules">
        {([
          ['all',  `Tous (${vehicles.length})`],
          ['todo', `À noter (${vehicles.length - votedCount})`],
          ['done', `Votés (${votedCount})`],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`nav-link ${filter === value ? 'active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="notice">Chargement des véhicules...</p>}
      {error && <p className="error">{error}</p>}

      <div className="grid" style={{ gap: 10 }}>
        {visible.map((vehicle) => {
          const score = scoresById.get(vehicle.id);
          return (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              hasVoted={Boolean(findUserVote(votes, vehicle.id, pseudo))}
              averageScore={score?.average}
              voteCount={score?.voteCount}
            />
          );
        })}
      </div>
    </section>
  );
}
