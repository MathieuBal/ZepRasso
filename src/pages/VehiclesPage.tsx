import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import VehicleCard from '../components/VehicleCard';
import { getStoredPseudo } from '../lib/localSession';
import { getEvent, getVehicles, getVotes } from '../lib/repository';
import { calculateVehicleScores, findUserVote, isOwnVehicle } from '../lib/scoring';
import { usePolling } from '../lib/usePolling';
import type { Vehicle, VehicleScore, Vote } from '../types';

const POLL_MS = 8000;

export default function VehiclesPage() {
  const pseudo = getStoredPseudo();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [canVote, setCanVote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    Promise.all([getEvent(), getVehicles(), getVotes()])
      .then(([event, loadedVehicles, loadedVotes]) => {
        if (!mountedRef.current) return;
        setCanVote(event.status === 'voting');
        setVehicles(loadedVehicles);
        setVotes(loadedVotes);
        setError(null);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setLoading(false);
      });
  }, []);

  usePolling(load, POLL_MS);

  const scoresById = useMemo(() => {
    const map = new Map<string, VehicleScore>();
    calculateVehicleScores(vehicles, votes).forEach((s) => map.set(s.vehicle.id, s));
    return map;
  }, [vehicles, votes]);

  // Le propre véhicule du participant ne compte pas : il ne peut pas voter dessus,
  // donc on l'exclut de la progression (sinon impossible d'atteindre 100%).
  const votableVehicles = vehicles.filter((v) => !isOwnVehicle(v, pseudo));
  const votedCount = votableVehicles.filter((v) => findUserVote(votes, v.id, pseudo)).length;
  const progressPct = votableVehicles.length > 0
    ? Math.round((votedCount / votableVehicles.length) * 100)
    : 0;

  const visible = vehicles.filter((v) => {
    if (filter === 'all') return true;
    if (isOwnVehicle(v, pseudo)) return false; // jamais dans "à noter" ni "votés"
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
        {!canVote ? (
          <p className="notice">Les votes ne sont pas ouverts pour l'instant. Découvre le <Link to="/results"><strong>classement</strong></Link>.</p>
        ) : pseudo ? (
          <>
            <p className="lead" style={{ marginBottom: 12 }}>
              {votedCount === votableVehicles.length && votableVehicles.length > 0
                ? 'Tu as voté pour tous les véhicules. Tu peux encore modifier tes notes.'
                : `Tu as voté pour ${votedCount}/${votableVehicles.length} véhicules.`}
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
          ['todo', `À noter (${votableVehicles.length - votedCount})`],
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

      {loading && <p className="notice">Chargement des véhicules…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && vehicles.length === 0 && (
        <div className="panel">
          <p className="lead" style={{ margin: 0 }}>Aucun véhicule pour le moment.</p>
          <p className="muted" style={{ marginTop: 6 }}>L'organisateur va ajouter les bolides en compétition d'ici peu — reviens dans un instant.</p>
        </div>
      )}

      {!loading && !error && vehicles.length > 0 && visible.length === 0 && (
        <p className="notice">Aucun véhicule à afficher dans cette catégorie.</p>
      )}

      <div className="grid" style={{ gap: 10 }}>
        {visible.map((vehicle) => {
          const score = scoresById.get(vehicle.id);
          return (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              hasVoted={Boolean(findUserVote(votes, vehicle.id, pseudo))}
              isOwn={isOwnVehicle(vehicle, pseudo)}
              averageScore={score?.average}
              voteCount={score?.voteCount}
            />
          );
        })}
      </div>
    </section>
  );
}
