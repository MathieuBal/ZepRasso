import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { getStoredPseudo, setStoredPseudo } from '../lib/localSession';
import { formatMoney } from '../lib/money';
import { getRacePublic, placePublicBet, type PublicRaceInfo } from '../lib/repository';
import { usePolling } from '../lib/usePolling';

export default function RaceBetPage() {
  const { raceId } = useParams();
  const [info, setInfo] = useState<PublicRaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pseudo, setPseudo] = useState(getStoredPseudo() || '');
  const [pilotId, setPilotId] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<null | { pilotPseudo: string; amount: number }>(null);

  const load = useCallback(() => {
    if (!raceId) return;
    getRacePublic(raceId)
      .then((data) => { setInfo(data); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [raceId]);

  useEffect(() => { load(); }, [load]);
  // Rafraîchissement doux des totaux par pilote pendant que la phase est ouverte.
  usePolling(load, 10000);

  if (loading) return <p className="notice">Chargement…</p>;
  if (error || !info) return <p className="error">{error || 'Course introuvable.'}</p>;

  const { race, pilots, totalsByPilot } = info;
  const totalPool = Object.values(totalsByPilot).reduce((s, v) => s + v, 0);

  // Bandeau d'état (ouvert / fermé / verrouillé / vainqueur déclaré)
  const stateBadge = race.bettingStatus === 'open'
    ? { cls: 'ok badge-live', text: 'PARIS OUVERTS' }
    : race.winnerPilotId
      ? { cls: 'closed', text: 'COURSE TERMINÉE' }
      : { cls: 'wait', text: 'PARIS FERMÉS' };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!raceId) return;
    setError(null);
    const trimmedPseudo = pseudo.trim();
    const amt = Math.floor(Number(amount) || 0);
    if (!trimmedPseudo) { setError('Donne ton pseudo.'); return; }
    if (!pilotId) { setError('Choisis un pilote.'); return; }
    if (!(amt > 0)) { setError('Indique une mise positive.'); return; }
    setSubmitting(true);
    try {
      const r = await placePublicBet(raceId, { bettorPseudo: trimmedPseudo, pilotId, amount: amt });
      setStoredPseudo(trimmedPseudo);
      const chosen = pilots.find((p) => p.id === r.pilotId);
      setSuccess({ pilotPseudo: chosen?.pseudo || '?', amount: r.amount });
      setPilotId('');
      setAmount('');
      load();
    } catch (err) {
      setError((err as Error).message || 'Impossible d\'enregistrer le pari.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid" style={{ gap: 22 }}>
      <PageHeader
        title={race.name}
        badge={stateBadge.text}
        badgeTone={stateBadge.cls.includes('ok') ? 'ok' : stateBadge.cls.includes('closed') ? 'closed' : 'wait'}
      >
        {race.description && <p className="lead">{race.description}</p>}
      </PageHeader>

      {/* Comment ça marche — sticky, visible dès l'ouverture pour rassurer */}
      <div className="panel" style={{ display: 'grid', gap: 6 }}>
        <p className="section-eyebrow">Comment ça marche</p>
        <p style={{ margin: 0 }}>
          1️⃣ Tu choisis un pilote et tu indiques ta mise.<br />
          2️⃣ Ton pari apparaît côté organisateur en <strong>« en attente de paiement »</strong>.<br />
          3️⃣ Tu vas voir l'organisateur, tu payes en jeu (cash ou virement) et il valide.<br />
          4️⃣ Si <strong>ton pilote gagne</strong>, tu récupères ta mise + une part du pot des perdants (au prorata de ta mise). L'organisateur prend {race.betOrgaCutPercent} %.
        </p>
      </div>

      {/* Pilotes + cotes */}
      <div className="panel" style={{ display: 'grid', gap: 10 }}>
        <p className="section-eyebrow">Pilotes en piste</p>
        {totalPool > 0 && (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Pot des paris payés : <strong>{formatMoney(totalPool)}</strong>.
          </p>
        )}
        <div className="grid" style={{ gap: 6 }}>
          {pilots.length === 0 && <p className="muted">Aucun pilote inscrit pour l'instant.</p>}
          {pilots.map((p) => {
            const stake = totalsByPilot[p.id] || 0;
            const share = totalPool > 0 ? Math.round((stake / totalPool) * 100) : 0;
            const isWinner = race.winnerPilotId === p.id;
            return (
              <div key={p.id} className="between" style={{ padding: '8px 10px', borderRadius: 6, background: isWinner ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)' }}>
                <div>
                  <strong>{p.pseudo}</strong>{isWinner && ' 🏆'}
                  {p.vehicle && <div className="muted" style={{ fontSize: '0.8rem' }}>{p.vehicle}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'monospace' }}>{formatMoney(stake)}</div>
                  {totalPool > 0 && <div className="muted" style={{ fontSize: '0.75rem' }}>{share}% du pot</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulaire de pari */}
      {race.bettingStatus === 'open' && pilots.length > 0 ? (
        success ? (
          <div className="panel grid">
            <span className="badge ok"><CheckCircle2 size={14} /> Pari enregistré</span>
            <h2 style={{ margin: '4px 0' }}>{formatMoney(success.amount)} sur {success.pilotPseudo}</h2>
            <p>Ton pari est <strong>en attente de paiement</strong>. Va voir l'organisateur pour payer (cash ou virement), il validera ton ticket. Tant qu'il n'est pas validé, il ne compte pas dans le pot.</p>
            <div className="actions">
              <button className="button" onClick={() => setSuccess(null)}>Parier à nouveau</button>
              <Link className="button ghost" to="/"><ArrowLeft size={14} /> Accueil</Link>
            </div>
          </div>
        ) : (
          <div className="panel grid">
            <p className="section-eyebrow">Placer un pari</p>
            <form className="form" onSubmit={handleSubmit}>
              <label className="field">
                <span className="label">Ton pseudo</span>
                <input className="input" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ex : Sandro_Vega" autoFocus />
              </label>
              <label className="field">
                <span className="label">Sur quel pilote ?</span>
                <select className="input" value={pilotId} onChange={(e) => setPilotId(e.target.value)}>
                  <option value="">— Choisis un pilote —</option>
                  {pilots.map((p) => <option key={p.id} value={p.id}>{p.pseudo}{p.vehicle ? ` · ${p.vehicle}` : ''}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Ta mise ($)</span>
                <input className="input" type="number" min="1" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex : 50000" />
              </label>
              {error && <p className="error">{error}</p>}
              <div className="actions">
                <button className="button primary" type="submit" disabled={submitting}>{submitting ? 'Envoi…' : 'Enregistrer mon pari'}</button>
                <Link className="button ghost" to="/">Annuler</Link>
              </div>
            </form>
          </div>
        )
      ) : (
        <div className="panel">
          <p className="notice" style={{ margin: 0 }}>
            {race.winnerPilotId
              ? 'La course est terminée. Les gains ont été distribués.'
              : race.bettingStatus === 'locked'
                ? 'Les paris sont verrouillés (course en train d\'être tranchée).'
                : 'Les paris ne sont pas ouverts pour le moment. Reviens quand l\'organisateur les ouvre.'}
          </p>
        </div>
      )}
    </section>
  );
}
