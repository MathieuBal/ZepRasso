import { ArrowRight, Trophy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStoredPseudo } from '../lib/localSession';
import { getEvent, getVehicles, getVotes } from '../lib/repository';
import { calculateVehicleScores, findUserVote } from '../lib/scoring';
import { usePolling } from '../lib/usePolling';
import type { RassoEvent, Vehicle, VehicleScore, Vote } from '../types';

const POLL_MS = 8000;

export default function HomePage() {
  const pseudo = getStoredPseudo();
  const [event, setEvent] = useState<RassoEvent | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [scores, setScores] = useState<VehicleScore[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    Promise.all([getEvent(), getVehicles(), getVotes()])
      .then(([loadedEvent, loadedVehicles, loadedVotes]) => {
        if (!mountedRef.current) return;
        setEvent(loadedEvent);
        setVehicles(loadedVehicles);
        setVotes(loadedVotes);
        setScores(calculateVehicleScores(loadedVehicles, loadedVotes));
      })
      .catch(() => { /* silent on home, the other pages show errors */ });
  }, []);

  usePolling(load, POLL_MS);

  const votesClosed = event?.status === 'closed';
  const totalVotes = votes.length;
  const uniqueVoters = new Set(votes.map((v) => v.voterPseudo)).size;
  const myVotes = pseudo
    ? vehicles.filter((v) => findUserVote(votes, v.id, pseudo)).length
    : 0;
  const progressPct = vehicles.length > 0
    ? Math.round((myVotes / vehicles.length) * 100)
    : 0;
  const leader = scores[0];
  const primaryTo = votesClosed ? '/results' : pseudo ? '/vehicles' : '/login';
  const primaryLabel = votesClosed
    ? 'Voir le classement final'
    : pseudo
      ? 'Continuer à voter'
      : 'Choisir mon pseudo';

  return (
    <section className="grid" style={{ gap: 22 }}>
      {/* Event card hero */}
      <section className="event-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span className={`badge ${votesClosed ? 'closed' : 'ok badge-live'}`} style={{ paddingLeft: 9 }}>
            {votesClosed ? 'VOTES FERMÉS' : 'VOTES OUVERTS'}
          </span>
          {event && <span className="badge wait">{event.name}</span>}
        </div>
        <h1 className="hero-title gradient-text" style={{ marginBottom: 12 }}>
          {votesClosed ? 'Le classement est tombé.' : <>Élis le plus beau<br/>bolide du rasso.</>}
        </h1>
        <p className="lead" style={{ maxWidth: 640 }}>
          {votesClosed
            ? 'Les votes sont clos. Découvre quels bolides ont marqué les esprits cette fois-ci.'
            : 'Tu choisis ton pseudo RP, tu notes chaque véhicule sur 5 critères (esthétique, cohérence, originalité, finition, RP), et le classement bouge en direct.'}
        </p>

        <div className="event-stats">
          <div>
            <div className="event-stat-num">{vehicles.length}</div>
            <p className="eyebrow" style={{ marginTop: 6 }}>Véhicules</p>
          </div>
          <div>
            <div className="event-stat-num">{uniqueVoters}</div>
            <p className="eyebrow" style={{ marginTop: 6 }}>Votants</p>
          </div>
          <div>
            <div className="event-stat-num accent-magenta">{totalVotes}</div>
            <p className="eyebrow" style={{ marginTop: 6 }}>Votes</p>
          </div>
        </div>

        <div className="actions" style={{ marginTop: 22 }}>
          <Link className="button primary" to={primaryTo}>
            {primaryLabel} <ArrowRight size={16} />
          </Link>
          {!votesClosed && (
            <Link className="button" to="/results"><Trophy size={16} /> Voir le classement</Link>
          )}
        </div>
      </section>

      {/* Ma progression (si pseudo défini) */}
      {pseudo && vehicles.length > 0 && (
        <div className="panel" style={{ display: 'grid', gap: 12 }}>
          <div className="between">
            <div>
              <p className="eyebrow">Ta progression</p>
              <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                {myVotes} / {vehicles.length} véhicules notés · pseudo <strong>{pseudo}</strong>
              </p>
            </div>
            <div className="score" style={{ fontSize: '2.4rem' }}>
              {progressPct}<small style={{ fontSize: '0.5em', color: 'var(--text-3)' }}>%</small>
            </div>
          </div>
          <div className="progress"><span style={{ width: `${progressPct}%` }} /></div>
        </div>
      )}

      {/* Featured : leader actuel */}
      {leader && leader.voteCount > 0 && (
        <div className="podium-winner" style={{ minHeight: 240 }}>
          <div className="pw-img" style={leader.vehicle.imageUrl ? { backgroundImage: `url(${leader.vehicle.imageUrl})` } : undefined} />
          <div className="pw-overlay" />
          <span className="pw-medal">★ #1 · EN TÊTE</span>
          <div className="pw-score">{leader.average.toFixed(1)}</div>
          <div className="pw-info">
            <h2 className="pw-name">{leader.vehicle.name}</h2>
            <p className="pw-owner">par <strong>{leader.vehicle.ownerName}</strong> · {leader.voteCount} votes</p>
          </div>
        </div>
      )}
    </section>
  );
}
