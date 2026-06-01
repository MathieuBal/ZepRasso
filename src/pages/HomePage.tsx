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

  const status = event?.status;
  const votesClosed = status === 'closed';
  const isVoting = status === 'voting';
  const isRegistrations = status === 'registrations';
  const isDraft = status === 'draft';
  const totalVotes = votes.length;
  const uniqueVoters = new Set(votes.map((v) => v.voterPseudo)).size;
  const myVotes = pseudo
    ? vehicles.filter((v) => findUserVote(votes, v.id, pseudo)).length
    : 0;
  const progressPct = vehicles.length > 0
    ? Math.round((myVotes / vehicles.length) * 100)
    : 0;
  const leader = scores[0];

  // CTA principal selon la phase de l'événement.
  let primaryTo = '/results';
  let primaryLabel = 'Voir le classement final';
  if (isRegistrations) {
    primaryTo = '/register';
    primaryLabel = "M'inscrire au concours";
  } else if (isVoting) {
    primaryTo = pseudo ? '/vehicles' : '/login';
    primaryLabel = pseudo ? 'Continuer à voter' : 'Choisir mon pseudo';
  } else if (isDraft) {
    primaryTo = '/results';
    primaryLabel = 'Voir le classement';
  }

  const statusBadge = votesClosed
    ? { cls: 'closed', text: 'VOTES FERMÉS' }
    : isVoting
      ? { cls: 'ok badge-live', text: 'VOTES OUVERTS' }
      : isRegistrations
        ? { cls: 'wait', text: 'INSCRIPTIONS OUVERTES' }
        : { cls: 'wait', text: 'EN PRÉPARATION' };

  const heroTitle = votesClosed
    ? 'Le classement est tombé.'
    : isRegistrations
      ? <>Inscris ton bolide<br/>au prochain rasso.</>
      : isDraft
        ? <>Le prochain rasso<br/>se prépare.</>
        : <>Élis le plus beau<br/>bolide du rasso.</>;

  const heroLead = votesClosed
    ? 'Les votes sont clos. Découvre quels bolides ont marqué les esprits cette fois-ci.'
    : isRegistrations
      ? 'Les inscriptions sont ouvertes : inscris-toi pour présenter ta voiture. Les votes ouvriront le jour du rasso.'
      : isDraft
        ? "L'événement n'est pas encore lancé. Reviens bientôt pour t'inscrire ou voter."
        : 'Tu choisis ton pseudo RP, tu notes chaque véhicule sur 5 critères (esthétique, cohérence, originalité, finition, RP), et le classement bouge en direct.';

  return (
    <section className="grid" style={{ gap: 22 }}>
      {/* Event card hero */}
      <section className="event-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span className={`badge ${statusBadge.cls}`} style={{ paddingLeft: 9 }}>
            {statusBadge.text}
          </span>
          {event && <span className="badge wait">{event.name}</span>}
        </div>
        <h1 className="hero-title gradient-text" style={{ marginBottom: 12 }}>
          {heroTitle}
        </h1>
        <p className="lead" style={{ maxWidth: 640 }}>
          {heroLead}
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
          {isVoting && (
            <Link className="button" to="/results"><Trophy size={16} /> Voir le classement</Link>
          )}
          {isRegistrations && (
            <Link className="button" to="/vehicles">Voir les véhicules</Link>
          )}
        </div>
      </section>

      {/* Ma progression (si pseudo défini) */}
      {isVoting && pseudo && vehicles.length > 0 && (
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
