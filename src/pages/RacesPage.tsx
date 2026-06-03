import { ArrowRight, Timer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/money';
import { getRacesPublicList, type PublicRaceListItem } from '../lib/repository';
import { usePolling } from '../lib/usePolling';

export default function RacesPage() {
  const [races, setRaces] = useState<PublicRaceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getRacesPublicList()
      .then((list) => { setRaces(list); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 10000);

  return (
    <section className="grid" style={{ gap: 22 }}>
      {/* En-tête éditorial */}
      <div className="page-header" style={{ padding: 0, background: 'transparent', border: 0 }}>
        <span className="badge ok badge-live" style={{ paddingLeft: 9 }}>PARIS LIVE</span>
        <h1 className="hero-title gradient-text" style={{ marginTop: 12 }}>
          Parie sur<br />les pilotes.
        </h1>
        <p className="lead">
          Choisis une course, mise sur un pilote. Tu payes l'organisateur en jeu, il valide ton
          ticket. Si ton pilote gagne, tu touches une part du pot des perdants.
        </p>
      </div>

      {loading && races.length === 0 && <p className="notice">Chargement des courses…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && races.length === 0 && !error && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <Timer size={28} style={{ color: 'var(--violet)', marginBottom: 8 }} />
          <h2 style={{ marginBottom: 8 }}>Aucune course ouverte</h2>
          <p className="muted" style={{ margin: 0 }}>
            Les paris ne sont pas ouverts pour l'instant. Reviens quand l'organisateur lance une course.
          </p>
        </div>
      )}

      <div className="grid" style={{ gap: 14 }}>
        {races.map((race) => (
          <Link
            key={race.id}
            to={`/races/${race.id}/bet`}
            className="race-card"
          >
            <div className="race-card-body">
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="badge ok badge-live" style={{ paddingLeft: 9, marginBottom: 10 }}>Paris ouverts</span>
                  <h2 className="race-card-name">{race.name}</h2>
                  {race.description && <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.9rem' }}>{race.description}</p>}
                </div>
                <span className="badge">{race.pilotsCount} pilote{race.pilotsCount > 1 ? 's' : ''}</span>
              </div>

              <div className="between" style={{ marginTop: 18, alignItems: 'flex-end' }}>
                <div>
                  <p className="section-eyebrow">Pot des paris payés</p>
                  <span className="money money-big">{formatMoney(race.pot)}</span>
                </div>
                <span className="button primary">
                  Parier <ArrowRight size={16} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
