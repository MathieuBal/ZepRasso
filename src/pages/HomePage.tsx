import { ArrowRight, QrCode, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStoredPseudo } from '../lib/localSession';
import { getVehicles, getVotes } from '../lib/repository';
import { calculateVehicleScores, findUserVote } from '../lib/scoring';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Vehicle, VehicleScore, Vote } from '../types';

export default function HomePage() {
  const pseudo = getStoredPseudo();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [scores, setScores] = useState<VehicleScore[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVehicles(), getVotes()])
      .then(([loadedVehicles, loadedVotes]) => {
        if (cancelled) return;
        setVehicles(loadedVehicles);
        setVotes(loadedVotes);
        setScores(calculateVehicleScores(loadedVehicles, loadedVotes));
      })
      .catch(() => { /* silent on home, the other pages show errors */ });
    return () => { cancelled = true; };
  }, []);

  const totalVotes = votes.length;
  const uniqueVoters = new Set(votes.map((v) => v.voterPseudo)).size;
  const myVotes = pseudo
    ? vehicles.filter((v) => findUserVote(votes, v.id, pseudo)).length
    : 0;
  const progressPct = vehicles.length > 0
    ? Math.round((myVotes / vehicles.length) * 100)
    : 0;
  const leader = scores[0];

  return (
    <section className="grid" style={{ gap: 22 }}>
      {/* Event card hero */}
      <section className="event-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span className="badge ok badge-live" style={{ paddingLeft: 9 }}>EN COURS · LIVE</span>
          {!isSupabaseConfigured() && <span className="badge wait">Démo locale</span>}
        </div>
        <h1 className="hero-title gradient-text" style={{ marginBottom: 12 }}>
          Vote pour le plus beau<br/>bolide du rasso.
        </h1>
        <p className="lead" style={{ maxWidth: 640 }}>
          Scanne, entre ton pseudo RP, note chaque véhicule sur 5 critères. Les résultats tombent live.
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
          <Link className="button primary" to={pseudo ? '/vehicles' : '/login'}>
            {pseudo ? 'Continuer à voter' : 'Entrer mon pseudo'} <ArrowRight size={16} />
          </Link>
          <Link className="button" to="/results"><Trophy size={16} /> Classement live</Link>
          <Link className="button ghost" to="/qr"><QrCode size={16} /> QR de l'event</Link>
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
